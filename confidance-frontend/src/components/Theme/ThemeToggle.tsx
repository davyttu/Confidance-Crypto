// src/components/theme/ThemeToggle.tsx
'use client';

import { useTranslation } from 'react-i18next';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

export function ThemeToggle() {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="relative w-12 h-12 rounded-xl glass-card hover:scale-105 transition-all duration-300 flex items-center justify-center group"
      aria-label={t('common.themeToggle.ariaLabel')}
      title={theme === 'dark' ? t('common.themeToggle.switchToLight') : t('common.themeToggle.switchToDark')}
    >
      <div className="relative">
        <Sun 
          className={`h-5 w-5 text-yellow-400 transition-all duration-500 ${
            theme === 'dark' 
              ? 'opacity-100 rotate-0 scale-100' 
              : 'opacity-0 rotate-90 scale-75 absolute'
          }`} 
        />
        <Moon 
          className={`h-5 w-5 text-blue-400 transition-all duration-500 ${
            theme === 'light' 
              ? 'opacity-100 rotate-0 scale-100' 
              : 'opacity-0 -rotate-90 scale-75 absolute'
          }`} 
        />
      </div>
    </button>
  );
}