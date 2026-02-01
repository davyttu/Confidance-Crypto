'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { EnvelopeIcon, ChatBubbleLeftIcon } from '@heroicons/react/24/outline';

export default function ContactPage() {
  const { t, ready: translationsReady } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    subject: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.email || !formData.subject || !formData.message) {
      setSubmitStatus({
        type: 'error',
        message: t('help.contact.form.error.required', { defaultValue: 'Please fill in all fields' })
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus({ type: null, message: '' });

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de l\'envoi du message');
      }

      // Succès : toujours afficher le message traduit (langue courante), pas data.message (souvent FR)
      setSubmitStatus({
        type: 'success',
        message: t('help.contact.form.success', { defaultValue: 'Your message has been sent successfully!' })
      });

      // Réinitialiser le formulaire
      setFormData({
        email: '',
        subject: '',
        message: '',
      });

      // Effacer le message de succès après 5 secondes
      setTimeout(() => {
        setSubmitStatus({ type: null, message: '' });
      }, 5000);

    } catch (error) {
      console.error('Erreur envoi formulaire:', error);
      setSubmitStatus({
        type: 'error',
        message: error instanceof Error ? error.message : t('help.contact.form.error.generic', { defaultValue: 'An error occurred. Please try again.' })
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    // Effacer le message d'erreur quand l'utilisateur modifie le formulaire
    if (submitStatus.type === 'error') {
      setSubmitStatus({ type: null, message: '' });
    }
  };

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
            <p className="text-blue-600 font-medium">contact@confidance-defi.com</p>
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
          
          {/* Message de statut */}
          {submitStatus.type && (
            <div className={`mb-6 p-4 rounded-xl ${
              submitStatus.type === 'success' 
                ? 'bg-green-50 border border-green-200 text-green-800' 
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}>
              <p className="font-medium">{submitStatus.message}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{isMounted && translationsReady ? t('help.contact.form.email') : 'Votre email'}</label>
              <input 
                type="email" 
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                disabled={isSubmitting}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed" 
                placeholder={isMounted && translationsReady ? t('help.contact.form.emailPlaceholder') : 'votre@email.com'} 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{isMounted && translationsReady ? t('help.contact.form.subject') : 'Sujet'}</label>
              <input 
                type="text" 
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                required
                disabled={isSubmitting}
                maxLength={200}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed" 
                placeholder={isMounted && translationsReady ? t('help.contact.form.subjectPlaceholder') : 'Sujet de votre demande'} 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{isMounted && translationsReady ? t('help.contact.form.message') : 'Message'}</label>
              <textarea 
                rows={6} 
                name="message"
                value={formData.message}
                onChange={handleChange}
                required
                disabled={isSubmitting}
                maxLength={5000}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none resize-none disabled:opacity-50 disabled:cursor-not-allowed" 
                placeholder={isMounted && translationsReady ? t('help.contact.form.messagePlaceholder') : 'Votre message...'} 
              />
            </div>
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting 
                ? t('help.contact.form.sending', { defaultValue: 'Sending...' }) 
                : t('help.contact.form.submit', { defaultValue: 'Send' })
              }
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}