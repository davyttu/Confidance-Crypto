// src/components/BatchPaymentForm.tsx
// VERSION 2 : Affichage clair des fees qui s'ajoutent

'use client';

import { useState } from 'react';
import { useCreateBatchPayment, type Beneficiary } from '@/hooks/useCreateBatchPayment';
import { formatEther } from 'viem';

// Constantes pour calcul fees
const FEE_PERCENTAGE = 0.0179; // 1.79%

export function BatchPaymentForm() {
  const { 
    createBatchPayment, 
    status, 
    error, 
    progressMessage, 
    contractAddress, 
    reset,
    totalToBeneficiaries,
    protocolFee,
    totalRequired,
  } = useCreateBatchPayment();

  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([
    { address: '', amount: '', name: '' }
  ]);
  const [releaseDate, setReleaseDate] = useState('');
  const [releaseTime, setReleaseTime] = useState('12:00');
  const [cancellable, setCancellable] = useState(false);

  const addBeneficiary = () => {
    if (beneficiaries.length < 5) {
      setBeneficiaries([...beneficiaries, { address: '', amount: '', name: '' }]);
    }
  };

  const removeBeneficiary = (index: number) => {
    if (beneficiaries.length > 1) {
      setBeneficiaries(beneficiaries.filter((_, i) => i !== index));
    }
  };

  const updateBeneficiary = (index: number, field: keyof Beneficiary, value: string) => {
    const updated = [...beneficiaries];
    updated[index] = { ...updated[index], [field]: value };
    setBeneficiaries(updated);
  };

  // Calculer les montants
  const getTotalToBeneficiaries = (): number => {
    return beneficiaries.reduce((sum, b) => {
      const amount = parseFloat(b.amount);
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);
  };

  const getProtocolFee = (): number => {
    const total = getTotalToBeneficiaries();
    return total * FEE_PERCENTAGE;
  };

  const getTotalRequired = (): number => {
    return getTotalToBeneficiaries() + getProtocolFee();
  };

  const validateForm = (): string | null => {
    if (beneficiaries.length === 0) {
      return 'Au moins un bénéficiaire requis';
    }

    for (let i = 0; i < beneficiaries.length; i++) {
      const b = beneficiaries[i];
      
      if (!b.address || !/^0x[a-fA-F0-9]{40}$/.test(b.address)) {
        return `Adresse invalide pour le bénéficiaire ${i + 1}`;
      }
      
      const amount = parseFloat(b.amount);
      if (isNaN(amount) || amount <= 0) {
        return `Montant invalide pour le bénéficiaire ${i + 1}`;
      }
    }

    if (!releaseDate) {
      return 'Date de libération requise';
    }

    const releaseTimestamp = new Date(`${releaseDate}T${releaseTime}`).getTime() / 1000;
    const now = Math.floor(Date.now() / 1000);

    if (releaseTimestamp <= now) {
      return 'La date doit être dans le futur';
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const error = validateForm();
    if (error) {
      alert(error);
      return;
    }

    const releaseTimestamp = Math.floor(new Date(`${releaseDate}T${releaseTime}`).getTime() / 1000);

    await createBatchPayment({
      beneficiaries: beneficiaries.filter(b => b.address && b.amount),
      releaseTime: releaseTimestamp,
      cancellable,
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6">💎 Créer un Paiement Programmé (Multi-bénéficiaires)</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Section Bénéficiaires */}
        <div className="border-2 border-gray-200 rounded-lg p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">👥 Bénéficiaires ({beneficiaries.length}/5)</h3>
            <button
              type="button"
              onClick={addBeneficiary}
              disabled={beneficiaries.length >= 5}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + Ajouter
            </button>
          </div>

          {beneficiaries.map((beneficiary, index) => (
            <div key={index} className="mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">Bénéficiaire {index + 1}</span>
                {beneficiaries.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeBeneficiary(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    ✕ Supprimer
                  </button>
                )}
              </div>

              <input
                type="text"
                placeholder="Nom (optionnel)"
                value={beneficiary.name || ''}
                onChange={(e) => updateBeneficiary(index, 'name', e.target.value)}
                className="w-full mb-2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />

              <input
                type="text"
                placeholder="Adresse (0x...)"
                value={beneficiary.address}
                onChange={(e) => updateBeneficiary(index, 'address', e.target.value)}
                className="w-full mb-2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.0001"
                  placeholder="0.0"
                  value={beneficiary.amount}
                  onChange={(e) => updateBeneficiary(index, 'amount', e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
                <span className="font-semibold">ETH</span>
              </div>
            </div>
          ))}

          {/* Récapitulatif des montants - NOUVELLE VERSION */}
          <div className="mt-4 space-y-2">
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium">💰 Total pour les bénéficiaires :</span>
                <span className="text-lg font-bold text-blue-600">
                  {getTotalToBeneficiaries().toFixed(4)} ETH
                </span>
              </div>
            </div>

            <div className="p-3 bg-purple-50 rounded-lg">
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium">💎 Fees protocole (1.79%) :</span>
                <span className="text-lg font-bold text-purple-600">
                  +{getProtocolFee().toFixed(4)} ETH
                </span>
              </div>
            </div>

            <div className="p-3 bg-green-50 rounded-lg border-2 border-green-200">
              <div className="flex justify-between items-center">
                <span className="font-semibold">🚀 TOTAL À ENVOYER :</span>
                <span className="text-2xl font-bold text-green-600">
                  {getTotalRequired().toFixed(4)} ETH
                </span>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Les bénéficiaires recevront exactement les montants indiqués ✅
              </p>
            </div>
          </div>
        </div>

        {/* Section Date/Heure */}
        <div className="border-2 border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">⏰ Programmation</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Date</label>
              <input
                type="date"
                value={releaseDate}
                onChange={(e) => setReleaseDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Heure</label>
              <input
                type="time"
                value={releaseTime}
                onChange={(e) => setReleaseTime(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>
        </div>

        {/* Option Annulable */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="cancellable"
            checked={cancellable}
            onChange={(e) => setCancellable(e.target.checked)}
            className="w-5 h-5"
          />
          <label htmlFor="cancellable" className="text-sm">
            ✅ Permettre l'annulation avant la date de libération
          </label>
        </div>

        {/* Bouton Submit */}
        <button
          type="submit"
          disabled={status === 'creating' || status === 'confirming'}
          className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === 'idle' && `🚀 Créer le Paiement (${getTotalRequired().toFixed(4)} ETH)`}
          {status === 'creating' && '⏳ Création en cours...'}
          {status === 'confirming' && '⏳ Confirmation...'}
          {status === 'success' && '✅ Paiement Créé !'}
          {status === 'error' && '❌ Erreur'}
        </button>

        {/* Messages */}
        {progressMessage && (
          <div className={`p-4 rounded-lg ${
            status === 'error' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
          }`}>
            <pre className="whitespace-pre-wrap text-sm">{progressMessage}</pre>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-100 text-red-700 rounded-lg">
            {error.message}
          </div>
        )}

        {/* Succès */}
        {status === 'success' && contractAddress && (
          <div className="p-4 bg-green-100 rounded-lg">
            <p className="font-semibold text-green-800 mb-2">✅ Paiement créé avec succès !</p>
            <p className="text-sm text-green-700">
              Contrat : 
              <a 
                href={`https://basescan.org/address/${contractAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 underline"
              >
                {contractAddress}
              </a>
            </p>
            
            {/* Afficher le récapitulatif final */}
            {totalToBeneficiaries && protocolFee && totalRequired && (
              <div className="mt-3 p-3 bg-white rounded text-sm">
                <p><strong>Total bénéficiaires :</strong> {formatEther(totalToBeneficiaries)} ETH</p>
                <p><strong>Fees protocole :</strong> {formatEther(protocolFee)} ETH</p>
                <p className="font-bold text-green-700"><strong>Total envoyé :</strong> {formatEther(totalRequired)} ETH</p>
              </div>
            )}

            <button
              type="button"
              onClick={reset}
              className="mt-3 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Créer un autre paiement
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
