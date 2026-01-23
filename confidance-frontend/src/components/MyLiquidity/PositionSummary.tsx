'use client';

import { getStatusConfig } from '@/lib/utils/liquidityStatus';

interface PositionSummaryProps {
  position: {
    depositedETH: string;
    depositedEuro: string;
    receivedAmount: string;
    token: 'USDC' | 'USDT';
    status: 'healthy' | 'warning' | 'critical';
    healthPercentage: number;
  };
}

export default function PositionSummary({ position }: PositionSummaryProps) {
  const statusConfig = getStatusConfig(position.status);

  return (
    <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 rounded-3xl p-8 mb-8">
      {/* ETH déposé + Liquidité reçue */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* ETH déposé */}
        <div className="bg-white/80 backdrop-blur rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">🔐</span>
            <span className="text-sm font-medium text-gray-600">ETH déposé</span>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">
            {position.depositedETH} ETH
          </div>
          <div className="text-lg text-gray-600">
            ≈ {position.depositedEuro} €
          </div>
        </div>
        
        {/* Liquidité reçue */}
        <div className="bg-white/80 backdrop-blur rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">💧</span>
            <span className="text-sm font-medium text-gray-600">Liquidité reçue</span>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">
            {position.receivedAmount} {position.token}
          </div>
          <div className="text-lg text-gray-600">
            Taux : 6% / an
          </div>
        </div>
      </div>
      
      {/* État de la position */}
      <div className={`p-6 rounded-2xl ${statusConfig.bg}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-4xl">{statusConfig.icon}</span>
            <div>
              <div className="text-sm font-medium text-gray-600 mb-1">État actuel</div>
              <div className={`text-2xl font-bold ${statusConfig.textColor}`}>
                {statusConfig.text}
              </div>
            </div>
          </div>
          
          {/* Jauge circulaire */}
          <div className="hidden md:block">
            <div className="relative w-32 h-32">
              {/* Cercle de fond */}
              <svg className="w-32 h-32 transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-gray-200"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 56}`}
                  strokeDashoffset={`${2 * Math.PI * 56 * (1 - position.healthPercentage / 100)}`}
                  className={statusConfig.gaugeColor}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold">{position.healthPercentage}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}