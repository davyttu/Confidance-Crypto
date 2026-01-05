// hooks/useEmailTransaction.ts
'use client';

import { useState } from 'react';
import { Payment } from './useDashboard';
import { formatAmount } from '@/lib/utils/amountFormatter';
import { formatDateTime } from '@/lib/utils/dateFormatter';

interface UseEmailTransactionReturn {
  sendEmail: (payment: Payment, recipientEmail: string, recipientName?: string) => Promise<void>;
  isSending: boolean;
  error: Error | null;
  success: boolean;
}

export function useEmailTransaction(): UseEmailTransactionReturn {
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [success, setSuccess] = useState(false);

  const sendEmail = async (
    payment: Payment,
    recipientEmail: string,
    recipientName?: string
  ) => {
    try {
      setIsSending(true);
      setError(null);
      setSuccess(false);

      // Déterminer le type de paiement
      const getPaymentType = () => {
        if (payment.payment_type === 'recurring' || payment.is_recurring) {
          const totalMonths = payment.total_months;
          return totalMonths ? `Mensualisé (${totalMonths} échéance${totalMonths > 1 ? 's' : ''})` : 'Mensualisé';
        } else if (payment.payment_type === 'instant' || payment.is_instant) {
          return 'Instantané';
        } else {
          return 'Programmé';
        }
      };

      // Préparer les données
      const emailData = {
        recipientEmail,
        recipientName: recipientName || 'Cher utilisateur',
        senderAddress: payment.payer_address,
        beneficiaryAddress: payment.payee_address,
        beneficiaryName: undefined, // Sera rempli par le backend si disponible
        amount: formatAmount(payment.amount),
        tokenSymbol: payment.token_symbol,
        releaseDate: formatDateTime(payment.release_time),
        status: payment.status,
        contractAddress: payment.contract_address,
        transactionHash: payment.tx_hash || payment.transaction_hash,
        paymentType: getPaymentType(),
        cancellable: payment.cancellable,
      };

      // Appeler l'API
      const response = await fetch('/api/email/transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailData),
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          const errorText = await response.text();
          throw new Error(`Erreur HTTP ${response.status}: ${errorText || 'Erreur inconnue'}`);
        }
        
        const errorMessage = errorData.error || errorData.message || 'Erreur lors de l\'envoi de l\'email';
        const errorDetails = errorData.details ? ` (${errorData.details})` : '';
        throw new Error(`${errorMessage}${errorDetails}`);
      }

      const result = await response.json();
      console.log('✅ Email envoyé:', result);
      
      setSuccess(true);

      // Reset success après 3 secondes
      setTimeout(() => {
        setSuccess(false);
      }, 3000);

    } catch (err) {
      console.error('❌ Erreur sendEmail:', err);
      setError(err as Error);
    } finally {
      setIsSending(false);
    }
  };

  return {
    sendEmail,
    isSending,
    error,
    success,
  };
}
