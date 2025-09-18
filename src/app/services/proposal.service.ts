// src/app/services/proposal.service.ts
import { Injectable } from '@angular/core';
import { supabase } from '../../../supabase/supabase.client';

export interface ProposalItemInput { name: string; notes?: string; }
export interface ProposalInput {
  proposalDate: string;  // "YYYY-MM-DD"
  notes?: string;
  items: ProposalItemInput[];
}


@Injectable({ providedIn: 'root' })
export class ProposalService {

  async createDraft(userId: string, payload: ProposalInput) {
    const { data: prop, error: e1 } = await supabase
      .from('proposal')
      .insert({
        user_id: userId,
        proposal_date: payload.proposalDate,
        notes: payload.notes ?? '',
        status: 'draft'
      })
      .select()
      .single();
    if (e1) throw e1;

    if (payload.items?.length) {
      const rows = payload.items.map(it => ({
        proposal_id: prop.id, name: it.name, notes: it.notes ?? ''
      }));
      const { error: e2 } = await supabase.from('proposal_item').insert(rows);
      if (e2) throw e2;
    }
    return prop;
  }

  async updateDraft(proposalId: string, payload: ProposalInput) {
    const { error: e1 } = await supabase
      .from('proposal')
      .update({
        proposal_date: payload.proposalDate,
        notes: payload.notes ?? ''
      })
      .eq('id', proposalId);
    if (e1) throw e1;

    const { error: eDel } = await supabase.from('proposal_item').delete().eq('proposal_id', proposalId);
    if (eDel) throw eDel;

    if (payload.items?.length) {
      const rows = payload.items.map(it => ({
        proposal_id: proposalId, name: it.name, notes: it.notes ?? ''
      }));
      const { error: e2 } = await supabase.from('proposal_item').insert(rows);
      if (e2) throw e2;
    }
    return true;
  }

  async getWithItems(proposalId: string) {
    const { data: prop, error } = await supabase
      .from('proposal')
      .select('id, user_id, proposal_date, notes, status, proposal_item(id, name, notes)')
      .eq('id', proposalId)
      .single();
    if (error) throw error;
    return prop;
  }

  async listMine(userId: string, status?: string) {
    let q = supabase
      .from('proposal')
      .select('id, proposal_date, notes, status, created_at, app_user:user_id(display_name), proposal_item(count)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map((r: any) => ({
      ...r,
      itemsCount: r.proposal_item?.[0]?.count ?? 0,
      proposerName: r.app_user?.display_name ?? '—'
    }));
  }

  async submit(proposalId: string) {
    const { error } = await supabase.from('proposal').update({ status: 'submitted' }).eq('id', proposalId);
    if (error) throw error;
    return true;
  }

  async remove(id: string) {
    const { error } = await supabase.from('proposal').delete().eq('id', id);
    if (error) throw error;
    return true;
  }

  async duplicate(id: string, userId: string) {
    // prendi proposta + items
    const { data: prop, error } = await supabase
      .from('proposal')
      .select('id, title, notes, proposal_item(id,name,notes)')
      .eq('id', id).single();
    if (error) throw error;

    // crea nuova bozza con sufisso “(copia)”
    const { data: newProp, error: e2 } = await supabase
      .from('proposal')
      .insert({ user_id: userId, title: `${prop.title} (copia)`, notes: prop.notes ?? '', status: 'draft' })
      .select().single();
    if (e2) throw e2;

    // copia items
    const rows = (prop.proposal_item || []).map((it: any) => ({
      proposal_id: newProp.id, name: it.name, notes: it.notes ?? ''
    }));
    if (rows.length) {
      const { error: e3 } = await supabase.from('proposal_item').insert(rows);
      if (e3) throw e3;
    }
    return newProp;
  }

   /** Proposte da revisionare: default solo 'submitted' (e opz. 'draft' se vuoi) */
  async listForReview(includeDraft = false) {
    let q = supabase
      .from('proposal')
      .select('id, user_id, proposal_date, notes, status, created_at, app_user:user_id(display_name), proposal_item(count)')
      .order('created_at', { ascending: false });

    if (includeDraft) {
      q = q.in('status', ['submitted','draft']);
    } else {
      q = q.eq('status', 'submitted');
    }

    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map((r: any) => ({
      ...r,
      itemsCount: r.proposal_item?.[0]?.count ?? 0,
      proposerName: r.app_user?.display_name ?? '—'
    }));
  }

  /** Approva la proposta e crea l'evento (RPC) */
  async approve(proposalId: string, eventDate: string, creatorId?: string): Promise<string> {
    const { data, error } = await supabase.rpc('approve_proposal', {
      p_proposal: proposalId,
      p_event_date: eventDate,
      p_creator: creatorId ?? null
    });
    if (error) throw error;
    return data as string; // event id
  }

  /** Rifiuta la proposta */
  async reject(proposalId: string) {
    const { error } = await supabase
      .from('proposal')
      .update({ status: 'rejected' })
      .eq('id', proposalId);
    if (error) throw error;
    return true;
  }
}
