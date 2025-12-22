// src/components/LanguageSwitcher.tsx
'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const languages = [
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
];

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [currentLangCode, setCurrentLangCode] = useState<string>('fr');
  const [isMounted, setIsMounted] = useState(false);
  
  // ✅ FIX : Éviter le mismatch d'hydratation en utilisant un état local
  useEffect(() => {
    setIsMounted(true);
    setCurrentLangCode(i18n.language || 'fr');
  }, [i18n.language]);
  
  // Écouter les changements de langue
  useEffect(() => {
    const handleLanguageChanged = (lng: string) => {
      setCurrentLangCode(lng);
    };
    
    i18n.on('languageChanged', handleLanguageChanged);
    
    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, [i18n]);
  
  const currentLanguage = languages.find(lang => lang.code === currentLangCode) || languages[0];

  const changeLanguage = (code: string) => {
    i18n.changeLanguage(code);
    setIsOpen(false);
  };

  // ✅ FIX : Utiliser la langue par défaut pendant l'hydratation pour éviter le mismatch
  if (!isMounted) {
    return (
      <div className="relative">
        <button
          className="group flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
          aria-label="Changer de langue"
          disabled
        >
          <span className="text-lg">🇫🇷</span>
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            FR
          </span>
          <svg 
            className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Bouton principal - Style minimaliste pro */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 transition-all shadow-sm hover:shadow-md"
        aria-label="Changer de langue"
      >
        {/* Drapeau */}
        <span className="text-lg">{currentLanguage.flag}</span>
        
        {/* Code langue */}
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
          {currentLanguage.code}
        </span>
        
        {/* Chevron */}
        <svg 
          className={`w-3.5 h-3.5 text-gray-500 dark:text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Overlay pour fermer */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Menu déroulant - Design card élégant */}
          <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-20 overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="px-4 py-2.5 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                🌍 Choisir la langue
              </p>
            </div>

            {/* Liste des langues */}
            <div className="py-1">
              {languages.map((lang, index) => {
                const isActive = currentLangCode === lang.code;
                
                return (
                  <button
                    key={lang.code}
                    onClick={() => changeLanguage(lang.code)}
                    className={`w-full px-4 py-2.5 text-left flex items-center gap-3 transition-all ${
                      isActive 
                        ? 'bg-gradient-to-r from-primary-50 to-purple-50 dark:from-primary-900/30 dark:to-purple-900/30' 
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    {/* Drapeau */}
                    <span className="text-xl flex-shrink-0">{lang.flag}</span>
                    
                    {/* Nom de la langue */}
                    <span className={`text-sm font-medium flex-1 ${
                      isActive 
                        ? 'text-primary-700 dark:text-primary-300' 
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {lang.name}
                    </span>
                    
                    {/* Checkmark si actif */}
                    {isActive && (
                      <svg 
                        className="w-4 h-4 text-primary-600 dark:text-primary-400 flex-shrink-0" 
                        fill="currentColor" 
                        viewBox="0 0 20 20"
                      >
                        <path 
                          fillRule="evenodd" 
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" 
                          clipRule="evenodd" 
                        />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Footer subtil */}
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-500 text-center">
                Préférence enregistrée
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}