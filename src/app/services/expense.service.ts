// src/app/services/expense.service.ts
import { Injectable } from '@angular/core';
import { supabase } from '../supabase.client';

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  async listByEvent(eventId: string) {
    // expenses + payer + shares
    const { data, error } = await supabase
      .from('expense')
      .select('id, user_id, amount, currency, description, created_at, app_user:user_id(display_name), expense_share(user_id, share_amount, app_user:user_id(display_name))')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    return (data||[]).map((e:any)=>({
      ...e,
      payer_name: e.app_user?.display_name ?? '—',
      shares: (e.expense_share||[]).map((s:any)=>({
        user_id: s.user_id,
        amount: Number(s.share_amount||0),
        name: s.app_user?.display_name ?? '—'
      }))
    }));
  }

  async addEqualSplit(eventId: string, payerId: string, amount: number, description: string) {
    // prendi i partecipanti "going"
    const { data: going, error: e1 } = await supabase
      .from('reservation')
      .select('user_id')
      .eq('event_id', eventId)
      .eq('status', 'going');
    if (e1) throw e1;
    const users = (going||[]).map(r=>r.user_id);
    if (users.length === 0) throw new Error('Nessun partecipante going');

    // crea expense
    const { data: exp, error: e2 } = await supabase
      .from('expense')
      .insert({ event_id: eventId, user_id: payerId, amount, currency: 'EUR', description, split_mode: 'equal' })
      .select()
      .single();
    if (e2) throw e2;

    const perHead = Math.round((amount / users.length) * 100) / 100;

    // shares
    const rows = users.map(uid => ({
      expense_id: exp.id, user_id: uid, share_amount: perHead
    }));
    const { error: e3 } = await supabase.from('expense_share').insert(rows);
    if (e3) throw e3;

    return exp.id;
  }
}
