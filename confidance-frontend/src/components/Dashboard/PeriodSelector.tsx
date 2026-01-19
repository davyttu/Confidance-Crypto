// components/Dashboard/PeriodSelector.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { getCurrentYearMonths, getAvailableYears } from '@/lib/utils/dateFormatter';

interface PeriodSelectorProps {
  onChange: (periodType: 'all' | 'month' | 'year', periodValue?: string | number) => void;
  oldestTimestamp?: number;
}

export function PeriodSelector({ onChange, oldestTimestamp }: PeriodSelectorProps) {
  const { t, ready: translationsReady } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);
  const [periodType, setPeriodType] = useState<'all' | 'month' | 'year'>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const currentYearMonths = getCurrentYearMonths();
  const availableYears = oldestTimestamp ? getAvailableYears(oldestTimestamp) : [];

  const handlePeriodTypeChange = (type: 'all' | 'month' | 'year') => {
    setPeriodType(type);
    setSelectedPeriod('');
    
    if (type === 'all') {
      onChange('all');
    }
  };

  const handleMonthChange = (monthValue: string) => {
    setSelectedPeriod(monthValue);
    onChange('month', monthValue);
  };

  const handleYearChange = (year: number) => {
    setSelectedPeriod(year.toString());
    onChange('year', year);
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Type de période */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handlePeriodTypeChange('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                periodType === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {isMounted && translationsReady ? t('dashboard.period.all') : 'Tout'}
            </button>
            
            <button
              onClick={() => handlePeriodTypeChange('month')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                periodType === 'month'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {isMounted && translationsReady ? t('dashboard.period.byMonth') : 'Par mois'}
            </button>
            
            <button
              onClick={() => handlePeriodTypeChange('year')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                periodType === 'year'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {isMounted && translationsReady ? t('dashboard.period.byYear') : 'Par année'}
            </button>
          </div>

          <div className="sm:ml-3 sm:pl-3 sm:border-l sm:border-gray-200">
            <Link
              href="/dashboard/links"
              className="group relative inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-blue-700 bg-gradient-to-r from-white to-blue-50 border border-blue-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <span className="absolute inset-0 rounded-lg bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="relative">
                {isMounted && translationsReady ? t('links.dashboard.button') : 'Mes liens'}
              </span>
            </Link>
          </div>
        </div>

        {/* Sélecteur de mois */}
        {periodType === 'month' && (
          <select
            value={selectedPeriod}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">{isMounted && translationsReady ? t('dashboard.period.selectMonth') : 'Sélectionner un mois'}</option>
            {currentYearMonths.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
        )}

        {/* Sélecteur d'année */}
        {periodType === 'year' && availableYears.length > 0 && (
          <select
            value={selectedPeriod}
            onChange={(e) => handleYearChange(parseInt(e.target.value))}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">{isMounted && translationsReady ? t('dashboard.period.selectYear') : 'Sélectionner une année'}</option>
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
