'use client';

import { useState, useEffect } from 'react';
import { parseEther } from 'viem';
import { useAccount } from 'wagmi';
import FeePreview from './FeePreview';
import { calculateLiquidityAmount, calculateFees } from '@/lib/utils/liquidityCalculator';

interface LiquidityFormProps {
  onShowExplanation: () => void;
}

export default function LiquidityForm({ onShowExplanation }: LiquidityFormProps) {
  const { address } = useAccount();
  
  // État du formulaire
  const [ethAmount, setEthAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState<'USDC' | 'USDT'>('USDC');
  const [ltvPercentage, setLtvPercentage] = useState(30); // 30% par défaut
  
  // Calculs
  const [receivedAmount, setReceivedAmount] = useState('0');
  const [estimatedCost, setEstimatedCost] = useState('0');
  const [ethValue, setEthValue] = useState('0');

  // Prix ETH (à récupérer via API)
  const ETH_PRICE = 2000; // Placeholder

  useEffect(() => {
    if (ethAmount && parseFloat(ethAmount) > 0) {
      const ethVal = parseFloat(ethAmount);
      
      // Valeur en euros
      setEthValue((ethVal * ETH_PRICE).toFixed(2));
      
      // Montant de liquidité reçu (LTV%)
      const liquidityAmount = calculateLiquidityAmount(ethVal, ETH_PRICE, ltvPercentage);
      setReceivedAmount(liquidityAmount.toFixed(2));
      
      // Coût sur 6 mois (6% annuel)
      const cost = (liquidityAmount * 0.06 * 0.5).toFixed(2);
      setEstimatedCost(cost);
    } else {
      setReceivedAmount('0');
      setEstimatedCost('0');
      setEthValue('0');
    }
  }, [ethAmount, ltvPercentage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Logique de création de liquidité
    console.log('Creating liquidity position...', {
      ethAmount,
      selectedToken,
      ltvPercentage,
      receivedAmount
    });
  };

  const isFormValid = ethAmount && parseFloat(ethAmount) > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Section 1: Dépôt ETH */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Montant d'ETH à déposer
        </label>
        
        <div className="relative">
          <input
            type="number"
            step="0.01"
            placeholder="0.0"
            value={ethAmount}
            onChange={(e) => setEthAmount(e.target.value)}
            className="w-full text-3xl font-semibold border-0 focus:ring-0 p-0 mb-2 outline-none"
          />
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              ≈ {ethValue} €
            </span>
            
            <button 
              type="button"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Max : 0.00 ETH
            </button>
          </div>
        </div>
        
        {/* Balance wallet */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Disponible dans votre wallet</span>
            <span className="font-medium">0.00 ETH</span>
          </div>
        </div>
      </div>

      {/* Section 2: Liquidité reçue */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <label className="text-sm font-medium text-gray-700">
            Liquidité que vous souhaitez
          </label>
          
          {/* Token selector */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelectedToken('USDC')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedToken === 'USDC' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              USDC
            </button>
            <button
              type="button"
              onClick={() => setSelectedToken('USDT')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedToken === 'USDT' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              USDT
            </button>
          </div>
        </div>
        
        {/* Slider */}
        <div className="mb-6">
          <input
            type="range"
            min="10"
            max="60"
            value={ltvPercentage}
            onChange={(e) => setLtvPercentage(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>Prudent</span>
            <span>Optimal</span>
            <span>Maximum</span>
          </div>
        </div>
        
        {/* Montant reçu */}
        <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl mb-4">
          <div className="text-sm text-gray-600 mb-1">Vous recevez</div>
          <div className="text-3xl font-bold text-gray-900">
            {receivedAmount} {selectedToken}
          </div>
        </div>
        
        {/* Coût estimé */}
        <div className="text-sm text-gray-600">
          Coût estimé sur 6 mois : <span className="font-semibold text-gray-900">{estimatedCost} {selectedToken}</span>
          <br />
          Taux annuel : <span className="font-semibold text-gray-900">6%</span>
        </div>
      </div>

      {/* Section 3: Alerte si LTV > 50% */}
      {ltvPercentage > 50 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚡</span>
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">
                À surveiller
              </h4>
              <p className="text-sm text-gray-700 mb-2">
                Si le prix de l'ETH baisse, une protection automatique peut s'activer 
                pour préserver votre dépôt.
              </p>
              <button 
                type="button"
                onClick={onShowExplanation}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                → Voir comment ça marche
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section 4: Prévisualisation des frais */}
      {isFormValid && (
        <FeePreview 
          ethAmount={parseFloat(ethAmount)}
          receivedAmount={parseFloat(receivedAmount)}
          token={selectedToken}
        />
      )}

      {/* Bouton submit */}
      <button
        type="submit"
        disabled={!isFormValid}
        className="w-full py-4 px-6 rounded-xl font-bold text-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        Confirmer et recevoir ma liquidité
      </button>

      <p className="text-xs text-center text-gray-500">
        Vous pourrez rembourser à tout moment et récupérer votre ETH
      </p>
    </form>
  );
}