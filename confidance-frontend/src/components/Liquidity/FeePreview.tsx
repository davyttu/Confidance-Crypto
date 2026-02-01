'use client';

import { useTranslation } from 'react-i18next';

interface FeePreviewProps {
  ethAmount: number;
  receivedAmount: number;
  token: 'USDC' | 'USDT';
}

export default function FeePreview({ ethAmount, receivedAmount, token }: FeePreviewProps) {
  const { t } = useTranslation();
  const ETH_PRICE = 2000; // Placeholder
  const ethValue = ethAmount * ETH_PRICE;
  
  const annualCost = receivedAmount * 0.06;
  const sixMonthsCost = annualCost * 0.5;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        {t('liquidity.feePreview.summary')}
      </h3>
      
      <div className="space-y-3">
        <div className="flex justify-between items-center pb-3 border-b border-gray-100">
          <span className="text-gray-600">{t('liquidity.feePreview.ethDeposited')}</span>
          <div className="text-right">
            <div className="font-semibold text-gray-900">{ethAmount.toFixed(4)} ETH</div>
            <div className="text-sm text-gray-500">≈ {ethValue.toFixed(2)} €</div>
          </div>
        </div>
        
        <div className="flex justify-between items-center pb-3 border-b border-gray-100">
          <span className="text-gray-600">{t('liquidity.feePreview.liquidityReceived')}</span>
          <div className="font-semibold text-gray-900">{receivedAmount.toFixed(2)} {token}</div>
        </div>
        
        {/* Taux */}
        <div className="flex justify-between items-center pb-3 border-b border-gray-100">
          <span className="text-gray-600">{t('liquidity.feePreview.annualRate')}</span>
          <div className="font-semibold text-gray-900">6%</div>
        </div>
        
        <div className="flex justify-between items-center pb-3 border-b border-gray-100">
          <span className="text-gray-600">{t('liquidity.feePreview.annualCost')}</span>
          <div className="font-semibold text-gray-900">{annualCost.toFixed(2)} {token}</div>
        </div>
        
        {/* Coût 6 mois */}
        <div className="flex justify-between items-center">
          <span className="text-gray-600">{t('liquidity.feePreview.cost6Months')}</span>
          <div className="font-semibold text-blue-600">{sixMonthsCost.toFixed(2)} {token}</div>
        </div>
      </div>
      
      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-800">
          💡 {t('liquidity.feePreview.note')}
        </p>
      </div>
    </div>
  );
}