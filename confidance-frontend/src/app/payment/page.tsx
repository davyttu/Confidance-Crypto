// src/app/payment/page.tsx
'use client';

import PaymentForm from '@/components/payment/PaymentForm';
import GuestBanner from '@/components/GuestBanner';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';

export default function PaymentPage() {
  const { t, ready } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);
  const [voiceLang, setVoiceLang] = useState('FR');
  const voiceLangStorageKey = 'voiceRecognitionLang';

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem(voiceLangStorageKey);
    if (stored && typeof stored === 'string') {
      setVoiceLang(stored.split('-')[0].toUpperCase());
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
      {/* Header */}
      <div className="container mx-auto px-4 pt-20 pb-12">
        {/* Bandeau invité */}
        <GuestBanner />

        {/* Formulaire */}
        <div id="payment-form" className="max-w-3xl mx-auto">
          <PaymentForm />
        </div>

        {/* Section info */}
        <div className="max-w-3xl mx-auto mt-12 grid md:grid-cols-3 gap-6">
          {/* Sécurisé */}
          <div className="text-center p-6 glass rounded-2xl">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white mb-2">
              {isMounted && ready ? t('create.features.secure.title') : '100% Secure'}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {isMounted && ready ? t('create.features.secure.description') : 'Your funds are secured in a verified smart contract'}
            </p>
          </div>

          {/* Automatique */}
          <div className="text-center p-6 glass rounded-2xl">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-blue-600 dark:text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white mb-2">
              {isMounted && ready ? t('create.features.automatic.title') : 'Automatic'}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {isMounted && ready ? t('create.features.automatic.description') : 'The payment is released automatically on the chosen date'}
            </p>
          </div>

          {/* Transparent */}
          <div className="text-center p-6 glass rounded-2xl">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-purple-100 dark:bg-purple-950 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-purple-600 dark:text-purple-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white mb-2">
              {isMounted && ready ? t('create.features.transparent.title') : 'Transparent'}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {isMounted && ready ? t('create.features.transparent.description') : 'Track your payment in real-time on the blockchain'}
            </p>
          </div>
        </div>
      </div>

      {/* Bouton vocal flottant — coming soon (désactivé pour le lancement Base) */}
      <div className="fixed bottom-28 right-6 z-40 flex flex-col items-end">
        <div className="relative group">
          <button
            type="button"
            disabled
            aria-disabled="true"
            title={isMounted && ready ? t('wallet.chainComingSoon', { defaultValue: 'Bientôt disponible' }) : 'Bientôt disponible'}
            className="
              w-16 h-16 rounded-full
              bg-gradient-to-br from-gray-400 to-gray-500 text-white
              opacity-45 grayscale cursor-not-allowed
              shadow-md
              transition-all duration-200
              flex flex-col items-center justify-center gap-0.5
            "
          >
            <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 14a3 3 0 003-3V7a3 3 0 10-6 0v4a3 3 0 003 3z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-14 0" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v3" />
            </svg>
            <span className="text-xs font-medium">
              {isMounted && ready ? t('create.voiceCtaShort', { defaultValue: 'Voice' }) : 'Voice'}
            </span>
          </button>
          <span
            className="
              pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2
              whitespace-nowrap rounded-md bg-gray-900/95 px-2 py-1
              text-center text-xs font-medium text-gray-100
              opacity-0 shadow-lg transition-opacity duration-150
              group-hover:opacity-100
            "
          >
            {isMounted && ready ? t('wallet.chainComingSoon', { defaultValue: 'Bientôt disponible' }) : 'Bientôt disponible'}
          </span>
          <span
            className="
              absolute -top-1 -right-1 w-7 h-7 rounded-full border-2 border-white dark:border-gray-900
              bg-gray-200 dark:bg-gray-700 text-[10px] font-bold text-gray-500 dark:text-gray-400
              shadow-md flex items-center justify-center opacity-60 grayscale cursor-not-allowed
            "
            aria-hidden
          >
            {voiceLang}
          </span>
        </div>
      </div>
    </div>
  );
}
