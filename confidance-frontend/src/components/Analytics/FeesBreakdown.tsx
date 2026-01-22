// components/Analytics/FeesBreakdown.tsx
'use client';

import { MonthlyStats } from '@/hooks/useMonthlyAnalytics';

interface FeesBreakdownProps {
  stats: MonthlyStats;
}

export function FeesBreakdown({ stats }: FeesBreakdownProps) {
  const { costs } = stats;

  return (
    <div className="bg-white rounded-xl shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">
          Décomposition des Frais - {stats.displayMonth}
        </h2>
      </div>

      <div className="p-6 space-y-6">
        {/* Frais de Gas */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Frais de Gaz (Base Network)</span>
            <span className="text-sm font-mono text-gray-900">
              {costs.gasFeesFormatted} ETH ({costs.gasPercentage.toFixed(0)}%)
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-blue-500 to-blue-600 h-full transition-all duration-500"
              style={{ width: `${costs.gasPercentage}%` }}
            />
          </div>
        </div>

        {/* Frais Protocole */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Frais Protocole Confidance (1.79%)</span>
            <span className="text-sm font-mono text-gray-900">
              {costs.protocolFeesFormatted} ETH ({costs.protocolPercentage.toFixed(0)}%)
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-purple-500 to-purple-600 h-full transition-all duration-500"
              style={{ width: `${costs.protocolPercentage}%` }}
            />
          </div>
        </div>

        {/* Total */}
        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-base font-bold text-gray-900">TOTAL FRAIS MENSUELS</span>
            <span className="text-lg font-mono font-bold text-gray-900">
              {stats.totalFeesFormatted} ETH
            </span>
          </div>
          {stats.totalFeesUsdFormatted && (
            <div className="flex justify-end mt-1">
              <span className="text-xs text-gray-500">{stats.totalFeesUsdFormatted}</span>
            </div>
          )}
        </div>

        {/* Insight */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">💡 Astuce d'optimisation</p>
              <p>
                {costs.gasPercentage > 60 
                  ? "Vos frais de gaz représentent la majorité des coûts. Privilégiez les heures creuses (week-end, nuit) pour économiser jusqu'à 30%."
                  : "Vos frais sont équilibrés entre gas et protocole. Continuez ainsi !"
                }
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
