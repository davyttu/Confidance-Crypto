// app/dashboard/page.tsx
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useDashboard, type Payment } from '@/hooks/useDashboard';
import { useBeneficiaries, type Beneficiary } from '@/hooks/useBeneficiaries';
import { useCancelPayment } from '@/hooks/useCancelPayment';
import { isInPeriod } from '@/lib/utils/dateFormatter';

// Composants
import { StatsCards } from '@/components/Dashboard/StatsCards';
import { PeriodSelector } from '@/components/Dashboard/PeriodSelector';
import { ExportButton } from '@/components/Dashboard/ExportButton';
import { TransactionTable } from '@/components/Dashboard/TransactionTable';
import { BeneficiaryList } from '@/components/Dashboard/BeneficiaryList';
import { BeneficiaryManager } from '@/components/Dashboard/BeneficiaryManager';
import { CancelPaymentModal } from '@/components/Dashboard/CancelPaymentModal';
import { EmptyState } from '@/components/Dashboard/EmptyState';

export default function DashboardPage() {
  const { t, ready: translationsReady } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);
  const { address, isConnected } = useAccount();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { payments, isLoading, refetch } = useDashboard();
  const { beneficiaries } = useBeneficiaries();
  const { cancelPayment, status: cancelStatus, error: cancelError, reset: resetCancel } = useCancelPayment();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // États locaux
  const [periodType, setPeriodType] = useState<'all' | 'month' | 'year'>('all');
  const [periodValue, setPeriodValue] = useState<string | number>();
  const [selectedPaymentToCancel, setSelectedPaymentToCancel] = useState<Payment | null>(null);
  const [beneficiaryToEdit, setBeneficiaryToEdit] = useState<Beneficiary | null>(null);
  const [beneficiaryAddressToAdd, setBeneficiaryAddressToAdd] = useState<string | undefined>();

  // 🆕 AJOUT : Rafraîchir automatiquement après annulation réussie
  useEffect(() => {
    if (cancelStatus === 'success') {
      console.log('✅ Annulation confirmée, rafraîchissement du dashboard...');
      
      // Attendre 1 seconde pour que la DB soit bien à jour
      setTimeout(async () => {
        await refetch();
        setSelectedPaymentToCancel(null);
        
        // Réinitialiser le status après 3 secondes (pour cacher la notification)
        setTimeout(() => {
          resetCancel();
        }, 3000);
      }, 1000);
    }
  }, [cancelStatus, refetch, resetCancel]);

  // Filtrer les paiements par période
  const filteredPayments = useMemo(() => {
    if (periodType === 'all') return payments;
    
    return payments.filter(payment => 
      isInPeriod(payment.release_time, periodType, periodValue)
    );
  }, [payments, periodType, periodValue]);

  // Gestionnaire de changement de période
  const handlePeriodChange = (type: 'all' | 'month' | 'year', value?: string | number) => {
    setPeriodType(type);
    setPeriodValue(value);
  };

  // Gestionnaire de renommage de bénéficiaire
  const handleRenameBeneficiary = (address: string) => {
    // Vérifier si le bénéficiaire existe déjà
    const existing = beneficiaries.find(
      b => b.beneficiary_address.toLowerCase() === address.toLowerCase()
    );

    if (existing) {
      setBeneficiaryToEdit(existing);
    } else {
      // Créer un nouveau bénéficiaire
      setBeneficiaryAddressToAdd(address);
    }
  };

  // Gestionnaire d'annulation de paiement (VERSION SIMPLIFIÉE)
  const handleCancelPayment = async (payment: Payment) => {
    try {
      console.log('🚫 Annulation du paiement:', payment.contract_address);
      
      await cancelPayment({
        contractAddress: payment.contract_address as `0x${string}`,
        paymentId: payment.id,
        payerAddress: payment.payer_address,
      });

      // Le refetch() est maintenant géré par useEffect qui surveille cancelStatus
      
    } catch (error) {
      console.error('❌ Erreur annulation:', error);
      // L'erreur s'affiche déjà dans la notification en bas à droite
    }
  };

  // Fermeture des modals
  const handleCloseBeneficiaryModal = () => {
    setBeneficiaryToEdit(null);
    setBeneficiaryAddressToAdd(undefined);
  };

  const handleBeneficiarySuccess = () => {
    refetch(); // Rafraîchir les paiements
  };

  // Vérifier l'authentification (compte client)
  if (!authLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-xl p-8 max-w-md w-full text-center">
          <svg className="w-16 h-16 text-blue-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            {isMounted && translationsReady ? t('dashboard.auth.title') : 'Créez un compte pour accéder au dashboard'}
          </h2>
          <p className="text-gray-600 mb-6">
            {isMounted && translationsReady ? t('dashboard.auth.description') : 'Le dashboard affiche l\'historique de tous vos paiements programmés et vous permet de les gérer facilement.'}
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-900 font-medium mb-2">
              {isMounted && translationsReady ? t('dashboard.auth.advantages') : '✨ Avantages du compte :'}
            </p>
            <ul className="text-sm text-blue-800 text-left space-y-1">
              <li>{isMounted && translationsReady ? t('dashboard.auth.advantagesList.dashboard') : '📊 Dashboard complet'}</li>
              <li>{isMounted && translationsReady ? t('dashboard.auth.advantagesList.history') : '📜 Historique des paiements'}</li>
              <li>{isMounted && translationsReady ? t('dashboard.auth.advantagesList.cancel') : '✅ Annulation possible (si activée)'}</li>
              <li>{isMounted && translationsReady ? t('dashboard.auth.advantagesList.beneficiaries') : '👥 Gestion des bénéficiaires'}</li>
            </ul>
          </div>
          <button
            onClick={() => window.location.href = '/'}
            className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700"
          >
            {isMounted && translationsReady ? t('dashboard.auth.cta') : 'Créer un compte gratuitement'}
          </button>
        </div>
      </div>
    );
  }

  // Vérifier la connexion wallet
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-xl p-8 max-w-md w-full text-center">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Wallet non connecté
          </h2>
          <p className="text-gray-600 mb-6">
            Veuillez connecter votre wallet pour accéder à votre dashboard.
          </p>
          <p className="text-sm text-gray-500">
            Utilisez le bouton "Connect Wallet" en haut à droite
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* En-tête */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">
              {isMounted && translationsReady ? t('dashboard.title') : 'Mon Dashboard'}
            </h1>
          </div>
          <p className="text-gray-600">
            {isMounted && translationsReady ? t('dashboard.subtitle') : 'Gérez vos paiements programmés'}
          </p>
        </div>

        {isLoading ? (
          // État de chargement
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement de votre dashboard...</p>
          </div>
        ) : payments.length === 0 ? (
          // État vide
          <EmptyState />
        ) : (
          // Dashboard complet
          <>
            {/* Statistiques */}
            <StatsCards payments={filteredPayments} />

            {/* Barre d'actions */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <PeriodSelector 
                onChange={handlePeriodChange}
                oldestTimestamp={payments[payments.length - 1]?.release_time}
              />
              
              <ExportButton 
                payments={filteredPayments}
                userAddress={address || ''}
                period={periodType === 'month' ? (periodValue as string) : 
                       periodType === 'year' ? (isMounted && translationsReady ? t('dashboard.period.year', { year: periodValue }) : `Année ${periodValue}`) : 
                       (isMounted && translationsReady ? t('dashboard.period.allPayments') : 'Tous les paiements')}
              />
            </div>

            {/* Tableau des transactions */}
            <div className="mb-8">
              <TransactionTable
                payments={filteredPayments}
                onRename={handleRenameBeneficiary}
                onCancel={setSelectedPaymentToCancel}
              />
            </div>

            {/* Liste des bénéficiaires */}
            {beneficiaries.length > 0 && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  👥 {isMounted && translationsReady ? t('dashboard.beneficiaries.title') : 'Mes bénéficiaires'}
                </h2>
                <BeneficiaryList 
                  onEdit={setBeneficiaryToEdit}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal d'annulation */}
      {selectedPaymentToCancel && (
        <CancelPaymentModal
          payment={selectedPaymentToCancel}
          onClose={() => {
            setSelectedPaymentToCancel(null);
            resetCancel();
          }}
          onConfirm={handleCancelPayment}
        />
      )}

      {/* Modal de gestion des bénéficiaires */}
      {(beneficiaryToEdit || beneficiaryAddressToAdd) && (
        <BeneficiaryManager
          beneficiary={beneficiaryToEdit}
          beneficiaryAddress={beneficiaryAddressToAdd}
          onClose={handleCloseBeneficiaryModal}
          onSuccess={handleBeneficiarySuccess}
        />
      )}

      {/* Notification de succès d'annulation */}
      {cancelStatus === 'success' && (
        <div className="fixed bottom-4 right-4 bg-green-600 text-white px-6 py-4 rounded-lg shadow-xl flex items-center gap-3 z-50">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <div>
            <p className="font-semibold">Paiement annulé !</p>
            <p className="text-sm">Les fonds ont été remboursés</p>
          </div>
        </div>
      )}

      {/* Notification d'erreur d'annulation */}
      {cancelError && (
        <div className="fixed bottom-4 right-4 bg-red-600 text-white px-6 py-4 rounded-lg shadow-xl flex items-center gap-3 z-50 max-w-md">
          <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          <div>
            <p className="font-semibold">{isMounted && translationsReady ? t('dashboard.cancel.errorTitle') : 'Erreur d\'annulation'}</p>
            <p className="text-sm">{cancelError.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}
