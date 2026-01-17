// components/Dashboard/StatsCards.tsx
'use client';

import { useMemo, useState } from 'react';
import { formatUnits } from 'viem';
import { useAccount } from 'wagmi';
import { useTranslationReady } from '@/hooks/useTranslationReady';
import { Payment } from '@/hooks/useDashboard';
import { useEthUsdPrice } from '@/hooks/useEthUsdPrice';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { formatAmount } from '@/lib/utils/amountFormatter';

interface StatsCardsProps {
  payments: Payment[];
}

type BalanceToken = 'ETH' | 'USDC' | 'USDT' | 'ALL';

export function StatsCards({ payments }: StatsCardsProps) {
  const { t, ready } = useTranslationReady();
  const [balanceToken, setBalanceToken] = useState<BalanceToken>('ETH');
  const { address } = useAccount();
  const { priceUsd, isLoading: isPriceLoading } = useEthUsdPrice();
  const ethBalance = useTokenBalance('ETH');
  const usdcBalance = useTokenBalance('USDC');
  const usdtBalance = useTokenBalance('USDT');
  
  // Calculer les stats
  const totalSent = payments.reduce((sum, p) => {
    return sum + BigInt(p.amount);
  }, BigInt(0));

  const pending = payments.filter(p => p.status === 'pending').length;
  const recurringPending = payments.filter(p => {
    const isRecurring = p.is_recurring || p.payment_type === 'recurring';
    return isRecurring && p.status === 'pending';
  }).length;

  const ethAmount = useMemo(() => {
    if (!ethBalance.balance) return 0;
    return Number(formatUnits(ethBalance.balance, 18));
  }, [ethBalance.balance]);

  const usdcAmount = useMemo(() => {
    if (!usdcBalance.balance) return 0;
    return Number(formatUnits(usdcBalance.balance, 6));
  }, [usdcBalance.balance]);

  const usdtAmount = useMemo(() => {
    if (!usdtBalance.balance) return 0;
    return Number(formatUnits(usdtBalance.balance, 6));
  }, [usdtBalance.balance]);

  const allTotalUsd = useMemo(() => {
    if (!priceUsd) return null;
    return ethAmount * priceUsd + usdcAmount + usdtAmount;
  }, [ethAmount, priceUsd, usdcAmount, usdtAmount]);

  const balanceDisplay = useMemo(() => {
    if (!address) return '0 ETH';
    if (balanceToken === 'ALL') {
      if (allTotalUsd === null) return '...';
      return `${formatNumber(allTotalUsd, 2)} USD`;
    }
    if (balanceToken === 'ETH') {
      return `${formatNumber(ethAmount, 5)} ETH`;
    }
    if (balanceToken === 'USDC') {
      return usdcBalance.formatted;
    }
    return usdtBalance.formatted;
  }, [
    address,
    balanceToken,
    allTotalUsd,
    ethAmount,
    usdcBalance.formatted,
    usdtBalance.formatted,
  ]);

  const isBalanceLoading =
    ethBalance.isLoading ||
    usdcBalance.isLoading ||
    usdtBalance.isLoading ||
    (balanceToken === 'ALL' && isPriceLoading);

  const isBalanceError =
    ethBalance.isError ||
    usdcBalance.isError ||
    usdtBalance.isError;

  return (
    <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-6">
      {/* Mon compte */}
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg p-4 text-white border border-indigo-400/30 shadow-md md:col-span-2">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide opacity-95">
            {ready ? t('dashboard.stats.account') : 'Mon compte'}
          </h3>
          <div className="w-12 h-12 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <svg className="w-6 h-6 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <p className="text-3xl font-bold mb-1">
          {isBalanceLoading ? '...' : balanceDisplay}
        </p>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs opacity-85">
            {ready ? t('dashboard.stats.availableBalance') : 'Solde disponible'}
          </p>
          <select
            value={balanceToken}
            onChange={(event) => setBalanceToken(event.target.value as BalanceToken)}
            className="text-xs bg-white text-gray-900 border border-white/60 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-white/70"
          >
            <option value="ETH">ETH</option>
            <option value="USDC">USDC</option>
            <option value="USDT">USDT</option>
            <option value="ALL">ALL</option>
          </select>
        </div>
        {((balanceToken === 'ALL' && !priceUsd && !isPriceLoading) || isBalanceError || !address) && (
          <p className="text-xs mt-2 text-white/80">
            {ready ? t('dashboard.stats.balanceUnavailable') : 'Solde indisponible'}
          </p>
        )}
      </div>

      {/* En cours */}
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-4 text-white border border-orange-400/30 shadow-md md:col-span-1">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide opacity-95">{ready ? t('dashboard.stats.pending') : 'En cours'}</h3>
          <div className="w-12 h-12 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <svg className="w-6 h-6 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <p className="text-3xl font-bold mb-1">{pending}</p>
        <p className="text-xs opacity-85">{ready ? t('dashboard.stats.scheduledPayments', { plural: pending > 1 ? 's' : '' }) : `Paiement${pending > 1 ? 's' : ''} programmé${pending > 1 ? 's' : ''}`}</p>
      </div>

      {/* Actifs (paiements récurrents en attente) */}
      <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-4 text-white border border-green-400/30 shadow-md md:col-span-1">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide opacity-95">
            {ready ? t('dashboard.stats.active', { defaultValue: 'Actif' }) : 'Actif'}
          </h3>
          <div className="w-12 h-12 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <svg className="w-6 h-6 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <p className="text-3xl font-bold mb-1">{recurringPending}</p>
        <p className="text-xs opacity-85">
          {ready ? t('dashboard.stats.recurringPayments', { defaultValue: 'Recurring payment' }) : 'Recurring payment'}
        </p>
      </div>

      {/* Total envoyé */}
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-4 text-white border border-blue-400/30 shadow-md md:col-span-2">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide opacity-95">{ready ? t('dashboard.stats.total') : 'Total envoyé'}</h3>
          <div className="w-12 h-12 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <svg className="w-6 h-6 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 12l16-8-6 16-2-6-6-2z" />
            </svg>
          </div>
        </div>
        <p className="text-3xl font-bold mb-1">{formatAmount(totalSent.toString())} ETH</p>
        <p className="text-xs opacity-85">{ready ? t('dashboard.stats.totalPayments', { count: payments.length, plural: payments.length > 1 ? 's' : '' }) : `${payments.length} paiement${payments.length > 1 ? 's' : ''} au total`}</p>
      </div>
    </div>
  );
}

function formatNumber(value: number, maxDecimals: number) {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  });
}
