// src/lib/supabase/types.ts
export type Currency = 'ETH' | 'USDC' | 'USDT' | 'WBTC';

export type PaymentStatus = 'pending' | 'executed' | 'failed' | 'cancelled';

export interface ScheduledPayment {
  id: string;
  contract_address: string;
  payer: string;
  payee: string;
  currency: Currency;
  token_address: string | null;
  amount: string;
  amount_decimals: number;
  release_time: number;
  status: PaymentStatus;
  tx_hash: string | null;
  execution_tx_hash: string | null;
  executed_at: string | null;
  created_at: string;
  updated_at: string;
  chain_id: number;
}

export interface UserPreferences {
  id: string;
  wallet_address: string;
  email: string | null;
  notify_payment_created: boolean;
  notify_payment_reminder: boolean;
  notify_payment_executed: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmailNotification {
  id: string;
  payment_id: string;
  email: string;
  type: 'payment_created' | 'payment_reminder' | 'payment_executed' | 'payment_failed';
  sent_at: string;
  status: 'sent' | 'failed';
}