import { Injectable } from '@angular/core';
import { supabase } from '../../../supabase/supabase.client';

function slug(s: string) {
  return s.normalize('NFKD').replace(/[^\w\s.-]/g, '').trim().replace(/\s+/g, '-').toLowerCase();
}

@Injectable({ providedIn: 'root' })
export class ExpensesService {

  private normDate(d: string | null | undefined) {    return d && d.trim() ? d : null;
  }

  // LISTA (usa la view v_expense_list)
  async list(from?: string, to?: string) {
    let q = supabase.from('v_expense_list')
      .select('*')
      .order('expense_date', { ascending: false });
    if (from) q = q.gte('expense_date', from);
    if (to)   q = q.lte('expense_date', to);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  // CREATE
  async create(payload: {
    user_id: string;
    amount: number;
    description?: string | null;
    expense_date?: string | null;
    notes?: string | null;
    include_payer: boolean;
  }) {
    const body: any = {
      user_id: payload.user_id,
      amount: payload.amount,
    };
    if (payload.description) body.description = payload.description;
    if (payload.expense_date) body.expense_date = payload.expense_date; // opzionale: DB ha default
    if (payload.notes) body.notes = payload.notes;

    const { data, error } = await supabase
      .from('expense')
      .insert(body)
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error', error); // <-- importantissimo per capire subito
      throw error;
    }
    return data;
  }

  async createWithParticipants(payload: {
    user_id: string;
    amount: number;
    description?: string | null;
    expense_date?: string | null;   // 'YYYY-MM-DD'
    notes?: string | null;
    include_payer: boolean;
    participants: string[];         // array di user_id aggiunti dal creatore
  }) {
    const { data, error } = await supabase.rpc('create_expense_with_participants', {
      p_user_id: payload.user_id,
      p_amount: payload.amount,
      p_description: payload.description ?? null,
      p_expense_date: payload.expense_date ?? null,
      p_notes: payload.notes ?? null,
      p_include_payer: payload.include_payer,
      p_participants: payload.participants ?? []
    });
    if (error) throw error;
    return data;
  }


  // DETTAGLIO
  async get(id: string) {
    const { data, error } = await supabase
      .from('v_expense_list')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  }

  // JOIN / LEAVE (opt-in)
  async join(expenseId: string, userId: string) {
    const { error } = await supabase
      .from('expense_participant')
      .insert({ expense_id: expenseId, user_id: userId });
    if (error) throw error;
    return true;
  }
  async leave(expenseId: string, userId: string) {
    const { error } = await supabase
      .from('expense_participant')
      .delete()
      .eq('expense_id', expenseId)
      .eq('user_id', userId);
    if (error) throw error;
    return true;
  }

  // STATO
  async setStatus(expenseId: string, status: 'open'|'locked'|'void') {
    const { error } = await supabase
      .from('expense')
      .update({ status })
      .eq('id', expenseId);
    if (error) throw error;
    return true;
  }

  // TOTALI / BILANCI (RPC)
  async total(from: string|null, to: string|null) {
    const { data, error } = await supabase.rpc('total_expenses', { p_from: from, p_to: to });
    if (error) throw error;
    return Number(data || 0);
  }

  async totalsByPayer(from: string|null, to: string|null) {
    const { data, error } = await supabase.rpc('total_expenses_by_payer', { p_from: from, p_to: to });
    if (error) throw error;
    return data || [];
  }

  async nets(from: string|null, to: string|null) {
    const { data, error } = await supabase.rpc('expense_nets', {
      p_from: this.normDate(from),
      p_to:   this.normDate(to)
    });
    if (error) throw error;
    return data || [];
  }

  async settlements(from: string|null, to: string|null) {
    const { data, error } = await supabase.rpc('expense_settlements', {
      p_from: this.normDate(from),
      p_to:   this.normDate(to)
    });
    if (error) throw error;
    return data || [];
  }

  async uploadReceipts(expenseId: string, files: File[], userId: string) {
    const bucket = supabase.storage.from('receipts');
    for (const f of files) {
      const path = `${expenseId}/${Date.now()}-${slug(f.name || 'scontrino')}`;
      const { error: upErr } = await bucket.upload(path, f, {
        contentType: f.type || 'image/jpeg',
        upsert: false
      });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from('expense_attachment').insert({
        expense_id: expenseId,
        file_path: path,
        content_type: f.type || null,
        uploaded_by: userId
      });
      if (insErr) throw insErr;
    }
    return true;
  }
  
  async listReceipts(expenseId: string) {
    const { data, error } = await supabase
      .from('expense_attachment')
      .select('id, file_path, content_type, created_at, uploaded_by')
      .eq('expense_id', expenseId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const bucket = supabase.storage.from('receipts');
    const rows = await Promise.all((data || []).map(async (r: any) => {
      const { data: signed } = await bucket.createSignedUrl(r.file_path, 60 * 10); // 10 min
      return { ...r, url: signed?.signedUrl || null };
    }));
    return rows;
  }

  // ExpensesService
  async payoutsPairs(from_user_id: string, from?: string|null, to?: string|null) {
    let q = supabase
      .from('payout')
      .select('to_user_id, amount_cents, status, created_at')
      .eq('from_user_id', from_user_id)
      .eq('status', 'paid'); // usa solo payout riusciti

    if (from) q = q.gte('created_at', from);
    if (to)   q = q.lt('created_at', to + 'T23:59:59.999Z');

    const { data, error } = await q;
    if (error) throw error;

    // mappa: to_user_id -> totale € già pagato
    const map = new Map<string, number>();
    for (const r of (data ?? [])) {
      const eur = (r.amount_cents ?? 0) / 100;
      map.set(r.to_user_id, (map.get(r.to_user_id) ?? 0) + eur);
    }
    return map;
  }

  /** Balances (per utente) dalla view */
  async userBalances() {
    const { data, error } = await supabase
      .from('v_user_balances')     // 👈 nuova view
      .select('*')
      .order('net', { ascending: false })
      .order('display_name', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /** Settlements netti dalla view (debtor -> creditor) */
  async settlementsNet() {
    const { data, error } = await supabase
      .from('v_expense_settlements_net')  // 👈 nuova view coppie
      .select('*')
      .order('from_name', { ascending: true })
      .order('to_name', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  // src/app/services/expenses.service.ts
  async settlementsMin() {
    const { data, error } = await supabase
      .from('v_expense_settlements_min')   // debtor → creditor, lista minima
      .select('*')
      .order('from_name', { ascending: true })
      .order('to_name',   { ascending: true });
    if (error) throw error;
    return data || [];
  }

}
