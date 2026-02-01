// components/Dashboard/TransactionTable.tsx
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAccount, usePublicClient } from 'wagmi';
import { Payment } from '@/hooks/useDashboard';
import { TransactionRow } from './TransactionRow';
import { ExportButton } from './ExportButton';
import { useBeneficiaries } from '@/hooks/useBeneficiaries';
import { EmailTransactionModal } from './EmailTransactionModal';
import { recurringPaymentERC20Abi } from '@/lib/contracts/recurringPaymentERC20Abi';

interface TransactionTableProps {
  payments: Payment[];
  onRename: (address: string) => void;
  onCancel: (payment: Payment) => void;
  onDelete: (payment: Payment) => void;
  /** Pour intégrer l’export à la barre de recherche */
  userAddress?: string;
  period?: string;
  showRecurringParentsOnly?: boolean;
}

type SortField = 'beneficiary' | 'amount' | 'date' | 'status';
type SortDirection = 'asc' | 'desc';
type DashboardPayment = Payment & {
  __isNew?: boolean;
  __recurringInstance?: {
    monthNumber: number;
    executionTime: number;
  };
  __parentId?: string;
  __parentPayment?: Payment;
  __monthlyStatuses?: Array<'executed' | 'failed' | 'pending' | 'cancelled' | 'mixed'>;
  __batchChildren?: Payment[];
  __batchMonthDetails?: Array<Array<{ address: string; status: string }>>;
};

const MONTH_IN_SECONDS =
  process.env.NEXT_PUBLIC_CHAIN === 'base_sepolia' ? 300 : 2592000; // 5 min en testnet
const DASHBOARD_SEEN_KEY = 'dashboardLastSeenAt';

export function TransactionTable({ payments, onRename, onCancel, onDelete, userAddress, period, showRecurringParentsOnly = false }: TransactionTableProps) {
  const { t, ready: translationsReady } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);
  const [batchMainByTx, setBatchMainByTx] = useState<Record<string, string>>({});
  const { address } = useAccount();
  const normalizedWallet = address?.toLowerCase() || '';
  const { getBeneficiaryName } = useBeneficiaries();
  const publicClient = usePublicClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [beneficiaryFilterAddress, setBeneficiaryFilterAddress] = useState<string | null>(null);
  const [beneficiaryDropdownOpen, setBeneficiaryDropdownOpen] = useState(false);
  const beneficiaryDropdownRef = useRef<HTMLDivElement | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;
  const [sessionStartAt] = useState(() => Date.now());
  const [lastSeenAt] = useState(() => {
    if (typeof window === 'undefined') return 0;
    const raw = localStorage.getItem(DASHBOARD_SEEN_KEY);
    const parsed = raw ? Number(raw) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  });
  const [onchainRecurring, setOnchainRecurring] = useState<
    Record<
      string,
      {
        executedMonths: number;
        totalMonths: number;
        monthExecuted: Array<boolean | null>;
        monthStatusByIndex?: Record<number, 'executed' | 'failed'>;
        nextMonthToProcess?: number;
        cancelled?: boolean;
      }
    >
  >({});
  
  // State pour gérer le modal email
  const [emailModalPayment, setEmailModalPayment] = useState<Payment | null>(null);
  const getPaginationItems = (current: number, total: number): Array<number | 'ellipsis'> => {
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const items: Array<number | 'ellipsis'> = [1];
    const left = Math.max(2, current - 1);
    const right = Math.min(total - 1, current + 1);

    if (left > 2) {
      items.push('ellipsis');
    }

    for (let page = left; page <= right; page += 1) {
      items.push(page);
    }

    if (right < total - 1) {
      items.push('ellipsis');
    }

    items.push(total);
    return items;
  };

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!beneficiaryDropdownOpen) return;
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (beneficiaryDropdownRef.current && target && !beneficiaryDropdownRef.current.contains(target)) {
        setBeneficiaryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [beneficiaryDropdownOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem('batchRecurringMainByTx');
      const parsed = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        setBatchMainByTx(parsed as Record<string, string>);
      }
    } catch (error) {
      console.warn('⚠️ Unable to read batchRecurringMainByTx:', error);
    }
  }, []);
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(DASHBOARD_SEEN_KEY, String(sessionStartAt));
    } catch (error) {
      console.error('⚠️ Impossible de sauvegarder la date de vue du dashboard:', error);
    }
  }, [sessionStartAt]);

  useEffect(() => {
    if (!publicClient) return;

    const allContractsMap = new Map<string, Payment>();
    const addPaymentIfRecurring = (payment: Payment) => {
      const hasMonths = Number(payment.total_months || 0) > 0;
      const hasFirstPaymentTime = Number(payment.first_payment_time || 0) > 0;
      const isRecurringType =
        payment.is_recurring === true ||
        payment.is_recurring === 'true' ||
        payment.is_recurring === 1 ||
        payment.payment_type === 'recurring';
      const isRecurring = isRecurringType || hasMonths || hasFirstPaymentTime;
      const hasContract = typeof payment.contract_address === 'string' && payment.contract_address.length > 0;

      if (hasContract && isRecurring) {
        const key = payment.contract_address.toLowerCase();
        if (!allContractsMap.has(key)) {
          allContractsMap.set(key, payment);
        }
      }
    };

    payments.forEach((payment) => addPaymentIfRecurring(payment));
    const recurringPayments = Array.from(allContractsMap.values());
    if (recurringPayments.length === 0) return;

    let isMounted = true;

    const fetchOnchainRecurring = async () => {
      try {
        const entries = await Promise.all(
          recurringPayments.map(async (payment) => {
            try {
              const address = payment.contract_address as `0x${string}`;
              // First check if contract has totalMonths (recurring contract)
              let totalMonthsRaw: bigint | number;
              try {
                totalMonthsRaw = await publicClient.readContract({
                  address,
                  abi: recurringPaymentERC20Abi,
                  functionName: 'totalMonths',
                }) as bigint;
              } catch (error) {
                // Contract doesn't have totalMonths, not a recurring contract
                return null;
              }

              const totalMonths = Number(totalMonthsRaw ?? 0);
              if (totalMonths === 0) {
                // Not actually a recurring payment
                return null;
              }

              const [executedMonthsRaw, nextMonthToProcessRaw] = await Promise.all([
                publicClient.readContract({
                  address,
                  abi: recurringPaymentERC20Abi,
                  functionName: 'executedMonths',
                }),
                publicClient.readContract({
                  address,
                  abi: recurringPaymentERC20Abi,
                  functionName: 'nextMonthToProcess',
                }),
              ]);
              let cancelled = false;
              try {
                cancelled = await publicClient.readContract({
                  address,
                  abi: recurringPaymentERC20Abi,
                  functionName: 'cancelled',
                }) as boolean;
              } catch (error) {
                cancelled = false;
              }
              let monthExecuted: Array<boolean | null> = [];
              if (totalMonths > 0) {
                const monthReads = Array.from({ length: totalMonths }, (_, index) =>
                  publicClient.readContract({
                    address,
                    abi: recurringPaymentERC20Abi,
                    functionName: 'monthExecuted',
                    args: [BigInt(index)],
                  })
                );
                const monthResults = await Promise.allSettled(monthReads);
                monthExecuted = monthResults.map((result) =>
                  result.status === 'fulfilled' ? Boolean(result.value) : null
                );
              }
              let monthStatusByIndex: Record<number, 'executed' | 'failed'> | undefined;
              try {
                const [executedLogs, failedLogs] = await Promise.all([
                  publicClient.getLogs({
                    address,
                    abi: recurringPaymentERC20Abi,
                    eventName: 'MonthlyPaymentExecuted',
                    fromBlock: 0n,
                    toBlock: 'latest',
                  }),
                  publicClient.getLogs({
                    address,
                    abi: recurringPaymentERC20Abi,
                    eventName: 'MonthlyPaymentFailed',
                    fromBlock: 0n,
                    toBlock: 'latest',
                  }),
                ]);
                const merged = [
                  ...executedLogs.map((log) => ({
                    status: 'executed' as const,
                    monthNumber: Number((log as any).args?.monthNumber ?? 0),
                    blockNumber: log.blockNumber ?? 0n,
                    logIndex: log.logIndex ?? 0,
                  })),
                  ...failedLogs.map((log) => ({
                    status: 'failed' as const,
                    monthNumber: Number((log as any).args?.monthNumber ?? 0),
                    blockNumber: log.blockNumber ?? 0n,
                    logIndex: log.logIndex ?? 0,
                  })),
                ]
                  .sort((a, b) => {
                    if (a.blockNumber === b.blockNumber) {
                      return a.logIndex - b.logIndex;
                    }
                    return a.blockNumber > b.blockNumber ? 1 : -1;
                  });
                const statusMap: Record<number, 'executed' | 'failed'> = {};
                const rawNumbers = merged.map((entry) => entry.monthNumber);
                const maxNumber = rawNumbers.length > 0 ? Math.max(...rawNumbers) : -1;
                let isZeroBased = rawNumbers.includes(0);
                if (!isZeroBased && totalMonths > 0 && maxNumber >= 0) {
                  if (maxNumber === totalMonths - 1) {
                    isZeroBased = true;
                  }
                }
                const resolveIndex = (monthNumber: number) =>
                  isZeroBased ? monthNumber : monthNumber - 1;
                merged.forEach((entry) => {
                  const index = resolveIndex(entry.monthNumber);
                  if (index < 0 || (totalMonths > 0 && index >= totalMonths)) return;
                  statusMap[index] = entry.status;
                });
                if (Object.keys(statusMap).length > 0) {
                  monthStatusByIndex = statusMap;
                }
              } catch (error) {
                console.warn('⚠️ Unable to read monthly logs', payment.id, error);
              }

              const result = {
                executedMonths: Number(executedMonthsRaw ?? 0),
                totalMonths,
                monthExecuted,
                monthStatusByIndex,
                nextMonthToProcess: Number(nextMonthToProcessRaw ?? 0),
                cancelled,
              };
              return [payment.id, result] as const;
            } catch (error) {
              console.warn('⚠️ Error reading on-chain recurring state', payment.id, error);
              return null;
            }
          })
        );

        if (!isMounted) return;
        const next: Record<
          string,
          {
            executedMonths: number;
            totalMonths: number;
            monthExecuted: Array<boolean | null>;
            monthStatusByIndex?: Record<number, 'executed' | 'failed'>;
            nextMonthToProcess?: number;
            cancelled?: boolean;
          }
        > = {};
        for (const entry of entries) {
          if (!entry) continue;
          next[entry[0]] = entry[1];
        }
        if (Object.keys(next).length > 0) {
          setOnchainRecurring((prev) => ({ ...prev, ...next }));
        }
      } catch (error) {
        console.warn('⚠️ Error reading on-chain recurring payments:', error);
      }
    };

    fetchOnchainRecurring();

    return () => {
      isMounted = false;
    };
  }, [payments, publicClient]);

  const shouldShowNewBadge = (timestampMs: number) => {
    if (!lastSeenAt) return false;
    if (!Number.isFinite(timestampMs)) return false;
    return timestampMs > lastSeenAt && timestampMs <= sessionStartAt;
  };

  const resolveExecutedMonths = (payment: Payment) => {
    const totalMonths = Number(payment.total_months || 0);
    const rawExecuted = Number(payment.executed_months || 0);
    const isCompleted = payment.status === 'completed';
    const hasSkip =
      typeof payment.last_execution_hash === 'string' &&
      payment.last_execution_hash.toLowerCase().startsWith('skipped');

    let inferred = rawExecuted;
    if (!hasSkip && inferred === 0 && payment.next_execution_time && payment.first_payment_time) {
      const diff = Number(payment.next_execution_time) - Number(payment.first_payment_time);
      if (Number.isFinite(diff) && diff > 0) {
        inferred = Math.floor(diff / MONTH_IN_SECONDS);
      }
    }

    if (isCompleted && totalMonths > 0) {
      return totalMonths;
    }

    if (totalMonths > 0) {
      return Math.min(inferred, totalMonths);
    }

    return Math.max(0, inferred);
  };

  const isIncomingForPayment = (payment: Payment) => {
    if (!normalizedWallet) return false;
    if (payment.payee_address?.toLowerCase() === normalizedWallet) return true;
    return (
      Array.isArray(payment.batch_beneficiaries) &&
      payment.batch_beneficiaries.some(
        (beneficiary) => beneficiary.address?.toLowerCase() === normalizedWallet
      )
    );
  };

  const isOutgoingForPayment = (payment: Payment) => {
    if (!normalizedWallet) return false;
    return payment.payer_address?.toLowerCase() === normalizedWallet;
  };

  const expandedPayments = useMemo<DashboardPayment[]>(() => {
    const expanded: DashboardPayment[] = [];
    const groupedPayments: Array<Payment & { __batchChildren?: Payment[] }> = [];
    const batchGroups = new Map<string, Payment & { __batchChildren: Payment[] }>();
    const signatureCounts = new Map<string, number>();

    const buildSignature = (payment: Payment) => [
      payment.payer_address,
      payment.token_symbol || '',
      payment.payment_label || payment.label || '',
      payment.first_payment_time || payment.release_time || '',
      payment.total_months || '',
      payment.monthly_amount || payment.amount || '',
    ].join('|');

    payments.forEach((payment) => {
      const isRecurring = payment.is_recurring || payment.payment_type === 'recurring';
      if (!isRecurring) return;
      const signature = buildSignature(payment);
      signatureCounts.set(signature, (signatureCounts.get(signature) || 0) + 1);
    });

    const bucketFromMs = (valueMs: number) => {
      const bucketSize = 10 * 60 * 1000; // 10 minutes
      return Math.floor(valueMs / bucketSize);
    };

    for (const payment of payments) {
      const isRecurring = payment.is_recurring || payment.payment_type === 'recurring';
      const signature = buildSignature(payment);
      const isBatchRecurring =
        isRecurring &&
        (payment.is_batch ||
          (payment.batch_count && payment.batch_count > 1) ||
          (payment.batch_beneficiaries && payment.batch_beneficiaries.length > 0) ||
          (signatureCounts.get(signature) || 0) > 1);

      if (!isBatchRecurring) {
        groupedPayments.push(payment);
        continue;
      }

      const createdAtMs = payment.created_at
        ? new Date(payment.created_at).getTime()
        : Number.isFinite(payment.release_time)
        ? payment.release_time * 1000
        : 0;
      const timeBucket = bucketFromMs(createdAtMs || Date.now());
      const groupKey =
        payment.transaction_hash ||
        payment.tx_hash ||
        `${signature}|${timeBucket}`;

      const existing = batchGroups.get(groupKey);
      if (existing) {
        existing.__batchChildren.push(payment);
        continue;
      }

      const grouped = { ...payment, __batchChildren: [payment] };
      batchGroups.set(groupKey, grouped);
      groupedPayments.push(grouped);
    }

    const resolveMonthlyStatuses = (
      sourcePayment: Payment,
      onchainState?: {
        executedMonths: number;
        totalMonths: number;
        monthExecuted: Array<boolean | null>;
        monthStatusByIndex?: Record<number, 'executed' | 'failed'>;
        nextMonthToProcess?: number;
        cancelled?: boolean;
      }
    ) => {
      // 🔧 FIX: Prefer on-chain data but fallback to DB data
      const dbExecutedMonths = Number(sourcePayment.executed_months || 0);
      const chainExecutedMonths =
        typeof onchainState?.executedMonths === 'number'
          ? onchainState.executedMonths
          : null;
      const resolvedExecutedMonths =
        chainExecutedMonths === null
          ? dbExecutedMonths
          : Math.max(dbExecutedMonths, chainExecutedMonths);

      const dbTotalMonths = Number(sourcePayment.total_months || 0);
      const chainTotalMonths =
        typeof onchainState?.totalMonths === 'number'
          ? onchainState.totalMonths
          : null;
      const resolvedTotalMonths =
        chainTotalMonths === null
          ? dbTotalMonths
          : Math.max(dbTotalMonths, chainTotalMonths);

      const monthExecuted = onchainState?.monthExecuted || [];
      const baseStatus = sourcePayment.status;
      const isCancelled = typeof onchainState?.cancelled === 'boolean'
        ? onchainState.cancelled
        : baseStatus === 'cancelled';

      const resolvedNextMonth =
        typeof onchainState?.nextMonthToProcess === 'number'
          ? onchainState.nextMonthToProcess
          : resolvedExecutedMonths;
      const now = Math.floor(Date.now() / 1000);
      const startTime = Number(sourcePayment.first_payment_time || 0);
      const hasStartTime = Number.isFinite(startTime) && startTime > 0;

      // 🆕 Lire monthly_statuses depuis la DB (mis à jour par le keeper)
      const dbMonthlyStatuses = sourcePayment.monthly_statuses || {};
      const dbStatusKeys = Object.keys(dbMonthlyStatuses);
      const dbUsesZeroBased = dbStatusKeys.includes('0');
      const normalizeDbStatus = (value: string | undefined) => {
        if (!value) return null;
        const normalized = value.toLowerCase();
        if (normalized === 'released' || normalized === 'executed') return 'executed';
        if (normalized === 'failed') return 'failed';
        if (normalized === 'pending') return 'pending';
        if (normalized === 'cancelled') return 'cancelled';
        return null;
      };
      const monthlyStatuses: Array<'executed' | 'failed' | 'pending' | 'cancelled'> = [];

      if (resolvedTotalMonths > 0) {
        for (let monthIndex = 0; monthIndex < resolvedTotalMonths; monthIndex++) {
          // DB monthly_statuses (mis à jour par le keeper)
          const dbKey = dbUsesZeroBased ? String(monthIndex) : String(monthIndex + 1);
          const dbStatusRaw = dbMonthlyStatuses[dbKey];
          const dbStatus = normalizeDbStatus(dbStatusRaw);
          if (dbStatus) {
            monthlyStatuses.push(dbStatus);
            continue;
          }

          // On-chain logs (fallback pour les anciens paiements)
          const logStatus = onchainState?.monthStatusByIndex?.[monthIndex];
          if (logStatus) {
            monthlyStatuses.push(logStatus);
            continue;
          }

          // Contract monthExecuted flag
          const executedFlag = monthExecuted[monthIndex];
          if (executedFlag === true) {
            monthlyStatuses.push('executed');
            continue;
          }

          // Contract cancelled
          if (isCancelled) {
            if (hasStartTime) {
              const paymentDate = startTime + (monthIndex * MONTH_IN_SECONDS);
              if (paymentDate > now) {
                monthlyStatuses.push('pending');
                continue;
              }
            }
            monthlyStatuses.push('cancelled');
            continue;
          }

          // Month less than executedMonths (confirmed by contract)
          if (monthIndex < resolvedExecutedMonths) {
            monthlyStatuses.push('executed');
            continue;
          }

          // Default: pending (waiting)
          monthlyStatuses.push('pending');
        }
      }

      // 🔧 FIX SIMPLE: Un paiement est "completed" si tous les mois ont été traités (executed ou failed)
      const processedMonthsCount = monthlyStatuses.filter(
        (status) => status === 'executed' || status === 'failed'
      ).length;
      const allTerminal = processedMonthsCount >= resolvedTotalMonths && resolvedTotalMonths > 0;

      // Distinguer pending (aucun mois traité) vs active (au moins 1 mois traité)
      const hasAnyStatus = monthlyStatuses.length > 0;
      const resolvedStatus =
        isCancelled
          ? 'cancelled'
          : allTerminal
          ? 'completed'
          : processedMonthsCount > 0
          ? 'active'
          : baseStatus;

      return { resolvedExecutedMonths, resolvedTotalMonths, resolvedStatus, monthlyStatuses };
    };

    for (const payment of groupedPayments) {
      const batchChildren = (payment as { __batchChildren?: Payment[] }).__batchChildren;
      const hasBatchChildren = Array.isArray(batchChildren) && batchChildren.length > 1;

      const mergedBeneficiaries = hasBatchChildren
        ? (() => {
            const seen = new Set<string>();
            const beneficiaries: { address: string; amount: string; name?: string }[] = [];
            for (const child of batchChildren) {
              if (child.batch_beneficiaries && child.batch_beneficiaries.length > 0) {
                for (const beneficiary of child.batch_beneficiaries) {
                  const key = beneficiary.address.toLowerCase();
                  if (seen.has(key)) continue;
                  seen.add(key);
                  beneficiaries.push(beneficiary);
                }
              } else {
                const key = child.payee_address.toLowerCase();
                if (seen.has(key)) continue;
                seen.add(key);
                beneficiaries.push({ address: child.payee_address, amount: child.amount });
              }
            }
            const txHash =
              payment.transaction_hash ||
              payment.tx_hash ||
              batchChildren.find((child) => child.transaction_hash)?.transaction_hash ||
              batchChildren.find((child) => child.tx_hash)?.tx_hash ||
              null;
            const preferredMain = txHash ? batchMainByTx[txHash] : null;
            if (preferredMain) {
              const index = beneficiaries.findIndex(
                (beneficiary) => beneficiary.address.toLowerCase() === preferredMain.toLowerCase()
              );
              if (index > 0) {
                const [main] = beneficiaries.splice(index, 1);
                beneficiaries.unshift(main);
              }
            }
            return beneficiaries;
          })()
        : null;

      const paymentForDisplay: Payment = hasBatchChildren && mergedBeneficiaries
        ? {
            ...payment,
            payee_address: mergedBeneficiaries[0]?.address || payment.payee_address,
            amount: mergedBeneficiaries[0]?.amount || payment.amount,
            batch_beneficiaries: mergedBeneficiaries,
            batch_count: mergedBeneficiaries.length,
            is_batch: true,
          }
        : payment;

      const childStates = hasBatchChildren
        ? batchChildren.map((child) => ({
            payment: child,
            onchain: onchainRecurring[child.id],
          }))
        : [];

      const aggregated = hasBatchChildren
        ? (() => {
            const perChild = childStates.map(({ payment: child, onchain }) =>
              resolveMonthlyStatuses(child, onchain)
            );
            const totalMonths = Math.max(
              0,
              ...perChild.map((entry) => entry.resolvedTotalMonths)
            );
            type MonthStatus = 'executed' | 'failed' | 'pending' | 'cancelled' | 'mixed';
            const monthlyStatuses: MonthStatus[] = [];
            const batchMonthDetails: Array<Array<{ address: string; status: string }>> = [];
            if (totalMonths > 0) {
              for (let monthIndex = 0; monthIndex < totalMonths; monthIndex++) {
                const statuses = perChild.map((entry) => entry.monthlyStatuses[monthIndex] || 'pending');
                const details = batchChildren.map((child, i) => ({
                  address: child.payee_address,
                  status: statuses[i] || 'pending',
                }));
                batchMonthDetails.push(details);

                const hasFailed = statuses.some((s) => s === 'failed');
                const hasCancelled = statuses.some((s) => s === 'cancelled');
                const hasExecuted = statuses.some((s) => s === 'executed');
                const allCancelled = statuses.every((s) => s === 'cancelled');
                if (hasFailed) {
                  monthlyStatuses.push('failed');
                  continue;
                }
                if (hasCancelled) {
                  if (allCancelled) {
                    monthlyStatuses.push('cancelled');
                  } else if (hasExecuted) {
                    monthlyStatuses.push('mixed');
                  } else {
                    monthlyStatuses.push('cancelled');
                  }
                  continue;
                }
                if (statuses.every((s) => s === 'executed')) {
                  monthlyStatuses.push('executed');
                  continue;
                }
                monthlyStatuses.push('pending');
              }
            }
            const resolvedExecutedMonths = monthlyStatuses.filter((s) => s === 'executed').length;
            const allCancelled = perChild.every((entry) => entry.resolvedStatus === 'cancelled');
            const hasCancelled = perChild.some((entry) => entry.resolvedStatus === 'cancelled');
            const hasPendingOrActive = perChild.some(
              (entry) => entry.resolvedStatus === 'pending' || entry.resolvedStatus === 'active'
            );

            const processedMonthsCount = monthlyStatuses.filter(
              (s) => s === 'executed' || s === 'failed' || s === 'mixed'
            ).length;
            const allTerminal = processedMonthsCount >= totalMonths && totalMonths > 0;

            const resolvedStatus = allTerminal
              ? allCancelled
                ? 'cancelled'
                : 'completed'
              : allCancelled || (hasCancelled && !hasPendingOrActive)
              ? 'cancelled'
              : processedMonthsCount > 0
              ? 'active'
              : payment.status;

            return { resolvedExecutedMonths, resolvedTotalMonths: totalMonths, resolvedStatus, monthlyStatuses, batchMonthDetails };
          })()
        : resolveMonthlyStatuses(paymentForDisplay, onchainRecurring[paymentForDisplay.id]);

      const normalizedPayment: Payment = {
        ...paymentForDisplay,
        executed_months: aggregated.resolvedExecutedMonths,
        total_months: aggregated.resolvedTotalMonths,
        status: aggregated.resolvedStatus,
      };
      const createdAtMs = new Date(paymentForDisplay.created_at).getTime();
      const fallbackMs = Number.isFinite(paymentForDisplay.release_time)
        ? paymentForDisplay.release_time * 1000
        : 0;
      const baseTimestamp = Number.isFinite(createdAtMs) ? createdAtMs : fallbackMs;
      const baseIsNew = shouldShowNewBadge(baseTimestamp);

      const isIncomingParent = isIncomingForPayment(normalizedPayment);
      const isOutgoingParent = isOutgoingForPayment(normalizedPayment);
      const isRecurring = normalizedPayment.is_recurring || normalizedPayment.payment_type === 'recurring';

      const showParentRow = !(isRecurring && isIncomingParent && !isOutgoingParent) || (showRecurringParentsOnly && isRecurring);
      if (showParentRow) {
        const aggWithDetails = aggregated as typeof aggregated & { batchMonthDetails?: Array<Array<{ address: string; status: string }>> };
        expanded.push({
          ...normalizedPayment,
          __isNew: baseIsNew,
          __monthlyStatuses: aggregated.monthlyStatuses.length > 0 ? aggregated.monthlyStatuses : undefined,
          __batchChildren: hasBatchChildren ? batchChildren : undefined,
          __batchMonthDetails: hasBatchChildren ? aggWithDetails.batchMonthDetails : undefined,
        });
      }

      if (showRecurringParentsOnly && isRecurring) continue;

      if (!isRecurring || !normalizedPayment.first_payment_time) continue;

      if (hasBatchChildren && batchChildren) {
        batchChildren.forEach((child) => {
          const childState = resolveMonthlyStatuses(child, onchainRecurring[child.id]);
          const childNormalized: Payment = {
            ...child,
            executed_months: childState.resolvedExecutedMonths,
            total_months: childState.resolvedTotalMonths,
            status: childState.resolvedStatus,
          };
          const totalMonths = Number(
            childNormalized.total_months || normalizedPayment.total_months || aggregated.resolvedTotalMonths || 0
          );
          if (!totalMonths) return;
          const startTime = Number(
            childNormalized.first_payment_time || normalizedPayment.first_payment_time || 0
          );
          const isFirstMonthCustom =
            childNormalized.is_first_month_custom === true || childNormalized.is_first_month_custom === 'true';
          const firstMonthAmount = childNormalized.first_month_amount || '';
          const monthlyAmount = childNormalized.monthly_amount || childNormalized.amount || '';

          for (let monthIndex = 0; monthIndex < totalMonths; monthIndex++) {
            const childMonthStatus = childState.monthlyStatuses?.[monthIndex] || 'pending';
            const batchMonthStatus = aggregated.monthlyStatuses?.[monthIndex];
            const resolvedChildStatus =
              childMonthStatus === 'pending' && batchMonthStatus && batchMonthStatus !== 'pending'
                ? batchMonthStatus
                : childMonthStatus;
            if (resolvedChildStatus === 'pending' || resolvedChildStatus === 'cancelled') {
              continue;
            }

            const executionTime = startTime + (monthIndex * MONTH_IN_SECONDS);
            const amount = monthIndex === 0 && isFirstMonthCustom && firstMonthAmount
              ? firstMonthAmount
              : monthlyAmount || childNormalized.amount;
            const isNew = shouldShowNewBadge(executionTime * 1000);

            const finalStatus: 'released' | 'failed' | 'cancelled' =
              resolvedChildStatus === 'failed'
                ? 'failed'
                : resolvedChildStatus === 'cancelled'
                ? 'cancelled'
                : 'released';

            expanded.push({
              ...childNormalized,
              id: `${childNormalized.id}-m${monthIndex + 1}`,
              release_time: executionTime,
              amount,
              status: finalStatus,
              cancellable: childNormalized.cancellable,
              __isNew: isNew,
              __recurringInstance: {
                monthNumber: monthIndex + 1,
                executionTime,
              },
              __parentId: normalizedPayment.id,
              __parentPayment: normalizedPayment,
            });
          }
        });
        continue;
      }

      const totalMonths = Number(normalizedPayment.total_months || 0);
      if (!totalMonths) continue;

      const startTime = Number(normalizedPayment.first_payment_time || 0);
      const isFirstMonthCustom =
        normalizedPayment.is_first_month_custom === true || normalizedPayment.is_first_month_custom === 'true';
      const firstMonthAmount = normalizedPayment.first_month_amount || '';
      const monthlyAmount = normalizedPayment.monthly_amount || normalizedPayment.amount || '';

      for (let monthIndex = 0; monthIndex < totalMonths; monthIndex++) {
        const monthStatus = aggregated.monthlyStatuses?.[monthIndex] || 'pending';
        if (monthStatus === 'pending' || monthStatus === 'cancelled') continue;

        const executionTime = startTime + (monthIndex * MONTH_IN_SECONDS);
        const amount = monthIndex === 0 && isFirstMonthCustom && firstMonthAmount
          ? firstMonthAmount
          : monthlyAmount || normalizedPayment.amount;
        const isNew = shouldShowNewBadge(executionTime * 1000);

        const derivedStatus =
          monthStatus === 'failed'
            ? 'failed'
            : 'released';

        expanded.push({
          ...normalizedPayment,
          id: `${normalizedPayment.id}-m${monthIndex + 1}`,
          release_time: executionTime,
          amount,
          status: derivedStatus,
          cancellable: normalizedPayment.cancellable,
          __isNew: isNew,
          __recurringInstance: {
            monthNumber: monthIndex + 1,
            executionTime,
          },
          __parentId: normalizedPayment.id,
          __parentPayment: normalizedPayment,
        });
      }
    }

    return expanded;
  }, [payments, lastSeenAt, onchainRecurring, sessionStartAt, batchMainByTx, normalizedWallet, showRecurringParentsOnly]);

  // Liste des bénéficiaires uniques (payee + batch) pour le filtre colonne Bénéficiaire
  const uniqueBeneficiariesFromPayments = useMemo(() => {
    const seen = new Set<string>();
    const list: { address: string; name: string }[] = [];
    for (const payment of payments) {
      const add = (addr: string | null | undefined) => {
        const raw = addr && String(addr).trim();
        if (!raw) return;
        const key = raw.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        const name = getBeneficiaryName(raw) || `${raw.slice(0, 6)}...${raw.slice(-4)}`;
        list.push({ address: raw, name });
      };
      add(payment.payee_address);
      if (payment.batch_beneficiaries?.length) {
        for (const b of payment.batch_beneficiaries) {
          add((b as { address?: string }).address);
        }
      }
    }
    list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    return list;
  }, [payments, getBeneficiaryName]);

  // Filtrer et trier les paiements
  const processedPayments = useMemo(() => {
    let filtered = expandedPayments.filter((payment) => {
      if (showRecurringParentsOnly && (payment.is_recurring || payment.payment_type === 'recurring')) return true;
      if (payment.__recurringInstance) return true;
      const isRecurringParent = payment.is_recurring || payment.payment_type === 'recurring';
      if (isRecurringParent && isIncomingForPayment(payment) && !isOutgoingForPayment(payment)) return false;
      return true;
    });

    // Filtre par bénéficiaire (menu flèche colonne Bénéficiaire)
    if (beneficiaryFilterAddress) {
      const target = beneficiaryFilterAddress.toLowerCase();
      filtered = filtered.filter((payment) => {
        if (payment.payee_address?.toLowerCase() === target) return true;
        return Array.isArray(payment.batch_beneficiaries) && payment.batch_beneficiaries.some(
          (b) => (b as { address?: string }).address?.toLowerCase() === target
        );
      });
    }

    // Recherche (inclut payee_address et tous les batch_beneficiaries pour trouver "Ali" etc.)
    if (searchTerm) {
      filtered = filtered.filter(payment => {
        const beneficiaryName = getBeneficiaryName(payment.payee_address);
        const searchLower = searchTerm.toLowerCase();
        const paymentLabel =
          typeof payment.payment_label === 'string'
            ? payment.payment_label
            : typeof payment.label === 'string'
            ? payment.label
            : '';
        const paymentCategory =
          typeof payment.payment_categorie === 'string'
            ? payment.payment_categorie
            : typeof payment.payment_category === 'string'
            ? payment.payment_category
            : typeof payment.category === 'string'
            ? payment.category
            : '';
        const mainMatch =
          payment.payee_address.toLowerCase().includes(searchLower) ||
          (beneficiaryName && beneficiaryName.toLowerCase().includes(searchLower));
        const batchMatch = Array.isArray(payment.batch_beneficiaries) && payment.batch_beneficiaries.some(
          (b) => {
            const addr = (b as { address?: string }).address;
            if (!addr) return false;
            const name = getBeneficiaryName(addr);
            return addr.toLowerCase().includes(searchLower) || (name && name.toLowerCase().includes(searchLower));
          }
        );
        return (
          mainMatch ||
          batchMatch ||
          payment.contract_address.toLowerCase().includes(searchLower) ||
          paymentLabel.toLowerCase().includes(searchLower) ||
          paymentCategory.toLowerCase().includes(searchLower)
        );
      });
    }

    // Tri
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;
      const aIsInstance = Boolean(a.__recurringInstance);
      const bIsInstance = Boolean(b.__recurringInstance);
      switch (sortField) {
        case 'beneficiary':
          comparison = (getBeneficiaryName(a.payee_address) || a.payee_address).localeCompare(
            getBeneficiaryName(b.payee_address) || b.payee_address
          );
          break;

        case 'amount':
          comparison = Number(BigInt(a.amount) - BigInt(b.amount));
          break;

        case 'date':
          comparison = a.release_time - b.release_time;
          if (comparison === 0 && aIsInstance !== bIsInstance) {
            // Prefer monthly instances when timestamps match
            comparison = aIsInstance ? 1 : -1;
          }
          break;

        case 'status':
          const statusOrder = { pending: 1, released: 2, cancelled: 3, failed: 4 };
          comparison = statusOrder[a.status as keyof typeof statusOrder] - 
                      statusOrder[b.status as keyof typeof statusOrder];
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [expandedPayments, searchTerm, sortField, sortDirection, getBeneficiaryName, normalizedWallet, showRecurringParentsOnly, beneficiaryFilterAddress]);

  // Pagination
  const totalPages = Math.ceil(processedPayments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPayments = processedPayments.slice(startIndex, endIndex);

  // Gérer le tri
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Icône de tri
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }

    return sortDirection === 'asc' ? (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Barre de recherche + export intégré */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex border border-gray-300 rounded-lg bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
          <div className="relative flex-1 min-w-0">
            <input
              type="text"
              placeholder={isMounted && translationsReady ? t('dashboard.table.search') : 'Rechercher par nom ou adresse...'}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className={`w-full pl-10 pr-4 py-2 border-0 focus:ring-0 focus:outline-none bg-transparent ${userAddress != null && period != null ? 'rounded-l-lg' : 'rounded-lg'}`}
            />
            <svg className="absolute left-3 top-2.5 w-5 h-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          {userAddress != null && period != null && (
            <ExportButton
              variant="inline"
              payments={payments}
              userAddress={userAddress}
              period={period}
            />
          )}
        </div>
      </div>

      {/* Tableau */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {/* Libellé & catégorie */}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {isMounted && translationsReady
                  ? t('dashboard.table.label', { defaultValue: 'Libellé' })
                  : 'Libellé'}
              </th>
              {/* Bénéficiaire : clic sur le libellé = tri ; une seule flèche = menu filtre */}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div ref={beneficiaryDropdownRef} className="relative flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleSort('beneficiary')}
                    className="flex items-center gap-1 rounded hover:bg-gray-100 px-1 py-0.5 -mx-1 cursor-pointer"
                  >
                    {isMounted && translationsReady ? t('dashboard.table.beneficiary') : 'Bénéficiaire'}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setBeneficiaryDropdownOpen((o) => !o);
                    }}
                    className={`p-1 rounded hover:bg-gray-100 ${beneficiaryFilterAddress ? 'text-blue-600' : 'text-gray-500'}`}
                    title={isMounted && translationsReady ? t('dashboard.table.filterByBeneficiary', { defaultValue: 'Filter by beneficiary' }) : 'Filtrer par bénéficiaire'}
                    aria-expanded={beneficiaryDropdownOpen}
                    aria-haspopup="listbox"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {beneficiaryDropdownOpen && (
                    <div
                      className="absolute left-0 top-full mt-1 z-50 min-w-[200px] max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg py-1"
                      role="listbox"
                    >
                      <button
                        type="button"
                        role="option"
                        onClick={() => {
                          setBeneficiaryFilterAddress(null);
                          setBeneficiaryDropdownOpen(false);
                          setCurrentPage(1);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${!beneficiaryFilterAddress ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                      >
                        {isMounted && translationsReady ? t('dashboard.table.allBeneficiaries', { defaultValue: 'All beneficiaries' }) : 'Tous les bénéficiaires'}
                      </button>
                      {uniqueBeneficiariesFromPayments.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-gray-500">
                          {isMounted && translationsReady ? t('dashboard.table.noBeneficiaries', { defaultValue: 'No beneficiaries in payments' }) : 'Aucun bénéficiaire dans les paiements'}
                        </div>
                      ) : (
                        uniqueBeneficiariesFromPayments.map((b) => {
                          const isSelected = beneficiaryFilterAddress?.toLowerCase() === b.address.toLowerCase();
                          return (
                            <button
                              key={b.address}
                              type="button"
                              role="option"
                              onClick={() => {
                                setBeneficiaryFilterAddress(b.address);
                                setBeneficiaryDropdownOpen(false);
                                setCurrentPage(1);
                              }}
                              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 truncate ${isSelected ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                            >
                              {b.name}
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </th>
              
              {/* Montant */}
              <th
                onClick={() => handleSort('amount')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center gap-2">
                  {isMounted && translationsReady ? t('dashboard.table.amount') : 'Montant'}
                  <SortIcon field="amount" />
                </div>
              </th>
              
              {/* 🆕 TYPE */}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              
              {/* Date de libération */}
              <th
                onClick={() => handleSort('date')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center gap-2">
                  {isMounted && translationsReady ? t('dashboard.table.releaseDate') : 'Date de libération'}
                  <SortIcon field="date" />
                </div>
              </th>
              
              {/* Statut */}
              <th
                onClick={() => handleSort('status')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center gap-2">
                  {isMounted && translationsReady ? t('dashboard.table.status') : 'Statut'}
                  <SortIcon field="status" />
                </div>
              </th>
              
              {/* Contrat */}
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                {isMounted && translationsReady ? t('dashboard.table.blockchain', { defaultValue: 'Blockchain' }) : 'Blockchain'}
              </th>
              
              {/* Actions */}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          
          <tbody>
            {currentPayments.map((payment) => (
              <TransactionRow
                key={payment.id}
                payment={payment}
                onRename={onRename}
                onCancel={onCancel}
                onDelete={onDelete}
                onEmailClick={(payment) => setEmailModalPayment(payment)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            {isMounted && translationsReady ? t('dashboard.table.pagination', { start: startIndex + 1, end: Math.min(endIndex, processedPayments.length), total: processedPayments.length }) : `Affichage de ${startIndex + 1} à ${Math.min(endIndex, processedPayments.length)} sur ${processedPayments.length} paiements`}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isMounted && translationsReady ? t('dashboard.table.previous') : 'Précédent'}
            </button>

            <div className="flex gap-1">
              {getPaginationItems(currentPage, totalPages).map((item, index) =>
                item === 'ellipsis' ? (
                  <span key={`ellipsis-${index}`} className="px-2 py-1 text-gray-500">
                    ...
                  </span>
                ) : (
                  <button
                    key={item}
                    onClick={() => setCurrentPage(item)}
                    className={`px-3 py-1 rounded-lg ${
                      currentPage === item
                        ? 'bg-blue-600 text-white'
                        : 'border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {item}
                  </button>
                )
              )}
            </div>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isMounted && translationsReady ? t('dashboard.table.next') : 'Suivant'}
            </button>
          </div>
        </div>
      )}

      {/* Modal Email */}
      {emailModalPayment && (
        <EmailTransactionModal
          payment={emailModalPayment}
          onClose={() => setEmailModalPayment(null)}
        />
      )}
    </div>
  );
}