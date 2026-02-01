'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface StatusCardProps {
  depositedETH?: string;
  receivedAmount?: string;
  token?: 'USDC' | 'USDT';
  ltvPercentage?: number;
}

export default function StatusCard({
  depositedETH = '0',
  receivedAmount = '0',
  token = 'USDC',
  ltvPercentage = 0
}: StatusCardProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'healthy' | 'warning' | 'critical'>('healthy');
  const [statusColor, setStatusColor] = useState('bg-green-50 border-green-200');
  const [statusIcon, setStatusIcon] = useState('🟢');

  useEffect(() => {
    if (ltvPercentage === 0 || ltvPercentage <= 50) {
      setStatus('healthy');
      setStatusColor('bg-green-50 border-green-200');
      setStatusIcon('🟢');
    } else if (ltvPercentage <= 60) {
      setStatus('warning');
      setStatusColor('bg-yellow-50 border-yellow-200');
      setStatusIcon('🟡');
    }
  }, [ltvPercentage]);

  const statusText = status === 'healthy' ? t('liquidity.statusCard.healthy') : t('liquidity.statusCard.warning');
  const statusDescription = status === 'healthy' ? t('liquidity.statusCard.healthyDesc') : t('liquidity.statusCard.warningDesc');

  // Calculer la couleur de la jauge
  const getGaugeColor = () => {
    if (ltvPercentage <= 40) return 'bg-green-500';
    if (ltvPercentage <= 55) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  return (
    <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-2xl p-6 sticky top-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">
        Résumé de votre position
      </h3>
      
      {/* État visuel */}
      <div className={`p-4 rounded-xl mb-6 border-2 ${statusColor}`}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{statusIcon}</span>
          <span className="font-semibold">{statusText}</span>
        </div>
        <p className="text-sm">{statusDescription}</p>
      </div>
      
      {/* Détails */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">🔐 {t('liquidity.statusCard.ethDeposited')}</span>
          <div className="text-right">
            <div className="font-semibold">{depositedETH} ETH</div>
            <div className="text-sm text-gray-500">≈ {(parseFloat(depositedETH) * 2000).toFixed(2)} €</div>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-gray-600">💧 {t('liquidity.statusCard.liquidity')}</span>
          <div className="font-semibold">{receivedAmount} {token}</div>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-gray-600">📈 Taux annuel</span>
          <div className="font-semibold">6%</div>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-gray-600">🛡️ {t('liquidity.statusCard.safetyRatio')}</span>
          <div className="font-semibold">{100 - ltvPercentage}%</div>
        </div>
      </div>
      
      {/* Barre de jauge visuelle */}
      <div className="mt-6">
        <div className="flex justify-between text-xs text-gray-600 mb-2">
          <span>{t('liquidity.statusCard.safe')}</span>
          <span>{t('liquidity.statusCard.warning')}</span>
        </div>
        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all ${getGaugeColor()}`}
            style={{ width: `${ltvPercentage}%` }}
          />
        </div>
      </div>
      
      {/* CTA principal */}
      <button 
        disabled={parseFloat(depositedETH) === 0}
        className="w-full mt-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {t('liquidity.statusCard.confirmAndReceive')}
      </button>
      
      <p className="text-xs text-center text-gray-500 mt-3">
        {t('liquidity.statusCard.repayAnytime')}
      </p>
    </div>
  );
}