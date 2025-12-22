// src/app/aide/guides/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { RocketLaunchIcon, CurrencyDollarIcon, CalendarIcon } from '@heroicons/react/24/outline';

export default function GuidesPage() {
  const { t, ready: translationsReady } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const guides = [
    {
      icon: RocketLaunchIcon,
      titleKey: 'help.guides.items.createPayment.title',
      titleFallback: 'Créer votre premier paiement',
      descriptionKey: 'help.guides.items.createPayment.description',
      descriptionFallback: 'Guide complet pour envoyer votre premier paiement programmé',
      durationKey: 'help.guides.items.createPayment.duration',
      durationFallback: '5 min',
      levelKey: 'help.guides.items.createPayment.level',
      levelFallback: 'Débutant',
      color: 'from-blue-500 to-blue-600',
    },
    {
      icon: CurrencyDollarIcon,
      titleKey: 'help.guides.items.fees.title',
      titleFallback: 'Comprendre les frais',
      descriptionKey: 'help.guides.items.fees.description',
      descriptionFallback: 'Calculez précisément les coûts de vos paiements',
      durationKey: 'help.guides.items.fees.duration',
      durationFallback: '3 min',
      levelKey: 'help.guides.items.fees.level',
      levelFallback: 'Débutant',
      color: 'from-green-500 to-green-600',
    },
    {
      icon: CalendarIcon,
      titleKey: 'help.guides.items.cancel.title',
      titleFallback: 'Annuler un paiement',
      descriptionKey: 'help.guides.items.cancel.description',
      descriptionFallback: 'Comment annuler un paiement avant sa libération',
      durationKey: 'help.guides.items.cancel.duration',
      durationFallback: '2 min',
      levelKey: 'help.guides.items.cancel.level',
      levelFallback: 'Intermédiaire',
      color: 'from-orange-500 to-orange-600',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <Link href="/aide" className="text-blue-600 hover:text-blue-700 mb-8 inline-block">
          {isMounted && translationsReady ? t('help.guides.back') : '← Retour au centre d\'aide'}
        </Link>

        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          {isMounted && translationsReady ? t('help.guides.title') : '📚 Guides Pratiques'}
        </h1>
        <p className="text-gray-600 mb-12">
          {isMounted && translationsReady ? t('help.guides.subtitle') : 'Tutoriels détaillés pour maîtriser Confidance Crypto'}
        </p>

        <div className="space-y-6">
          {guides.map((guide, index) => (
            <div
              key={index}
              className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-200 border-2 border-transparent hover:border-blue-200"
            >
              <div className="flex items-start gap-4">
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${guide.color} flex items-center justify-center flex-shrink-0`}>
                  <guide.icon className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-900 mb-2">
                    {isMounted && translationsReady ? t(guide.titleKey) : guide.titleFallback}
                  </h2>
                  <p className="text-gray-600 mb-3">
                    {isMounted && translationsReady ? t(guide.descriptionKey) : guide.descriptionFallback}
                  </p>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
                      ⏱️ {isMounted && translationsReady ? t(guide.durationKey) : guide.durationFallback}
                    </span>
                    <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full font-medium">
                      📊 {isMounted && translationsReady ? t(guide.levelKey) : guide.levelFallback}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white">
          <h2 className="text-2xl font-bold mb-3">{isMounted && translationsReady ? t('help.guides.tip.title') : '💡 Astuce'}</h2>
          <p className="text-white/90">
            {isMounted && translationsReady ? t('help.guides.tip.description') : 'Commencez par créer un paiement test avec un petit montant (0.001 ETH) pour vous familiariser avec le processus !'}
          </p>
        </div>
      </div>
    </div>
  );
}