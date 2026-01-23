'use client';

import { useState } from 'react';

interface RepayModalProps {
  isOpen: boolean;
  onClose: () => void;
  position: {
    totalDebt: string;
    token: 'USDC' | 'USDT';
    depositedETH: string;
  };
}

export default function RepayModal({ isOpen, onClose, position }: RepayModalProps) {
  const [amount, setAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleRepay = async () => {
    setIsProcessing(true);
    // TODO: Implémenter la logique de remboursement
    console.log('Repaying...', amount);
    setTimeout(() => {
      setIsProcessing(false);
      onClose();
    }, 2000);
  };

  const amountFloat = parseFloat(amount) || 0;
  const totalDebtFloat = parseFloat(position.totalDebt);
  const recoveredETH = ((amountFloat / totalDebtFloat) * parseFloat(position.depositedETH)).toFixed(4);
  const remainingDebt = (totalDebtFloat - amountFloat).toFixed(2);

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
              <h2 className="text-2xl font-bold">Rembourser</h2>
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
                Montant à rembourser
              </label>
              
              <input
                type="number"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full text-2xl font-semibold border-2 border-gray-200 rounded-xl p-4 mb-2 outline-none focus:border-blue-500"
              />
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Dette totale : {position.totalDebt} {position.token}</span>
                <button 
                  onClick={() => setAmount(position.totalDebt)}
                  className="text-blue-600 font-medium hover:text-blue-700"
                >
                  Max
                </button>
              </div>
            </div>
            
            {/* Prévisualisation */}
            {amountFloat > 0 && (
              <div className="bg-blue-50 rounded-xl p-4 mb-6">
                <div className="text-sm text-gray-600 mb-3">Après remboursement :</div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>ETH récupéré</span>
                    <span className="font-semibold text-green-700">+{recoveredETH} ETH</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Dette restante</span>
                    <span className="font-semibold">{remainingDebt} {position.token}</span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Actions */}
            <button 
              onClick={handleRepay}
              disabled={!amount || amountFloat <= 0 || isProcessing}
              className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl mb-3 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? 'Traitement...' : 'Confirmer le remboursement'}
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