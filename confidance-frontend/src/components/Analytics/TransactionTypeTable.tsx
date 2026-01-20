// components/Analytics/TransactionTypeTable.tsx
'use client';

import { MonthlyStats } from '@/hooks/useMonthlyAnalytics';
import { useTranslationReady } from '@/hooks/useTranslationReady';

interface TransactionTypeTableProps {
  stats: MonthlyStats;
}

export function TransactionTypeTable({ stats }: TransactionTypeTableProps) {
  const { t } = useTranslationReady();
  const { breakdown } = stats;

  const rows = [
    {
      type: t('analytics.types.instant', { defaultValue: 'Instant Payments' }),
      icon: '💰',
      data: breakdown.instant,
      color: 'text-blue-600'
    },
    {
      type: t('analytics.types.scheduled', { defaultValue: 'Scheduled Payments' }),
      icon: '⏰',
      data: breakdown.scheduled,
      color: 'text-purple-600'
    },
    {
      type: t('analytics.types.recurring', { defaultValue: 'Recurring Payments' }),
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
        <h2 className="text-lg font-semibold text-gray-900">
          {t('analytics.table.title', { defaultValue: 'Breakdown by Transaction Type' })}
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('analytics.table.type', { defaultValue: 'Transaction Type' })}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('analytics.table.count', { defaultValue: 'Count' })}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('analytics.table.volume', { defaultValue: 'Volume' })}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('analytics.table.avgFees', { defaultValue: 'Avg Fees' })}
              </th>
            </tr>
          </thead>
          
          <tbody className="divide-y divide-gray-200">
            {rows.map((row) => (
              <tr key={row.type} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{row.icon}</span>
                    <span className={`font-medium ${row.color}`}>{row.type}</span>
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
                <span className="text-gray-900">
                  {t('analytics.table.total', { defaultValue: 'TOTAL' })}
                </span>
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
