// components/Dashboard/PeriodSelector.tsx
'use client';

import { useState } from 'react';
import { getCurrentYearMonths, getAvailableYears } from '@/lib/utils/dateFormatter';

interface PeriodSelectorProps {
  onChange: (periodType: 'all' | 'month' | 'year', periodValue?: string | number) => void;
  oldestTimestamp?: number;
}

export function PeriodSelector({ onChange, oldestTimestamp }: PeriodSelectorProps) {
  const [periodType, setPeriodType] = useState<'all' | 'month' | 'year'>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');

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
        <div className="flex gap-2">
          <button
            onClick={() => handlePeriodTypeChange('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              periodType === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Tout
          </button>
          
          <button
            onClick={() => handlePeriodTypeChange('month')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              periodType === 'month'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Par mois
          </button>
          
          <button
            onClick={() => handlePeriodTypeChange('year')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              periodType === 'year'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Par année
          </button>
        </div>

        {/* Sélecteur de mois */}
        {periodType === 'month' && (
          <select
            value={selectedPeriod}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Sélectionner un mois</option>
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
            <option value="">Sélectionner une année</option>
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
