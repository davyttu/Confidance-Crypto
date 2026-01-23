'use client';

import { useState } from 'react';

interface AddCollateralModalProps {
  isOpen: boolean;
  onClose: () => void;
  position: {
    depositedETH: string;
    status: 'healthy' | 'warning' | 'critical';
  };
}

export default function AddCollateralModal({ isOpen, onClose, position }: AddCollateralModalProps) {
  const [ethAmount, setEthAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleAddETH = async () => {
    setIsProcessing(true);
    // TODO: Implémenter la logique d'ajout de collatéral
    console.log('Adding ETH...', ethAmount);
    setTimeout(() => {
      setIsProcessing(false);
      onClose();
    }, 2000);
  };

  const ethFloat = parseFloat(ethAmount) || 0;
  const totalETHAfter = (parseFloat(position.depositedETH) + ethFloat).toFixed(4);
  const newStatus = ethFloat > 0 ? '🟢 Position saine' : position.status;

  // Balance wallet (à récupérer via Wagmi)
  const availableETH = '1.5'; // Placeholder

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full">
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Ajouter de l'ETH</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Input montant */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Montant d'ETH à ajouter
              </label>
              
              <input
                type="number"
                step="0.01"
                placeholder="0.0"
                value={ethAmount}
                onChange={(e) => setEthAmount(e.target.value)}
                className="w-full text-2xl font-semibold border-2 border-gray-200 rounded-xl p-4 mb-2 outline-none focus:border-green-500"
              />
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Disponible : {availableETH} ETH</span>
                <button 
                  onClick={() => setEthAmount(availableETH)}
                  className="text-blue-600 font-medium hover:text-blue-700"
                >
                  Max
                </button>
              </div>
            </div>
            
            {/* Prévisualisation */}
            {ethFloat > 0 && (
              <div className="bg-green-50 rounded-xl p-4 mb-6">
                <div className="text-sm text-gray-600 mb-3">Après ajout :</div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>ETH total</span>
                    <span className="font-semibold">{totalETHAfter} ETH</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Nouvel état</span>
                    <span className="font-semibold text-green-700">{newStatus}</span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Actions */}
            <button 
              onClick={handleAddETH}
              disabled={!ethAmount || ethFloat <= 0 || isProcessing}
              className="w-full py-3 bg-green-600 text-white font-semibold rounded-xl mb-3 hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? 'Traitement...' : 'Confirmer l\'ajout'}
            </button>
            
            <button 
              onClick={onClose}
              className="w-full py-3 border-2 border-gray-200 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}