// components/Analytics/TransactionTypeTable.tsx
'use client';

import { MonthlyStats } from '@/hooks/useMonthlyAnalytics';

interface TransactionTypeTableProps {
  stats: MonthlyStats;
}

export function TransactionTypeTable({ stats }: TransactionTypeTableProps) {
  const { breakdown } = stats;

  const rows = [
    {
      typeKey: 'analytics.transactionTypeTable.instant',
      icon: '💰',
      data: breakdown.instant,
      color: 'text-blue-600'
    },
    {
      typeKey: 'analytics.transactionTypeTable.scheduled',
      icon: '⏰',
      data: breakdown.scheduled,
      color: 'text-purple-600'
    },
    {
      typeKey: 'analytics.transactionTypeTable.recurring',
      icon: '🔄',
      data: breakdown.recurring,
      color: 'text-green-600'
    }
  ];

  const totalCount = breakdown.instant.count + breakdown.scheduled.count + breakdown.recurring.count;
  const totalVolume = breakdown.instant.volume + breakdown.scheduled.volume + breakdown.recurring.volume;
  const totalAvgFees = totalCount > 0 
    ? (breakdown.instant.avgFees * BigInt(breakdown.instant.count) + 
       breakdown.scheduled.avgFees * BigInt(breakdown.scheduled.count) + 
       breakdown.recurring.avgFees * BigInt(breakdown.recurring.count)) / BigInt(totalCount)
    : BigInt(0);

  return (
    <div className="bg-white rounded-xl shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">{t('analytics.transactionTypeTable.title')}</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('analytics.transactionTypeTable.typeHeader')}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('analytics.transactionTypeTable.countHeader')}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('analytics.transactionTypeTable.volumeHeader')}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('analytics.transactionTypeTable.avgFeesHeader')}
              </th>
            </tr>
          </thead>
          
          <tbody className="divide-y divide-gray-200">
            {rows.map((row) => (
              <tr key={row.typeKey} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{row.icon}</span>
                    <span className={`font-medium ${row.color}`}>{t(row.typeKey)}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-gray-900 font-medium">{row.data.count}</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-gray-900 font-mono">{row.data.volumeFormatted} ETH</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-gray-600 font-mono">{row.data.avgFeesFormatted} ETH</span>
                </td>
              </tr>
            ))}
            
            {/* Ligne Total */}
            <tr className="bg-gray-100 font-bold">
              <td className="px-6 py-4">
                <span className="text-gray-900">{t('analytics.transactionTypeTable.total')}</span>
              </td>
              <td className="px-6 py-4 text-right">
                <span className="text-gray-900">{totalCount}</span>
              </td>
              <td className="px-6 py-4 text-right">
                <span className="text-gray-900 font-mono">{stats.totalVolumeFormatted} ETH</span>
              </td>
              <td className="px-6 py-4 text-right">
                <span className="text-gray-900 font-mono">
                  {(Number(totalAvgFees) / 1e18).toFixed(6)} ETH
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
