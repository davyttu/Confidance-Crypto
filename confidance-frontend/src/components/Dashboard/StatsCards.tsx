// components/Dashboard/StatsCards.tsx
'use client';

import { useMemo, useState, useEffect } from 'react';
import { formatUnits } from 'viem';
import { useAccount, usePublicClient } from 'wagmi';
import { useTranslationReady } from '@/hooks/useTranslationReady';
import { Payment } from '@/hooks/useDashboard';
import { useEthUsdPrice } from '@/hooks/useEthUsdPrice';
import { formatAmount } from '@/lib/utils/amountFormatter';
import { getToken } from '@/config/tokens';
import { erc20Abi } from '@/lib/contracts/erc20Abi';

interface StatsCardsProps {
  payments: Payment[];
  selectedWallets?: string[];
}

type BalanceToken = 'ETH' | 'USDC' | 'USDT' | 'ALL';

export function StatsCards({ payments, selectedWallets = [] }: StatsCardsProps) {
  const { t, ready } = useTranslationReady();
  const [balanceToken, setBalanceToken] = useState<BalanceToken>('ETH');
  const [totalSentToken, setTotalSentToken] = useState<BalanceToken>('ETH');
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { priceUsd, isLoading: isPriceLoading } = useEthUsdPrice();
  const [balances, setBalances] = useState({
    ETH: BigInt(0),
    USDC: BigInt(0),
    USDT: BigInt(0),
  });
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [balancesError, setBalancesError] = useState(false);
  
  // Calculer les stats
  const totalSentByToken = useMemo(() => {
    const totals = {
      ETH: BigInt(0),
      USDC: BigInt(0),
      USDT: BigInt(0),
    };

    payments.forEach((payment) => {
      const symbol = (payment.token_symbol || 'ETH').toUpperCase();
      if (symbol === 'USDC' || symbol === 'USDT' || symbol === 'ETH') {
        totals[symbol] += BigInt(payment.amount);
      }
    });

    return totals;
  }, [payments]);

  const pending = payments.filter(p => p.status === 'pending').length;
  const recurringPending = payments.filter(p => {
    const isRecurring = p.is_recurring || p.payment_type === 'recurring';
    return isRecurring && p.status === 'pending';
  }).length;

  const addressesToQuery = useMemo(() => {
    if (selectedWallets.length > 0) {
      return Array.from(new Set(selectedWallets.map((wallet) => wallet.toLowerCase())));
    }
    if (address) {
      return [address.toLowerCase()];
    }
    return [];
  }, [selectedWallets, address]);

  useEffect(() => {
    if (!publicClient || addressesToQuery.length === 0) {
      setBalances({ ETH: BigInt(0), USDC: BigInt(0), USDT: BigInt(0) });
      setBalancesLoading(false);
      setBalancesError(false);
      return;
    }

    let isMounted = true;
    const usdcToken = getToken('USDC');
    const usdtToken = getToken('USDT');

    const fetchBalances = async () => {
      setBalancesLoading(true);
      setBalancesError(false);

      try {
        let ethTotal = BigInt(0);
        let usdcTotal = BigInt(0);
        let usdtTotal = BigInt(0);

        await Promise.all(
          addressesToQuery.map(async (wallet) => {
            const addressValue = wallet as `0x${string}`;
            const [eth, usdc, usdt] = await Promise.all([
              publicClient.getBalance({ address: addressValue }),
              publicClient.readContract({
                address: usdcToken.address,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [addressValue],
              }) as Promise<bigint>,
              publicClient.readContract({
                address: usdtToken.address,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [addressValue],
              }) as Promise<bigint>,
            ]);

            ethTotal += eth;
            usdcTotal += usdc;
            usdtTotal += usdt;
          })
        );

        if (isMounted) {
          setBalances({ ETH: ethTotal, USDC: usdcTotal, USDT: usdtTotal });
        }
      } catch (error) {
        if (isMounted) {
          console.error('❌ Error fetching balances:', error);
          setBalancesError(true);
        }
      } finally {
        if (isMounted) {
          setBalancesLoading(false);
        }
      }
    };

    fetchBalances();

    return () => {
      isMounted = false;
    };
  }, [addressesToQuery, publicClient]);

  const ethAmount = useMemo(() => {
    return Number(formatUnits(balances.ETH, 18));
  }, [balances.ETH]);

  const usdcAmount = useMemo(() => {
    return Number(formatUnits(balances.USDC, 6));
  }, [balances.USDC]);

  const usdtAmount = useMemo(() => {
    return Number(formatUnits(balances.USDT, 6));
  }, [balances.USDT]);

  const totalBalanceEth = useMemo(() => {
    if (addressesToQuery.length === 0) return null;
    if (!priceUsd || priceUsd <= 0) return ethAmount;
    return ethAmount + (usdcAmount + usdtAmount) / priceUsd;
  }, [addressesToQuery.length, ethAmount, priceUsd, usdcAmount, usdtAmount]);

  const totalBalanceUsd = useMemo(() => {
    if (!priceUsd || priceUsd <= 0 || totalBalanceEth === null) return null;
    return totalBalanceEth * priceUsd;
  }, [priceUsd, totalBalanceEth]);

  const sentEthAmount = useMemo(() => {
    return Number(formatUnits(totalSentByToken.ETH, 18));
  }, [totalSentByToken.ETH]);

  const sentUsdcAmount = useMemo(() => {
    return Number(formatUnits(totalSentByToken.USDC, 6));
  }, [totalSentByToken.USDC]);

  const sentUsdtAmount = useMemo(() => {
    return Number(formatUnits(totalSentByToken.USDT, 6));
  }, [totalSentByToken.USDT]);

  const totalSentAllEth = useMemo(() => {
    if (!priceUsd || priceUsd <= 0) return null;
    return sentEthAmount + (sentUsdcAmount + sentUsdtAmount) / priceUsd;
  }, [priceUsd, sentEthAmount, sentUsdcAmount, sentUsdtAmount]);

  const totalSentAllUsd = useMemo(() => {
    if (totalSentAllEth === null || !priceUsd || priceUsd <= 0) return null;
    return totalSentAllEth * priceUsd;
  }, [totalSentAllEth, priceUsd]);

  const totalSentDisplay = useMemo(() => {
    if (totalSentToken === 'ALL') {
      if (totalSentAllEth === null) {
        return { main: '...', sub: null };
      }
      return {
        main: `${formatNumber(totalSentAllEth, 5)} ETH`,
        sub: totalSentAllUsd !== null ? `${formatNumber(totalSentAllUsd, 2)} $` : null,
      };
    }
    if (totalSentToken === 'ETH') {
      return { main: `${formatAmount(totalSentByToken.ETH, 18)} ETH`, sub: null };
    }
    if (totalSentToken === 'USDC') {
      return { main: `${formatAmount(totalSentByToken.USDC, 6)} USDC`, sub: null };
    }
    return { main: `${formatAmount(totalSentByToken.USDT, 6)} USDT`, sub: null };
  }, [totalSentAllEth, totalSentAllUsd, totalSentByToken.ETH, totalSentByToken.USDC, totalSentByToken.USDT, totalSentToken]);

  const balanceDisplay = useMemo(() => {
    if (addressesToQuery.length === 0) {
      return { main: '0 ETH', sub: null };
    }
    if (balanceToken === 'ALL') {
      if (totalBalanceEth === null) return { main: '...', sub: null };
      return {
        main: `${formatNumber(totalBalanceEth, 5)} ETH`,
        sub: totalBalanceUsd !== null ? `${formatNumber(totalBalanceUsd, 2)} $` : null,
      };
    }
    if (balanceToken === 'ETH') {
      return { main: `${formatNumber(ethAmount, 5)} ETH`, sub: null };
    }
    if (balanceToken === 'USDC') {
      return { main: `${formatNumber(usdcAmount, 4)} USDC`, sub: null };
    }
    return { main: `${formatNumber(usdtAmount, 4)} USDT`, sub: null };
  }, [
    addressesToQuery.length,
    balanceToken,
    totalBalanceEth,
    totalBalanceUsd,
    ethAmount,
    usdcAmount,
    usdtAmount,
  ]);

  const isBalanceLoading =
    balancesLoading ||
    (balanceToken === 'ALL' && isPriceLoading);

  const isBalanceError =
    balancesError;

  const isBalanceUnavailable =
    isBalanceError ||
    addressesToQuery.length === 0 ||
    (balanceToken === 'ALL' && !priceUsd && !isPriceLoading);

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
          {isBalanceLoading ? '...' : balanceDisplay.main}
          {!isBalanceLoading && balanceDisplay.sub && (
            <span className="text-sm font-medium opacity-85"> / {balanceDisplay.sub}</span>
          )}
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
        {isBalanceUnavailable && (
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
        <p className="text-3xl font-bold mb-1">
          {totalSentDisplay.main}
          {totalSentDisplay.sub && (
            <span className="text-sm font-medium opacity-85"> / {totalSentDisplay.sub}</span>
          )}
        </p>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs opacity-85">
            {ready ? t('dashboard.stats.totalPayments', { count: payments.length, plural: payments.length > 1 ? 's' : '' }) : `${payments.length} paiement${payments.length > 1 ? 's' : ''} au total`}
          </p>
          <select
            value={totalSentToken}
            onChange={(event) => setTotalSentToken(event.target.value as BalanceToken)}
            className="text-xs bg-white text-gray-900 border border-white/60 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-white/70"
          >
            <option value="ETH">ETH</option>
            <option value="USDC">USDC</option>
            <option value="USDT">USDT</option>
            <option value="ALL">ALL</option>
          </select>
        </div>
        {totalSentToken === 'ALL' && !priceUsd && !isPriceLoading && (
          <p className="text-xs mt-2 text-white/80">
            {ready ? t('dashboard.stats.priceUnavailable') : 'Prix indisponible'}
          </p>
        )}
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

