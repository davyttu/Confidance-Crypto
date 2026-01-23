// components/Dashboard/EmailTransactionModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { Payment } from '@/hooks/useDashboard';
import { useBeneficiaries } from '@/hooks/useBeneficiaries';
import { useEmailTransaction } from '@/hooks/useEmailTransaction';
import { useAuth } from '@/contexts/AuthContext';
import { formatAmount } from '@/lib/utils/amountFormatter';
import { formatDate } from '@/lib/utils/dateFormatter';
import { truncateAddress } from '@/lib/utils/addressFormatter';

interface EmailTransactionModalProps {
  payment: Payment | null;
  onClose: () => void;
}

export function EmailTransactionModal({ 
  payment, 
  onClose 
}: EmailTransactionModalProps) {
  const { getBeneficiaryName } = useBeneficiaries();
  const { sendEmail, isSending, error, success } = useEmailTransaction();
  const { user } = useAuth();

  const [recipientType, setRecipientType] = useState<'self' | 'other'>('self');
  const [email, setEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);

  // Pré-remplir l'email avec l'email de l'utilisateur connecté
  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
      setRecipientType('self');
    }
  }, [user]);

  useEffect(() => {
    if (success) {
      // Fermer automatiquement après succès
      setTimeout(() => {
        onClose();
      }, 2000);
    }
  }, [success, onClose]);

  if (!payment) return null;

  const beneficiaryName = getBeneficiaryName(payment.payee_address);
  const displayBeneficiary = beneficiaryName || truncateAddress(payment.payee_address);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSend = async () => {
    // Validation
    if (!email.trim()) {
      setEmailError('Veuillez entrer une adresse email');
      return;
    }

    if (!validateEmail(email)) {
      setEmailError('Adresse email invalide');
      return;
    }

    setEmailError(null);

    // Envoyer l'email
    await sendEmail(payment, email, recipientName || undefined);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
        {/* En-tête */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                Envoyer par email
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Contenu */}
        <div className="px-6 py-4 space-y-4">
          {/* Résumé du paiement */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Montant</span>
              <span className="text-lg font-bold text-gray-900">
                {formatAmount(payment.amount)} {payment.token_symbol}
              </span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Bénéficiaire</span>
              <span className="text-sm font-medium text-gray-900">{displayBeneficiary}</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Date</span>
              <span className="text-sm font-medium text-gray-900">{formatDate(payment.release_time)}</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Type de paiement</span>
              <span className="text-sm font-medium text-gray-900">
                {(() => {
                  if (payment.payment_type === 'recurring' || payment.is_recurring) {
                    // Pour les paiements récurrents, afficher "Mensualisé (X échéances)"
                    const totalMonths = payment.total_months;
                    return totalMonths ? `Mensualisé (${totalMonths} échéance${totalMonths > 1 ? 's' : ''})` : 'Mensualisé';
                  } else if (payment.payment_type === 'instant' || payment.is_instant) {
                    return 'Instantané';
                  } else {
                    return 'Programmé';
                  }
                })()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Annulation</span>
              <span className={`text-sm font-medium ${payment.cancellable ? 'text-green-600' : 'text-gray-600'}`}>
                {payment.cancellable ? 'Annulable' : 'Non-annulable'}
              </span>
            </div>
          </div>

          {/* Choix du destinataire */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Destinataire de l'email
            </label>
            
            <div className="flex gap-3 mb-4">
              <button
                onClick={() => setRecipientType('self')}
                className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                  recipientType === 'self'
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="font-medium">Moi-même</span>
                </div>
              </button>

              <button
                onClick={() => setRecipientType('other')}
                className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                  recipientType === 'other'
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span className="font-medium">Autre personne</span>
                </div>
              </button>
            </div>
          </div>

          {/* Champ email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Adresse email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError(null);
              }}
              placeholder="exemple@email.com"
              className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all ${
                emailError
                  ? 'border-red-500'
                  : 'border-gray-200 focus:border-purple-500'
              }`}
            />
            {emailError && (
              <p className="text-sm text-red-600 mt-2">{emailError}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              💡 L'email sera envoyé via Brevo à l'adresse indiquée.
            </p>
          </div>

          {/* Nom du destinataire (optionnel) */}
          {recipientType === 'other' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nom du destinataire <span className="text-gray-400">(optionnel)</span>
              </label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Ex: Jean Dupont"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
              />
            </div>
          )}

          {/* Erreur */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <p className="font-semibold mb-1">Erreur lors de l'envoi</p>
                  <p className="text-red-700">{error.message}</p>
                </div>
              </div>
            </div>
          )}

          {/* Succès */}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Email envoyé avec succès !
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            disabled={isSending}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Annuler
          </button>
          
          <button
            onClick={handleSend}
            disabled={isSending || success}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isSending ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Envoi...
              </span>
            ) : success ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Envoyé !
              </span>
            ) : (
              'Envoyer'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
