import { useState, useEffect } from 'react';
import { supabase } from '@/lib/Supabase/client';

export interface Transaction {
  id: string;
  amount: string;
  currency: string;
  date: string;
  recipient: string;
  tx_hash: string;
}

export const useFetchTransactions = (userAddress: string | undefined) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!userAddress) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('scheduled_payments')
          .select('id, amount, currency, release_time, payee, tx_hash')
          .or(`payer.eq.${userAddress.toLowerCase()},payee.eq.${userAddress.toLowerCase()}`)
          .order('release_time', { ascending: false });

        if (error) {
          throw error;
        }

        const formattedTransactions: Transaction[] = data.map((tx: any) => ({
          id: tx.id,
          amount: (tx.amount / 10 ** 18).toFixed(6), // Assuming 18 decimals
          currency: tx.currency,
          date: new Date(tx.release_time).toLocaleDateString(),
          recipient: tx.payee,
          tx_hash: tx.tx_hash,
        }));

        setTransactions(formattedTransactions);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [userAddress]);

  return { transactions, loading, error };
};
