// components/Dashboard/RecurringPaymentHistory.tsx
'use client';

import { useMemo } from 'react';
import { Payment } from '@/hooks/useDashboard';

interface MonthlyPayment {
  monthNumber: number;
  date: number; // Timestamp
  status: 'executed' | 'pending' | 'failed';
}

interface RecurringPaymentHistoryProps {
  payment: Payment;
}

const MONTH_IN_SECONDS = 2592000; // 30 jours

export function RecurringPaymentHistory({ payment }: RecurringPaymentHistoryProps) {
  // Calculer l'historique des paiements mensuels
  const monthlyPayments = useMemo<MonthlyPayment[]>(() => {
    if (!payment.is_recurring || !payment.total_months || !payment.first_payment_time) {
      return [];
    }

    const totalMonths = payment.total_months;
    const executedMonths = payment.executed_months || 0;
    const startTime = payment.first_payment_time;
    const now = Math.floor(Date.now() / 1000);

    const payments: MonthlyPayment[] = [];

    // ✅ LOGIQUE SIMPLIFIÉE : On affiche seulement ce qu'on sait avec certitude
    // - executedMonths = nombre de mois RÉUSSIS (confirmé par le contrat)
    // - On ne peut pas savoir quels mois spécifiques ont échoué sans parser les events
    // - Donc on affiche : exécutés (premiers mois) et pending (le reste)
    for (let monthIndex = 0; monthIndex < totalMonths; monthIndex++) {
      const paymentDate = startTime + (monthIndex * MONTH_IN_SECONDS);

      let status: 'executed' | 'pending' | 'failed';

      if (monthIndex < executedMonths) {
        // ✅ Les premiers N mois ont été exécutés avec succès
        status = 'executed';
      } else if (paymentDate > now) {
        // Date dans le futur
        status = 'pending';
      } else {
        // Date passée mais pas exécuté avec succès
        // On ne sait pas si c'est un échec ou si le keeper n'a pas encore traité
        // On garde "pending" au lieu de "failed" pour éviter les faux positifs
        status = 'pending';
      }

      payments.push({
        monthNumber: monthIndex + 1,
        date: paymentDate,
        status,
      });
    }

    return payments;
  }, [payment.is_recurring, payment.total_months, payment.first_payment_time, payment.executed_months]);

  // Formater la date
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  // Badge de statut
  const getStatusBadge = (status: string) => {
    const styles = {
      executed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };

    const labels = {
      executed: 'Exécuté',
      pending: 'En attente',
      failed: 'Échoué',
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || styles.pending}`}>
        {labels[status as keyof typeof labels] || status}
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
            Historique des paiements mensuels
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {payment.executed_months || 0} / {payment.total_months} mois exécutés
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
                    Mois {monthlyPayment.monthNumber}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(monthlyPayment.date)}
                  </div>
                </div>
              </div>
              {getStatusBadge(monthlyPayment.status)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
