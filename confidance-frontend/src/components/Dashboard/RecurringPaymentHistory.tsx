// components/Dashboard/RecurringPaymentHistory.tsx
'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Payment } from '@/hooks/useDashboard';

interface MonthlyPayment {
  monthNumber: number;
  date: number; // Timestamp
  status: 'executed' | 'pending' | 'failed' | 'cancelled';
  amount: string;
}

type RecurringPaymentWithStatus = Payment & {
  __monthlyStatuses?: Array<'executed' | 'failed' | 'pending' | 'cancelled'>;
};

interface RecurringPaymentHistoryProps {
  payment: RecurringPaymentWithStatus;
}

const MONTH_IN_SECONDS =
  process.env.NEXT_PUBLIC_CHAIN === 'base_sepolia' ? 300 : 2592000; // 5 min en testnet

export function RecurringPaymentHistory({ payment }: RecurringPaymentHistoryProps) {
  const { t, i18n } = useTranslation();
  
  const resolveExecutedMonths = () => {
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

  // Calculer l'historique des paiements mensuels
  const monthlyPayments = useMemo<MonthlyPayment[]>(() => {
    if (!payment.is_recurring || !payment.total_months || !payment.first_payment_time) {
      return [];
    }

    const totalMonths = Number(payment.total_months || 0);
    const rawExecutedMonths = resolveExecutedMonths();
    const isCompleted =
      payment.status === 'completed' || rawExecutedMonths >= totalMonths;
    const executedMonths = isCompleted ? totalMonths : rawExecutedMonths;
    const startTime = Number(payment.first_payment_time || 0);
    const now = Math.floor(Date.now() / 1000);
    const isCancelled = payment.status === 'cancelled';

    const payments: MonthlyPayment[] = [];

    // ✅ LOGIQUE SIMPLIFIÉE : On affiche seulement ce qu'on sait avec certitude
    // - executedMonths = nombre de mois RÉUSSIS (confirmé par le contrat)
    // - On ne peut pas savoir quels mois spécifiques ont échoué sans parser les events
    // - Donc on affiche : exécutés (premiers mois) et pending (le reste)
    // ✅ FIX : Si le paiement récurrent est annulé, tous les mois non exécutés sont "cancelled"
    const isFirstMonthCustom =
      payment.is_first_month_custom === true || payment.is_first_month_custom === 'true';
    const firstMonthAmount = payment.first_month_amount || '';
    const monthlyAmount = payment.monthly_amount || payment.amount || '';

    for (let monthIndex = 0; monthIndex < totalMonths; monthIndex++) {
      const paymentDate = startTime + (monthIndex * MONTH_IN_SECONDS);

      let status: 'executed' | 'pending' | 'failed' | 'cancelled';

      const monthlyStatusOverride = payment.__monthlyStatuses?.[monthIndex];
      if (monthlyStatusOverride) {
        status = monthlyStatusOverride;
      } else if (monthIndex < executedMonths) {
        // ✅ Les premiers N mois ont été exécutés avec succès
        status = 'executed';
      } else if (isCancelled) {
        // ✅ Si le paiement récurrent est annulé, tous les mois non exécutés sont annulés
        status = 'cancelled';
      } else if (paymentDate > now) {
        // Date dans le futur
        status = 'pending';
      } else {
        // Date passée mais pas exécuté avec succès
        // On ne sait pas si c'est un échec ou si le keeper n'a pas encore traité
        // On garde "pending" au lieu de "failed" pour éviter les faux positifs
        status = 'pending';
      }

      const amount =
        monthIndex === 0 && isFirstMonthCustom && firstMonthAmount
          ? firstMonthAmount
          : monthlyAmount;

      payments.push({
        monthNumber: monthIndex + 1,
        date: paymentDate,
        status,
        amount,
      });
    }

    return payments;
  }, [
    payment.is_recurring,
    payment.total_months,
    payment.first_payment_time,
    payment.executed_months,
    payment.next_execution_time,
    payment.last_execution_hash,
    payment.status,
    payment.__monthlyStatuses,
    payment.first_month_amount,
    payment.is_first_month_custom,
    payment.monthly_amount,
    payment.amount,
  ]);

  // Formater la date avec la locale actuelle
  const formatDate = (timestamp: number) => {
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
    
    return date.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatAmount = (amount: string) => {
    const symbol = payment.token_symbol || 'ETH';
    const decimals = symbol === 'ETH' ? 18 : 6;
    const amountNum = Number(BigInt(amount || '0')) / Math.pow(10, decimals);

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

  // Badge de statut
  const getStatusBadge = (status: string) => {
    const styles = {
      executed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    };

    const label = t(`dashboard.recurringHistory.status.${status}`, status);

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || styles.pending}`}>
        {label}
      </span>
    );
  };

  if (monthlyPayments.length === 0) {
    return null;
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 transition-all duration-200 ease-in-out">
      <div className="px-6 py-4">
        <div className="mb-3">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
            {t('dashboard.recurringHistory.title')}
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('dashboard.recurringHistory.executed', {
              executed: resolveExecutedMonths(),
              total: payment.total_months
            })}
          </p>
        </div>
        
        <div className="space-y-2">
          {monthlyPayments.map((monthlyPayment) => (
            <div
              key={monthlyPayment.monthNumber}
              className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-semibold">
                  {monthlyPayment.monthNumber}
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {t('dashboard.recurringHistory.month', { number: monthlyPayment.monthNumber })}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(monthlyPayment.date)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatAmount(monthlyPayment.amount)} {payment.token_symbol || 'ETH'}
                </div>
                {getStatusBadge(monthlyPayment.status)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
