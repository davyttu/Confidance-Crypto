// src/app/aide/debuter/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';

export default function DebuterPage() {
  const { t, ready: translationsReady } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <Link href="/aide" className="text-blue-600 hover:text-blue-700 mb-8 inline-block">
          {isMounted && translationsReady ? t('help.getStarted.back') : '← Retour au centre d\'aide'}
        </Link>

        <h1 className="text-4xl font-bold text-gray-900 mb-8">
          {isMounted && translationsReady ? t('help.getStarted.title') : '🚀 Débuter avec Confidance Crypto'}
        </h1>

        <div className="bg-white rounded-2xl p-8 shadow-lg mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {isMounted && translationsReady ? t('help.getStarted.whatIs.title') : 'Qu\'est-ce que Confidance Crypto ?'}
          </h2>
          <p className="text-gray-700 mb-4">
            {isMounted && translationsReady ? t('help.getStarted.whatIs.description') : 'Confidance Crypto est une plateforme DeFi qui permet de programmer des paiements crypto automatiques. Envoyez de l\'ETH ou des tokens qui seront libérés automatiquement à une date précise.'}
          </p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-lg mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {isMounted && translationsReady ? t('help.getStarted.requirements.title') : '✅ Ce dont vous avez besoin'}
          </h2>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <span className="text-green-600 text-xl">✓</span>
              <div>
                <strong className="text-gray-900">{isMounted && translationsReady ? t('help.getStarted.requirements.wallet.title') : 'Un wallet crypto'}</strong>
                <p className="text-gray-600">{isMounted && translationsReady ? t('help.getStarted.requirements.wallet.description') : 'MetaMask, Coinbase Wallet, Rainbow, etc.'}</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-600 text-xl">✓</span>
              <div>
                <strong className="text-gray-900">{isMounted && translationsReady ? t('help.getStarted.requirements.eth.title') : 'Des ETH sur Base Mainnet'}</strong>
                <p className="text-gray-600">{isMounted && translationsReady ? t('help.getStarted.requirements.eth.description') : 'Minimum ~0.01 ETH pour les frais + montant à envoyer'}</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-600 text-xl">✓</span>
              <div>
                <strong className="text-gray-900">{isMounted && translationsReady ? t('help.getStarted.requirements.address.title') : 'L\'adresse du destinataire'}</strong>
                <p className="text-gray-600">{isMounted && translationsReady ? t('help.getStarted.requirements.address.description') : 'Adresse Ethereum (0x...)'}</p>
              </div>
            </li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-lg">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {isMounted && translationsReady ? t('help.getStarted.nextSteps.title') : '📚 Prochaines étapes'}
          </h2>
          <div className="space-y-4">
            <Link
              href="/aide/guides"
              className="block p-4 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors"
            >
              <h3 className="font-semibold text-blue-900 mb-1">
                {isMounted && translationsReady ? t('help.getStarted.nextSteps.createPayment.title') : '1. Créer votre premier paiement'}
              </h3>
              <p className="text-blue-700 text-sm">
                {isMounted && translationsReady ? t('help.getStarted.nextSteps.createPayment.description') : 'Tutoriel pas-à-pas pour envoyer votre premier paiement programmé'}
              </p>
            </Link>
            <Link
              href="/aide/faq"
              className="block p-4 bg-purple-50 rounded-xl hover:bg-purple-100 transition-colors"
            >
              <h3 className="font-semibold text-purple-900 mb-1">
                {isMounted && translationsReady ? t('help.getStarted.nextSteps.faq.title') : '2. Questions fréquentes'}
              </h3>
              <p className="text-purple-700 text-sm">
                {isMounted && translationsReady ? t('help.getStarted.nextSteps.faq.description') : 'Sécurité, frais, délais... toutes les réponses'}
              </p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}