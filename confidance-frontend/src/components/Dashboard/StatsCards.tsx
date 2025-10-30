// components/Dashboard/StatsCards.tsx
'use client';

import { Payment } from '@/hooks/useDashboard';
import { formatAmount } from '@/lib/utils/amountFormatter';

interface StatsCardsProps {
  payments: Payment[];
}

export function StatsCards({ payments }: StatsCardsProps) {
  // Calculer les stats
  const totalSent = payments.reduce((sum, p) => {
    return sum + BigInt(p.amount);
  }, BigInt(0));

  const pending = payments.filter(p => p.status === 'pending').length;
  const released = payments.filter(p => p.status === 'released').length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {/* Total envoyé */}
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium opacity-90">Total envoyé</h3>
          <svg className="w-8 h-8 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-3xl font-bold">{formatAmount(totalSent.toString())} ETH</p>
        <p className="text-sm opacity-80 mt-2">{payments.length} paiement{payments.length > 1 ? 's' : ''} au total</p>
      </div>

      {/* En cours */}
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium opacity-90">En cours</h3>
          <svg className="w-8 h-8 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-3xl font-bold">{pending}</p>
        <p className="text-sm opacity-80 mt-2">Paiement{pending > 1 ? 's' : ''} programmé{pending > 1 ? 's' : ''}</p>
      </div>

      {/* Exécutés */}
      <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium opacity-90">Exécutés</h3>
          <svg className="w-8 h-8 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-3xl font-bold">{released}</p>
        <p className="text-sm opacity-80 mt-2">Paiement{released > 1 ? 's' : ''} libéré{released > 1 ? 's' : ''}</p>
      </div>
    </div>
  );
}
