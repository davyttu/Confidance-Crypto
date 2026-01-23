'use client';

interface FeePreviewProps {
  ethAmount: number;
  receivedAmount: number;
  token: 'USDC' | 'USDT';
}

export default function FeePreview({ ethAmount, receivedAmount, token }: FeePreviewProps) {
  const ETH_PRICE = 2000; // Placeholder
  const ethValue = ethAmount * ETH_PRICE;
  
  // Coût annuel
  const annualCost = receivedAmount * 0.06;
  
  // Coût sur 6 mois
  const sixMonthsCost = annualCost * 0.5;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Récapitulatif
      </h3>
      
      <div className="space-y-3">
        {/* ETH déposé */}
        <div className="flex justify-between items-center pb-3 border-b border-gray-100">
          <span className="text-gray-600">ETH déposé</span>
          <div className="text-right">
            <div className="font-semibold text-gray-900">{ethAmount.toFixed(4)} ETH</div>
            <div className="text-sm text-gray-500">≈ {ethValue.toFixed(2)} €</div>
          </div>
        </div>
        
        {/* Liquidité reçue */}
        <div className="flex justify-between items-center pb-3 border-b border-gray-100">
          <span className="text-gray-600">Liquidité reçue</span>
          <div className="font-semibold text-gray-900">{receivedAmount.toFixed(2)} {token}</div>
        </div>
        
        {/* Taux */}
        <div className="flex justify-between items-center pb-3 border-b border-gray-100">
          <span className="text-gray-600">Taux annuel</span>
          <div className="font-semibold text-gray-900">6%</div>
        </div>
        
        {/* Coût annuel */}
        <div className="flex justify-between items-center pb-3 border-b border-gray-100">
          <span className="text-gray-600">Coût annuel</span>
          <div className="font-semibold text-gray-900">{annualCost.toFixed(2)} {token}</div>
        </div>
        
        {/* Coût 6 mois */}
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Coût sur 6 mois</span>
          <div className="font-semibold text-blue-600">{sixMonthsCost.toFixed(2)} {token}</div>
        </div>
      </div>
      
      {/* Note explicative */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-800">
          💡 Les intérêts s'accumulent quotidiennement et sont dus au moment du remboursement.
        </p>
      </div>
    </div>
  );
}