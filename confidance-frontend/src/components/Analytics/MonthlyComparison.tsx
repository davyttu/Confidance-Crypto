// components/Analytics/MonthlyComparison.tsx
'use client';

import { MonthlyStats } from '@/hooks/useMonthlyAnalytics';

interface MonthlyComparisonProps {
  monthlyData: MonthlyStats[];
}

export function MonthlyComparison({ monthlyData }: MonthlyComparisonProps) {
  // Trouver le meilleur et le pire ratio
  const bestRatio = monthlyData.reduce((min, current) => 
    current.feeRatio < min.feeRatio ? current : min
  );
  const worstRatio = monthlyData.reduce((max, current) => 
    current.feeRatio > max.feeRatio ? current : max
  );

  return (
    <div className="bg-white rounded-xl shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Historique Mensuel</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Mois
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Txs
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Volume
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Frais
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ratio %
              </th>
            </tr>
          </thead>
          
          <tbody className="divide-y divide-gray-200">
            {monthlyData.map((monthData, index) => {
              const isCurrent = index === 0;
              const isBest = monthData.month === bestRatio.month;
              const isWorst = monthData.month === worstRatio.month;

              return (
                <tr 
                  key={monthData.month}
                  className={`
                    ${isCurrent ? 'bg-blue-50' : 'hover:bg-gray-50'}
                    transition-colors
                  `}
                >
                  {/* Mois */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${isCurrent ? 'text-blue-900' : 'text-gray-900'}`}>
                        {monthData.displayMonth}
                      </span>
                      {isCurrent && (
                        <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded-full">
                          Actuel
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Transactions */}
                  <td className="px-6 py-4 text-right">
                    <span className="text-gray-900 font-medium">
                      {monthData.transactionCount}
                    </span>
                  </td>

                  {/* Volume */}
                  <td className="px-6 py-4 text-right">
                    <span className="text-gray-900 font-mono">
                      {monthData.totalVolumeFormatted} ETH
                    </span>
                  </td>

                  {/* Frais */}
                  <td className="px-6 py-4 text-right">
                    <span className="text-gray-900 font-mono">
                      {monthData.totalFeesFormatted} ETH
                    </span>
                  </td>

                  {/* Ratio */}
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className={`font-mono ${
                        isBest ? 'text-green-600 font-bold' : 
                        isWorst ? 'text-red-600 font-bold' : 
                        'text-gray-900'
                      }`}>
                        {monthData.feeRatio.toFixed(2)}%
                      </span>
                      {isBest && monthlyData.length > 1 && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                          Best
                        </span>
                      )}
                      {isWorst && monthlyData.length > 1 && (
                        <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full font-medium">
                          High
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Statistiques globales */}
      {monthlyData.length > 1 && (
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Mois le plus économique : </span>
              <span className="font-semibold text-green-600">{bestRatio.displayMonth}</span>
              <span className="text-gray-500"> ({bestRatio.feeRatio.toFixed(2)}%)</span>
            </div>
            <div>
              <span className="text-gray-600">Mois le plus coûteux : </span>
              <span className="font-semibold text-red-600">{worstRatio.displayMonth}</span>
              <span className="text-gray-500"> ({worstRatio.feeRatio.toFixed(2)}%)</span>
            </div>
            <div>
              <span className="text-gray-600">Ratio moyen : </span>
              <span className="font-semibold text-gray-900">
                {(monthlyData.reduce((sum, m) => sum + m.feeRatio, 0) / monthlyData.length).toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
