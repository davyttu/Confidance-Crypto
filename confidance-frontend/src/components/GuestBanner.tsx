// components/GuestBanner.tsx
'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';

export default function GuestBanner() {
  const { isAuthenticated } = useAuth();
  const { t, ready } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Si connecté, ne rien afficher
  if (isAuthenticated) return null;

  const title =
    isMounted && ready
      ? t('create.guest.title')
      : 'You are creating as a guest';
  const emailHint =
    isMounted && ready
      ? t('create.guest.emailHint')
      : 'You will receive a confirmation email with the details of your scheduled payment.';
  const accountHint =
    isMounted && ready
      ? t('create.guest.accountHint')
      : 'Create an account to access your dashboard and manage all your payments!';
  const accountHintStrong =
    isMounted && ready
      ? t('create.guest.accountHintStrong')
      : 'Create an account';

  return (
    <div className="max-w-3xl mx-auto mb-6">
      <div className="bg-blue-50 dark:bg-blue-950 border-2 border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <svg 
            className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
          <div className="flex-1">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
              {title}
            </h3>
            <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
              {emailHint}
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              💡 <strong>{accountHintStrong}</strong>{' '}
              {accountHint}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}