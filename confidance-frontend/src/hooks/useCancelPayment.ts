// hooks/useCancelPayment.ts
'use client';

import { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ABI minimal pour la fonction cancel()
const SCHEDULED_PAYMENT_ABI = [
  {
    name: 'cancel',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'cancellable',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'cancelled',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'released',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bool' }],
  },
] as const;

interface CancelPaymentParams {
  contractAddress: `0x${string}`;
  paymentId: string;
}

type CancelStatus = 'idle' | 'cancelling' | 'confirming' | 'updating-db' | 'success' | 'error';

interface UseCancelPaymentReturn {
  cancelPayment: (params: CancelPaymentParams) => Promise<void>;
  status: CancelStatus;
  error: Error | null;
  txHash: `0x${string}` | undefined;
  reset: () => void;
}

export function useCancelPayment(): UseCancelPaymentReturn {
  const [status, setStatus] = useState<CancelStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [currentPaymentId, setCurrentPaymentId] = useState<string | null>(null);

  const {
    writeContract,
    data: txHash,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: confirmError,
  } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const cancelPayment = async ({ contractAddress, paymentId }: CancelPaymentParams) => {
    try {
      setError(null);
      setCurrentPaymentId(paymentId);

      // Étape 1 : Appeler cancel() sur le smart contract
      setStatus('cancelling');
      console.log('🚫 Annulation du paiement:', contractAddress);

      writeContract({
        abi: SCHEDULED_PAYMENT_ABI,
        address: contractAddress,
        functionName: 'cancel',
      });

      // Attendre la confirmation de la transaction
      // (géré automatiquement par useWaitForTransactionReceipt)
      
    } catch (err) {
      console.error('❌ Erreur annulation:', err);
      setError(err as Error);
      setStatus('error');
    }
  };

  // Effet : Gérer la confirmation et la mise à jour de la DB
  const updateDatabaseStatus = async () => {
    if (isConfirmed && currentPaymentId) {
      try {
        setStatus('updating-db');
        console.log('📝 Mise à jour du statut dans la base de données...');

        const response = await fetch(`${API_URL}/api/payments/${currentPaymentId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'cancelled' }),
        });

        if (!response.ok) {
          throw new Error('Erreur lors de la mise à jour du statut');
        }

        const result = await response.json();
        console.log('✅ Statut mis à jour:', result);

        setStatus('success');
      } catch (err) {
        console.error('❌ Erreur mise à jour DB:', err);
        // Ne pas bloquer l'utilisateur si la DB fail, la transaction blockchain est OK
        setStatus('success');
      }
    }
  };

  // Déclencheur : Quand la transaction est confirmée
  if (isConfirming && status !== 'confirming') {
    setStatus('confirming');
  }

  if (isConfirmed && status === 'confirming') {
    updateDatabaseStatus();
  }

  // Gestion des erreurs
  if (writeError && status !== 'error') {
    setError(writeError);
    setStatus('error');
  }

  if (confirmError && status !== 'error') {
    setError(confirmError);
    setStatus('error');
  }

  const reset = () => {
    setStatus('idle');
    setError(null);
    setCurrentPaymentId(null);
    resetWrite();
  };

  return {
    cancelPayment,
    status,
    error,
    txHash,
    reset,
  };
}