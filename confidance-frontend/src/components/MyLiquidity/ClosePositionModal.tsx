'use client';

import { useState } from 'react';

interface ClosePositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  position: {
    totalDebt: string;
    totalInterest: string;
    depositedETH: string;
    token: 'USDC' | 'USDT';
  };
}

export default function ClosePositionModal({ isOpen, onClose, position }: ClosePositionModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleClose = async () => {
    setIsProcessing(true);
    // TODO: Implémenter la logique de clôture
    console.log('Closing position...');
    setTimeout(() => {
      setIsProcessing(false);
      onClose();
    }, 2000);
  };

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
              <h2 className="text-2xl font-bold">Clôturer la position</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Avertissement */}
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <h3 className="font-semibold text-yellow-800 mb-1">Attention</h3>
                  <p className="text-sm text-yellow-700">
                    Clôturer votre position nécessite de rembourser la totalité de votre dette.
                  </p>
                </div>
              </div>
            </div>
            
            {/* Résumé final */}
            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <div className="text-sm font-medium text-gray-700 mb-3">Résumé de clôture :</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Dette à rembourser</span>
                  <span className="font-semibold">{position.totalDebt} {position.token}</span>
                </div>
                <div className="flex justify-between">
                  <span>Intérêts totaux</span>
                  <span className="font-semibold">{position.totalInterest} {position.token}</span>
                </div>
                <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between">
                  <span className="font-semibold">ETH récupéré</span>
                  <span className="font-bold text-green-700">+{position.depositedETH} ETH</span>
                </div>
              </div>
            </div>
            
            {/* Actions */}
            <button 
              onClick={handleClose}
              disabled={isProcessing}
              className="w-full py-3 bg-red-600 text-white font-semibold rounded-xl mb-3 hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? 'Traitement...' : 'Confirmer la clôture'}
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