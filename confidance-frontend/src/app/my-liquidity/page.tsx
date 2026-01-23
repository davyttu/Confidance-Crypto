'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useMyLiquidity } from '@/hooks/useMyLiquidity';
import PositionSummary from '@/components/MyLiquidity/PositionSummary';
import StatusExplanation from '@/components/MyLiquidity/StatusExplanation';
import ActionButtons from '@/components/MyLiquidity/ActionButtons';
import Timeline from '@/components/MyLiquidity/Timeline';
import RepayModal from '@/components/MyLiquidity/RepayModal';
import AddCollateralModal from '@/components/MyLiquidity/AddCollateralModal';
import ClosePositionModal from '@/components/MyLiquidity/ClosePositionModal';
import ProtectionInfoDrawer from '@/components/MyLiquidity/ProtectionInfoDrawer';

export default function MyLiquidityPage() {
  const { address, isConnected } = useAccount();
  const { position, isLoading, error } = useMyLiquidity();

  // États des modals
  const [showRepayModal, setShowRepayModal] = useState(false);
  const [showAddETHModal, setShowAddETHModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showProtectionInfo, setShowProtectionInfo] = useState(false);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-blue-100 flex items-center justify-center">
            <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Connectez votre wallet
          </h2>
          <p className="text-gray-600">
            Pour accéder à votre position de liquidité, veuillez connecter votre wallet
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement de votre position...</p>
        </div>
      </div>
    );
  }

  if (error || !position) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gray-100 flex items-center justify-center">
            <span className="text-4xl">📭</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Aucune position active
          </h2>
          <p className="text-gray-600 mb-6">
            Vous n'avez pas encore de position de liquidité ouverte.
          </p>
          <a
            href="/liquidity"
            className="inline-block px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
          >
            Créer une position
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              My Liquidity
            </h1>
            <p className="text-gray-600">
              Suivez et gérez votre liquidité en toute sérénité
            </p>
          </div>
          
          {/* Badge temps réel */}
          <div className="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-lg">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-green-700">Temps réel</span>
          </div>
        </div>

        {/* Résumé principal (Hero) */}
        <PositionSummary position={position} />

        {/* Bloc "Que se passe-t-il maintenant ?" */}
        <StatusExplanation 
          position={position}
          onShowProtectionInfo={() => setShowProtectionInfo(true)}
        />

        {/* Boutons d'action */}
        <ActionButtons
          position={position}
          onRepay={() => setShowRepayModal(true)}
          onAddETH={() => setShowAddETHModal(true)}
          onClose={() => setShowCloseModal(true)}
        />

        {/* Timeline */}
        <Timeline 
          events={position.events}
          onShowProtectionInfo={() => setShowProtectionInfo(true)}
        />
      </div>

      {/* Modals */}
      <RepayModal
        isOpen={showRepayModal}
        onClose={() => setShowRepayModal(false)}
        position={position}
      />

      <AddCollateralModal
        isOpen={showAddETHModal}
        onClose={() => setShowAddETHModal(false)}
        position={position}
      />

      <ClosePositionModal
        isOpen={showCloseModal}
        onClose={() => setShowCloseModal(false)}
        position={position}
      />

      <ProtectionInfoDrawer
        isOpen={showProtectionInfo}
        onClose={() => setShowProtectionInfo(false)}
      />
    </div>
  );
}