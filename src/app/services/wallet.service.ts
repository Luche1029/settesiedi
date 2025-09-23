import { Injectable } from '@angular/core';
import { supabase } from '../../../supabase/supabase.client';
import { WalletAccount, WalletTx } from '../models/wallet';

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
  async payout(from_user_id: string, to_paypal_email: string, amount_cents: number, note?: string, to_user_id?: string) {
    const { data, error } = await supabase.functions.invoke('payments-paypal-payout', {
      body: { from_user_id, to_paypal_email, to_user_id, amount_cents, note }
    });
    if (error) throw error;
    return data;
  }
}
