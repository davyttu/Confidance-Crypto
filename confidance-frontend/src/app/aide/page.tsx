// src/app/aide/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import {
  RocketLaunchIcon,
  BookOpenIcon,
  QuestionMarkCircleIcon,
  VideoCameraIcon,
} from '@heroicons/react/24/outline';

export default function AidePage() {
  const { t, ready: translationsReady } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const sections = [
    {
      icon: RocketLaunchIcon,
      titleKey: 'help.sections.getStarted.title',
      titleFallback: 'Débuter',
      descriptionKey: 'help.sections.getStarted.description',
      descriptionFallback: 'Premiers pas avec Confidance Crypto',
      href: '/aide/debuter',
      color: 'from-blue-500 to-blue-600',
    },
    {
      icon: BookOpenIcon,
      titleKey: 'help.sections.guides.title',
      titleFallback: 'Guides',
      descriptionKey: 'help.sections.guides.description',
      descriptionFallback: 'Tutoriels détaillés pas-à-pas',
      href: '/aide/guides',
      color: 'from-purple-500 to-purple-600',
    },
    {
      icon: QuestionMarkCircleIcon,
      titleKey: 'help.sections.faq.title',
      titleFallback: 'FAQ',
      descriptionKey: 'help.sections.faq.description',
      descriptionFallback: 'Questions fréquentes',
      href: '/aide/faq',
      color: 'from-green-500 to-green-600',
    },
    {
      icon: VideoCameraIcon,
      titleKey: 'help.sections.videos.title',
      titleFallback: 'Vidéos',
      descriptionKey: 'help.sections.videos.description',
      descriptionFallback: 'Tutoriels vidéo',
      href: '/aide/videos',
      color: 'from-orange-500 to-orange-600',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            💎 {isMounted && translationsReady ? t('help.title') : 'Centre d\'Aide'}
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            {isMounted && translationsReady ? t('help.subtitle') : 'Trouvez rapidement les réponses à vos questions sur Confidance Crypto'}
          </p>
        </div>

        <div className="max-w-2xl mx-auto mb-16">
          <div className="relative">
            <input
              type="text"
              placeholder={isMounted && translationsReady ? `🔍 ${t('help.search')}` : '🔍 Rechercher dans l\'aide...'}
              className="w-full px-6 py-4 rounded-2xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none text-lg shadow-lg"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          {sections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="group bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-200 border-2 border-transparent hover:border-blue-200"
            >
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${section.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <section.icon className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                {isMounted && translationsReady ? t(section.titleKey) : section.titleFallback}
              </h2>
              <p className="text-gray-600">
                {isMounted && translationsReady ? t(section.descriptionKey) : section.descriptionFallback}
              </p>
            </Link>
          ))}
        </div>

        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white text-center">
          <h2 className="text-3xl font-bold mb-4">{isMounted && translationsReady ? t('help.cta.title') : 'Besoin d\'aide personnalisée ?'}</h2>
          <p className="text-lg mb-6 text-white/90">
            {isMounted && translationsReady ? t('help.cta.description') : 'Notre équipe est là pour vous accompagner'}
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/aide/contact"
              className="px-6 py-3 bg-white text-blue-600 rounded-xl font-semibold hover:bg-gray-100 transition-colors"
            >
              💬 {isMounted && translationsReady ? t('help.cta.button') : 'Contacter le support'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}