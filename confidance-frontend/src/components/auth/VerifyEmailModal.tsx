// components/Auth/VerifyEmailModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';

interface VerifyEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  email: string;
  verificationCode?: string; // Code reçu après inscription (en dev)
}

export function VerifyEmailModal({ isOpen, onClose, email, verificationCode }: VerifyEmailModalProps) {
  const { t } = useTranslation();
  const { verify } = useAuth();
  
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pré-remplir le code en développement
  useEffect(() => {
    if (verificationCode) {
      setCode(verificationCode);
    }
  }, [verificationCode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (code.length !== 6) {
      setError(t('verifyEmailModal.errors.codeLength'));
      return;
    }

    try {
      setIsSubmitting(true);
      await verify(email, code);
      
      // Succès - fermer le modal
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('verifyEmailModal.errors.wrongCode'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setCode('');
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        {/* En-tête */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">
              {t('verifyEmailModal.title')}
            </h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Contenu */}
        <div className="px-6 py-6">
          {/* Icône email */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>

          {/* Message */}
          <div className="text-center mb-6">
            <p className="text-gray-700 mb-2">
              {t('verifyEmailModal.codeSentTo')}
            </p>
            <p className="font-semibold text-gray-900 mb-4">{email}</p>
            <p className="text-sm text-gray-600">
              {t('verifyEmailModal.enterCode')}
            </p>
          </div>

          {/* Formulaire */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                value={code}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setCode(value);
                  setError(null);
                }}
                placeholder="000000"
                className="w-full px-4 py-3 text-center text-2xl font-mono border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent tracking-widest"
                maxLength={6}
                autoFocus
              />
            </div>

            {/* Erreur */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                {error}
              </div>
            )}

            {/* Info développement */}
            {verificationCode && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800">
                <strong>{t('verifyEmailModal.devMode')}</strong> {t('verifyEmailModal.devModeCode')}
              </div>
            )}

            {/* Bouton submit */}
            <button
              type="submit"
              disabled={isSubmitting || code.length !== 6}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isSubmitting ? t('verifyEmailModal.verifying') : t('verifyEmailModal.verify')}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              {t('verifyEmailModal.resendCode')}{' '}
              <button className="text-blue-600 hover:text-blue-700 font-medium">
                {t('verifyEmailModal.resend')}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
