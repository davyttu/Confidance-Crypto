// hooks/usePaymentTransactions.ts
'use client';

import { useEffect, useMemo, useState } from 'react';

export interface PaymentTransaction {
  id: string;
  scheduled_payment_id: string;
  user_id: string | null;
  chain_id: number;
  tx_hash: string;
  tx_type: 'approve' | 'create' | 'execute';
  token_address: string | null;
  gas_used: string;
  gas_price: string;
  gas_cost_native: string;
  gas_cost_usd: number;
  created_at: string;
  user_address: string;
}

interface UsePaymentTransactionsResult {
  transactions: PaymentTransaction[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function usePaymentTransactions(userAddresses?: string | string[]): UsePaymentTransactionsResult {
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const addressList = useMemo(() => {
    if (!userAddresses) return [];
    if (Array.isArray(userAddresses)) {
      return userAddresses.filter(Boolean);
    }
    return [userAddresses];
  }, [userAddresses]);

  const fetchTransactions = async () => {
    if (addressList.length === 0) {
      setTransactions([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const responses = await Promise.allSettled(
        addressList.map(async (addr) => {
          const response = await fetch(
            `${API_URL}/api/payment-transactions?user_address=${encodeURIComponent(addr)}`
          );
          if (!response.ok) {
            throw new Error(`Erreur lors du chargement des transactions (${response.status})`);
          }
          return response.json();
        })
      );

      const merged = responses.flatMap((result) => {
        if (result.status !== 'fulfilled') {
          console.warn('⚠️ Payment transactions fetch failed:', result.reason);
          return [];
        }
        return result.value?.transactions || [];
      });
      const deduped = new Map<string, PaymentTransaction>();
      merged.forEach((tx: PaymentTransaction) => {
        const key = tx.tx_hash || tx.id;
        if (!deduped.has(key)) {
          deduped.set(key, tx);
        }
      });
      setTransactions(Array.from(deduped.values()));
    } catch (err) {
      console.error('Erreur usePaymentTransactions:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [addressList.join('|')]);

  return {
    transactions,
    isLoading,
    error,
    refetch: fetchTransactions,
  };
}
