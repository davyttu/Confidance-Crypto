// components/CreatePayment/PaymentIdentitySection.tsx
'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  PaymentCategory, 
  CATEGORY_LABELS, 
  CATEGORY_ICONS,
  CATEGORY_COLORS 
} from '@/types/payment-identity';
import { useCategorySuggestion } from '@/hooks/useCategorySuggestion';

interface PaymentIdentitySectionProps {
  label: string;
  category: PaymentCategory | null;
  onLabelChange: (label: string) => void;
  onCategoryChange: (category: PaymentCategory) => void;
  onToggleDisabled?: () => void;
  suggestedCategory?: PaymentCategory;
  confidence?: number;
  matchedKeywords?: string[];
  error?: string;
  disabled?: boolean;
}

export default function PaymentIdentitySection({
  label,
  category,
  onLabelChange,
  onCategoryChange,
  onToggleDisabled,
  suggestedCategory: suggestedCategoryProp,
  confidence: confidenceProp,
  matchedKeywords: matchedKeywordsProp,
  error,
  disabled = false
}: PaymentIdentitySectionProps) {
  const { t, i18n } = useTranslation();
  
  // Auto-suggestion de catégorie
  const suggestion = useCategorySuggestion(label);
  const suggestedCategory = suggestedCategoryProp ?? suggestion.suggestedCategory;
  const confidence = confidenceProp ?? suggestion.confidence;
  const matchedKeywords = matchedKeywordsProp ?? suggestion.matchedKeywords;
  
  // Langue actuelle
  const currentLang = (i18n?.language?.split('-')[0] || 'en') as 'en' | 'fr' | 'es' | 'ru' | 'zh';
  
  // Liste des catégories
  const categories: PaymentCategory[] = [
    'housing',
    'salary',
    'subscription',
    'utilities',
    'services',
    'transfer',
    'other'
  ];
  
  // Afficher suggestion si différente de la sélection actuelle et confiance > 50%
  const showSuggestion = useMemo(() => {
    return !disabled &&
           suggestedCategory !== category && 
           confidence > 0.5 && 
           label.trim().length > 0 &&
           suggestedCategory !== 'other';
  }, [suggestedCategory, category, confidence, label, disabled]);

  // Handler pour accepter la suggestion
  const handleAcceptSuggestion = () => {
    onCategoryChange(suggestedCategory);
  };

  return (
    <div className={`glass rounded-2xl p-6 space-y-4 ${disabled ? 'opacity-60' : ''}`}>
      {/* En-tête avec icône */}
      <div className="flex items-center gap-2">
        <span className="text-2xl">💡</span>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('create.identity.title', 'Payment description')}
        </label>
        {onToggleDisabled && (
          <button
            type="button"
            onClick={onToggleDisabled}
            className="ml-1 h-4 w-4 rounded-full border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600 transition-colors flex items-center justify-center"
            aria-label={disabled ? t('links.create.aria.enablePaymentDescription') : t('links.create.aria.disablePaymentDescription')}
            title={disabled ? t('links.create.aria.enablePaymentDescription') : t('links.create.aria.disablePaymentDescription')}
          >
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Input Label */}
      <div className="space-y-2">
        <input
          type="text"
          value={label}
          onChange={(e) => onLabelChange(e.target.value)}
          placeholder={t('create.identity.placeholder', 'Ex: Rent, Spotify subscription, Freelance payment...')}
          disabled={disabled}
          maxLength={100}
          className={`
            w-full px-4 py-3 rounded-xl border-2 
            bg-white dark:bg-gray-800
            text-gray-900 dark:text-white
            placeholder:text-gray-400 dark:placeholder:text-gray-500
            transition-all
            ${
              error
                ? 'border-red-500 focus:border-red-600'
                : 'border-gray-200 dark:border-gray-700 focus:border-primary-500'
            }
            focus:outline-none focus:ring-4 focus:ring-primary-500/20
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        />
        
        {/* Counter de caractères */}
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>
            {label.length === 0 
              ? t('create.identity.hint', '💡 Describe your payment to help you track it later')
              : matchedKeywords.length > 0
              ? `🎯 ${t('create.identity.matched', 'Matched keywords')}: ${matchedKeywords.slice(0, 3).join(', ')}`
              : ''}
          </span>
          <span>{label.length}/100</span>
        </div>

        {/* Erreur */}
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </p>
        )}
      </div>

      {/* Suggestion automatique (si pertinente) */}
      {showSuggestion && (
        <div className={`
          flex items-center gap-3 p-3 rounded-xl border-2
          ${CATEGORY_COLORS[suggestedCategory].bg}
          ${CATEGORY_COLORS[suggestedCategory].border}
          animate-in fade-in slide-in-from-top-2 duration-300
        `}>
          <span className="text-xl">{CATEGORY_ICONS[suggestedCategory]}</span>
          <div className="flex-1">
            <p className={`text-sm font-medium ${CATEGORY_COLORS[suggestedCategory].text}`}>
              {t('create.identity.suggestion', 'Suggested category')}: {CATEGORY_LABELS[suggestedCategory][currentLang]}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
              {Math.round(confidence * 100)}% {t('create.identity.confidence', 'confidence')}
            </p>
          </div>
          <button
            type="button"
            onClick={handleAcceptSuggestion}
            className={`
              px-3 py-1.5 rounded-lg text-xs font-medium
              ${CATEGORY_COLORS[suggestedCategory].text}
              hover:bg-white/50 dark:hover:bg-black/20
              transition-colors
            `}
          >
            {t('create.identity.apply', 'Apply')}
          </button>
        </div>
      )}

      {/* Sélecteur de catégorie (grid compact) */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
          📁 {t('create.identity.categoryLabel', 'Category')}
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {categories.map((cat) => {
            const isSelected = category === cat;
            const colors = CATEGORY_COLORS[cat];
            
            return (
              <button
                key={cat}
                type="button"
                onClick={() => onCategoryChange(cat)}
                disabled={disabled}
                className={`
                  flex items-center gap-2 p-2.5 rounded-lg border-2 
                  transition-all
                  ${
                    isSelected
                      ? `${colors.bg} ${colors.border} ${colors.text} font-semibold`
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                <span className="text-lg">{CATEGORY_ICONS[cat]}</span>
                <span className="text-xs truncate">
                  {CATEGORY_LABELS[cat][currentLang]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Info bulle explicative */}
      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-blue-800 dark:text-blue-200">
            {t('create.identity.why', 'This helps you track your expenses and enables AI-powered insights about your payments.')}
          </p>
        </div>
      </div>
    </div>
  );
}
