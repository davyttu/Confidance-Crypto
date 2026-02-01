// components/Dashboard/StatsCards.tsx
'use client';

import { useMemo, useState, useEffect } from 'react';
import { formatUnits } from 'viem';
import { useAccount, usePublicClient } from 'wagmi';
import { useTranslationReady } from '@/hooks/useTranslationReady';
import { Payment } from '@/hooks/useDashboard';
import { useEthUsdPrice } from '@/hooks/useEthUsdPrice';
import { formatAmount } from '@/lib/utils/amountFormatter';
import { getToken, isZeroAddress } from '@/config/tokens';
import { erc20Abi } from '@/lib/contracts/erc20Abi';

interface StatsCardsProps {
  payments: Payment[];
  selectedWallets?: string[];
}

type BalanceToken = 'ETH' | 'USDC' | 'USDT' | 'ALL';
type TotalSentPeriod = 'all' | 'year' | 'month' | 'week';

const MONTH_IN_SECONDS = 30 * 24 * 3600; // 30 days for recurring installment spacing

function getPeriodBounds(period: TotalSentPeriod): { startSec: number; endSec: number } | null {
  if (period === 'all') return null;
  const now = new Date();
  const endSec = Math.floor(now.getTime() / 1000);
  let start: Date;
  if (period === 'week') {
    start = new Date(now);
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1; // Monday = start of week
    start.setDate(now.getDate() - diff);
    start.setHours(0, 0, 0, 0);
  } else if (period === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    start = new Date(now.getFullYear(), 0, 1);
  }
  const startSec = Math.floor(start.getTime() / 1000);
  return { startSec, endSec };
}

export function StatsCards({ payments, selectedWallets = [], statsCardFilter = null, onStatsCardFilterChange }: StatsCardsProps) {
  const { t, ready } = useTranslationReady();
  const [balanceToken, setBalanceToken] = useState<BalanceToken>('ETH');
  const [totalSentToken, setTotalSentToken] = useState<BalanceToken>('ETH');
  const [totalSentPeriod, setTotalSentPeriod] = useState<TotalSentPeriod>('all');
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
  
  // Bornes de période pour "Total sent"
  const periodBounds = useMemo(() => getPeriodBounds(totalSentPeriod), [totalSentPeriod]);

  // Calculer les stats : uniquement paiements réellement envoyés (released/completed), filtrés par période
  const { totalSentByToken, totalSentCount } = useMemo(() => {
    const totals = {
      ETH: BigInt(0),
      USDC: BigInt(0),
      USDT: BigInt(0),
    };
    let count = 0;

    const completedStatuses = new Set<string>(['released', 'completed']);
    const startSec = periodBounds?.startSec ?? 0;
    const endSec = periodBounds?.endSec ?? Number.MAX_SAFE_INTEGER;

    const inRange = (ts: number) => ts >= startSec && ts <= endSec;

    payments.forEach((payment) => {
      if (!completedStatuses.has(payment.status)) return;
      const symbol = (payment.token_symbol || 'ETH').toUpperCase();
      if (symbol !== 'USDC' && symbol !== 'USDT' && symbol !== 'ETH') return;

      const isRecurring = payment.is_recurring || payment.payment_type === 'recurring';
      let added = BigInt(0);

      if (isRecurring) {
        const executed = Number(payment.executed_months ?? 0);
        if (executed <= 0) return;
        const firstPaymentTime = Number(payment.first_payment_time ?? payment.release_time ?? 0);
        const monthlyAmount = BigInt(payment.monthly_amount ?? payment.amount ?? '0');
        const firstMonthCustom = payment.is_first_month_custom === true || payment.is_first_month_custom === 'true';
        const firstMonthAmount = firstMonthCustom && payment.first_month_amount
          ? BigInt(payment.first_month_amount)
          : monthlyAmount;

        for (let k = 0; k < executed; k++) {
          const releaseTimeK = firstPaymentTime + k * MONTH_IN_SECONDS;
          if (!inRange(releaseTimeK)) continue;
          const amountK = k === 0 ? firstMonthAmount : monthlyAmount;
          totals[symbol] += amountK;
          added += amountK;
        }
      } else {
        const releaseTime = Number(payment.release_time ?? 0);
        if (!inRange(releaseTime)) return;
        const amount = BigInt(payment.amount ?? '0');
        totals[symbol] += amount;
        added = amount;
      }

      if (added > 0n) count += 1;
    });

    return { totalSentByToken: totals, totalSentCount: count };
  }, [payments, periodBounds]);

  const pending = payments.filter(p => p.status === 'pending').length;
  const recurringActive = payments.filter((payment) => {
    const isRecurring = payment.is_recurring || payment.payment_type === 'recurring';
    if (!isRecurring) return false;
    if (payment.status === 'completed') return false;
    if (payment.status !== 'active' && payment.status !== 'pending') return false;
    const executed = Number(payment.executed_months ?? 0);
    const total = Number(payment.total_months ?? 0);
    if (!Number.isFinite(total) || total <= 0) return true;
    return executed < total;
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
    const canReadToken = (token: { address: string; isNative: boolean }) =>
      !token.isNative && !isZeroAddress(token.address);

    const readTokenBalance = async (token: typeof usdcToken, wallet: `0x${string}`) => {
      if (!canReadToken(token)) return 0n;
      try {
        return await publicClient.readContract({
          address: token.address,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [wallet],
        }) as bigint;
      } catch (err) {
        console.warn('⚠️ BalanceOf failed for token', token.symbol, err);
        return 0n;
      }
    };

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
              readTokenBalance(usdcToken, addressValue),
              readTokenBalance(usdtToken, addressValue),
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
          <h3 className="text-sm font-extrabold uppercase tracking-[0.2em] text-white drop-shadow-sm">
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
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-4 text-white border border-orange-400/30 shadow-md md:col-span-1 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide opacity-95">{ready ? t('dashboard.stats.pending') : 'En cours'}</h3>
          <div className="w-12 h-12 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <svg className="w-6 h-6 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <p className="text-3xl font-bold mb-1">{pending}</p>
        <p className="text-xs opacity-85 mb-2">{ready ? t('dashboard.stats.scheduledPayments', { plural: pending > 1 ? 's' : '' }) : `Paiement${pending > 1 ? 's' : ''} programmé${pending > 1 ? 's' : ''}`}</p>
        {onStatsCardFilterChange && (
          <button
            type="button"
            onClick={() => onStatsCardFilterChange(statsCardFilter === 'pending' ? null : 'pending')}
            className={`mt-auto w-full text-[10px] font-medium uppercase tracking-wide py-1.5 px-2 rounded-md transition-all ${
              statsCardFilter === 'pending'
                ? 'bg-white/30 text-white ring-1 ring-white/50'
                : 'bg-white/20 hover:bg-white/30 text-white/95'
            }`}
          >
            {statsCardFilter === 'pending' ? (ready ? t('dashboard.stats.resetView') : 'Réinitialiser') : (ready ? t('dashboard.stats.displayInDashboard') : 'Afficher dans le dashboard')}
          </button>
        )}
      </div>

      {/* Actifs (paiements récurrents en attente) */}
      <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-4 text-white border border-green-400/30 shadow-md md:col-span-1 flex flex-col">
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
        <p className="text-3xl font-bold mb-1">{recurringActive}</p>
        <p className="text-xs opacity-85 mb-2">
          {ready ? t('dashboard.stats.recurringPayments', { defaultValue: 'Recurring payment' }) : 'Recurring payment'}
        </p>
        {onStatsCardFilterChange && (
          <button
            type="button"
            onClick={() => onStatsCardFilterChange(statsCardFilter === 'recurring_active' ? null : 'recurring_active')}
            className={`mt-auto w-full text-[10px] font-medium uppercase tracking-wide py-1.5 px-2 rounded-md transition-all ${
              statsCardFilter === 'recurring_active'
                ? 'bg-white/30 text-white ring-1 ring-white/50'
                : 'bg-white/20 hover:bg-white/30 text-white/95'
            }`}
          >
            {statsCardFilter === 'recurring_active' ? (ready ? t('dashboard.stats.resetView') : 'Réinitialiser') : (ready ? t('dashboard.stats.displayInDashboard') : 'Afficher dans le dashboard')}
          </button>
        )}
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
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs opacity-85">
              {ready
                ? (totalSentPeriod === 'all'
                    ? t('dashboard.stats.totalPayments', { count: totalSentCount, plural: totalSentCount !== 1 ? 's' : '' })
                    : t('dashboard.stats.totalPaymentsInPeriod', { count: totalSentCount, period: t(`dashboard.stats.period.${totalSentPeriod}`), plural: totalSentCount !== 1 ? 's' : '' }))
                : (totalSentPeriod === 'all'
                    ? `${totalSentCount} paiement${totalSentCount !== 1 ? 's' : ''} au total`
                    : `${totalSentCount} paiement${totalSentCount !== 1 ? 's' : ''} ${totalSentPeriod === 'week' ? 'cette semaine' : totalSentPeriod === 'month' ? 'ce mois' : "cette année"}`)}
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
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wide opacity-75">
              {ready ? t('dashboard.stats.periodLabel') : 'Période'}
            </span>
            <select
              value={totalSentPeriod}
              onChange={(event) => setTotalSentPeriod(event.target.value as TotalSentPeriod)}
              className="text-[10px] bg-white/90 text-gray-900 border border-white/60 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-white/70 flex-1 min-w-0"
              title={ready ? t('dashboard.stats.periodTitle') : 'Choisir la période'}
            >
              <option value="all">{ready ? t('dashboard.stats.period.all') : 'Depuis le début'}</option>
              <option value="year">{ready ? t('dashboard.stats.period.year') : 'Cette année'}</option>
              <option value="month">{ready ? t('dashboard.stats.period.month') : 'Ce mois'}</option>
              <option value="week">{ready ? t('dashboard.stats.period.week') : 'Cette semaine'}</option>
            </select>
          </div>
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

