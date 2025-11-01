// components/GuestBanner.tsx
'use client';

import { useAuth } from '@/hooks/useAuth';

export default function GuestBanner() {
  const { isAuthenticated } = useAuth();

  // Si connecté, ne rien afficher
  if (isAuthenticated) return null;

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
              Vous créez en tant qu'invité
            </h3>
            <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
              Vous recevrez un email de confirmation avec les détails de votre paiement programmé.
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              💡 <strong>Créez un compte</strong> pour accéder à votre dashboard et gérer tous vos paiements !
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}