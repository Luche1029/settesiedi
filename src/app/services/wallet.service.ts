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
  async payout(
      from_user_id: string,
      to_user_id: string,
      amount_cents: number,
      note?: string,
      to_paypal_email?: string
    ): Promise<PayoutResponse> {
      const body = { from_user_id, to_user_id, amount_cents, note, to_paypal_email };
      // debug utile:
      console.log('payout →', body);

      const { data, error } = await supabase.functions.invoke('payments-paypal-create', { body });
      if (error) {
        console.error('payout error', error);
        // supabase.functions error ha spesso .message o .context
        throw new Error((error as any)?.message || 'Errore payout');
      }
      return (data ?? {}) as PayoutResponse;
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
}
