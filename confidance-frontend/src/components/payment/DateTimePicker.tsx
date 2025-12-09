'use client';

import { useState, useEffect } from 'react';

interface DateTimePickerProps {
  value: Date | null;
  onChange: (date: Date) => void;
  minDate?: Date;
  label?: string;
  error?: string;
  hidePresets?: boolean;
}

export default function DateTimePicker({
  value,
  onChange,
  minDate,
  label = 'Date et heure de libération',
  error,
  hidePresets = false,
}: DateTimePickerProps) {
  // Formater la date pour l'input datetime-local
  const formatDateTimeLocal = (date: Date | null): string => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Date minimale (maintenant + 5 minutes)
  const minDateTime = minDate || new Date(Date.now() + 5 * 60 * 1000);
  const minDateTimeString = formatDateTimeLocal(minDateTime);

  // Calculer le temps restant
  const [timeUntil, setTimeUntil] = useState<string>('');

  useEffect(() => {
    if (!value) return;

    const updateTimeUntil = () => {
      const now = new Date();
      const diff = value.getTime() - now.getTime();

      if (diff < 0) {
        setTimeUntil('Dans le passé');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) {
        setTimeUntil(`Dans ${days}j ${hours}h ${minutes}min`);
      } else if (hours > 0) {
        setTimeUntil(`Dans ${hours}h ${minutes}min`);
      } else {
        setTimeUntil(`Dans ${minutes}min`);
      }
    };

    updateTimeUntil();
    const interval = setInterval(updateTimeUntil, 60000); // Update chaque minute

    return () => clearInterval(interval);
  }, [value]);

  // Raccourcis temps
  const presets = [
    { label: '1 heure', minutes: 60 },
    { label: '6 heures', minutes: 360 },
    { label: '1 jour', minutes: 1440 },
    { label: '1 semaine', minutes: 10080 },
    { label: '1 mois', minutes: 43200 },
  ];

  const handlePreset = (minutes: number) => {
    const newDate = new Date(Date.now() + minutes * 60 * 1000);
    onChange(newDate);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(e.target.value);
    if (!isNaN(newDate.getTime())) {
      onChange(newDate);
    }
  };

  return (
    <div className="space-y-4">
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}

      {/* Raccourcis */}
      {!hidePresets && (
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => handlePreset(preset.minutes)}
              className="px-3 py-2 text-sm font-medium rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400 transition-all"
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}

      {/* Input datetime */}
      <div className="relative">
        <input
          type="datetime-local"
          value={formatDateTimeLocal(value)}
          onChange={handleInputChange}
          min={minDateTimeString}
          className={`
            w-full px-4 py-3 rounded-xl border-2 
            bg-white dark:bg-gray-800
            text-gray-900 dark:text-white
            transition-all
            ${
              error
                ? 'border-red-500 focus:border-red-600'
                : 'border-gray-200 dark:border-gray-700 focus:border-primary-500'
            }
            focus:outline-none focus:ring-4 focus:ring-primary-500/20
          `}
        />

        {/* Icône calendrier */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      </div>

      {/* Info temps restant */}
      {value && !error && (
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <svg
            className="w-4 h-4 text-green-500"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
              clipRule="evenodd"
            />
          </svg>
          <span>{timeUntil}</span>
        </div>
      )}

      {/* Erreur */}
      {error && (
        <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
          <svg
            className="w-5 h-5 flex-shrink-0 mt-0.5"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Aide */}
      <div className="text-xs text-gray-500 dark:text-gray-400">
        💡 Le paiement sera automatiquement libéré à cette date
      </div>
    </div>
  );
}