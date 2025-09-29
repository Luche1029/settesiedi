import { Injectable } from '@angular/core';
import { supabase } from '../../../supabase/supabase.client';
import { WalletAccount, WalletTx } from '../models/wallet';

export interface PayoutResponse {
  ok: boolean;
  batch_id?: string;         // id batch PayPal (se usi Payouts)
  item_id?: string;          // id item
  provider_status?: string;  // es. SUCCESS/PENDING
  message?: string;
}

export type PayoutRow = {
  id: string;
  from_user_id: string | null;
  from_user_name: string | null;
  amount_cents: number;
  currency: string;
  status: 'PROCESSING'|'PENDING'|'UNCLAIMED'|'SUCCESS'|'FAILED'|string;
};

export type ReceivableRow = {
  from_user: string;     // debitore (id)
  from_name: string;     // debitore (display)
  to_user:   string;     // creditore (id)
  to_name:   string;     // creditore (display)
  amount:    number;     // € (numero, 2 decimali)
};


@Injectable({ providedIn: 'root' })
export class WalletService {

  async getAccount(userId: string): Promise<WalletAccount | null> {
    const { data, error } = await supabase
      .from('wallet_account')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data as WalletAccount | null;
  }

  async getLastTx(userId: string, limit = 50): Promise<WalletTx[]> {
    const { data, error } = await supabase
      .from('wallet_tx')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as WalletTx[];
  }

  // Edge Function di payout (es. 'payments-paypal-payout')
  async payout(params: {
    from_user_id: string;
    to_user_id?: string;        // o email
    to_paypal_email?: string;   // opzionale: se non c'è user_id
    amount_cents: number;
    note?: string;
  }) {
    console.log('payout →', params); // debug
    const { data, error } = await supabase.functions.invoke('payments-paypal-payout', {
      body: params
    });
    if (error) throw error;
    return data;
  }

  /** saldo corrente del wallet in centesimi */
  async getBalanceCents(userId: string): Promise<number> {
    const acc = await this.getAccount(userId);
    return acc?.balance_cents ?? 0;
  }

  /** quanto resta da pagare (dovuto − wallet), minimo 0.
   * NB: qui dovuto lo devi già avere dal tuo servizio/spesa */
  async getRemainingDueCents(userId: string, dueCents: number): Promise<number> {
    const wallet = await this.getBalanceCents(userId);
    return Math.max(0, dueCents - wallet);
  }

  async getBalancesMap(userIds: string[]): Promise<Map<string, number>> {
    const ids = Array.from(new Set(userIds.filter(Boolean)));
    if (!ids.length) return new Map();

    const { data, error } = await supabase
      .from('wallet_account')
      .select('user_id,balance_cents')
      .in('user_id', ids);

    if (error) throw error;
    // ritorno in EURO per comodità
    return new Map((data ?? []).map(r => [r.user_id as string, (r.balance_cents ?? 0) / 100]));
  }

   /**
   * Ritorna l’elenco di chi ti deve dei soldi (righe dove sei to_user).
   */
  async listForUser(userId: string): Promise<ReceivableRow[]> {
    // 1. prendo tutti i "da ricevere" teorici
    const { data: settlements, error: sErr } = await supabase
      .from('v_expense_settlements_min')
      .select('from_user, from_name, to_user, to_name, amount')
      .eq('to_user', userId);

    if (sErr) throw sErr;

    // 2. prendo tutti i payout già registrati verso questo user
    const { data: payouts, error: pErr } = await supabase
      .from('payout')
      .select('from_user_id, to_user_id, amount_cents, status')
      .eq('to_user_id', userId);

    if (pErr) throw pErr;

    // 3. filtro quelli già coperti da payout
    const filtered = (settlements ?? []).filter(s => {
      const paid = (payouts ?? []).some(p =>
        p.from_user_id === s.from_user &&
        p.to_user_id === s.to_user &&
        Math.abs(p.amount_cents / 100 - s.amount) < 0.01
      );
      return !paid;
    });

    return filtered as ReceivableRow[];
  }


  /**
   * (Opzionale) Ritorna anche il totale da ricevere.
   */
  async totalForUser(userId: string): Promise<number> {
    const rows = await this.listForUser(userId);
    return rows.reduce((s, r) => s + Number(r.amount || 0), 0);
  }

  async listReceivedPayouts(to_user_id: string): Promise<PayoutRow[]> {
    const { data, error } = await supabase
      .from('payout')
      .select(`
        id,
        from_user_id,
        to_user_id,
        amount_cents,
        status,
        created_at,
        currency,
        from_user:from_user_id ( display_name )
      `)
      .eq('to_user_id', to_user_id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map((r: any) => ({
      id: r.id,
      from_user_id: r.from_user_id,
      from_user_name: r.from_user?.display_name ?? '—',
      amount_cents: r.amount_cents,
      currency: r.currency ?? 'EUR',
      status: String(r.status || 'PROCESSING')
    }));
  }

  /**
   * Conferma manuale: imposta status=SUCCESS per un payout ricevuto.
   * Preferibile via RPC con SECURITY DEFINER (es. confirm_payout(p_payout_id uuid)).
   * Qui prima tentiamo la RPC; se non esiste/permessi, fallback update diretto.
 
  async confirmPayout(payoutId: string) {
    // 1) prova RPC se esiste
    const rpc = await supabase.rpc('confirm_payout', { p_payout_id: payoutId });
    if (!rpc.error) return true;

    // 2) fallback: update diretto (richiede policy RLS adeguata!)
    const { error } = await supabase
      .from('payout')
      .update({ status: 'SUCCESS' })
      .eq('id', payoutId);
    if (error) throw error;
    return true;
  }
*/

  async markDebtAsPaid(from_user_id: string, to_user_id: string, amount_eur: number, note?:string) {
    const body = { from_user_id, to_user_id, amount_eur, note };
    console.log(JSON.stringify(body));
    const { data, error } = await supabase.functions.invoke('payments-mark-paid', {
      body
    });
    if (error) throw error;
    return data;
  }

  async confirmPayout(payout_id: string, actor_user_id: string) {
    const { data, error } = await supabase.functions.invoke('payments-confirm-payout', {
      body: { payout_id, actor_user_id }
    });
    if (error) throw error;
    return data;
  }

  async getOutgoingPayoutsByCreditor(from_user_id: string): Promise<Record<string, number>> {
    // prendo i payout non-cancellati/falliti che contano come “già pagati”
    const { data, error } = await supabase
      .from('payout')
      .select('to_user_id, amount_cents, status')
      .eq('from_user_id', from_user_id)
      .in('status', ['PROCESSING','PENDING','SUCCESS','COMPLETED']); // includi qui gli status “attivi/buoni”

    if (error) throw error;

    const map: Record<string, number> = {};
    for (const r of (data ?? [])) {
      const to = String(r.to_user_id);
      map[to] = (map[to] ?? 0) + Number(r.amount_cents || 0);
    }
    return map; // in centesimi
  }


}
