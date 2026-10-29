// components/Dashboard/StatsCards.tsx
'use client';

import { useMemo, useState, useEffect } from 'react';
import { formatUnits } from 'viem';
import { useAccount, useChainId, usePublicClient } from 'wagmi';
import { useTranslationReady } from '@/hooks/useTranslationReady';
import { Payment } from '@/hooks/useDashboard';
import { useEthUsdPrice } from '@/hooks/useEthUsdPrice';
import { formatAmount } from '@/lib/utils/amountFormatter';
import { getWriteToken, getDashboardDisplayDecimals, isZeroAddress } from '@/config/tokens';
import { erc20Abi } from '@/lib/contracts/erc20Abi';
import { getCustomTokens, type CustomToken } from '@/lib/custom-tokens';

interface StatsCardsProps {
  payments: Payment[];
  selectedWallets?: string[];
  statsCardFilter?: 'pending' | 'recurring_active' | null;
  onStatsCardFilterChange?: (filter: 'pending' | 'recurring_active' | null) => void;
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
  const chainId = useChainId();
  const [balanceToken, setBalanceToken] = useState<BalanceToken>('ETH');
  const [totalSentToken, setTotalSentToken] = useState<string>('ETH');
  const [totalSentPeriod, setTotalSentPeriod] = useState<TotalSentPeriod>('all');
  const [customTokensList, setCustomTokensList] = useState<CustomToken[]>([]);

  useEffect(() => {
    const refresh = () => setCustomTokensList(getCustomTokens());
    refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'confidance.customTokens' || e.key === null) refresh();
    };
    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [payments]);
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

  // Calculer les stats : paiements réellement envoyés, filtrés par période
  // Inclut ETH, USDC, USDT et tout autre token (ex. TMP enregistré).
  // totalSentAllPaymentsCount = nombre d’événements (tous tokens), pour le libellé « X paiements au total ».
  const { totalSentByToken, totalSentCountByToken, totalSentAllPaymentsCount } = useMemo(() => {
    const totals: Record<string, bigint> = {
      ETH: BigInt(0),
      USDC: BigInt(0),
      USDT: BigInt(0),
    };
    const countByToken: Record<string, number> = {
      ETH: 0,
      USDC: 0,
      USDT: 0,
    };

    const bump = (sym: string, amount: bigint, count: number) => {
      const s = sym.toUpperCase();
      if (!totals[s]) totals[s] = BigInt(0);
      if (countByToken[s] === undefined) countByToken[s] = 0;
      totals[s] += amount;
      countByToken[s] += count;
    };

    const completedStatuses = new Set<string>(['released', 'completed']);
    const recurringActiveStatuses = new Set<string>(['active', 'released', 'completed']);
    const startSec = periodBounds?.startSec ?? 0;
    const endSec = periodBounds?.endSec ?? Number.MAX_SAFE_INTEGER;

    const inRange = (ts: number) => ts >= startSec && ts <= endSec;

    const batchKey = (p: Payment) =>
      [p.payer_address, p.first_payment_time ?? p.release_time, p.transaction_hash || p.tx_hash].join('|');
    const batchExecutedMax = new Map<string, number>();
    payments.forEach((p) => {
      if (!(p.is_recurring || p.payment_type === 'recurring')) return;
      const key = batchKey(p);
      const ex = Number(p.executed_months ?? 0);
      const prev = batchExecutedMax.get(key) ?? 0;
      batchExecutedMax.set(key, Math.max(prev, ex));
    });

    const paymentsToProcess = payments.flatMap((p) => {
      const isRecurring = p.is_recurring || p.payment_type === 'recurring';
      const children = p.__batchChildren;
      if (isRecurring && children && children.length > 1) return children;
      return [p];
    });

    const seenIds = new Set<string>();
    const uniquePayments = paymentsToProcess.filter((p) => {
      const id = p.id || p.contract_address || '';
      if (seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    });

    uniquePayments.forEach((payment) => {
      const symbol = (payment.token_symbol || 'ETH').toUpperCase();

      const isRecurring = payment.is_recurring || payment.payment_type === 'recurring';

      if (isRecurring) {
        if (!recurringActiveStatuses.has(payment.status)) return;
        const key = batchKey(payment);
        const executed = batchExecutedMax.has(key) ? batchExecutedMax.get(key)! : Number(payment.executed_months ?? 0);
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
          bump(symbol, amountK, 1);
        }
      } else {
        if (!completedStatuses.has(payment.status)) return;

        const releaseTime = Number(payment.release_time ?? 0);
        if (!inRange(releaseTime)) return;
        const amount = BigInt(payment.amount ?? '0');
        bump(symbol, amount, 1);
      }
    });

    const totalSentAllPaymentsCount = Object.values(countByToken).reduce((sum, n) => sum + n, 0);
    return { totalSentByToken: totals, totalSentCountByToken: countByToken, totalSentAllPaymentsCount };
  }, [payments, periodBounds]);

  const displayedTotalSentCount = totalSentAllPaymentsCount;

  const sentTokenSelectOptions = useMemo(() => {
    const extras = new Set<string>();
    payments.forEach((p) => {
      const s = (p.token_symbol || 'ETH').toUpperCase();
      if (s !== 'ETH' && s !== 'USDC' && s !== 'USDT') extras.add(s);
    });
    customTokensList.forEach((c) => extras.add(c.symbol.toUpperCase()));
    const sorted = Array.from(extras).sort((a, b) => a.localeCompare(b));
    return ['ETH', 'USDC', 'USDT', ...sorted, 'ALL'];
  }, [payments, customTokensList]);

  useEffect(() => {
    if (!sentTokenSelectOptions.includes(totalSentToken)) {
      setTotalSentToken('ETH');
    }
  }, [sentTokenSelectOptions, totalSentToken]);

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
    const usdcToken = getWriteToken(chainId, 'USDC');
    const usdtToken = getWriteToken(chainId, 'USDT');
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
  }, [addressesToQuery, publicClient, chainId]);

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
    return Number(formatUnits(totalSentByToken['ETH'] ?? 0n, 18));
  }, [totalSentByToken]);

  const sentUsdcAmount = useMemo(() => {
    return Number(formatUnits(totalSentByToken['USDC'] ?? 0n, 6));
  }, [totalSentByToken]);

  const sentUsdtAmount = useMemo(() => {
    return Number(formatUnits(totalSentByToken['USDT'] ?? 0n, 6));
  }, [totalSentByToken]);

  const totalSentAllEth = useMemo(() => {
    if (!priceUsd || priceUsd <= 0) return null;
    let ethEq = sentEthAmount + (sentUsdcAmount + sentUsdtAmount) / priceUsd;
    customTokensList.forEach((ct) => {
      const usd = ct.usdPerToken;
      if (usd == null || !Number.isFinite(usd) || usd <= 0) return;
      const sym = ct.symbol.toUpperCase();
      const wei = totalSentByToken[sym] ?? 0n;
      if (wei === 0n) return;
      const human = Number(formatUnits(wei, ct.decimals));
      ethEq += (human * usd) / priceUsd;
    });
    return ethEq;
  }, [priceUsd, sentEthAmount, sentUsdcAmount, sentUsdtAmount, customTokensList, totalSentByToken]);

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
      return { main: `${formatAmount(totalSentByToken['ETH'] ?? 0n, 18)} ETH`, sub: null };
    }
    if (totalSentToken === 'USDC') {
      return { main: `${formatAmount(totalSentByToken['USDC'] ?? 0n, 6)} USDC`, sub: null };
    }
    if (totalSentToken === 'USDT') {
      return { main: `${formatAmount(totalSentByToken['USDT'] ?? 0n, 6)} USDT`, sub: null };
    }
    const dec = getDashboardDisplayDecimals(totalSentToken);
    const raw = totalSentByToken[totalSentToken] ?? 0n;
    return { main: `${formatAmount(raw, dec)} ${totalSentToken}`, sub: null };
  }, [totalSentAllEth, totalSentAllUsd, totalSentByToken, totalSentToken]);

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
                    ? t('dashboard.stats.totalPayments', { count: displayedTotalSentCount, plural: displayedTotalSentCount !== 1 ? 's' : '' })
                    : t('dashboard.stats.totalPaymentsInPeriod', { count: displayedTotalSentCount, period: t(`dashboard.stats.period.${totalSentPeriod}`), plural: displayedTotalSentCount !== 1 ? 's' : '' }))
                : (totalSentPeriod === 'all'
                    ? `${displayedTotalSentCount} paiement${displayedTotalSentCount !== 1 ? 's' : ''} au total`
                    : `${displayedTotalSentCount} paiement${displayedTotalSentCount !== 1 ? 's' : ''} ${totalSentPeriod === 'week' ? 'cette semaine' : totalSentPeriod === 'month' ? 'ce mois' : "cette année"}`)}
            </p>
            <select
              value={totalSentToken}
              onChange={(event) => setTotalSentToken(event.target.value)}
              className="text-xs bg-white text-gray-900 border border-white/60 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-white/70"
            >
              {sentTokenSelectOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
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

