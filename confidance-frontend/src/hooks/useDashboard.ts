// hooks/useDashboard.ts
'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// 🆕 Interface pour les bénéficiaires batch
export interface BatchBeneficiary {
  address: string;
  amount: string;
  name?: string;
}

export interface Payment {
  id: string;
  contract_address: string;
  payer_address: string;
  payee_address: string;
  token_symbol: string;
  token_address: string | null;
  amount: string;
  release_time: number;
  created_at: string;
  released_at: string | null;
  status: 'pending' | 'active' | 'released' | 'cancelled' | 'failed' | 'completed';
  cancellable: boolean;
  transaction_hash: string | null;
  tx_hash: string | null;
  network: string;
  payment_label?: string | null;
  payment_category?: string | null;
  payment_categorie?: string | null;
  label?: string | null;
  category?: string | null;
  
  // 🆕 Nouvelles propriétés pour les colonnes COUNT et TYPE
  is_batch: boolean;
  batch_count: number | null;
  batch_beneficiaries: BatchBeneficiary[] | null;
  payment_type: 'instant' | 'scheduled' | 'recurring';
  is_instant: boolean;
  
  // 🆕 Propriétés pour les paiements récurrents
  total_months?: number | null;
  monthly_amount?: string | null;
  first_month_amount?: string | null;
  is_first_month_custom?: boolean | null;
  executed_months?: number | null;
  first_payment_time?: number | null;
  next_execution_time?: number | null;
  is_recurring?: boolean;
  last_execution_hash?: string | null;
}

interface UseDashboardReturn {
  payments: Payment[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useDashboard(): UseDashboardReturn {
  const { address } = useAccount();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPayments = async () => {
    if (!address) {
      setPayments([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${API_URL}/api/payments/${address}`);
      
      if (!response.ok) {
        throw new Error('Erreur lors du chargement des paiements');
      }

      const data = await response.json();
      setPayments(data.payments || []);
    } catch (err) {
      console.error('Erreur useDashboard:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [address]);

  return {
    payments,
    isLoading,
    error,
    refetch: fetchPayments,
  };
}