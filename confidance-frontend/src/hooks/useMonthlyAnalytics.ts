// hooks/useMonthlyAnalytics.ts
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Payment } from './useDashboard';
import { formatAmount } from '@/lib/utils/amountFormatter';
import { formatUnits } from 'viem';
import { getProtocolFeeBps } from '@/config/tokens';
import { PaymentTransaction } from './usePaymentTransactions';

export interface MonthlyStats {
  month: string; // "2024-11"
  displayMonth: string; // "Novembre 2024"
  transactionCount: number;
  totalVolume: bigint;
  totalVolumeFormatted: string;
  totalVolumeUsd: number | null;
  totalVolumeUsdFormatted: string | null;
  totalFees: bigint;
  totalFeesFormatted: string;
  totalFeesUsd: number | null;
  totalFeesUsdFormatted: string | null;
  feeRatio: number; // pourcentage
  breakdown: {
    instant: TransactionTypeStats;
    scheduled: TransactionTypeStats;
    recurring: TransactionTypeStats;
  };
  costs: {
    gasFees: bigint;
    gasFeesFormatted: string;
    protocolFees: bigint;
    protocolFeesFormatted: string;
    gasPercentage: number;
    protocolPercentage: number;
  };
  explanations?: {
    transactions: KpiExplanation<number>;
    totalVolume: KpiExplanation<string>;
    totalFees: KpiExplanation<string>;
    realCost: KpiExplanation<number>;
  };
  previousMonthComparison?: {
    volumeChange: number; // % changement
    feesChange: number;
    ratioChange: number;
  };
}

export interface TransactionTypeStats {
  count: number;
  volume: bigint;
  volumeFormatted: string;
  avgFees: bigint;
  avgFeesFormatted: string;
}

export interface KpiExplanation<T> {
  value: T;
  delta: number;
  explanation: string;
}

interface AnalyticsApiBreakdown {
  count: number;
  volume: string;
  avgFees: string;
}

interface AnalyticsApiMonth {
  month: string;
  transactionCount: number;
  totalVolume: string;
  totalFees: string;
  feeRatio: number;
  gasFees: string;
  protocolFees: string;
  breakdown: {
    instant: AnalyticsApiBreakdown;
    scheduled: AnalyticsApiBreakdown;
    recurring: AnalyticsApiBreakdown;
  };
  explanations?: {
    transactions: KpiExplanation<number>;
    totalVolume: KpiExplanation<string>;
    totalFees: KpiExplanation<string>;
    realCost: KpiExplanation<number>;
  };
}

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const FEE_PERCENTAGE = 179; // 1.79%
const FEE_DENOMINATOR = 10000;

const USD_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

const normalizeTokenSymbol = (symbol?: string) => (symbol || 'ETH').toUpperCase();

const toEthWei = (amount: bigint, symbol: string, priceUsd: number | null) => {
  if (symbol === 'ETH') {
    return amount;
  }
  if ((symbol === 'USDC' || symbol === 'USDT') && priceUsd && priceUsd > 0) {
    const amountUsd = Number(formatUnits(amount, 6));
    const amountEth = amountUsd / priceUsd;
    return BigInt(Math.round(amountEth * 1e18));
  }
  return BigInt(0);
};

const isInstantPayment = (payment: Payment) => {
  return payment.payment_type === 'instant' || payment.is_instant === true;
};

export function useMonthlyAnalytics(
  payments: Payment[],
  priceUsd?: number | null,
  transactions: PaymentTransaction[] = [],
  isProVerified: boolean = false
) {
  const [apiMonthlyData, setApiMonthlyData] = useState<MonthlyStats[] | null>(null);

  useEffect(() => {
    let isMounted = true;
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      setApiMonthlyData(null);
      return;
    }

    const fetchAnalytics = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/analytics/monthly`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!response.ok) {
          throw new Error('analytics_fetch_failed');
        }
        const data = await response.json();
        const rows: AnalyticsApiMonth[] = data?.months || [];

        const normalizedPrice = priceUsd && priceUsd > 0 ? priceUsd : null;
        const mapped = rows.map((row) => {
          const totalVolume = BigInt(row.totalVolume || '0');
          const totalFees = BigInt(row.totalFees || '0');
          const gasFees = BigInt(row.gasFees || '0');
          const protocolFees = BigInt(row.protocolFees || '0');

          const totalVolumeEth = Number(formatUnits(totalVolume, 18));
          const totalFeesEth = Number(formatUnits(totalFees, 18));
          const totalVolumeUsd = normalizedPrice ? totalVolumeEth * normalizedPrice : null;
          const totalFeesUsd = normalizedPrice ? totalFeesEth * normalizedPrice : null;

          const [year, monthNum] = row.month.split('-');
          const monthIndex = parseInt(monthNum) - 1;
          const displayMonth = `${MONTH_NAMES[monthIndex]} ${year}`;

          const mapBreakdown = (entry: AnalyticsApiBreakdown): TransactionTypeStats => {
            const volume = BigInt(entry.volume || '0');
            const avgFees = BigInt(entry.avgFees || '0');
            return {
              count: entry.count,
              volume,
              volumeFormatted: formatAmount(volume.toString()),
              avgFees,
              avgFeesFormatted: formatAmount(avgFees.toString())
            };
          };

          return {
            month: row.month,
            displayMonth,
            transactionCount: row.transactionCount,
            totalVolume,
            totalVolumeFormatted: formatAmount(totalVolume.toString()),
            totalVolumeUsd,
            totalVolumeUsdFormatted: totalVolumeUsd !== null ? USD_FORMATTER.format(totalVolumeUsd) : null,
            totalFees,
            totalFeesFormatted: formatAmount(totalFees.toString()),
            totalFeesUsd,
            totalFeesUsdFormatted: totalFeesUsd !== null ? USD_FORMATTER.format(totalFeesUsd) : null,
            feeRatio: row.feeRatio,
            breakdown: {
              instant: mapBreakdown(row.breakdown.instant),
              scheduled: mapBreakdown(row.breakdown.scheduled),
              recurring: mapBreakdown(row.breakdown.recurring)
            },
            costs: {
              gasFees,
              gasFeesFormatted: formatAmount(gasFees.toString()),
              protocolFees,
              protocolFeesFormatted: formatAmount(protocolFees.toString()),
              gasPercentage: totalFees > BigInt(0)
                ? Number((gasFees * BigInt(10000)) / totalFees) / 100
                : 0,
              protocolPercentage: totalFees > BigInt(0)
                ? Number((protocolFees * BigInt(10000)) / totalFees) / 100
                : 0
            },
            explanations: row.explanations
          } satisfies MonthlyStats;
        }).sort((a, b) => b.month.localeCompare(a.month));

        // Ajouter comparaison avec mois précédent
        mapped.forEach((current, index) => {
          if (index < mapped.length - 1) {
            const previous = mapped[index + 1];
            current.previousMonthComparison = {
              volumeChange: previous.totalVolume > BigInt(0)
                ? Number(((current.totalVolume - previous.totalVolume) * BigInt(10000)) / previous.totalVolume) / 100
                : 0,
              feesChange: previous.totalFees > BigInt(0)
                ? Number(((current.totalFees - previous.totalFees) * BigInt(10000)) / previous.totalFees) / 100
                : 0,
              ratioChange: current.feeRatio - previous.feeRatio
            };
          }
        });

        if (isMounted) {
          setApiMonthlyData(mapped);
        }
      } catch (error) {
        if (isMounted) {
          setApiMonthlyData(null);
        }
      }
    };

    fetchAnalytics();

    return () => {
      isMounted = false;
    };
  }, [priceUsd]);

  const computedMonthlyData = useMemo(() => {
    // Grouper les paiements par mois
    const byMonth: Record<string, Payment[]> = {};
    
    payments.forEach(payment => {
      const date = new Date(payment.release_time * 1000);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!byMonth[monthKey]) {
        byMonth[monthKey] = [];
      }
      byMonth[monthKey].push(payment);
    });

    const gasFeesByMonth = transactions.reduce<Record<string, bigint>>((acc, tx) => {
      const date = new Date(tx.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const gasCost = BigInt(tx.gas_cost_native || '0');
      acc[monthKey] = (acc[monthKey] || BigInt(0)) + gasCost;
      return acc;
    }, {});

    // Calculer les stats pour chaque mois
    const stats: MonthlyStats[] = Object.entries(byMonth)
      .map(([month, monthPayments]) => {
        const normalizedPrice = priceUsd && priceUsd > 0 ? priceUsd : null;

        // Volume total en équivalent ETH
        const totalVolume = monthPayments.reduce((sum, payment) => {
          const symbol = normalizeTokenSymbol(payment.token_symbol);
          const amount = BigInt(payment.amount);
          return sum + toEthWei(amount, symbol, normalizedPrice);
        }, BigInt(0));

        // Calculer les fees protocole (réels selon type et statut pro)
        const protocolFees = monthPayments.reduce((sum, payment) => {
          if (isInstantPayment(payment)) {
            return sum;
          }
          const symbol = normalizeTokenSymbol(payment.token_symbol);
          const amount = BigInt(payment.amount);
          const feeBps = getProtocolFeeBps({ isInstantPayment: false, isProVerified });
          const feeAmount = (amount * BigInt(feeBps)) / BigInt(FEE_DENOMINATOR);
          return sum + toEthWei(feeAmount, symbol, normalizedPrice);
        }, BigInt(0));

        // Gas fees réels depuis Supabase
        const gasFees = gasFeesByMonth[month] || BigInt(0);
        
        const totalFees = protocolFees + gasFees;

        // Ratio fees/volume
        const feeRatio = totalVolume > BigInt(0) 
          ? Number((totalFees * BigInt(10000)) / totalVolume) / 100
          : 0;

        // Breakdown par type de transaction
        // Pour l'instant on simule, à adapter selon votre logique métier
        const instantPayments = monthPayments.filter(p => !p.cancellable);
        const scheduledPayments = monthPayments.filter(p => p.cancellable);
        const recurringPayments: Payment[] = []; // À implémenter

        const calculateTypeStats = (typePayments: Payment[]): TransactionTypeStats => {
          const volume = typePayments.reduce((sum, payment) => {
            const symbol = normalizeTokenSymbol(payment.token_symbol);
            const amount = BigInt(payment.amount);
            return sum + toEthWei(amount, symbol, normalizedPrice);
          }, BigInt(0));
          const fees = typePayments.reduce((sum, payment) => {
            if (isInstantPayment(payment)) {
              return sum;
            }
            const symbol = normalizeTokenSymbol(payment.token_symbol);
            const amount = BigInt(payment.amount);
            const feeBps = getProtocolFeeBps({ isInstantPayment: false, isProVerified });
            const feeAmount = (amount * BigInt(feeBps)) / BigInt(FEE_DENOMINATOR);
            return sum + toEthWei(feeAmount, symbol, normalizedPrice);
          }, BigInt(0));
          const avgFees = typePayments.length > 0 ? fees / BigInt(typePayments.length) : BigInt(0);

          return {
            count: typePayments.length,
            volume,
            volumeFormatted: formatAmount(volume.toString()),
            avgFees,
            avgFeesFormatted: formatAmount(avgFees.toString())
          };
        };

        const totalVolumeEth = Number(formatUnits(totalVolume, 18));
        const totalFeesEth = Number(formatUnits(totalFees, 18));
        const totalVolumeUsd = normalizedPrice ? totalVolumeEth * normalizedPrice : null;
        const totalFeesUsd = normalizedPrice ? totalFeesEth * normalizedPrice : null;

        // Date formatée
        const [year, monthNum] = month.split('-');
        const monthIndex = parseInt(monthNum) - 1;
        const displayMonth = `${MONTH_NAMES[monthIndex]} ${year}`;

        return {
          month,
          displayMonth,
          transactionCount: monthPayments.length,
          totalVolume,
          totalVolumeFormatted: formatAmount(totalVolume.toString()),
          totalVolumeUsd,
          totalVolumeUsdFormatted: totalVolumeUsd !== null ? USD_FORMATTER.format(totalVolumeUsd) : null,
          totalFees,
          totalFeesFormatted: formatAmount(totalFees.toString()),
          totalFeesUsd,
          totalFeesUsdFormatted: totalFeesUsd !== null ? USD_FORMATTER.format(totalFeesUsd) : null,
          feeRatio,
          breakdown: {
            instant: calculateTypeStats(instantPayments),
            scheduled: calculateTypeStats(scheduledPayments),
            recurring: calculateTypeStats(recurringPayments)
          },
          costs: {
            gasFees,
            gasFeesFormatted: formatAmount(gasFees.toString()),
            protocolFees,
            protocolFeesFormatted: formatAmount(protocolFees.toString()),
            gasPercentage: totalFees > BigInt(0) 
              ? Number((gasFees * BigInt(10000)) / totalFees) / 100 
              : 0,
            protocolPercentage: totalFees > BigInt(0)
              ? Number((protocolFees * BigInt(10000)) / totalFees) / 100
              : 0
          }
        };
      })
      .sort((a, b) => b.month.localeCompare(a.month)); // Plus récent en premier

    // Ajouter comparaison avec mois précédent
    stats.forEach((current, index) => {
      if (index < stats.length - 1) {
        const previous = stats[index + 1];
        
        current.previousMonthComparison = {
          volumeChange: previous.totalVolume > BigInt(0)
            ? Number(((current.totalVolume - previous.totalVolume) * BigInt(10000)) / previous.totalVolume) / 100
            : 0,
          feesChange: previous.totalFees > BigInt(0)
            ? Number(((current.totalFees - previous.totalFees) * BigInt(10000)) / previous.totalFees) / 100
            : 0,
          ratioChange: current.feeRatio - previous.feeRatio
        };
      }
    });

    return stats;
  }, [payments, priceUsd, transactions, isProVerified]);

  const monthlyData = apiMonthlyData ?? computedMonthlyData;

  return {
    monthlyData,
    currentMonth: monthlyData[0], // Mois le plus récent
    getMonthData: (monthKey: string) => monthlyData.find(m => m.month === monthKey)
  };
}