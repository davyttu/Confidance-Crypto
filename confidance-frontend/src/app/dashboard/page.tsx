// app/dashboard/page.tsx
'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useAccount, useDisconnect } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useDashboard, type Payment } from '@/hooks/useDashboard';
import { useBeneficiaries, type Beneficiary } from '@/hooks/useBeneficiaries';
import { useCancelPayment } from '@/hooks/useCancelPayment';
import { isInPeriod } from '@/lib/utils/dateFormatter';

// Composants
import { StatsCards } from '@/components/Dashboard/StatsCards';
import { PeriodSelector } from '@/components/Dashboard/PeriodSelector';
import { TransactionTable } from '@/components/Dashboard/TransactionTable';
import { ExportButton } from '@/components/Dashboard/ExportButton';
import { BeneficiaryList } from '@/components/Dashboard/BeneficiaryList';
import { BeneficiaryManager } from '@/components/Dashboard/BeneficiaryManager';
import { CancelPaymentModal } from '@/components/Dashboard/CancelPaymentModal';
import { EmptyState } from '@/components/Dashboard/EmptyState';

export default function DashboardPage() {
  const { t, ready: translationsReady } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { payments, isLoading, refetch } = useDashboard();
  const { beneficiaries } = useBeneficiaries();
  const { cancelPayment, status: cancelStatus, error: cancelError, reset: resetCancel } = useCancelPayment();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!payments || payments.length === 0) return;
    const byCreatedAtDesc = [...payments].sort((a, b) => {
      const aTime = new Date(a.created_at).getTime() || 0;
      const bTime = new Date(b.created_at).getTime() || 0;
      return bTime - aTime;
    });

    const recent: { address: string; name?: string }[] = [];
    const seen = new Set<string>();

    const getName = (address: string) => {
      const entry = beneficiaries.find(
        (b) => b.beneficiary_address.toLowerCase() === address.toLowerCase()
      );
      return entry?.display_name;
    };

    for (const payment of byCreatedAtDesc) {
      const addresses: string[] = [payment.payee_address];
      if (payment.batch_beneficiaries?.length) {
        addresses.push(...payment.batch_beneficiaries.map((b) => b.address));
      }

      for (const address of addresses) {
        const normalized = address?.toLowerCase();
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        recent.push({ address, name: getName(address) || undefined });
        if (recent.length >= 5) break;
      }

      if (recent.length >= 5) break;
    }

    if (recent.length > 0) {
      localStorage.setItem('beneficiaryHistory', JSON.stringify(recent));
    }
  }, [payments, beneficiaries]);

  // États locaux
  const [periodType, setPeriodType] = useState<'all' | 'month' | 'wallet' | 'beneficiary'>('all');
  const [periodValue, setPeriodValue] = useState<string | number | string[]>();
  const [statsCardFilter, setStatsCardFilter] = useState<null | 'recurring_active' | 'pending'>(null);
  const [selectedPaymentToCancel, setSelectedPaymentToCancel] = useState<Payment | null>(null);
  const [lastCancelWasRecurring, setLastCancelWasRecurring] = useState(false);
  const [beneficiaryToEdit, setBeneficiaryToEdit] = useState<Beneficiary | null>(null);
  const [beneficiaryAddressToAdd, setBeneficiaryAddressToAdd] = useState<string | undefined>();
  const [wallets, setWallets] = useState<{ id?: string; wallet_address: string; is_primary?: boolean }[]>([]);
  const [walletsLoading, setWalletsLoading] = useState(false);
  const [walletAliases, setWalletAliases] = useState<Record<string, string>>({});
  const walletConnected = Boolean(address);
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const walletAliasesKey = user?.id ? `walletAliases:${user.id}` : 'walletAliases';

  const handleReconnectWallet = () => {
    disconnect();
    if (openConnectModal) {
      setTimeout(() => openConnectModal(), 50);
    }
  };

  // 🆕 AJOUT : Rafraîchir automatiquement après annulation réussie
  useEffect(() => {
    // Rafraîchir quand le statut devient 'success'
    if (cancelStatus === 'success') {
      console.log('✅ Annulation confirmée, rafraîchissement IMMÉDIAT du dashboard...');
      
      // Rafraîchir immédiatement (pas d'attente)
      refetch();
      setSelectedPaymentToCancel(null);
      
      // Réinitialiser le status après 5 secondes (pour cacher la notification)
      setTimeout(() => {
        resetCancel();
      }, 5000);
    }
  }, [cancelStatus, refetch, resetCancel]);

  // 🆕 AJOUT : Écouter l'événement personnalisé de cancellation pour rafraîchir immédiatement
  useEffect(() => {
    const handlePaymentCancelled = async (event: CustomEvent) => {
      console.log('📢 Événement payment-cancelled reçu, rafraîchissement du dashboard...', event.detail);
      
      // Rafraîchir immédiatement (plusieurs fois pour être sûr)
      await refetch();
      
      // Rafraîchir à nouveau après 1 seconde (au cas où)
      setTimeout(async () => {
        console.log('🔄 Rafraîchissement supplémentaire après 1 seconde...');
        await refetch();
      }, 1000);
      
      // Et encore une fois après 3 secondes
      setTimeout(async () => {
        console.log('🔄 Rafraîchissement supplémentaire après 3 secondes...');
        await refetch();
      }, 3000);
    };

    window.addEventListener('payment-cancelled', handlePaymentCancelled as EventListener);
    
    return () => {
      window.removeEventListener('payment-cancelled', handlePaymentCancelled as EventListener);
    };
  }, [refetch]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (typeof window === 'undefined') return;

    try {
      const raw = localStorage.getItem(walletAliasesKey);
      if (raw) {
        setWalletAliases(JSON.parse(raw));
      }
    } catch (error) {
      console.error('⚠️ Impossible de charger les alias de wallet:', error);
    }
  }, [isAuthenticated, walletAliasesKey]);

  useEffect(() => {
    const fetchWallets = async () => {
      if (!isAuthenticated) return;
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        setWalletsLoading(true);
        const response = await fetch(`${API_URL}/api/users/wallets`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          console.error('❌ Erreur récupération wallets:', await response.text());
          return;
        }

        const data = await response.json();
        setWallets(data.wallets || []);
      } catch (error) {
        console.error('❌ Erreur récupération wallets:', error);
      } finally {
        setWalletsLoading(false);
      }
    };

    fetchWallets();
  }, [API_URL, isAuthenticated]);

  // Bénéficiaires uniques (payee + batch + liste sauvegardée) pour le filtre "Par bénéficiaire"
  const uniqueBeneficiaries = useMemo(() => {
    const seen = new Set<string>();
    const list: { address: string; name: string }[] = [];
    const getName = (addr: string) => {
      const b = beneficiaries.find((x) => x.beneficiary_address.toLowerCase() === addr.toLowerCase());
      return b?.display_name || `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };
    const addAddress = (addr: string | null | undefined) => {
      const raw = addr && String(addr).trim();
      if (!raw) return;
      const key = raw.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      list.push({ address: raw, name: getName(raw) });
    };
    // 1) Depuis les paiements (payee + batch_beneficiaries, champs possibles: address, beneficiary_address)
    for (const payment of payments) {
      addAddress(payment.payee_address);
      if (payment.batch_beneficiaries?.length) {
        for (const b of payment.batch_beneficiaries) {
          const addr = (b as { address?: string; beneficiary_address?: string }).address
            ?? (b as { address?: string; beneficiary_address?: string }).beneficiary_address;
          addAddress(addr);
        }
      }
    }
    // 2) Toujours inclure les bénéficiaires sauvegardés ("Mes bénéficiaires") pour qu'ils apparaissent dans le filtre
    for (const b of beneficiaries) {
      addAddress(b.beneficiary_address);
    }
    list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    return list;
  }, [payments, beneficiaries]);

  // Filtrer les paiements par période
  const filteredPayments = useMemo(() => {
    if (periodType === 'all') return payments;

    if (periodType === 'month') {
      return payments.filter(payment =>
        isInPeriod(payment.release_time, periodType, periodValue)
      );
    }

    if (periodType === 'wallet' && Array.isArray(periodValue)) {
      if (periodValue.length === 0) return payments;
      const targets = periodValue.map((value) => value.toLowerCase());
      return payments.filter((payment) => {
        const payer = payment.payer_address?.toLowerCase();
        const payee = payment.payee_address?.toLowerCase();
        const batch = payment.batch_beneficiaries?.some(
          (beneficiary) => targets.includes(beneficiary.address?.toLowerCase() || '')
        );
        return targets.includes(payer || '') || targets.includes(payee || '') || Boolean(batch);
      });
    }

    // Filtre par bénéficiaire : afficher les paiements où ce bénéficiaire reçoit (payee ou en batch)
    if (periodType === 'beneficiary' && Array.isArray(periodValue) && periodValue.length > 0) {
      const targets = periodValue.map((v) => String(v).toLowerCase());
      return payments.filter((payment) => {
        const payee = payment.payee_address?.toLowerCase();
        if (payee && targets.includes(payee)) return true;
        const inBatch = payment.batch_beneficiaries?.some(
          (b) => targets.includes((b.address || '').toLowerCase())
        );
        return Boolean(inBatch);
      });
    }

    return payments;
  }, [payments, periodType, periodValue]);

  // Filtre optionnel depuis les cartes (Actif / En cours) : afficher uniquement ces paiements dans le tableau
  const displayedPayments = useMemo(() => {
    if (!statsCardFilter) return filteredPayments;
    if (statsCardFilter === 'pending') {
      return filteredPayments.filter((p) => p.status === 'pending');
    }
    if (statsCardFilter === 'recurring_active') {
      return filteredPayments.filter((payment) => {
        const isRecurring = payment.is_recurring || payment.payment_type === 'recurring';
        if (!isRecurring) return false;
        const statusLower = (payment.status || '').toLowerCase();
        if (statusLower === 'cancelled' || statusLower === 'failed') return false;
        const executed = Number(payment.executed_months ?? 0);
        const total = Number(payment.total_months ?? 0);
        if (!Number.isFinite(total) || total <= 0) return false;
        return executed < total;
      });
    }
    return filteredPayments;
  }, [filteredPayments, statsCardFilter]);

  // Gestionnaire de changement de période
  const handlePeriodChange = (type: 'all' | 'month' | 'wallet' | 'beneficiary', value?: string | number | string[]) => {
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
      const isRecurring = payment.is_recurring || payment.payment_type === 'recurring';
      setLastCancelWasRecurring(isRecurring);
      const batchChildren = payment.__batchChildren || [];
      const targets = batchChildren.length > 0 ? batchChildren : [payment];
      const seenContracts = new Set<string>();

      for (const target of targets) {
        if (!target.contract_address) continue;
        const contract = target.contract_address.toLowerCase();
        if (seenContracts.has(contract)) continue;
        seenContracts.add(contract);

        console.log('🚫 Annulation du paiement:', target.contract_address);

        await cancelPayment({
          contractAddress: target.contract_address as `0x${string}`,
          paymentId: target.id,
          payerAddress: target.payer_address,
          isRecurring,
        });
      }

      // Le refetch() est maintenant géré par useEffect qui surveille cancelStatus
      
    } catch (error) {
      console.error('❌ Erreur annulation:', error);
      // L'erreur s'affiche déjà dans la notification en bas à droite
    }
  };

  const handleDeletePayment = async (payment: Payment) => {
    if (!address) return;

    const isRecurring = payment.is_recurring || payment.payment_type === 'recurring';
    const endpoint = isRecurring
      ? `${API_URL}/api/payments/recurring/${payment.id}/remove`
      : `${API_URL}/api/payments/${payment.id}/remove`;

    const confirmMessage = isMounted && translationsReady
      ? t('dashboard.payments.deleteConfirm', { defaultValue: 'Supprimer ce paiement du dashboard ?' })
      : 'Supprimer ce paiement du dashboard ?';

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet_address: address }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Erreur suppression');
      }

      await refetch();
    } catch (error) {
      console.error('❌ Erreur suppression paiement:', error);
      alert(isMounted && translationsReady
        ? t('dashboard.payments.deleteError', { defaultValue: 'Erreur lors de la suppression' })
        : 'Erreur lors de la suppression'
      );
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

  const persistWalletAliases = (aliases: Record<string, string>) => {
    setWalletAliases(aliases);
    try {
      localStorage.setItem(walletAliasesKey, JSON.stringify(aliases));
      window.dispatchEvent(new CustomEvent('wallet-aliases-updated', { detail: aliases }));
    } catch (error) {
      console.error('⚠️ Impossible de sauvegarder les alias de wallet:', error);
    }
  };

  const handleRenameWallet = (address: string, name: string) => {
    const normalized = address.toLowerCase();
    const next = { ...walletAliases };

    if (!name) {
      delete next[normalized];
    } else {
      next[normalized] = name;
    }

    persistWalletAliases(next);
  };

  const handleDeleteWallet = async (addressToDelete: string) => {
    const confirmMessage = isMounted && translationsReady
      ? t('dashboard.wallets.deleteConfirm', { defaultValue: 'Supprimer ce wallet de votre compte ?' })
      : 'Supprimer ce wallet de votre compte ?';

    if (!window.confirm(confirmMessage)) {
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/users/wallets/${addressToDelete}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Erreur suppression wallet');
      }

      setWallets((prev) => prev.filter((wallet) => wallet.wallet_address.toLowerCase() !== addressToDelete.toLowerCase()));
      if (periodType === 'wallet' && periodValue?.toString().toLowerCase() === addressToDelete.toLowerCase()) {
        handlePeriodChange('all');
      }
    } catch (error) {
      console.error('❌ Erreur suppression wallet:', error);
      alert(isMounted && translationsReady
        ? t('dashboard.wallets.deleteError', { defaultValue: 'Erreur lors de la suppression du wallet' })
        : 'Erreur lors de la suppression du wallet'
      );
    }
  };

  const handleSetPrimaryWallet = async (addressToSet: string) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/users/wallets/${addressToSet}/primary`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Erreur mise à jour wallet principal');
      }

      setWallets((prev) =>
        prev.map((wallet) => ({
          ...wallet,
          is_primary: wallet.wallet_address.toLowerCase() === addressToSet.toLowerCase(),
        }))
      );
    } catch (error) {
      console.error('❌ Erreur wallet principal:', error);
      alert(isMounted && translationsReady
        ? t('dashboard.wallets.primaryError', { defaultValue: 'Erreur lors de la mise à jour du wallet principal' })
        : 'Erreur lors de la mise à jour du wallet principal'
      );
    }
  };

  const walletPeriodLabel = useMemo(() => {
    if (periodType !== 'wallet') return '';
    if (!periodValue || !Array.isArray(periodValue)) {
      return isMounted && translationsReady
        ? t('dashboard.period.walletGeneric', { defaultValue: 'Wallets' })
        : 'Wallets';
    }
    if (periodValue.length === 1) {
      const normalized = periodValue[0].toLowerCase();
      const alias = walletAliases[normalized];
      return alias || formatWalletLabel(periodValue[0]);
    }
    return isMounted && translationsReady
      ? t('dashboard.period.walletGeneric', { defaultValue: 'Wallets' })
      : 'Wallets';
  }, [periodType, periodValue, walletAliases, isMounted, translationsReady, t]);

  const beneficiaryPeriodLabel = useMemo(() => {
    if (periodType !== 'beneficiary' || !periodValue || !Array.isArray(periodValue) || periodValue.length === 0) return '';
    if (periodValue.length === 1) {
      const b = uniqueBeneficiaries.find((x) => x.address.toLowerCase() === String(periodValue[0]).toLowerCase());
      return b?.name || formatWalletLabel(periodValue[0]);
    }
    return isMounted && translationsReady
      ? t('dashboard.beneficiariesFilter.selectedCount', { count: periodValue.length, defaultValue: `${periodValue.length} beneficiaries` })
      : `${periodValue.length} bénéficiaires`;
  }, [periodType, periodValue, uniqueBeneficiaries, isMounted, translationsReady, t]);

  const periodLabel = useMemo(() => {
    if (periodType === 'month') return periodValue as string;
    if (periodType === 'wallet') {
      return Array.isArray(periodValue) && periodValue.length === 1
        ? (isMounted && translationsReady
          ? t('dashboard.period.wallet', { wallet: walletPeriodLabel, defaultValue: `Wallet ${walletPeriodLabel}` })
          : `Wallet ${walletPeriodLabel}`)
        : (isMounted && translationsReady ? t('dashboard.period.walletGeneric', { defaultValue: walletPeriodLabel }) : walletPeriodLabel);
    }
    if (periodType === 'beneficiary' && beneficiaryPeriodLabel) {
      return isMounted && translationsReady
        ? t('dashboard.period.beneficiary', { beneficiary: beneficiaryPeriodLabel, defaultValue: `Beneficiary: ${beneficiaryPeriodLabel}` })
        : `Bénéficiaire: ${beneficiaryPeriodLabel}`;
    }
    return isMounted && translationsReady ? t('dashboard.period.allPayments') : 'Tous les paiements';
  }, [periodType, periodValue, walletPeriodLabel, beneficiaryPeriodLabel, isMounted, translationsReady, t]);

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
  if (!walletConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-xl p-8 max-w-md w-full text-center">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            {isMounted && translationsReady ? t('dashboard.auth.walletNotConnected.title') : 'Wallet non connecté'}
          </h2>
          <p className="text-gray-600 mb-6">
            {isMounted && translationsReady ? t('dashboard.auth.walletNotConnected.description') : 'Veuillez connecter votre wallet pour accéder à votre dashboard.'}
          </p>
          <p className="text-sm text-gray-500">
            {isMounted && translationsReady ? t('dashboard.auth.walletNotConnected.hint') : 'Utilisez le bouton "Connect Wallet" en haut à droite'}
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <button
              onClick={() => openConnectModal?.()}
              className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all"
            >
              {isMounted && translationsReady ? t('common.connectWallet', { defaultValue: 'Connect Wallet' }) : 'Connect Wallet'}
            </button>
            <button
              onClick={handleReconnectWallet}
              className="w-full px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-all"
            >
              {isMounted && translationsReady ? t('common.resetWallet', { defaultValue: 'Reset wallet connection' }) : 'Reset wallet connection'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const selectedWallets = periodType === 'wallet' && Array.isArray(periodValue)
    ? periodValue
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* En-tête */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-gray-900">
                {isMounted && translationsReady ? t('dashboard.title') : 'Mon Dashboard'}
              </h1>
            </div>

            {/* Boutons de navigation rapide */}
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/statement"
                className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm font-medium"
                title="Relevé bancaire simplifié"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                {isMounted && translationsReady ? t('dashboard.statement.button', { defaultValue: 'Relevé' }) : 'Relevé'}
              </Link>

              <Link
                href="/my-liquidity"
                className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-purple-200 text-purple-700 rounded-lg hover:bg-purple-50 hover:border-purple-300 transition-all shadow-sm font-medium"
              >
                <span className="text-lg">💧</span>
                {isMounted && translationsReady ? t('dashboard.liquidity.button', { defaultValue: 'My Liquidity' }) : 'My Liquidity'}
              </Link>
            </div>
          </div>
          <p className="text-gray-600">
            {isMounted && translationsReady ? t('dashboard.subtitle') : 'Gérez vos paiements programmés'}
          </p>
        </div>

        {isLoading ? (
          // État de chargement
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600">{t('dashboard.loading')}</p>
          </div>
        ) : payments.length === 0 ? (
          // État vide
          <EmptyState />
        ) : (
          // Dashboard complet
          <>
            {/* Statistiques */}
            <StatsCards
              payments={filteredPayments}
              selectedWallets={selectedWallets}
              statsCardFilter={statsCardFilter}
              onStatsCardFilterChange={setStatsCardFilter}
            />

            {/* Barre d'actions : filtres + export alignés */}
            <div className="flex flex-wrap items-center justify-between gap-3 mt-16 mb-5">
              <PeriodSelector 
                onChange={handlePeriodChange}
                wallets={wallets}
                walletsLoading={walletsLoading}
                connectedWallet={address || null}
                walletAliases={walletAliases}
                onRenameWallet={handleRenameWallet}
                onDeleteWallet={handleDeleteWallet}
                onSetPrimaryWallet={handleSetPrimaryWallet}
                beneficiaries={uniqueBeneficiaries}
                selectedBeneficiaryAddresses={periodType === 'beneficiary' && Array.isArray(periodValue) ? periodValue as string[] : []}
              />
              {address && periodLabel && (
                <ExportButton
                  variant="toolbar"
                  payments={displayedPayments}
                  userAddress={address}
                  period={periodLabel}
                />
              )}
            </div>

            {/* Tableau des transactions */}
            <div className="mb-6">
              <TransactionTable
                payments={displayedPayments}
                onRename={handleRenameBeneficiary}
                onCancel={setSelectedPaymentToCancel}
                onDelete={handleDeletePayment}
                userAddress={address || ''}
                period={periodLabel}
                showRecurringParentsOnly={statsCardFilter === 'recurring_active'}
              />
            </div>

            {/* Liste des bénéficiaires */}
            <div className="mb-8">
              <BeneficiaryList onEdit={setBeneficiaryToEdit} />
            </div>
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
      {cancelStatus === 'success' && !lastCancelWasRecurring && (
        <div className="fixed bottom-4 right-4 bg-green-600 text-white px-6 py-4 rounded-lg shadow-xl flex items-center gap-3 z-50">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <div>
            <p className="font-semibold">{t('dashboard.cancel.success.title')}</p>
            <p className="text-sm">{t('dashboard.cancel.success.message')}</p>
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

function formatWalletLabel(address: string) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
