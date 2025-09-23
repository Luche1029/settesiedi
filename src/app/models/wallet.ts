export type WalletTxType = 'topup'|'withdraw'|'payout_out'|'payout_in'|'adjustment';

export interface WalletAccount {
  user_id: string;
  balance_cents: number;
  currency: string;    // 'EUR'
  updated_at: string;
}

export interface WalletTx {
  id: string;
  user_id: string;
  type: WalletTxType;
  amount_cents: number;
  affects_balance: boolean;
  provider?: string | null;
  provider_ref?: string | null;
  payment_id?: string | null;
  payout_id?: string | null;
  related_user_id?: string | null;
  note?: string | null;
  balance_after_cents: number;
  created_at: string;
}

export interface Payout {
  id: string;
  from_user_id: string;
  to_user_id?: string | null;
  to_paypal_email: string;
  amount_cents: number;
  currency: string;
  status: 'processing'|'success'|'unclaimed'|'returned'|'failed';
  paypal_batch_id?: string | null;
  paypal_item_id?: string | null;
  paypal_txn_id?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  tx_out_id?: string | null;
  tx_in_id?: string | null;
  created_at: string;
  updated_at: string;
}
