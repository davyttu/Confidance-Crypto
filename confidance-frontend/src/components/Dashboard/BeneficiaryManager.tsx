// components/Dashboard/BeneficiaryManager.tsx
'use client';

import { useState, useEffect } from 'react';
import { useBeneficiaries, type Beneficiary, type BeneficiaryCategory } from '@/hooks/useBeneficiaries';

interface BeneficiaryManagerProps {
  beneficiary: Beneficiary | null;
  beneficiaryAddress?: string;
  onClose: () => void;
  onSuccess: () => void;
}

const CATEGORIES: BeneficiaryCategory[] = ['Famille', 'Travail', 'Perso', 'Autre'];

const CATEGORY_ICONS = {
  'Famille': '👨‍👩‍👧‍👦',
  'Travail': '💼',
  'Perso': '⭐',
  'Autre': '📌',
};

export function BeneficiaryManager({ 
  beneficiary, 
  beneficiaryAddress, 
  onClose, 
  onSuccess 
}: BeneficiaryManagerProps) {
  const { createBeneficiary, updateBeneficiary } = useBeneficiaries();
  
  const [displayName, setDisplayName] = useState('');
  const [category, setCategory] = useState<BeneficiaryCategory>('Perso');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!beneficiary;

  useEffect(() => {
    if (beneficiary) {
      setDisplayName(beneficiary.display_name);
      setCategory(beneficiary.category || 'Perso');
    }
  }, [beneficiary]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (displayName.trim().length < 2) {
      setError('Le nom doit contenir au moins 2 caractères');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      if (isEditing && beneficiary) {
        await updateBeneficiary(beneficiary.id, displayName.trim(), category);
      } else if (beneficiaryAddress) {
        await createBeneficiary(beneficiaryAddress, displayName.trim(), category);
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        {/* En-tête */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              {isEditing ? 'Modifier le bénéficiaire' : 'Nouveau bénéficiaire'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Nom */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nom du bénéficiaire
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                setError(null);
              }}
              placeholder="Ex: Jean Dupont, Entreprise XYZ..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              minLength={2}
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1">
              Minimum 2 caractères
            </p>
          </div>

          {/* Catégorie */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Catégorie
            </label>
            <div className="grid grid-cols-2 gap-3">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    category === cat
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{CATEGORY_ICONS[cat]}</span>
                    <span className="font-medium text-gray-900">{cat}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Info adresse (si création) */}
          {!isEditing && beneficiaryAddress && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-800">
                <strong>Adresse :</strong> <code className="font-mono">{beneficiaryAddress}</code>
              </p>
            </div>
          )}

          {/* Erreur */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
              {error}
            </div>
          )}
        </form>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Annuler
          </button>
          
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || displayName.trim().length < 2}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Enregistrement...
              </span>
            ) : (
              isEditing ? 'Modifier' : 'Créer'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
