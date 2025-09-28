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

   /** Elenco payout ricevuti (dove io sono to_user_id) */
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
        amount_cents: (Number(r.amount_cents || 0) / 100),
        currency: r.currency ?? 'EUR',
        status: String(r.status || 'PROCESSING')
      }));
  }

  /**
   * Conferma manuale: imposta status=SUCCESS per un payout ricevuto.
   * Preferibile via RPC con SECURITY DEFINER (es. confirm_payout(p_payout_id uuid)).
   * Qui prima tentiamo la RPC; se non esiste/permessi, fallback update diretto.
   */
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
}
