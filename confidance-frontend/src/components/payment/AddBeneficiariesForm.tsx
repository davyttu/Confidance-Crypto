// src/components/payment/AddBeneficiariesForm.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AddBeneficiariesForm() {
  const router = useRouter();
  
  const [beneficiaries, setBeneficiaries] = useState<string[]>(['', '', '', '']);
  const [errors, setErrors] = useState<string[]>(['', '', '', '']);

  const isValidAddress = (address: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  const handleAddressChange = (index: number, value: string) => {
    const updated = [...beneficiaries];
    updated[index] = value;
    setBeneficiaries(updated);

    // Validation
    const updatedErrors = [...errors];
    if (value && !isValidAddress(value)) {
      updatedErrors[index] = 'Adresse invalide';
    } else {
      updatedErrors[index] = '';
    }
    setErrors(updatedErrors);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Filtrer les adresses vides et valides
    const validAddresses = beneficiaries.filter(addr => addr && isValidAddress(addr));

    if (validAddresses.length === 0) {
      alert('Ajoutez au moins une adresse valide');
      return;
    }

    // Sauvegarder dans localStorage
    localStorage.setItem('additionalBeneficiaries', JSON.stringify(validAddresses));

    // Retour sur /create
    router.push('/create');
  };

  const handleCancel = () => {
    router.push('/create');
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
        ➕ Ajouter des bénéficiaires
      </h2>
      
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        Ajoutez jusqu'à 4 bénéficiaires supplémentaires (ils recevront le même montant)
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {beneficiaries.map((address, index) => (
          <div key={index}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Bénéficiaire {index + 2} (optionnel)
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => handleAddressChange(index, e.target.value)}
              placeholder="0x..."
              className={`
                w-full px-4 py-3 rounded-xl border-2
                bg-white dark:bg-gray-900
                text-gray-900 dark:text-white
                transition-all
                ${
                  errors[index]
                    ? 'border-red-500 focus:border-red-600'
                    : 'border-gray-200 dark:border-gray-700 focus:border-primary-500'
                }
                focus:outline-none focus:ring-4 focus:ring-primary-500/20
              `}
            />
            {errors[index] && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                {errors[index]}
              </p>
            )}
          </div>
        ))}

        <div className="flex gap-4 mt-8">
          <button
            type="button"
            onClick={handleCancel}
            className="flex-1 py-3 px-6 rounded-xl font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
          >
            Annuler
          </button>
          
          <button
            type="submit"
            className="flex-1 py-3 px-6 rounded-xl font-bold text-white bg-gradient-to-r from-primary-500 via-purple-500 to-pink-500 hover:shadow-xl hover:scale-105 transition-all"
          >
            ✅ Valider
          </button>
        </div>
      </form>
    </div>
  );
}
