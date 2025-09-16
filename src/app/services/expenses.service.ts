import { Injectable } from '@angular/core';
import { supabase } from '../supabase.client';

@Injectable({ providedIn: 'root' })
export class ExpensesService {

  private normDate(d: string | null | undefined) {
    return d && d.trim() ? d : null;
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
}
