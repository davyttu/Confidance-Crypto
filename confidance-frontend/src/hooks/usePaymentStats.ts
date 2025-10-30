// hooks/usePaymentStats.ts
'use client';

import { useMemo } from 'react';
import { Payment } from './useDashboard';
import { formatEther } from 'viem';

interface PaymentStats {
  totalSent: string; // En ETH
  totalPending: string;
  totalReleased: string;
  totalCancelled: string;
  
  countTotal: number;
  countPending: number;
  countReleased: number;
  countCancelled: number;
  countFailed: number;
  
  // Stats par token
  statsByToken: Record<string, {
    totalAmount: string;
    count: number;
  }>;
  
  // Paiements envoyés vs reçus
  sentPayments: Payment[];
  receivedPayments: Payment[];
  sentTotal: string;
  receivedTotal: string;
}

interface UsePaymentStatsParams {
  payments: Payment[];
  userAddress?: string;
}

export function usePaymentStats({ payments, userAddress }: UsePaymentStatsParams): PaymentStats {
  const stats = useMemo(() => {
    if (!payments || payments.length === 0) {
      return {
        totalSent: '0',
        totalPending: '0',
        totalReleased: '0',
        totalCancelled: '0',
        countTotal: 0,
        countPending: 0,
        countReleased: 0,
        countCancelled: 0,
        countFailed: 0,
        statsByToken: {},
        sentPayments: [],
        receivedPayments: [],
        sentTotal: '0',
        receivedTotal: '0',
      };
    }

    // Séparer paiements envoyés vs reçus
    const sentPayments = payments.filter(
      p => p.payer_address.toLowerCase() === userAddress?.toLowerCase()
    );
    const receivedPayments = payments.filter(
      p => p.payee_address.toLowerCase() === userAddress?.toLowerCase()
    );

    // Calculer totaux par statut (en wei)
    let totalSent = BigInt(0);
    let totalPending = BigInt(0);
    let totalReleased = BigInt(0);
    let totalCancelled = BigInt(0);

    let countPending = 0;
    let countReleased = 0;
    let countCancelled = 0;
    let countFailed = 0;

    const statsByToken: Record<string, { totalAmount: bigint; count: number }> = {};

    payments.forEach(payment => {
      const amount = BigInt(payment.amount);
      totalSent += amount;

      // Compter par statut
      switch (payment.status) {
        case 'pending':
          totalPending += amount;
          countPending++;
          break;
        case 'released':
          totalReleased += amount;
          countReleased++;
          break;
        case 'cancelled':
          totalCancelled += amount;
          countCancelled++;
          break;
        case 'failed':
          countFailed++;
          break;
      }

      // Stats par token
      const token = payment.token_symbol;
      if (!statsByToken[token]) {
        statsByToken[token] = { totalAmount: BigInt(0), count: 0 };
      }
      statsByToken[token].totalAmount += amount;
      statsByToken[token].count++;
    });

    // Calculer totaux envoyés vs reçus
    const sentTotal = sentPayments.reduce((sum, p) => sum + BigInt(p.amount), BigInt(0));
    const receivedTotal = receivedPayments.reduce((sum, p) => sum + BigInt(p.amount), BigInt(0));

    // Convertir stats par token en string
    const statsByTokenFormatted: Record<string, { totalAmount: string; count: number }> = {};
    Object.entries(statsByToken).forEach(([token, data]) => {
      statsByTokenFormatted[token] = {
        totalAmount: formatEther(data.totalAmount),
        count: data.count,
      };
    });

    return {
      totalSent: formatEther(totalSent),
      totalPending: formatEther(totalPending),
      totalReleased: formatEther(totalReleased),
      totalCancelled: formatEther(totalCancelled),
      
      countTotal: payments.length,
      countPending,
      countReleased,
      countCancelled,
      countFailed,
      
      statsByToken: statsByTokenFormatted,
      
      sentPayments,
      receivedPayments,
      sentTotal: formatEther(sentTotal),
      receivedTotal: formatEther(receivedTotal),
    };
  }, [payments, userAddress]);

  return stats;
}

// Hook auxiliaire pour obtenir le pourcentage d'un statut
export function useStatusPercentage(stats: PaymentStats, status: 'pending' | 'released' | 'cancelled'): number {
  if (stats.countTotal === 0) return 0;
  
  const count = {
    pending: stats.countPending,
    released: stats.countReleased,
    cancelled: stats.countCancelled,
  }[status];
  
  return Math.round((count / stats.countTotal) * 100);
}