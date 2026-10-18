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
        {t('liquidity.statusCard.positionSummary')}
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
          <span className="text-gray-600">📈 {t('liquidity.statusCard.annualRate')}</span>
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
      
      {/* CTA principal — coming soon */}
      <div className="relative group mt-8">
        <button
          type="button"
          disabled
          aria-disabled="true"
          title={t('liquidity.comingSoon')}
          className="w-full py-4 bg-gradient-to-r from-gray-400 to-gray-500 text-white font-semibold rounded-xl opacity-50 grayscale cursor-not-allowed"
        >
          {t('liquidity.statusCard.confirmAndReceive')}
        </button>
        <span
          className="pointer-events-none absolute left-1/2 bottom-full mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900/95 px-3 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
        >
          {t('liquidity.comingSoon')}
        </span>
      </div>
      
      <p className="text-xs text-center text-gray-500 mt-3">
        {t('liquidity.statusCard.repayAnytime')}
      </p>
    </div>
  );
}