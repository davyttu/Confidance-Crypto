// components/Analytics/KPICards.tsx
'use client';

import { MonthlyStats } from '@/hooks/useMonthlyAnalytics';

interface KPICardsProps {
  stats: MonthlyStats;
}

export function KPICards({ stats }: KPICardsProps) {
  const { previousMonthComparison } = stats;

  const getTrendIcon = (change?: number) => {
    if (!change || Math.abs(change) < 1) {
      return <span className="text-gray-500">→</span>;
    }
    return change > 0 
      ? <span className="text-green-600">↑</span>
      : <span className="text-red-600">↓</span>;
  };

  const getTrendColor = (change?: number) => {
    if (!change || Math.abs(change) < 1) return 'text-gray-500';
    return change > 0 ? 'text-green-600' : 'text-red-600';
  };

  const formatChange = (change?: number) => {
    if (!change) return '';
    const abs = Math.abs(change).toFixed(1);
    return change > 0 ? `+${abs}%` : `${abs}%`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {/* Card 1 : Transactions */}
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-500">Transactions</h3>
          <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p className="text-3xl font-bold text-gray-900">{stats.transactionCount}</p>
        {previousMonthComparison && (
          <div className={`flex items-center gap-1 mt-2 text-sm ${getTrendColor(previousMonthComparison.volumeChange)}`}>
            {getTrendIcon(previousMonthComparison.volumeChange)}
            <span>{formatChange(previousMonthComparison.volumeChange)}</span>
          </div>
        )}
      </div>

      {/* Card 2 : Volume Total */}
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-500">Volume Total</h3>
          <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-3xl font-bold text-gray-900">{stats.totalVolumeFormatted} ETH</p>
        {stats.totalVolumeUsdFormatted && (
          <p className="text-xs text-gray-500 mt-1">{stats.totalVolumeUsdFormatted}</p>
        )}
        {previousMonthComparison && (
          <div className={`flex items-center gap-1 mt-2 text-sm ${getTrendColor(previousMonthComparison.volumeChange)}`}>
            {getTrendIcon(previousMonthComparison.volumeChange)}
            <span>{formatChange(previousMonthComparison.volumeChange)}</span>
          </div>
        )}
      </div>

      {/* Card 3 : Frais Totaux */}
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-500">Frais Totaux</h3>
          <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <p className="text-3xl font-bold text-gray-900">{stats.totalFeesFormatted} ETH</p>
        {stats.totalFeesUsdFormatted && (
          <p className="text-xs text-gray-500 mt-1">{stats.totalFeesUsdFormatted}</p>
        )}
        {previousMonthComparison && (
          <div className={`flex items-center gap-1 mt-2 text-sm ${getTrendColor(previousMonthComparison.feesChange)}`}>
            {getTrendIcon(previousMonthComparison.feesChange)}
            <span>{formatChange(previousMonthComparison.feesChange)}</span>
          </div>
        )}
      </div>

      {/* Card 4 : Coût Réel (Ratio) */}
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-500">Coût Réel</h3>
          <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <p className="text-3xl font-bold text-gray-900">{stats.feeRatio.toFixed(2)}%</p>
        {previousMonthComparison && (
          <div className={`flex items-center gap-1 mt-2 text-sm ${getTrendColor(-previousMonthComparison.ratioChange)}`}>
            {getTrendIcon(-previousMonthComparison.ratioChange)}
            <span>{Math.abs(previousMonthComparison.ratioChange).toFixed(2)}%</span>
          </div>
        )}
      </div>
    </div>
  );
}
