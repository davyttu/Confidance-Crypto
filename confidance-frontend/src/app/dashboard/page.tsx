// app/dashboard/page.tsx
'use client';

import { useState, useMemo } from 'react';
import { useAccount } from 'wagmi';
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
  const { address, isConnected } = useAccount();
  const { payments, isLoading, refetch } = useDashboard();
  const { beneficiaries } = useBeneficiaries();
  const { cancelPayment, status: cancelStatus, error: cancelError, reset: resetCancel } = useCancelPayment();

  // États locaux
  const [periodType, setPeriodType] = useState<'all' | 'month' | 'year'>('all');
  const [periodValue, setPeriodValue] = useState<string | number>();
  const [selectedPaymentToCancel, setSelectedPaymentToCancel] = useState<Payment | null>(null);
  const [beneficiaryToEdit, setBeneficiaryToEdit] = useState<Beneficiary | null>(null);
  const [beneficiaryAddressToAdd, setBeneficiaryAddressToAdd] = useState<string | undefined>();

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

  // Gestionnaire d'annulation de paiement
  const handleCancelPayment = async (payment: Payment) => {
    try {
      console.log('🚫 Annulation du paiement:', payment.contract_address);
      
      await cancelPayment({
        contractAddress: payment.contract_address as `0x${string}`,
        paymentId: payment.id,
      });

      // Attendre un peu pour que la blockchain se mette à jour
      setTimeout(async () => {
        await refetch();
        setSelectedPaymentToCancel(null);
      }, 2000);

    } catch (error) {
      console.error('❌ Erreur annulation:', error);
      alert('Erreur lors de l\'annulation. Voir la console pour plus de détails.');
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            💎 Mon Dashboard
          </h1>
          <p className="text-gray-600">
            Gérez vos paiements programmés en toute simplicité
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
                       periodType === 'year' ? `Année ${periodValue}` : 
                       'Tous les paiements'}
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
                  👥 Mes bénéficiaires
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
        <div className="fixed bottom-4 right-4 bg-green-600 text-white px-6 py-4 rounded-lg shadow-xl flex items-center gap-3">
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
        <div className="fixed bottom-4 right-4 bg-red-600 text-white px-6 py-4 rounded-lg shadow-xl flex items-center gap-3">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          <div>
            <p className="font-semibold">Erreur d'annulation</p>
            <p className="text-sm">{cancelError.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}
