// components/Dashboard/TransactionTable.tsx
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { usePublicClient } from 'wagmi';
import { Payment } from '@/hooks/useDashboard';
import { TransactionRow } from './TransactionRow';
import { useBeneficiaries } from '@/hooks/useBeneficiaries';
import { EmailTransactionModal } from './EmailTransactionModal';
import { recurringPaymentERC20Abi } from '@/lib/contracts/recurringPaymentERC20Abi';

interface TransactionTableProps {
  payments: Payment[];
  onRename: (address: string) => void;
  onCancel: (payment: Payment) => void;
  onDelete: (payment: Payment) => void;
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
  __monthlyStatuses?: Array<'executed' | 'failed' | 'pending' | 'cancelled'>;
  __batchChildren?: Payment[];
};

const MONTH_IN_SECONDS =
  process.env.NEXT_PUBLIC_CHAIN === 'base_sepolia' ? 300 : 2592000; // 5 min en testnet
const DASHBOARD_SEEN_KEY = 'dashboardLastSeenAt';

export function TransactionTable({ payments, onRename, onCancel, onDelete }: TransactionTableProps) {
  const { t, ready: translationsReady } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);
  const [batchMainByTx, setBatchMainByTx] = useState<Record<string, string>>({});
  const { getBeneficiaryName } = useBeneficiaries();
  const publicClient = usePublicClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
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
      }
    >
  >({});
  
  // State pour gérer le modal email
  const [emailModalPayment, setEmailModalPayment] = useState<Payment | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

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
    console.log(`🚀 useEffect triggered! publicClient=${!!publicClient}, payments.length=${payments.length}`);

    if (!publicClient) {
      console.log(`⚠️ No publicClient, skipping on-chain fetch`);
      return;
    }

    // 🔧 FIX: Get ALL unique contracts including batch children
    const allContractsMap = new Map<string, Payment>();

    const addPaymentIfRecurring = (payment: Payment, source: string) => {
      const hasMonths = Number(payment.total_months || 0) > 0;
      const hasFirstPaymentTime = Number(payment.first_payment_time || 0) > 0;
      // 🔧 FIX: Relax condition - accept any truthy value for is_recurring
      const isRecurringType =
        payment.is_recurring === true ||
        payment.is_recurring === 'true' ||
        payment.is_recurring === 1 ||
        payment.payment_type === 'recurring';
      const hasContract = typeof payment.contract_address === 'string' && payment.contract_address.length > 0;

      // 🔧 FIX: A payment is recurring if it has months OR first_payment_time
      const isRecurring = isRecurringType && (hasMonths || hasFirstPaymentTime);

      console.log(`  🔍 Checking ${source} payment ${payment.id.slice(0, 8)}:`, {
        contract: payment.contract_address?.slice(0, 10),
        hasMonths,
        hasFirstPaymentTime,
        total_months: payment.total_months,
        first_payment_time: payment.first_payment_time,
        total_months_type: typeof payment.total_months,
        isRecurringType,
        is_recurring: payment.is_recurring,
        is_recurring_type: typeof payment.is_recurring,
        payment_type: payment.payment_type,
        hasContract,
        finalDecision: isRecurring,
      });

      if (hasContract && isRecurring) {
        const key = payment.contract_address.toLowerCase();
        if (!allContractsMap.has(key)) {
          allContractsMap.set(key, payment);
          console.log(`    ✅ Added to fetch list`);
        } else {
          console.log(`    ⏩ Already in fetch list`);
        }
      } else {
        console.log(`    ❌ Skipped (missing: hasContract=${hasContract}, isRecurringType=${isRecurringType}, hasMonths=${hasMonths})`);
      }
    };

    console.log(`🔎 Scanning ${payments.length} payments for recurring contracts...`);
    payments.forEach((payment) => {
      addPaymentIfRecurring(payment, 'direct');
    });

    const recurringPayments = Array.from(allContractsMap.values());

    console.log(`📋 Found ${recurringPayments.length} unique recurring contracts to fetch`);
    if (recurringPayments.length === 0) {
      console.log(`⚠️ No recurring contracts found, skipping fetch`);
      return;
    }

    console.log(`🔄 Fetching on-chain data for ${recurringPayments.length} recurring contracts:`,
      recurringPayments.map(p => ({
        id: p.id.slice(0, 8),
        contract: p.contract_address.slice(0, 10),
        payee: p.payee_address.slice(0, 8),
      }))
    );

    let isMounted = true;

    const fetchOnchainRecurring = async () => {
      try {
        const entries = await Promise.all(
          recurringPayments.map(async (payment) => {
            try {
              const address = payment.contract_address as `0x${string}`;
              console.log(`  📡 Reading contract ${address.slice(0, 10)}... for payment ${payment.id.slice(0, 8)}`);

              const payeeName = payment.payee_address.slice(0, 8);

              // 🔧 FIX: First check if contract has totalMonths (recurring contract)
              let totalMonthsRaw: bigint | number;
              try {
                totalMonthsRaw = await publicClient.readContract({
                  address,
                  abi: recurringPaymentERC20Abi,
                  functionName: 'totalMonths',
                }) as bigint;
              } catch (error) {
                // Contract doesn't have totalMonths, not a recurring contract
                console.log(`⏩ Skipping non-recurring contract ${address}`);
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

                // 🔧 FIX: Improved 0-based vs 1-based detection
                // Use monthExecuted as source of truth to determine indexing
                const rawNumbers = merged.map((entry) => entry.monthNumber);
                const maxNumber = rawNumbers.length > 0 ? Math.max(...rawNumbers) : -1;

                // Determine if 0-based or 1-based
                let isZeroBased = true; // Default 0-based (Solidity standard)

                // If we have logs and monthExecuted
                if (rawNumbers.length > 0 && monthExecuted.length > 0) {
                  // Check if index 0 is really executed
                  const hasZero = rawNumbers.includes(0);
                  const hasOne = rawNumbers.includes(1);

                  if (hasZero && monthExecuted[0] === true) {
                    isZeroBased = true;
                  } else if (hasOne && monthExecuted[0] === true) {
                    isZeroBased = false;
                  } else if (maxNumber === totalMonths) {
                    // If maxNumber = totalMonths, it's probably 1-based
                    isZeroBased = false;
                  }
                }

                const resolveIndex = (monthNumber: number) =>
                  isZeroBased ? monthNumber : monthNumber - 1;

                console.log(`🔢 Indexing detection for ${address}:`, {
                  isZeroBased,
                  rawNumbers,
                  monthExecuted: monthExecuted.slice(0, 3),
                  maxNumber,
                });

                merged.forEach((entry) => {
                  const index = resolveIndex(entry.monthNumber);
                  console.log(`  📍 Event monthNumber=${entry.monthNumber} → index=${index}, status=${entry.status}`);
                  if (index < 0 || (totalMonths > 0 && index >= totalMonths)) {
                    console.log(`    ⚠️ Index out of bounds, skipping`);
                    return;
                  }
                  statusMap[index] = entry.status;
                });

                if (Object.keys(statusMap).length > 0) {
                  monthStatusByIndex = statusMap;
                  console.log(`  ✅ Final statusMap:`, statusMap);
                } else {
                  console.log(`  ⚠️ No valid status entries found`);
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
              };

              // 🔍 Debug: Logs to verify on-chain data
              console.log(`📊 On-chain data for payment ${payment.id.slice(0, 8)}:`, {
                contract: address,
                executedMonths: result.executedMonths,
                totalMonths: result.totalMonths,
                nextMonthToProcess: result.nextMonthToProcess,
                monthExecuted: result.monthExecuted,
                monthStatusByIndex: result.monthStatusByIndex,
              });

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
      }
    ) => {
      // 🔧 FIX: Prefer on-chain data but fallback to DB data
      const resolvedExecutedMonths =
        typeof onchainState?.executedMonths === 'number'
          ? onchainState.executedMonths
          : Number(sourcePayment.executed_months || 0);

      const resolvedTotalMonths =
        typeof onchainState?.totalMonths === 'number'
          ? onchainState.totalMonths
          : Number(sourcePayment.total_months || 0);

      const monthExecuted = onchainState?.monthExecuted || [];
      const baseStatus = sourcePayment.status;

      const resolvedNextMonth =
        typeof onchainState?.nextMonthToProcess === 'number'
          ? onchainState.nextMonthToProcess
          : resolvedExecutedMonths;

      console.log(`🔍 Resolving statuses for payment ${sourcePayment.id.slice(0, 8)}:`, {
        hasOnchainData: !!onchainState,
        resolvedExecutedMonths,
        resolvedTotalMonths,
        baseStatus,
        monthStatusByIndex: onchainState?.monthStatusByIndex,
      });
      const monthlyStatuses: Array<'executed' | 'failed' | 'pending' | 'cancelled'> = [];

      if (resolvedTotalMonths > 0) {
        const startTime = Number(sourcePayment.first_payment_time || 0);
        const now = Math.floor(Date.now() / 1000);

        for (let monthIndex = 0; monthIndex < resolvedTotalMonths; monthIndex++) {
          // 🔧 PRIORITY 1: On-chain logs (absolute source of truth)
          const logStatus = onchainState?.monthStatusByIndex?.[monthIndex];
          if (logStatus) {
            console.log(`      Month ${monthIndex + 1}: Using log status = ${logStatus}`);
            monthlyStatuses.push(logStatus);
            continue;
          }

          // 🔧 PRIORITY 2: Contract monthExecuted flag
          const executedFlag = monthExecuted[monthIndex];
          if (executedFlag === true) {
            console.log(`      Month ${monthIndex + 1}: monthExecuted flag = true → executed`);
            monthlyStatuses.push('executed');
            continue;
          }

          // 🔧 PRIORITY 3: Contract cancelled
          if (baseStatus === 'cancelled') {
            console.log(`      Month ${monthIndex + 1}: Contract cancelled → cancelled`);
            monthlyStatuses.push('cancelled');
            continue;
          }

          // 🔧 PRIORITY 4: Month less than executedMonths (confirmed by contract)
          if (monthIndex < resolvedExecutedMonths) {
            console.log(`      Month ${monthIndex + 1}: monthIndex < executedMonths (${monthIndex} < ${resolvedExecutedMonths}) → executed`);
            monthlyStatuses.push('executed');
            continue;
          }

          // 🔧 PRIORITY 5: Check if truly "failed" or just "pending"
          // Mark "failed" only if:
          // - executedFlag === false (explicitly marked as not executed)
          // - AND execution date has passed
          // - AND keeper already tried (monthIndex < resolvedNextMonth)
          const executionTime = startTime + (monthIndex * MONTH_IN_SECONDS);
          const isPastDue = executionTime <= now;
          const wasAttempted = monthIndex < resolvedNextMonth;

          if (executedFlag === false && isPastDue && wasAttempted) {
            console.log(`      Month ${monthIndex + 1}: executedFlag=false, isPastDue=true, wasAttempted=true → failed`);
            monthlyStatuses.push('failed');
            continue;
          }

          // 🔧 Default: pending (waiting)
          console.log(`      Month ${monthIndex + 1}: No match, defaulting to pending (executedFlag=${executedFlag}, isPastDue=${isPastDue}, wasAttempted=${wasAttempted})`);
          monthlyStatuses.push('pending');
        }
      }

      const allExecuted =
        monthlyStatuses.length > 0 &&
        monthlyStatuses.every((status) => status === 'executed');
      const hasExecuted = monthlyStatuses.some((status) => status === 'executed');

      const resolvedStatus =
        baseStatus === 'cancelled'
          ? 'cancelled'
          : allExecuted
          ? 'completed'
          : hasExecuted
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
            const monthlyStatuses: Array<'executed' | 'failed' | 'pending' | 'cancelled'> = [];
            if (totalMonths > 0) {
              for (let monthIndex = 0; monthIndex < totalMonths; monthIndex++) {
                const statuses = perChild.map((entry) => entry.monthlyStatuses[monthIndex] || 'pending');
                if (statuses.some((status) => status === 'failed')) {
                  monthlyStatuses.push('failed');
                  continue;
                }
                if (statuses.some((status) => status === 'cancelled')) {
                  monthlyStatuses.push('cancelled');
                  continue;
                }
                if (statuses.every((status) => status === 'executed')) {
                  monthlyStatuses.push('executed');
                  continue;
                }
                monthlyStatuses.push('pending');
              }
            }
            const resolvedExecutedMonths = monthlyStatuses.filter((status) => status === 'executed').length;
            const hasExecuted = monthlyStatuses.includes('executed');
            const hasFailed = monthlyStatuses.includes('failed');
            const allCancelled = batchChildren.every((child) => child.status === 'cancelled');
            const hasCancelled = batchChildren.some((child) => child.status === 'cancelled');
            const hasPendingOrActive = batchChildren.some(
              (child) => child.status === 'pending' || child.status === 'active'
            );
            const resolvedStatus =
              allCancelled || (hasCancelled && !hasPendingOrActive)
                ? 'cancelled'
                : totalMonths > 0 && resolvedExecutedMonths >= totalMonths
                ? 'completed'
                : hasExecuted
                ? 'active'
                : hasFailed
                ? 'failed'
                : payment.status;

            console.log(`📦 Batch aggregation for payment ${payment.id.slice(0, 8)}:`, {
              totalMonths,
              monthlyStatuses,
              resolvedStatus,
              childStatuses: perChild.map((p, i) => ({
                payee: batchChildren[i].payee_address.slice(0, 8),
                monthlyStatuses: p.monthlyStatuses,
              })),
            });

            return { resolvedExecutedMonths, resolvedTotalMonths: totalMonths, resolvedStatus, monthlyStatuses };
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

      expanded.push({
        ...normalizedPayment,
        __isNew: baseIsNew,
        __monthlyStatuses: aggregated.monthlyStatuses.length > 0 ? aggregated.monthlyStatuses : undefined,
        __batchChildren: hasBatchChildren ? batchChildren : undefined,
      });

      const isRecurring = normalizedPayment.is_recurring || normalizedPayment.payment_type === 'recurring';
      if (!isRecurring || !normalizedPayment.first_payment_time) continue;

      if (hasBatchChildren && batchChildren) {
        console.log(`👥 Processing batch recurring with ${batchChildren.length} children`);

        batchChildren.forEach((child, childIdx) => {
          const childState = resolveMonthlyStatuses(child, onchainRecurring[child.id]);
          const childNormalized: Payment = {
            ...child,
            executed_months: childState.resolvedExecutedMonths,
            total_months: childState.resolvedTotalMonths,
            status: childState.resolvedStatus,
          };
          const totalMonths = Number(childNormalized.total_months || 0);
          if (!totalMonths) return;

          console.log(`  📝 Child ${childIdx + 1}/${batchChildren.length} (${child.payee_address.slice(0, 8)}):`, {
            monthlyStatuses: childState.monthlyStatuses,
            status: childState.resolvedStatus,
          });

          const startTime = Number(childNormalized.first_payment_time || 0);
          const isFirstMonthCustom =
            childNormalized.is_first_month_custom === true || childNormalized.is_first_month_custom === 'true';
          const firstMonthAmount = childNormalized.first_month_amount || '';
          const monthlyAmount = childNormalized.monthly_amount || childNormalized.amount || '';

          for (let monthIndex = 0; monthIndex < totalMonths; monthIndex++) {
            // 🔧 FIX: Use child status AND check batch aggregation
            const childMonthStatus = childState.monthlyStatuses?.[monthIndex] || 'pending';
            const batchMonthStatus = aggregated.monthlyStatuses?.[monthIndex];

            // 🔧 If batch aggregation says "executed", all children must have a line
            // This ensures we see 1 line per beneficiary when the monthly is executed
            const shouldShow =
              childMonthStatus === 'executed' ||
              childMonthStatus === 'failed' ||
              (batchMonthStatus === 'executed' && childMonthStatus !== 'cancelled');

            console.log(`    📅 Month ${monthIndex + 1}:`, {
              childMonthStatus,
              batchMonthStatus,
              shouldShow,
              childExecuted: childState.monthlyStatuses?.[monthIndex],
              payee: child.payee_address.slice(0, 8),
            });

            if (!shouldShow) {
              console.log(`      ⏩ Skipping month ${monthIndex + 1} for ${child.payee_address.slice(0, 8)} (shouldShow=false)`);
              continue;
            }

            const executionTime = startTime + (monthIndex * MONTH_IN_SECONDS);
            const amount = monthIndex === 0 && isFirstMonthCustom && firstMonthAmount
              ? firstMonthAmount
              : monthlyAmount || childNormalized.amount;
            const isNew = shouldShowNewBadge(executionTime * 1000);

            // 🔧 Determine final status: priority to child status, otherwise use aggregation
            let finalStatus: 'released' | 'failed' | 'cancelled';
            if (childMonthStatus === 'failed') {
              finalStatus = 'failed';
            } else if (childMonthStatus === 'cancelled') {
              finalStatus = 'cancelled';
            } else if (childMonthStatus === 'executed') {
              finalStatus = 'released';
            } else if (batchMonthStatus === 'executed') {
              // If batch is executed but no child status, consider executed
              finalStatus = 'released';
            } else {
              finalStatus = 'failed';
            }

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
  }, [payments, lastSeenAt, onchainRecurring, sessionStartAt, batchMainByTx]);

  // Filtrer et trier les paiements
  const processedPayments = useMemo(() => {
    let filtered = expandedPayments;

    // Recherche
    if (searchTerm) {
      filtered = expandedPayments.filter(payment => {
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
        
        return (
          payment.payee_address.toLowerCase().includes(searchLower) ||
          (beneficiaryName && beneficiaryName.toLowerCase().includes(searchLower)) ||
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
          const nameA = getBeneficiaryName(a.payee_address) || a.payee_address;
          const nameB = getBeneficiaryName(b.payee_address) || b.payee_address;
          comparison = nameA.localeCompare(nameB);
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
  }, [expandedPayments, searchTerm, sortField, sortDirection, getBeneficiaryName]);

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
      {/* Barre de recherche */}
      <div className="p-4 border-b border-gray-200">
        <div className="relative">
          <input
            type="text"
            placeholder={isMounted && translationsReady ? t('dashboard.table.search') : 'Rechercher par nom ou adresse...'}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <svg className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
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
              {/* Bénéficiaire */}
              <th
                onClick={() => handleSort('beneficiary')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center gap-2">
                  {isMounted && translationsReady ? t('dashboard.table.beneficiary') : 'Bénéficiaire'}
                  <SortIcon field="beneficiary" />
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
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1 rounded-lg ${
                    currentPage === page
                      ? 'bg-blue-600 text-white'
                      : 'border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              ))}
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