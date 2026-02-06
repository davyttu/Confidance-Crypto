'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToLogin: () => void;
  onSuccess: (email: string, code: string, accountType: 'particular' | 'professional') => void; // MODIFIED
}

export function RegisterModal({ isOpen, onClose, onSwitchToLogin, onSuccess }: RegisterModalProps) {
  const { register } = useAuth();
  const { t, i18n } = useTranslation();
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    accountType: 'particular' as 'particular' | 'professional',
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validations
    if (formData.password.length < 8) {
      setError(t('registerModal.errors.passwordTooShort'));
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError(t('registerModal.errors.passwordsMismatch'));
      return;
    }

    try {
      setIsSubmitting(true);
      const locale = (i18n.language || 'fr').split('-')[0];
      const { verificationCode } = await register(
        formData.email,
        formData.password,
        formData.confirmPassword,
        formData.accountType,
        locale
      );

      // Passer au modal de vérification
      onSuccess(formData.email, verificationCode, formData.accountType); // MODIFIED
    } catch (err) {
      setError(err instanceof Error ? err.message : t('registerModal.errors.registerFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({
      email: '',
      password: '',
      confirmPassword: '',
      accountType: 'particular',
    });
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* En-tête */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {t('registerModal.title')}
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

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('registerModal.emailLabel')}
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder={t('registerModal.emailPlaceholder')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Type de compte */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('registerModal.accountTypeLabel')}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, accountType: 'particular' })}
                className={`p-4 rounded-lg border-2 transition-all ${
                  formData.accountType === 'particular'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-center">
                  <div className="text-2xl mb-1">👤</div>
                  <div className="font-semibold text-gray-900">{t('registerModal.particular')}</div>
                  <div className="text-xs text-gray-500 mt-1">{t('registerModal.feesParticular')}</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, accountType: 'professional' })}
                className={`p-4 rounded-lg border-2 transition-all ${
                  formData.accountType === 'professional'
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-center">
                  <div className="text-2xl mb-1">💼</div>
                  <div className="font-semibold text-gray-900">{t('registerModal.professional')}</div>
                  <div className="text-xs text-gray-500 mt-1">{t('registerModal.feesProfessional')}</div>
                </div>
              </button>
            </div>
            {formData.accountType === 'professional' && (
              <p className="text-xs text-gray-500 mt-2">
                {t('registerModal.proInfoRequired')}
              </p>
            )}
          </div>

          {/* Mot de passe */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('registerModal.passwordLabel')}
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="••••••••"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              minLength={8}
            />
            <p className="text-xs text-gray-500 mt-1">{t('registerModal.passwordMinHint')}</p>
          </div>

          {/* Confirmation mot de passe */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('registerModal.confirmPasswordLabel')}
            </label>
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              placeholder="••••••••"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Erreur */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {/* Bouton submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isSubmitting ? t('registerModal.submitting') : t('registerModal.submitButton')}
          </button>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-600">
            {t('registerModal.alreadyHaveAccount')}{' '}
            <button
              onClick={onSwitchToLogin}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              {t('registerModal.signIn')}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
