// src/app/create/page.tsx
'use client';

import PaymentForm from '@/components/payment/PaymentForm';
import GuestBanner from '@/components/GuestBanner';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';

export default function CreatePaymentPage() {
  const { t, ready } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);
  const [voiceLang, setVoiceLang] = useState('FR');
  const voiceLangOptions = ['FR', 'EN', 'ES', 'RU', 'ZH'];
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
      <div className="container mx-auto px-4 pt-32 pb-12">
        {/* Bandeau invité */}
        <GuestBanner />

        <div className="max-w-2xl mx-auto text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-8 gradient-text leading-relaxed pb-2">
            {isMounted && ready ? t('create.title') : 'Créer un paiement instantané, programmé ou récurrent'}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            {isMounted && ready ? t('create.subtitle') : 'Envoyez de la crypto qui sera automatiquement libérée à la date choisie'}
          </p>
          <div className="mt-6 flex justify-center">
            <div className="group inline-flex items-center gap-3 rounded-full border border-primary-200 bg-white/80 px-3 py-2 text-sm font-semibold text-primary-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-md dark:border-primary-800 dark:bg-gray-900/70 dark:text-primary-300">
              <button
                type="button"
                onClick={() => {
                  document.getElementById('payment-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  window.dispatchEvent(new CustomEvent('voice-payment-start'));
                }}
                className="inline-flex items-center gap-3 px-2"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-primary-600 group-hover:bg-primary-200 dark:bg-primary-900 dark:text-primary-300">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 14a3 3 0 003-3V7a3 3 0 10-6 0v4a3 3 0 003 3z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-14 0" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v3" />
                  </svg>
                </span>
                <span>
                  {isMounted && ready ? t('create.voiceCta', { defaultValue: 'Créer un paiement par la voix' }) : 'Créer un paiement par la voix'}
                </span>
                <span className="text-primary-400 group-hover:text-primary-500">→</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const currentIndex = voiceLangOptions.indexOf(voiceLang);
                  const next = voiceLangOptions[(currentIndex + 1) % voiceLangOptions.length];
                  setVoiceLang(next);
                  try {
                    const storageValue =
                      next === 'FR' ? 'fr-FR' :
                      next === 'EN' ? 'en-US' :
                      next === 'ES' ? 'es-ES' :
                      next === 'RU' ? 'ru-RU' : 'zh-CN';
                    localStorage.setItem(voiceLangStorageKey, storageValue);
                  } catch {
                    // ignore storage failure
                  }
                }}
                className="mr-2 inline-flex items-center rounded-full border border-primary-200 px-3 py-1 text-xs text-primary-700 hover:border-primary-300 hover:text-primary-800"
                title={isMounted && ready ? t('create.voiceLang', { defaultValue: 'Langue vocale' }) : 'Langue vocale'}
                aria-label={isMounted && ready ? t('create.voiceLang', { defaultValue: 'Langue vocale' }) : 'Langue vocale'}
              >
                {voiceLang}
              </button>
            </div>
          </div>
        </div>

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
              {isMounted && ready ? t('create.features.secure.title') : '100% Sécurisé'}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {isMounted && ready ? t('create.features.secure.description') : 'Vos fonds sont verrouillés dans un smart contract vérifié'}
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
              {isMounted && ready ? t('create.features.automatic.title') : 'Automatique'}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {isMounted && ready ? t('create.features.automatic.description') : 'Le paiement est libéré automatiquement à la date choisie'}
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
              {isMounted && ready ? t('create.features.transparent.description') : 'Suivez votre paiement en temps réel sur Basescan'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
