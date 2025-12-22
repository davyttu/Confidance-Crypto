'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { EnvelopeIcon, ChatBubbleLeftIcon } from '@heroicons/react/24/outline';

export default function ContactPage() {
  const { t, ready: translationsReady } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <Link href="/aide" className="text-blue-600 hover:text-blue-700 mb-8 inline-block">
          {isMounted && translationsReady ? t('help.contact.back') : 'Retour au centre d\'aide'}
        </Link>

        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          {isMounted && translationsReady ? t('help.contact.title') : 'Contacter le Support'}
        </h1>
        <p className="text-gray-600 mb-12">
          {isMounted && translationsReady ? t('help.contact.subtitle') : 'Notre équipe est là pour vous aider'}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="bg-white rounded-2xl p-8 shadow-lg">
            <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
              <EnvelopeIcon className="w-7 h-7 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">{isMounted && translationsReady ? t('help.contact.email.title') : 'Email'}</h2>
            <p className="text-gray-600 mb-4">{isMounted && translationsReady ? t('help.contact.email.description') : 'Réponse sous 24h en moyenne'}</p>
            <p className="text-blue-600 font-medium">support@confidance.crypto</p>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-lg">
            <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
              <ChatBubbleLeftIcon className="w-7 h-7 text-purple-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">{isMounted && translationsReady ? t('help.contact.discord.title') : 'Discord'}</h2>
            <p className="text-gray-600 mb-4">{isMounted && translationsReady ? t('help.contact.discord.description') : 'Rejoignez la communauté'}</p>
            <p className="text-purple-600 font-medium">{isMounted && translationsReady ? t('help.contact.discord.comingSoon') : 'Bientôt disponible'}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-lg">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">{isMounted && translationsReady ? t('help.contact.form.title') : 'Formulaire de contact'}</h2>
          <form className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{isMounted && translationsReady ? t('help.contact.form.email') : 'Votre email'}</label>
              <input type="email" className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none" placeholder={isMounted && translationsReady ? t('help.contact.form.emailPlaceholder') : 'votre@email.com'} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{isMounted && translationsReady ? t('help.contact.form.subject') : 'Sujet'}</label>
              <input type="text" className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none" placeholder={isMounted && translationsReady ? t('help.contact.form.subjectPlaceholder') : 'Sujet de votre demande'} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{isMounted && translationsReady ? t('help.contact.form.message') : 'Message'}</label>
              <textarea rows={6} className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none resize-none" placeholder={isMounted && translationsReady ? t('help.contact.form.messagePlaceholder') : 'Votre message...'} />
            </div>
            <button type="submit" className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all">
              {isMounted && translationsReady ? t('help.contact.form.submit') : 'Envoyer'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}