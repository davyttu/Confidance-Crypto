'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type TokenSymbol } from '@/config/tokens';

interface PaymentProgressModalProps {
  isOpen: boolean;
  status: 'idle' | 'approving' | 'creating' | 'confirming' | 'success' | 'error';
  currentStep: number;
  totalSteps: number;
  progressMessage: string;
  error: Error | null;
  approveTxHash?: `0x${string}`;
  createTxHash?: `0x${string}`;
  contractAddress?: `0x${string}`;
  tokenSymbol: TokenSymbol;
  onClose: () => void;
  onViewPayment?: () => void;
}

export default function PaymentProgressModal({
  isOpen,
  status,
  currentStep,
  totalSteps,
  progressMessage,
  error,
  approveTxHash,
  createTxHash,
  contractAddress,
  tokenSymbol,
  onClose,
  onViewPayment,
}: PaymentProgressModalProps) {
  const { t } = useTranslation();

  // 🔔 EVENTBUS: éviter les envois multiples si le composant re-render en success
  const eventSentRef = useRef(false);

  // 🔔 EVENTBUS: envoyer l'événement à l'EventBus quand la tx de création est confirmée
  useEffect(() => {
    if (status !== 'success') return;
    if (!createTxHash) return;
    if (eventSentRef.current) return;

    eventSentRef.current = true;

    const sendPaymentRegisteredEvent = async () => {
      try {
        await fetch('https://davyvittu.app.n8n.cloud/webhook/payment-protocol', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Event-API-Key': 'a6e1f0d4-93cb-4cf8-9b56-1c0fa5cd52be',
          },
          body: JSON.stringify({
            event_id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            agent_emetteur: 'confidance_frontend',
            type: 'payment_registered',
            importance: 'haute',
            payload: {
              tx_hash: createTxHash,
              contract_address: contractAddress || null,
              chain: 'base',
              token: tokenSymbol,
            },
          }),
        });
      } catch (err) {
        console.error('[EventBus] payment_registered failed:', err);
      }
    };

    sendPaymentRegisteredEvent();
  }, [status, createTxHash, contractAddress, tokenSymbol]);

  // Empêcher le scroll du body quand la modal est ouverte
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Si le statut est idle, ne rien afficher
  if (status === 'idle') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={status === 'success' || status === 'error' ? onClose : undefined}
      />

      {/* Modal */}
      <div className="relative glass rounded-3xl p-8 max-w-md w-full shadow-2xl">
        {/* SUCCESS */}
        {status === 'success' && (
          <div className="text-center space-y-6">
            {/* Icône succès animée */}
            <div className="w-20 h-20 mx-auto rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center animate-bounce">
              <svg
                className="w-10 h-10 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>

            <div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {contractAddress 
                  ? t('create.modal.paymentCreated', { defaultValue: 'Paiement créé !' })
                  : t('create.modal.transactionConfirmed', { defaultValue: 'Transaction confirmée !' })}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {contractAddress 
                  ? t('create.modal.paymentDeployedSuccess', { defaultValue: 'Votre paiement programmé a été déployé avec succès' })
                  : t('create.modal.viewOnBasescanDetails', { defaultValue: 'Consultez Basescan pour voir les détails' })
                }
              </p>
            </div>

            {/* Adresse du contrat (si disponible) */}
            {contractAddress && (
              <div className="p-4 rounded-xl bg-gray-100 dark:bg-gray-800">
                <p className="text-xs text-gray-500 mb-1">
                  {t('create.modal.contractAddress', { defaultValue: 'Adresse du contrat' })}
                </p>
                <p className="font-mono text-sm text-gray-900 dark:text-white break-all">
                  {contractAddress}
                </p>
              </div>
            )}

            {/* Hash de la transaction (toujours disponible) */}
            {createTxHash && (
              <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
                <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">
                  {t('create.modal.transactionHash', { defaultValue: 'Transaction Hash' })}
                </p>
                <p className="font-mono text-xs text-gray-900 dark:text-white break-all">
                  {createTxHash}
                </p>
              </div>
            )}

            {/* Liens */}
            <div className="flex gap-3">
              {createTxHash && (
                <a
                  href={`https://basescan.org/tx/${createTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3 px-4 rounded-xl border-2 border-primary-500 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/30 transition-all text-center font-medium"
                >
                  {t('create.modal.viewOnBasescan', { defaultValue: 'Voir sur Basescan' })}
                </a>
              )}
              {contractAddress && onViewPayment && (
                <button
                  onClick={onViewPayment}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-primary-500 to-purple-500 text-white font-bold hover:shadow-lg transition-all"
                >
                  {t('create.modal.viewPayment', { defaultValue: 'Voir le paiement' })}
                </button>
              )}
            </div>

            <button
              onClick={onClose}
              className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              {t('create.modal.close', { defaultValue: 'Fermer' })}
            </button>
          </div>
        )}

        {/* ERROR */}
        {status === 'error' && (
          <div className="text-center space-y-6">
            {/* Icône erreur */}
            <div className="w-20 h-20 mx-auto rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center">
              <svg
                className="w-10 h-10 text-red-600 dark:text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>

            <div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {t('create.modal.error', { defaultValue: 'Erreur' })}
              </h3>
              <p className="text-sm text-red-600 dark:text-red-400">
                {error?.message || t('create.modal.errorOccurred', { defaultValue: 'Une erreur est survenue' })}
              </p>
            </div>

            <button
              onClick={onClose}
              className="w-full py-3 px-4 rounded-xl bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 font-medium transition-all"
            >
              {t('create.modal.close', { defaultValue: 'Fermer' })}
            </button>
          </div>
        )}

        {/* LOADING (approving, creating, confirming) */}
        {(status === 'approving' || status === 'creating' || status === 'confirming') && (
          <div className="text-center space-y-6">
            {/* Spinner */}
            <div className="w-20 h-20 mx-auto">
              <div className="w-full h-full border-4 border-primary-200 dark:border-primary-900 border-t-primary-600 rounded-full animate-spin" />
            </div>

            <div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {progressMessage}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('create.modal.step', { current: currentStep, total: totalSteps, defaultValue: `Étape ${currentStep} sur ${totalSteps}` })}
              </p>
            </div>

            {/* Progress bar */}
            <div className="space-y-3">
              {/* Barre de progression */}
              <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary-500 to-purple-500 transition-all duration-500"
                  style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                />
              </div>

              {/* Étapes */}
              <div className="flex justify-between text-xs text-gray-500">
                {totalSteps === 2 && (
                  <>
                    <span className={currentStep >= 1 ? 'text-primary-600 font-medium' : ''}>
                      {t('create.modal.approval', { defaultValue: '1. Approbation' })}
                    </span>
                    <span className={currentStep >= 2 ? 'text-primary-600 font-medium' : ''}>
                      {t('create.modal.creation', { defaultValue: '2. Création' })}
                    </span>
                  </>
                )}
                {totalSteps === 1 && (
                  <span className="text-primary-600 font-medium mx-auto">
                    {t('create.modal.creationSingle', { defaultValue: 'Création' })}
                  </span>
                )}
              </div>
            </div>

            {/* Liens vers transactions */}
            <div className="space-y-2 text-sm">
              {approveTxHash && (
                <a
                  href={`https://basescan.org/tx/${approveTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 text-primary-600 hover:text-primary-700"
                >
                  <span>{t('create.modal.viewApproval', { defaultValue: 'Voir l\'approbation' })}</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
              {createTxHash && (
                <a
                  href={`https://basescan.org/tx/${createTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 text-primary-600 hover:text-primary-700"
                >
                  <span>{t('create.modal.viewCreation', { defaultValue: 'Voir la création' })}</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>

            <p className="text-xs text-gray-500">
              {t('create.modal.dontCloseWindow', { defaultValue: '⚠️ Ne fermez pas cette fenêtre' })}
            </p>
          </div>
        )}

        {/* CAS PAR DÉFAUT (ne devrait jamais arriver) */}
        {status === 'idle' && (
          <div className="text-center p-8">
            <p className="text-gray-600 dark:text-gray-400">
              {t('create.modal.loading', { defaultValue: 'Chargement...' })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
