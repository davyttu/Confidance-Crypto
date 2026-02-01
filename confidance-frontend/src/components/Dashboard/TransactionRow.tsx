// components/Dashboard/TransactionRow.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useAccount } from 'wagmi';
import { Payment } from '@/hooks/useDashboard';
import { useBeneficiaries } from '@/hooks/useBeneficiaries';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Copy, ExternalLink, Mail, X, Edit2, ChevronDown, ChevronRight, Info } from 'lucide-react';
import { sumAmounts } from '@/lib/utils/amountFormatter';
import { BeneficiariesDropdown } from './BeneficiariesDropdown';
import { RecurringPaymentHistory } from './RecurringPaymentHistory';
import {
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  PaymentCategory
} from '@/types/payment-identity';

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

interface TransactionRowProps {
  payment: DashboardPayment;
  onRename: (address: string) => void;
  onCancel: (payment: Payment) => void;
  onDelete: (payment: Payment) => void;
  onEmailClick?: (payment: Payment) => void;
}

export function TransactionRow({ payment, onRename, onCancel, onDelete, onEmailClick }: TransactionRowProps) {
  const { t, i18n, ready: translationsReady } = useTranslation();
  const { address } = useAccount();
  const { getBeneficiaryName } = useBeneficiaries();
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showContractTooltip, setShowContractTooltip] = useState(false);
  const tooltipHideTimeoutRef = useRef<number | null>(null);
  const isRecurringInstance = Boolean(payment.__recurringInstance);
  const cancelTargetPayment = isRecurringInstance ? payment : (payment.__parentPayment ?? payment);

  // Vérifier si c'est un paiement récurrent
  const isRecurringParent = (payment.is_recurring || payment.payment_type === 'recurring') && !isRecurringInstance;
  const isRecurring = isRecurringParent;
  const deletableStatuses = new Set(['released', 'cancelled', 'failed', 'completed']);
  const canDelete = !isRecurringInstance && deletableStatuses.has(payment.status);
  const totalMonths = Number(payment.total_months || 0);
  const executedMonthsRaw = Number(payment.executed_months || 0);
  const isCompletedRecurring =
    isRecurringParent &&
    totalMonths > 0 &&
    (payment.status === 'completed' || executedMonthsRaw >= totalMonths);
  const isLastRecurringInstance =
    isRecurringInstance &&
    totalMonths > 0 &&
    Boolean(payment.__recurringInstance) &&
    payment.__recurringInstance.monthNumber >= totalMonths;
  const canCancelRecurringProcess =
    payment.cancellable &&
    !isCompletedRecurring &&
    !isLastRecurringInstance &&
    payment.status !== 'cancelled' &&
    payment.status !== 'failed';

  const beneficiaryName = getBeneficiaryName(payment.payee_address);
  const displayName = beneficiaryName || `${payment.payee_address.slice(0, 6)}...${payment.payee_address.slice(-4)}`;
  const normalizedWallet = address?.toLowerCase();
  const isIncoming = Boolean(
    normalizedWallet &&
    (payment.payee_address?.toLowerCase() === normalizedWallet ||
      payment.batch_beneficiaries?.some(
        (beneficiary) => beneficiary.address?.toLowerCase() === normalizedWallet
      ))
  );
  const contractAddresses = (() => {
    const addresses = new Set<string>();
    if (payment.contract_address) {
      addresses.add(payment.contract_address);
    }
    if (payment.__batchChildren) {
      payment.__batchChildren.forEach((child) => {
        if (child.contract_address) {
          addresses.add(child.contract_address);
        }
      });
    }
    return Array.from(addresses);
  })();
  const contractEntries = (() => {
    const entries: Array<{ address: string; label: string }> = [];
    const seen = new Set<string>();
    const truncate = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;
    if (payment.__batchChildren?.length) {
      payment.__batchChildren.forEach((child, index) => {
        const address = child.contract_address;
        if (!address) return;
        const key = address.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        const name = getBeneficiaryName(child.payee_address);
        const label = name ? `Contract ${name}` : `Contract ${index + 1}`;
        entries.push({ address, label });
      });
    }
    contractAddresses.forEach((address, index) => {
      const key = address.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      entries.push({ address, label: `Contract ${index + 1}` });
    });
    return entries;
  })();
  const transactionHash =
    payment.transaction_hash ||
    payment.tx_hash ||
    payment.__batchChildren?.find((child) => child.transaction_hash)?.transaction_hash ||
    payment.__batchChildren?.find((child) => child.tx_hash)?.tx_hash ||
    null;

  // Formater le montant avec la locale actuelle
  const formatAmount = (amount: string, symbol: string) => {
    const decimals = symbol === 'ETH' ? 18 : 6;
    const amountNum = Number(BigInt(amount)) / Math.pow(10, decimals);
    
    // Mapper les langues i18n vers les locales de formatage
    const localeMap: Record<string, string> = {
      'fr': 'fr-FR',
      'en': 'en-GB',
      'es': 'es-ES',
      'ru': 'ru-RU',
      'zh': 'zh-CN',
    };
    const currentLang = i18n.language || 'fr';
    const baseLang = currentLang.split('-')[0];
    const locale = localeMap[baseLang] || localeMap['en'];
    
    return amountNum.toLocaleString(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: symbol === 'ETH' ? 5 : 2,
    });
  };

  const getRecurringDisplayAmount = () => {
    const isFirstMonthCustom =
      payment.is_first_month_custom === true || payment.is_first_month_custom === 'true';
    if (payment.__recurringInstance) {
      return payment.amount;
    }
    // Parent row: always show the initial/reference amount (not the last executed installment).
    // When first month is custom, show first_month_amount (e.g. 3 USDC); otherwise monthly amount.
    if (isFirstMonthCustom && payment.first_month_amount) {
      return payment.first_month_amount;
    }
    if (payment.monthly_amount) {
      return payment.monthly_amount;
    }
    return payment.amount;
  };

  const getNextInstallmentAmount = () => {
    if (!isRecurringParent) return null;
    const executedMonths = Number(payment.executed_months || 0);
    const totalMonths = Number(payment.total_months || 0);
    if (totalMonths > 0 && executedMonths >= totalMonths) return null;
    const isFirstMonthCustom =
      payment.is_first_month_custom === true || payment.is_first_month_custom === 'true';

    if (payment.batch_beneficiaries && payment.batch_beneficiaries.length > 0) {
      const beneficiariesCount = payment.batch_beneficiaries.length;
      const monthlyTotals = sumAmounts(payment.batch_beneficiaries.map((beneficiary) => beneficiary.amount || '0'));
      if (isFirstMonthCustom && executedMonths === 0 && payment.first_month_amount) {
        return BigInt(payment.first_month_amount) * BigInt(beneficiariesCount);
      }
      return monthlyTotals;
    }

    if (isFirstMonthCustom && executedMonths === 0 && payment.first_month_amount) {
      return BigInt(payment.first_month_amount);
    }

    return BigInt(payment.monthly_amount || payment.amount || '0');
  };

  // Formater la date et l'heure avec la locale actuelle
  const formatDateAndTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    
    // Mapper les langues i18n vers les locales de formatage
    const localeMap: Record<string, string> = {
      'fr': 'fr-FR',
      'en': 'en-GB',
      'es': 'es-ES',
      'ru': 'ru-RU',
      'zh': 'zh-CN',
    };
    const currentLang = i18n.language || 'fr';
    const baseLang = currentLang.split('-')[0];
    const locale = localeMap[baseLang] || localeMap['en'];
    
    // Formater la date
    const dateFormatted = date.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    
    // Formater l'heure
    const timeFormatted = date.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    return { date: dateFormatted, time: timeFormatted };
  };

  // Copier dans le presse-papier
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (!contextMenu) return;
    const handleClose = () => setContextMenu(null);
    window.addEventListener('click', handleClose);
    window.addEventListener('scroll', handleClose, true);
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('scroll', handleClose, true);
    };
  }, [contextMenu]);

  const contextMenuPortal =
    contextMenu && canDelete && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed z-50 min-w-[180px] rounded-lg border border-gray-200 bg-white shadow-xl"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            role="menu"
          >
            <button
              type="button"
              onClick={() => {
                setContextMenu(null);
                onDelete(payment);
              }}
              className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            >
              Supprimer du dashboard
            </button>
          </div>,
          document.body
        )
      : null;

  // Déterminer le type de paiement avec emoji et texte
  const getPaymentType = () => {
    const types: Array<{ emoji: string; text: string }> = [];

    if (payment.is_batch) {
      types.push({ emoji: '👥', text: `Batch (${payment.batch_count || 0})` });
    }
    if (payment.payment_type === 'recurring') {
      types.push({ emoji: '🔄', text: 'Récurrent' });
    }
    if (payment.is_instant || payment.payment_type === 'instant') {
      types.push({ emoji: '⚡', text: 'Instantané' });
    }

    // Par défaut: programmé si rien de spécifique
    if (types.length === 0) {
      types.push({ emoji: '🕐', text: 'Programmé' });
    }

    return types;
  };

  const resolvePaymentLabel = () => {
    const rawLabel =
      typeof payment.payment_label === 'string'
        ? payment.payment_label.trim()
        : typeof payment.label === 'string'
        ? payment.label.trim()
        : '';
    return rawLabel;
  };

  const resolvePaymentCategory = () => {
    const rawCategory =
      typeof payment.payment_categorie === 'string'
        ? payment.payment_categorie.trim()
        : typeof payment.payment_category === 'string'
        ? payment.payment_category.trim()
        : typeof payment.category === 'string'
        ? payment.category.trim()
        : '';

    const categoryKeys = Object.keys(CATEGORY_LABELS) as PaymentCategory[];
    const normalizedCategory = categoryKeys.includes(rawCategory as PaymentCategory)
      ? (rawCategory as PaymentCategory)
      : null;

    return {
      raw: rawCategory,
      key: normalizedCategory
    };
  };

  // Statut avec badge
  const getStatusBadge = () => {
    const statusClass = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      active: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      released: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
      failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    };

    const statusLabels = {
      pending: translationsReady ? t('dashboard.status.pending') : 'En attente',
      active: translationsReady ? t('dashboard.status.active', { defaultValue: 'Actif' }) : 'Actif',
      released: translationsReady ? t('dashboard.status.released') : 'Libéré',
      cancelled: translationsReady ? t('dashboard.status.cancelled') : 'Annulé',
      failed: translationsReady ? t('dashboard.status.failed') : 'Échoué',
      completed: translationsReady ? t('dashboard.status.completed', { defaultValue: 'Terminé' }) : 'Terminé',
    };

    const isRecurringParent = (payment.payment_type === 'recurring' || payment.is_recurring) && !isRecurringInstance;
    const hasAllMonths =
      isRecurringParent &&
      typeof payment.executed_months === 'number' &&
      typeof payment.total_months === 'number' &&
      payment.executed_months >= payment.total_months;
    const derivedStatus = isRecurringInstance
      ? payment.status
      : (hasAllMonths || payment.status === 'completed' ? 'completed' : payment.status);
    const hasWarning =
      derivedStatus === 'completed' &&
      typeof payment.last_execution_hash === 'string' &&
      payment.last_execution_hash.toLowerCase().startsWith('skipped');

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusClass[derivedStatus as keyof typeof statusClass] || statusClass.pending}`}>
        {hasWarning ? '⚠️ ' : ''}
        {statusLabels[derivedStatus as keyof typeof statusLabels] || derivedStatus}
      </span>
    );
  };

  return (
    <>
      <tr
        className="border-b border-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        onContextMenu={(event) => {
          if (!canDelete) return;
          event.preventDefault();
          setContextMenu({ x: event.clientX, y: event.clientY });
        }}
      >
        {/* Libellé & catégorie */}
        <td className="px-6 py-4 whitespace-nowrap">
          {(() => {
            const label = resolvePaymentLabel();
            const { raw, key } = resolvePaymentCategory();
            const lang = (i18n.language || 'fr').split('-')[0];
            const categoryLabel = key
              ? CATEGORY_LABELS[key][lang] || CATEGORY_LABELS[key].en
              : raw;
            const categoryIcon = key ? CATEGORY_ICONS[key] : raw ? '🏷️' : '📌';
            const categoryStyles = key
              ? CATEGORY_COLORS[key]
              : {
                  bg: 'bg-gray-50 dark:bg-gray-950/30',
                  text: 'text-gray-700 dark:text-gray-300',
                  border: 'border-gray-200 dark:border-gray-800'
                };
            const isNew = Boolean(payment.__isNew);
            const recurringInstanceLabel = payment.__recurringInstance
              ? `Mensualité ${payment.__recurringInstance.monthNumber}${payment.total_months ? `/${payment.total_months}` : ''}`
              : null;

            return (
              <div className="flex min-w-[160px] flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[180px]"
                      title={label || 'Sans libellé'}
                    >
                      {label || 'Sans libellé'}
                    </span>
                    {isNew && (
                      <span className="inline-flex items-center rounded-full bg-gradient-to-r from-pink-500 to-purple-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
                        {translationsReady ? t('dashboard.badges.new', { defaultValue: 'New' }) : 'New'}
                      </span>
                    )}
                  </div>
                  {isRecurring && (
                    <button
                      onClick={() => setIsExpanded(!isExpanded)}
                      className="flex-shrink-0 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                      title={isExpanded ? t('tooltips.hideHistory') : t('tooltips.showHistory')}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      )}
                    </button>
                  )}
                </div>
                <span
                  className={`inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${categoryStyles.bg} ${categoryStyles.text} ${categoryStyles.border}`}
                  title={categoryLabel || 'Sans catégorie'}
                >
                  <span aria-hidden="true">{categoryIcon}</span>
                  <span>{categoryLabel || 'Sans catégorie'}</span>
                </span>
                {recurringInstanceLabel && (
                  <span className="inline-flex w-fit items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
                    {recurringInstanceLabel}
                  </span>
                )}
              </div>
            );
          })()}
        </td>
        {/* Bénéficiaire */}
        <td className="px-6 py-4 whitespace-nowrap">
          <BeneficiariesDropdown
            payment={payment}
            onRename={onRename}
            showBatchControls={!payment.__recurringInstance}
          />
        </td>

      {/* Montant */}
      <td className="px-6 py-4 whitespace-nowrap">
        {(() => {
          const tokenSymbol = payment.token_symbol || 'ETH';
          const nextInstallment = getNextInstallmentAmount();
          const displayAmount = nextInstallment
            ? nextInstallment.toString()
            : (isRecurring ? getRecurringDisplayAmount() : payment.amount);
          const isFailed = payment.status === 'failed';
          const now = Math.floor(Date.now() / 1000);
          const isInstantOrScheduled = payment.payment_type === 'instant' || payment.payment_type === 'scheduled';
          const hasReachedReleaseTime = Number.isFinite(payment.release_time) && payment.release_time <= now;
          const isSettledStatus =
            payment.status === 'released' ||
            payment.status === 'completed' ||
            payment.status === 'paid' ||
            (payment.status === 'active' && isInstantOrScheduled && hasReachedReleaseTime);
          const isIncomingAmount = isIncoming && (isRecurringInstance || isSettledStatus);
          const amountPrefix = isIncomingAmount && !isFailed ? '+' : '';
          // Ligne parent récurrente : montant de référence toujours en couleur normale (pas grisé)
          const isParentReferenceAmount = isRecurringParent && !nextInstallment;
          const amountColor =
            isFailed
              ? 'text-gray-400 dark:text-gray-500'
              : isIncomingAmount
              ? 'text-green-600 dark:text-green-400'
              : isParentReferenceAmount || !nextInstallment
              ? 'text-gray-900 dark:text-white'
              : 'text-gray-500 dark:text-gray-400';
          const showReferenceNote = isRecurringParent;
          return (
            <div className="flex flex-col">
              <div className={`text-sm font-semibold ${amountColor}`}>
                {amountPrefix}{formatAmount(displayAmount, tokenSymbol)} {tokenSymbol}
              </div>
              {showReferenceNote && (
                <span
                  className="mt-1 inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  title={t('dashboard.table.referenceAmountNote', { defaultValue: 'This amount is not debited' })}
                >
                  <Info className="h-3 w-3" />
                  {t('dashboard.table.referenceAmountNote', { defaultValue: 'This amount is not debited' })}
                </span>
              )}
            </div>
          );
        })()}
      </td>

      {/* Type */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="group relative inline-block">
          <span
            className="text-lg cursor-help inline-flex items-center gap-1"
            title={getPaymentType().map((type) => type.text).join(' • ')}
          >
            {getPaymentType().map((type, index) => (
              <span key={`${type.text}-${index}`} aria-label={type.text}>
                {type.emoji}
              </span>
            ))}
          </span>
          {/* Tooltip */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
            {getPaymentType().map((type) => type.text).join(' • ')}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
          </div>
        </div>
      </td>

      {/* Date de libération */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex flex-col items-center">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {formatDateAndTime(payment.release_time).date}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {formatDateAndTime(payment.release_time).time}
          </span>
        </div>
      </td>

      {/* Statut */}
      <td className="px-6 py-4 whitespace-nowrap">
        {getStatusBadge()}
      </td>

      {/* Contrat */}
      <td className="px-6 py-4 whitespace-nowrap text-center">
        {contractEntries.length > 0 ? (
          <div
            className="relative inline-flex items-center justify-center"
            onMouseEnter={() => {
              if (tooltipHideTimeoutRef.current) {
                window.clearTimeout(tooltipHideTimeoutRef.current);
                tooltipHideTimeoutRef.current = null;
              }
              setShowContractTooltip(true);
            }}
            onMouseLeave={() => {
              tooltipHideTimeoutRef.current = window.setTimeout(() => {
                setShowContractTooltip(false);
                tooltipHideTimeoutRef.current = null;
              }, 250);
            }}
          >
            <a
              href={`https://basescan.org/address/${contractEntries[0].address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center"
              title={t('dashboard.table.viewOnBasescan')}
            >
              <img
                src="/blockchains/base.svg"
                alt="Base"
                className="w-6 h-6"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    parent.innerHTML = '<div class="w-6 h-6 rounded bg-blue-500 flex items-center justify-center"><span class="text-white text-xs font-bold">B</span></div>';
                  }
                }}
              />
            </a>
            {/* Tooltip */}
            {showContractTooltip && (
              <div
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 min-w-[220px] px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg z-10"
                onMouseEnter={() => {
                  if (tooltipHideTimeoutRef.current) {
                    window.clearTimeout(tooltipHideTimeoutRef.current);
                    tooltipHideTimeoutRef.current = null;
                  }
                  setShowContractTooltip(true);
                }}
                onMouseLeave={() => {
                  tooltipHideTimeoutRef.current = window.setTimeout(() => {
                    setShowContractTooltip(false);
                    tooltipHideTimeoutRef.current = null;
                  }, 250);
                }}
              >
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {contractEntries.map((entry) => (
                    <div key={entry.address} className="space-y-1">
                      <div className="text-[10px] uppercase tracking-wide text-gray-300">
                        {entry.label}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono">
                          {entry.address.slice(0, 10)}...{entry.address.slice(-8)}
                        </span>
                        <button
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            copyToClipboard(entry.address);
                          }}
                          className="text-gray-200 hover:text-white transition-colors"
                          title={t('dashboard.table.copyAddress')}
                        >
                          <Copy className={`w-4 h-4 ${copied ? 'text-green-400' : ''}`} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {transactionHash && (
                  <div className="mt-3 border-t border-white/10 pt-2">
                    <div className="text-[10px] uppercase tracking-wide text-gray-300">
                      {t('dashboard.table.transactionHash')}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono">
                        {transactionHash.slice(0, 10)}...{transactionHash.slice(-8)}
                      </span>
                      <button
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          copyToClipboard(transactionHash);
                        }}
                        className="text-gray-200 hover:text-white transition-colors"
                        title={t('dashboard.table.copyHash')}
                      >
                        <Copy className={`w-4 h-4 ${copied ? 'text-green-400' : ''}`} />
                      </button>
                    </div>
                  </div>
                )}
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
              </div>
            )}
          </div>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
        <div className="flex items-center gap-2">
          {onEmailClick && (
            <button
              onClick={() => onEmailClick(payment)}
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
              title={t('dashboard.table.sendByEmail')}
            >
              <Mail className="w-4 h-4" />
            </button>
          )}
          {(payment.status === 'pending' || isRecurringParent || isRecurringInstance) && canCancelRecurringProcess && (
            <button
              onClick={() => onCancel(cancelTargetPayment)}
              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors"
              title={t('common.cancel')}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
    {contextMenuPortal}
    {isRecurring && isExpanded && (
      <tr className="border-b border-gray-200">
        <td colSpan={8} className="p-0">
          <RecurringPaymentHistory payment={payment} />
        </td>
      </tr>
    )}
    </>
  );
}
