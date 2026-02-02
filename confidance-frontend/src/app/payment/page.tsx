// src/app/payment/page.tsx
'use client';

import PaymentForm from '@/components/payment/PaymentForm';
import GuestBanner from '@/components/GuestBanner';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';

export default function PaymentPage() {
  const { t, ready } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);
  const [voiceSessionActive, setVoiceSessionActive] = useState(false);
  const [hasBeneficiaries, setHasBeneficiaries] = useState(false);
  const [voiceLang, setVoiceLang] = useState('FR');
  const voiceLangOptions = ['FR', 'EN', 'ES', 'RU', 'ZH'];
  const voiceLangStorageKey = 'voiceRecognitionLang';

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onActive = () => setVoiceSessionActive(true);
    const onInactive = () => setVoiceSessionActive(false);
    window.addEventListener('voice-session-active', onActive);
    window.addEventListener('voice-session-inactive', onInactive);
    return () => {
      window.removeEventListener('voice-session-active', onActive);
      window.removeEventListener('voice-session-inactive', onInactive);
    };
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

        {!hasBeneficiaries && (
          <p className="max-w-md mx-auto text-center text-sm text-gray-600 dark:text-gray-400 mb-6">
            {isMounted && ready ? t('create.voiceNeedBeneficiary', { defaultValue: 'To use the voice command, save at least one beneficiary (they will appear in favorites).' }) : 'To use the voice command, save at least one beneficiary (they will appear in favorites).'}
          </p>
        )}

        {/* Formulaire */}
        <div id="payment-form" className="max-w-3xl mx-auto">
          <PaymentForm onBeneficiariesChange={setHasBeneficiaries} />
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
              {isMounted && ready ? t('create.features.transparent.description') : 'Track your payment in real-time on Basescan'}
            </p>
          </div>
        </div>
      </div>

      {/* Bouton vocal flottant — même taille que Help, badge langue rattaché en haut */}
      <div className="fixed bottom-28 right-6 z-40 flex flex-col items-end">
        <div className="relative">
          <button
            type="button"
            title={
              voiceSessionActive
                ? (isMounted && ready ? t('create.voiceStopCta', { defaultValue: 'Stop the voice command' }) : 'Stop the voice command')
                : `${isMounted && ready ? t('create.voiceCta', { defaultValue: 'Create a payment by voice' }) : 'Create a payment by voice'} (${voiceLang})`
            }
            onClick={() => {
              if (voiceSessionActive) {
                document.getElementById('payment-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                window.dispatchEvent(new CustomEvent('voice-payment-stop'));
              } else if (hasBeneficiaries) {
                document.getElementById('payment-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                window.dispatchEvent(new CustomEvent('voice-payment-start'));
              }
            }}
            disabled={!voiceSessionActive && !hasBeneficiaries}
            className={`
              w-16 h-16 rounded-full
              shadow-lg hover:shadow-xl
              transform hover:scale-105 active:scale-95
              transition-all duration-200
              flex flex-col items-center justify-center gap-0.5
              ${voiceSessionActive
                ? 'bg-gradient-to-br from-red-500 to-red-600 text-white'
                : 'bg-gradient-to-br from-blue-600 to-purple-600 text-white'}
              ${(!voiceSessionActive && !hasBeneficiaries) ? 'opacity-60 cursor-not-allowed' : ''}
            `}
          >
            {voiceSessionActive ? (
              <>
                <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                <span className="text-[10px] font-semibold uppercase tracking-wider">
                  {isMounted && ready ? t('create.voiceStopCtaShort', { defaultValue: 'Stop' }) : 'Stop'}
                </span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 14a3 3 0 003-3V7a3 3 0 10-6 0v4a3 3 0 003 3z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-14 0" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v3" />
                </svg>
                <span className="text-xs font-medium">
                  {isMounted && ready ? t('create.voiceCtaShort', { defaultValue: 'Voice' }) : 'Voice'}
                </span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
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
            className="absolute -top-1 -right-1 w-7 h-7 rounded-full border-2 border-white dark:border-gray-900 bg-white dark:bg-gray-800 text-[10px] font-bold text-primary-600 dark:text-primary-400 shadow-md flex items-center justify-center hover:bg-primary-50 dark:hover:bg-gray-700 transition-colors"
            title={isMounted && ready ? t('create.voiceLang', { defaultValue: 'Voice language' }) : 'Voice language'}
            aria-label={isMounted && ready ? t('create.voiceLang', { defaultValue: 'Voice language' }) : 'Voice language'}
          >
            {voiceLang}
          </button>
        </div>
      </div>
    </div>
  );
}
