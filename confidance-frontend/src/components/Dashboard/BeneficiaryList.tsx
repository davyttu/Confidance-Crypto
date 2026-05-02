// components/Dashboard/BeneficiaryList.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useBeneficiaries, type Beneficiary, type BeneficiaryCategory } from '@/hooks/useBeneficiaries';
import { useDashboard, type Payment } from '@/hooks/useDashboard';
import { truncateAddress } from '@/lib/utils/addressFormatter';

interface BeneficiaryListProps {
  onEdit: (beneficiary: Beneficiary) => void;
}

export function BeneficiaryList({ onEdit }: BeneficiaryListProps) {
  const { t, ready: translationsReady } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);
  const { beneficiaries, isLoading, deleteBeneficiary } = useBeneficiaries();
  const { payments } = useDashboard();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Valeurs possibles renvoyées par l'API (anglais/uppercase) ou frontend (français)
  const CATEGORY_TO_I18N: Record<string, string> = {
    FAMILY: 'dashboard.beneficiaries.categories.family',
    Famille: 'dashboard.beneficiaries.categories.family',
    WORK: 'dashboard.beneficiaries.categories.work',
    Travail: 'dashboard.beneficiaries.categories.work',
    PERSONAL: 'dashboard.beneficiaries.categories.personal',
    Perso: 'dashboard.beneficiaries.categories.personal',
    OTHER: 'dashboard.beneficiaries.categories.other',
    Autre: 'dashboard.beneficiaries.categories.other',
  };

  const getCategoryLabel = (category: BeneficiaryCategory | string | null) => {
    if (!category) return isMounted && translationsReady ? t('dashboard.beneficiaries.categories.other') : 'Autre';
    const key = CATEGORY_TO_I18N[category];
    if (key && isMounted && translationsReady) return t(key);
    const fallbacks: Record<string, string> = { FAMILY: 'Famille', Famille: 'Famille', WORK: 'Travail', Travail: 'Travail', PERSONAL: 'Perso', Perso: 'Perso', OTHER: 'Autre', Autre: 'Autre' };
    return fallbacks[category] ?? 'Autre';
  };

  // Icône et couleur par catégorie (accepte API PERSONAL / frontend Perso)
  const getCategoryStyle = (category: BeneficiaryCategory | string | null) => {
    const styles: Record<string, { icon: string; color: string }> = {
      FAMILY: { icon: '👨‍👩‍👧‍👦', color: 'bg-blue-100 text-blue-800' },
      Famille: { icon: '👨‍👩‍👧‍👦', color: 'bg-blue-100 text-blue-800' },
      WORK: { icon: '💼', color: 'bg-purple-100 text-purple-800' },
      Travail: { icon: '💼', color: 'bg-purple-100 text-purple-800' },
      PERSONAL: { icon: '⭐', color: 'bg-green-100 text-green-800' },
      Perso: { icon: '⭐', color: 'bg-green-100 text-green-800' },
      OTHER: { icon: '📌', color: 'bg-gray-100 text-gray-800' },
      Autre: { icon: '📌', color: 'bg-gray-100 text-gray-800' },
    };
    return (category && styles[category]) ? styles[category] : styles['Autre'];
  };

  // Helper pour convertir un montant en BigInt (gère les formats décimal et BigInt)
  const parseAmount = (amountValue: string | number | bigint | undefined, decimals: number = 18): bigint => {
    if (!amountValue) return BigInt(0);
    
    // Si c'est déjà un BigInt, retourner directement
    if (typeof amountValue === 'bigint') {
      return amountValue;
    }
    
    // Si c'est un nombre, le convertir en BigInt
    if (typeof amountValue === 'number') {
      return BigInt(Math.floor(amountValue * Math.pow(10, decimals)));
    }
    
    // Si c'est une chaîne
    const str = String(amountValue);
    
    // Vérifier si c'est un nombre décimal (contient un point)
    if (str.includes('.')) {
      // Convertir le nombre décimal en BigInt
      const [integerPart, decimalPart = ''] = str.split('.');
      const paddedDecimal = decimalPart.padEnd(decimals, '0').slice(0, decimals);
      return BigInt(integerPart + paddedDecimal);
    }
    
    // Sinon, essayer de convertir directement en BigInt
    try {
      return BigInt(str);
    } catch (e) {
      console.warn('Impossible de convertir le montant en BigInt:', amountValue);
      return BigInt(0);
    }
  };

  // Calculer les statistiques pour chaque bénéficiaire
  const beneficiaryStats = useMemo(() => {
    const stats: Record<string, { count: number; totalAmount: Record<string, bigint> }> = {};
    
    payments.forEach((payment: Payment) => {
      const tokenSymbol = payment.token_symbol || 'ETH';
      const decimals = tokenSymbol === 'ETH' ? 18 : 6; // ETH = 18, USDC/USDT = 6
      const isRecurring = payment.is_recurring || payment.payment_type === 'recurring';
      const totalMonths = Number(payment.total_months || 0);
      const executedMonths = Number(payment.executed_months ?? 0);
      const isFirstMonthCustom =
        payment.is_first_month_custom === true || payment.is_first_month_custom === 'true';

      // Pour les paiements récurrents : n compter que les mensualités déjà exécutées/released
      // (pas le montant total contracté, pour éviter d'afficher des montants non encore versés)
      const getRecurringTotalPerBeneficiary = (perMonthAmount: string): bigint => {
        if (totalMonths <= 0) return parseAmount(perMonthAmount, decimals);
        if (executedMonths <= 0) return BigInt(0); // Pending : aucune mensualité versée
        const monthly = parseAmount(perMonthAmount, decimals);
        if (isFirstMonthCustom && payment.first_month_amount) {
          const firstMonth = parseAmount(payment.first_month_amount, decimals);
          if (executedMonths === 1) return firstMonth;
          return firstMonth + monthly * BigInt(executedMonths - 1);
        }
        return monthly * BigInt(executedMonths);
      };

      // Convertir le montant principal
      const amount = parseAmount(payment.amount, decimals);
      
      // Gérer les paiements batch
      if (payment.is_batch && payment.batch_beneficiaries && payment.batch_beneficiaries.length > 0) {
        payment.batch_beneficiaries.forEach((batchBeneficiary) => {
          const beneficiaryAddress = batchBeneficiary.address.toLowerCase();
          
          if (!stats[beneficiaryAddress]) {
            stats[beneficiaryAddress] = { count: 0, totalAmount: {} };
          }
          
          stats[beneficiaryAddress].count += 1;
          
          // Montant : récurrent = total sur toutes les mensualités, sinon montant du batch
          const beneficiaryAmount = isRecurring && totalMonths > 0
            ? getRecurringTotalPerBeneficiary(
                batchBeneficiary.amount || payment.monthly_amount || payment.amount || '0'
              )
            : parseAmount(batchBeneficiary.amount, decimals);
          
          if (!stats[beneficiaryAddress].totalAmount[tokenSymbol]) {
            stats[beneficiaryAddress].totalAmount[tokenSymbol] = BigInt(0);
          }
          
          stats[beneficiaryAddress].totalAmount[tokenSymbol] += beneficiaryAmount;
        });
      } else {
        // Paiement simple
        const beneficiaryAddress = payment.payee_address.toLowerCase();
        
        if (!stats[beneficiaryAddress]) {
          stats[beneficiaryAddress] = { count: 0, totalAmount: {} };
        }
        
        stats[beneficiaryAddress].count += 1;
        
        // Montant : récurrent = total sur toutes les mensualités, sinon montant du paiement
        const beneficiaryAmount = isRecurring && totalMonths > 0
          ? getRecurringTotalPerBeneficiary(
              payment.monthly_amount || payment.amount || '0'
            )
          : amount;
        
        if (!stats[beneficiaryAddress].totalAmount[tokenSymbol]) {
          stats[beneficiaryAddress].totalAmount[tokenSymbol] = BigInt(0);
        }
        
        stats[beneficiaryAddress].totalAmount[tokenSymbol] += beneficiaryAmount;
      }
    });
    
    return stats;
  }, [payments]);

  // Formater le montant
  const formatAmount = (amount: bigint, symbol: string) => {
    const decimals = symbol === 'ETH' ? 18 : 6;
    const amountNum = Number(amount) / Math.pow(10, decimals);
    return amountNum.toLocaleString('fr-FR', {
      minimumFractionDigits: symbol === 'ETH' ? 4 : 2,
      maximumFractionDigits: symbol === 'ETH' ? 4 : 2,
    });
  };

  // Grouper par catégorie
  const groupedBeneficiaries = beneficiaries.reduce((acc, beneficiary) => {
    const category = beneficiary.category || 'Autre';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(beneficiary);
    return acc;
  }, {} as Record<string, Beneficiary[]>);

  const handleDelete = async (id: string, name: string) => {
    const confirmMessage = isMounted && translationsReady 
      ? t('dashboard.beneficiaries.deleteConfirm', { name })
      : `Supprimer "${name}" de vos bénéficiaires ?`;
    
    if (window.confirm(confirmMessage)) {
      try {
        await deleteBeneficiary(id);
      } catch (error) {
        console.error('Erreur suppression:', error);
        alert(isMounted && translationsReady ? t('dashboard.beneficiaries.deleteError') : 'Erreur lors de la suppression');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (beneficiaries.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{isMounted && translationsReady ? t('dashboard.beneficiaries.empty') : 'Aucun bénéficiaire'}</h3>
        <p className="text-gray-600">
          {isMounted && translationsReady ? t('dashboard.beneficiaries.emptyDescription') : 'Créez des paiements pour ajouter des bénéficiaires à votre liste.'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-4 py-3 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
            <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              {isMounted && translationsReady ? t('dashboard.beneficiaries.title') : 'Mes bénéficiaires'}
            </h2>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {isMounted && translationsReady ? t('dashboard.beneficiaries.count', { count: beneficiaries.length }) : `${beneficiaries.length} ${beneficiaries.length === 1 ? 'bénéficiaire' : 'bénéficiaires'}`}
            </p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {Object.entries(groupedBeneficiaries).map(([category, items]) => (
          <div key={category}>
            {/* En-tête de catégorie */}
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border-l-3 border-purple-500">
              <div className="flex items-center gap-2">
                <span className="text-base">{getCategoryStyle(category as BeneficiaryCategory).icon}</span>
                <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 uppercase tracking-wide">
                  {getCategoryLabel((category || 'Autre') as BeneficiaryCategory)}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/50 text-xs font-medium text-purple-700 dark:text-purple-300">
                  {items.length}
                </span>
              </div>
            </div>

            {/* Liste des bénéficiaires */}
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {items.map((beneficiary) => {
                const style = getCategoryStyle(beneficiary.category);
                const address = beneficiary.beneficiary_address.toLowerCase();
                const stats = beneficiaryStats[address];
                
                return (
                  <div key={beneficiary.id} className="px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <div className="flex items-center gap-3">
                      {/* Avatar avec icône catégorie */}
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${style.color}`}>
                        <span className="text-base">{style.icon}</span>
                      </div>
                      
                      {/* Contenu principal */}
                      <div className="flex-1 min-w-0 flex items-center gap-4">
                        {/* Nom et adresse */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                              {beneficiary.display_name}
                            </h3>
                            {stats && stats.count > 0 && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                ({stats.count} {stats.count === 1 ? 'paiement' : 'paiements'})
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                            {truncateAddress(beneficiary.beneficiary_address)}
                          </p>
                        </div>
                        
                        {/* Statistiques - Montants totaux */}
                        {stats && stats.count > 0 && Object.keys(stats.totalAmount).length > 0 && (
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-gray-500 dark:text-gray-400">{t('dashboard.beneficiaries.totalLabel')}</span>
                            <div className="flex items-center gap-1.5">
                              {Object.keys(stats.totalAmount).map((symbol, idx) => (
                                <span key={symbol} className="text-xs font-medium text-gray-900 dark:text-white">
                                  {idx > 0 && <span className="text-gray-400 mx-0.5">•</span>}
                                  {formatAmount(stats.totalAmount[symbol], symbol)} {symbol}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <button
                          onClick={() => onEdit(beneficiary)}
                          className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded transition-colors"
                          title={isMounted && translationsReady ? t('dashboard.beneficiaries.edit') : 'Modifier'}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>

                        <button
                          onClick={() => handleDelete(beneficiary.id, beneficiary.display_name)}
                          className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded transition-colors"
                          title={isMounted && translationsReady ? t('dashboard.beneficiaries.delete') : 'Supprimer'}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
