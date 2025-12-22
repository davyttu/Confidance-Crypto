// src/app/aide/videos/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { PlayCircleIcon } from '@heroicons/react/24/outline';

export default function VideosPage() {
  const { t, ready: translationsReady } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const videos = [
    {
      titleKey: 'help.videos.items.createPayment.title',
      titleFallback: 'Créer un paiement de A à Z',
      descriptionKey: 'help.videos.items.createPayment.description',
      descriptionFallback: 'Tutoriel complet pour créer votre premier paiement programmé',
      durationKey: 'help.videos.items.createPayment.duration',
      durationFallback: '5:30',
      thumbnail: '🎥',
    },
    {
      titleKey: 'help.videos.items.connectWallet.title',
      titleFallback: 'Connecter son wallet MetaMask',
      descriptionKey: 'help.videos.items.connectWallet.description',
      descriptionFallback: 'Comment connecter et configurer votre wallet sur Base',
      durationKey: 'help.videos.items.connectWallet.duration',
      durationFallback: '3:15',
      thumbnail: '🦊',
    },
    {
      titleKey: 'help.videos.items.feesSecurity.title',
      titleFallback: 'Comprendre les frais et la sécurité',
      descriptionKey: 'help.videos.items.feesSecurity.description',
      descriptionFallback: 'Explication détaillée du système de fees et de sécurité',
      durationKey: 'help.videos.items.feesSecurity.duration',
      durationFallback: '4:45',
      thumbnail: '🔐',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <Link href="/aide" className="text-blue-600 hover:text-blue-700 mb-8 inline-block">
          {isMounted && translationsReady ? t('help.videos.back') : '← Retour au centre d\'aide'}
        </Link>

        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          {isMounted && translationsReady ? t('help.videos.title') : '📹 Tutoriels Vidéo'}
        </h1>
        <p className="text-gray-600 mb-12">
          {isMounted && translationsReady ? t('help.videos.subtitle') : 'Apprenez en vidéo avec nos tutoriels pas-à-pas'}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {videos.map((video, index) => (
            <div
              key={index}
              className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-200 group cursor-pointer"
            >
              <div className="aspect-video bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center relative group-hover:scale-105 transition-transform">
                <span className="text-6xl">{video.thumbnail}</span>
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                  <PlayCircleIcon className="w-16 h-16 text-white opacity-80 group-hover:opacity-100 transition-opacity" />
                </div>
                <span className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 text-white text-xs rounded">
                  {video.duration}
                </span>
              </div>
              <div className="p-4">
                <h3 className="font-bold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                  {isMounted && translationsReady ? t(video.titleKey) : video.titleFallback}
                </h3>
                <p className="text-sm text-gray-600">
                  {isMounted && translationsReady ? t(video.descriptionKey) : video.descriptionFallback}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-6 text-center">
          <p className="text-yellow-800 font-medium">
            {isMounted && translationsReady ? t('help.videos.comingSoon.title') : '🎬 Les vidéos tutoriels arrivent bientôt !'}
          </p>
          <p className="text-yellow-700 text-sm mt-2">
            {isMounted && translationsReady ? t('help.videos.comingSoon.description') : 'En attendant, consultez nos guides écrits détaillés'}
          </p>
        </div>
      </div>
    </div>
  );
}