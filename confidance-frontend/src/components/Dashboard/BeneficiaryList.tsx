// components/Dashboard/BeneficiaryList.tsx
'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useBeneficiaries, type Beneficiary, type BeneficiaryCategory } from '@/hooks/useBeneficiaries';
import { truncateAddress } from '@/lib/utils/addressFormatter';

interface BeneficiaryListProps {
  onEdit: (beneficiary: Beneficiary) => void;
}

export function BeneficiaryList({ onEdit }: BeneficiaryListProps) {
  const { t, ready: translationsReady } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);
  const { beneficiaries, isLoading, deleteBeneficiary } = useBeneficiaries();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fonction pour obtenir le label traduit d'une catégorie
  const getCategoryLabel = (category: BeneficiaryCategory | null) => {
    if (!category) return isMounted && translationsReady ? t('dashboard.beneficiaries.categories.other') : 'Autre';
    
    const translations: Record<string, string> = {
      'Famille': isMounted && translationsReady ? t('dashboard.beneficiaries.categories.family') : 'Famille',
      'Travail': isMounted && translationsReady ? t('dashboard.beneficiaries.categories.work') : 'Travail',
      'Perso': isMounted && translationsReady ? t('dashboard.beneficiaries.categories.personal') : 'Perso',
      'Autre': isMounted && translationsReady ? t('dashboard.beneficiaries.categories.other') : 'Autre',
    };
    
    return translations[category] || translations['Autre'];
  };

  // Icône et couleur par catégorie
  const getCategoryStyle = (category: BeneficiaryCategory | null) => {
    const styles = {
      'Famille': { icon: '👨‍👩‍👧‍👦', color: 'bg-blue-100 text-blue-800' },
      'Travail': { icon: '💼', color: 'bg-purple-100 text-purple-800' },
      'Perso': { icon: '⭐', color: 'bg-green-100 text-green-800' },
      'Autre': { icon: '📌', color: 'bg-gray-100 text-gray-800' },
    };

    return category ? styles[category] : styles['Autre'];
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
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">
          {isMounted && translationsReady ? t('dashboard.beneficiaries.title') : 'Mes bénéficiaires'} ({beneficiaries.length})
        </h2>
      </div>

      <div className="divide-y divide-gray-200">
        {Object.entries(groupedBeneficiaries).map(([category, items]) => (
          <div key={category}>
            {/* En-tête de catégorie */}
            <div className="px-6 py-3 bg-gray-50">
              <div className="flex items-center gap-2">
                <span className="text-lg">{getCategoryStyle(category as BeneficiaryCategory).icon}</span>
                <span className="text-sm font-medium text-gray-700">{getCategoryLabel((category || 'Autre') as BeneficiaryCategory)}</span>
                <span className="text-sm text-gray-500">({items.length})</span>
              </div>
            </div>

            {/* Liste des bénéficiaires */}
            <div className="divide-y divide-gray-100">
              {items.map((beneficiary) => {
                const style = getCategoryStyle(beneficiary.category);
                
                return (
                  <div key={beneficiary.id} className="px-6 py-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      {/* Info */}
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${style.color}`}>
                          <span className="text-xl">{style.icon}</span>
                        </div>
                        
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">
                            {beneficiary.display_name}
                          </h3>
                          <p className="text-sm text-gray-500 font-mono">
                            {truncateAddress(beneficiary.beneficiary_address)}
                          </p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onEdit(beneficiary)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title={isMounted && translationsReady ? t('dashboard.beneficiaries.edit') : 'Modifier'}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>

                        <button
                          onClick={() => handleDelete(beneficiary.id, beneficiary.display_name)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title={isMounted && translationsReady ? t('dashboard.beneficiaries.delete') : 'Supprimer'}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
