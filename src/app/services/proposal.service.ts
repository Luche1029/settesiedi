// src/app/services/proposal.service.ts
import { Injectable } from '@angular/core';
import { supabase } from '../../../supabase/supabase.client';

export interface ProposalItemInput {
  name: string;
  notes?: string;
  quantity?: number;
  price_cents?: number;
}

export interface ProposalInput {
  proposalDate: string;   // "YYYY-MM-DD"
  title: string;
  notes?: string;
  items: ProposalItemInput[];
}

@Injectable({ providedIn: 'root' })
export class ProposalService {
 

// ➊ helper: trova o crea dish (serve RLS su 'dish', vedi §3)
private async ensureDishByName(name: string): Promise<string> {
  const trimmed = (name || '').trim();
  if (!trimmed) throw new Error('Nome piatto mancante');

  // prova a leggere (case-insensitive)
  const { data: found, error: selErr } = await supabase
    .from('dish')
    .select('id')
    .ilike('name', trimmed)
    .limit(1)
    .maybeSingle();
  if (selErr && selErr.code !== 'PGRST116') throw selErr;
  if (found?.id) return found.id as string;

  // crea se non esiste
  const { data: created, error: insErr } = await supabase
    .from('dish')
    .insert({ name: trimmed })
    .select('id')
    .single();
  if (insErr) throw insErr;
  return created!.id as string;
}

// ➋ crea proposta + righe
async createProposal(userId: string, payload: ProposalInput, status: string) {
  const normalized = status && status.trim() ? status.trim() : 'submitted'; // ← default corretto

  const { data: prop, error: e1 } = await supabase
    .from('proposal')
    .insert({
      user_id: userId,
      proposal_date: payload.proposalDate,
      title: payload.title, 
      notes: payload.notes ?? '',
      status: normalized
    })
    .select('id')
    .single();
  if (e1) throw e1;

  const proposalId = prop.id as string;

  // crea / collega i piatti
  for (const it of (payload.items || [])) {
    const dish_id = await this.ensureDishByName(it.name); // ← qui scatta il 401 se RLS non è a posto
    const row = {
      proposal_id: proposalId,
      dish_id,
      notes: it.notes ?? '',
      quantity: (it as any).quantity ?? 1,
      price_cents: (it as any).price_cents ?? null
    };
    const { error: e2 } = await supabase
      .from('proposal_dish')
      .upsert(row, { onConflict: 'proposal_id,dish_id' });
    if (e2) throw e2;
  }

  return { id: proposalId };
}

  // Aggiorna intestazione + sincronizza proposal_dish (rimuovi mancanti, upsert presenti)
  async updateDraft(proposalId: string, payload: ProposalInput) {
    const { error: e1 } = await supabase
      .from('proposal')
      .update({
        proposal_date: payload.proposalDate,
        notes: payload.notes ?? ''
      })
      .eq('id', proposalId);
    if (e1) throw e1;

    // set desiderato
    const desired: Array<{ dish_id: string; notes: string; quantity: number; price_cents: number | null; }> = [];
    for (const it of (payload.items || [])) {
      const dish_id = await this.ensureDishByName(it.name);
      desired.push({
        dish_id,
        notes: it.notes ?? '',
        quantity: it.quantity ?? 1,
        price_cents: it.price_cents ?? null
      });
    }

    // attuali
    const { data: current, error: curErr } = await supabase
      .from('proposal_dish')
      .select('dish_id')
      .eq('proposal_id', proposalId);
    if (curErr) throw curErr;

    const currentIds = new Set((current ?? []).map(r => r.dish_id as string));
    const desiredIds = new Set(desired.map(d => d.dish_id));

    // delete mancanti
    const toDelete = [...currentIds].filter(id => !desiredIds.has(id));
    if (toDelete.length) {
      const { error: delErr } = await supabase
        .from('proposal_dish')
        .delete()
        .eq('proposal_id', proposalId)
        .in('dish_id', toDelete);
      if (delErr) throw delErr;
    }

    // upsert presenti
    for (const d of desired) {
      const row = {
        proposal_id: proposalId,
        dish_id: d.dish_id,
        notes: d.notes,
        quantity: d.quantity,
        price_cents: d.price_cents
      };
      const { error: upErr } = await supabase
        .from('proposal_dish')
        .upsert(row, { onConflict: 'proposal_id,dish_id' });
      if (upErr) throw upErr;
    }

    return true;
  }

  // Dettaglio proposta + piatti
  async getWithItems(proposalId: string) {
    const { data, error } = await supabase
      .from('proposal')
      .select(`
        id,
        user_id,
        proposal_date,
        notes,
        status,
        proposal_dish (
          dish_id,
          quantity,
          price_cents,
          notes,
          dish:dish_id ( id, name )
        )
      `)
      .eq('id', proposalId)
      .single();
    if (error) throw error;
    return data;
  }

  // Lista tutte (filtrabile per stato) + contatori voti
  async listAll(currentUserId: string, status?: string) {
    let q = supabase
      .from('proposal')
      .select(`
        id,
        user_id,
        proposal_date,
        notes,
        status,
        created_at,
        generated_event_id,
        app_user:user_id ( id, display_name ),
        proposal_dish (
          quantity,
          price_cents,
          notes,
          dish:dish_id ( id, name )
        ),
        proposal_vote ( user_id, value )
      `)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') q = q.eq('status', status);

    const { data, error } = await q;
    if (error) throw error;

    return (data ?? []).map((r: any) => {
      const votes = r.proposal_vote ?? [];
      const votesUp = votes.filter((v: any) => v.value === 1).length;
      const votesDown = votes.filter((v: any) => v.value === -1).length;
      const myVote = votes.find((v: any) => v.user_id === currentUserId)?.value ?? 0;
      return {
        ...r,
        itemsCount: r.proposal_dish?.length ?? 0,
        proposerName: r.app_user?.display_name ?? '—',
        votesUp,
        votesDown,
        myVote
      };
    });
  }

  async listForReview(includeDraft = false) {
  let q = supabase
    .from('proposal')
    .select(`
      id,
      user_id,
      proposal_date,
      notes,
      status,
      created_at,
      app_user:user_id ( id, display_name ),
      proposal_dish (
        quantity,
        notes,
        dish:dish_id ( id, name )
      )
    `)
    .order('created_at', { ascending: false });

  if (includeDraft) {
    q = q.in('status', ['submitted', 'draft']);
  } else {
    q = q.eq('status', 'submitted');
  }

  const { data, error } = await q;
  if (error) throw error;

  return (data ?? []).map((r: any) => ({
    ...r,
    itemsCount: r.proposal_dish?.length ?? 0,
    proposerName: r.app_user?.display_name ?? '—'
  }));
}

  // Stato → submitted
  async submit(proposalId: string) {
    const { error } = await supabase
      .from('proposal')
      .update({ status: 'submitted' })
      .eq('id', proposalId);
    if (error) throw error;
    return true;
  }

  // Elimina proposta (cascade rimuove proposal_dish)
  async remove(id: string) {
    const { error } = await supabase.from('proposal').delete().eq('id', id);
    if (error) throw error;
    return true;
  }

  // Duplica proposta + righe (riusa gli stessi dish_id)
  async duplicate(id: string, userId: string) {
    // intestazione
    const { data: prop, error: e1 } = await supabase
      .from('proposal')
      .select('id, notes, proposal_date')
      .eq('id', id)
      .single();
    if (e1) throw e1;

    const { data: newProp, error: e2 } = await supabase
      .from('proposal')
      .insert({
        user_id: userId,
        proposal_date: prop.proposal_date,
        notes: (prop.notes ?? '') + ' (copia)',
        status: 'draft'
      })
      .select('id')
      .single();
    if (e2) throw e2;

    // righe
    const { data: rows, error: e3 } = await supabase
      .from('proposal_dish')
      .select('dish_id, quantity, price_cents, notes')
      .eq('proposal_id', id);
    if (e3) throw e3;

    if (rows?.length) {
      const toInsert = rows.map((r: any) => ({
        proposal_id: newProp.id,
        dish_id: r.dish_id,
        quantity: r.quantity ?? 1,
        price_cents: r.price_cents ?? null,
        notes: r.notes ?? ''
      }));
      const { error: e4 } = await supabase.from('proposal_dish').insert(toInsert);
      if (e4) throw e4;
    }

    return newProp;
  }

  // Like/Dislike (toggle)
  async castVote(proposalId: string, userId: string, value: 1 | -1, toggleOff: boolean) {
    if (toggleOff) {
      const { error } = await supabase
        .from('proposal_vote')
        .delete()
        .match({ proposal_id: proposalId, user_id: userId });
      if (error) throw error;
      return;
    }
    const { error } = await supabase
      .from('proposal_vote')
      .upsert(
        { proposal_id: proposalId, user_id: userId, value },
        { onConflict: 'proposal_id,user_id' }
      );
    if (error) throw error;
  }

  // Conferma proposta → crea event e lega i dish (RPC lato DB)
  async confirm(proposalId: string) {
    const { data, error } = await supabase.rpc('confirm_proposal', { p_proposal_id: proposalId });
    if (error) throw error;
    return data as string; // event_id
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

  /** Approva la proposta. **/
  async approve(proposalId: string, eventDate?: string | null): Promise<string | null> {
    const date = eventDate && eventDate.trim() ? eventDate : null;

    const { data, error } = await supabase.rpc('approve_proposal', {
      p_proposal: proposalId,
      p_event_date: date
    });

    if (error) {
      // fallback: marca almeno approved
      const { error: e2 } = await supabase
        .from('proposal')
        .update({ status: 'approved' })
        .eq('id', proposalId);
      if (e2) throw e2;
      return null;
    }
    return data as string; // event_id
  }



}
