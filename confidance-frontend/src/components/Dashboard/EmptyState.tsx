// components/Dashboard/EmptyState.tsx
'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';

export function EmptyState() {
  const { t, ready: translationsReady } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);
  return (
    <div className="bg-white rounded-lg shadow-lg p-12 text-center">
      {/* Illustration */}
      <div className="mb-8">
        <svg 
          className="w-32 h-32 mx-auto text-gray-300" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={1.5} 
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" 
          />
        </svg>
      </div>

      {/* Titre */}
      <h2 className="text-2xl font-bold text-gray-900 mb-3">
        {isMounted && translationsReady ? t('dashboard.empty.title') : 'Aucun paiement programmé'}
      </h2>

      {/* Description */}
      <p className="text-gray-600 mb-8 max-w-md mx-auto">
        {isMounted && translationsReady ? t('dashboard.empty.description') : 'Vous n\'avez pas encore créé de paiement programmé. Commencez dès maintenant à automatiser vos transferts crypto !'}
      </p>

      {/* Call-to-action principal */}
      <Link
        href="/payment"
        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Créer mon premier paiement
      </Link>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
        <div className="bg-blue-50 rounded-lg p-6">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">{isMounted && translationsReady ? t('dashboard.empty.features.secure.title') : 'Sécurisé'}</h3>
          <p className="text-sm text-gray-600">
            {isMounted && translationsReady ? t('dashboard.empty.features.secure.description') : 'Vos fonds sont protégés par la blockchain'}
          </p>
        </div>

        <div className="bg-purple-50 rounded-lg p-6">
          <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Automatique</h3>
          <p className="text-sm text-gray-600">
            Exécution automatique à la date programmée
          </p>
        </div>

        <div className="bg-green-50 rounded-lg p-6">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">{isMounted && translationsReady ? t('dashboard.empty.features.transparent.title') : 'Transparent'}</h3>
          <p className="text-sm text-gray-600">
            {isMounted && translationsReady ? t('dashboard.empty.features.transparent.description') : 'Suivez vos paiements en temps réel'}
          </p>
        </div>
      </div>
    </div>
  );
}
