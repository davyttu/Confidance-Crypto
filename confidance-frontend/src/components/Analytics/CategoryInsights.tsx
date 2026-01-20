// components/Analytics/CategoryInsights.tsx
'use client';

import { useTranslationReady } from '@/hooks/useTranslationReady';

export interface CategoryInsight {
  id: string;
  icon: string;
  message: string;
}

interface CategoryInsightsProps {
  insights: CategoryInsight[];
  loading: boolean;
  error: string | null;
  monthLabel: string;
}

export function CategoryInsights({ insights, loading, error, monthLabel }: CategoryInsightsProps) {
  const { t } = useTranslationReady();

  return (
    <div className="bg-white rounded-xl shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">
          {t('analytics.insights.title', { defaultValue: 'Category Insights' })} - {monthLabel}
        </h2>
        <p className="text-sm text-gray-500">
          {t('analytics.insights.subtitle', { defaultValue: 'Based on your executed payments timeline' })}
        </p>
      </div>
      <div className="p-6 space-y-3">
        {loading && (
          <p className="text-sm text-gray-500">
            {t('analytics.insights.loading', { defaultValue: 'Loading insights...' })}
          </p>
        )}
        {!loading && error && (
          <p className="text-sm text-red-600">
            {error}
          </p>
        )}
        {!loading && !error && insights.length === 0 && (
          <p className="text-sm text-gray-500">
            {t('analytics.insights.empty', { defaultValue: 'Aucun insight disponible pour ce mois.' })}
          </p>
        )}
        {!loading && !error && insights.length > 0 && insights.map((insight) => (
          <div key={insight.id} className="flex items-start gap-3 rounded-lg border border-gray-200 px-4 py-3">
            <span className="text-lg">{insight.icon}</span>
            <p className="text-sm text-gray-800">{insight.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
