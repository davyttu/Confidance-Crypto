'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import LiquidityForm from '@/components/Liquidity/LiquidityForm';
import StatusCard from '@/components/Liquidity/StatusCard';
import ProtectionExplainer from '@/components/Liquidity/ProtectionExplainer';

export default function LiquidityPage() {
  const { address, isConnected } = useAccount();
  const [showExplanation, setShowExplanation] = useState(false);

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
            Pour accéder à la liquidité, veuillez d'abord connecter votre wallet
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
            <span className="text-3xl">💧</span>
          </div>
          
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Accédez à de la liquidité sans vendre votre ETH
          </h1>
          
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Utilisez votre ETH comme garantie et recevez de l'USDC ou de l'USDT en quelques secondes.
          </p>
        </div>

        {/* Main Content - 2 colonnes */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Colonne gauche - Formulaire */}
          <div className="lg:col-span-2">
            <LiquidityForm onShowExplanation={() => setShowExplanation(true)} />
          </div>

          {/* Colonne droite - Résumé */}
          <div className="lg:col-span-1">
            <StatusCard />
          </div>
        </div>

        {/* Features en bas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Sécurisé</h3>
            <p className="text-sm text-gray-600">
              Vos fonds sont protégés par la blockchain et des smart contracts audités
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Instantané</h3>
            <p className="text-sm text-gray-600">
              Recevez votre liquidité immédiatement après validation de la transaction
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Flexible</h3>
            <p className="text-sm text-gray-600">
              Remboursez à tout moment et récupérez votre ETH sans pénalité
            </p>
          </div>
        </div>
      </div>

      {/* Modal d'explication */}
      <ProtectionExplainer 
        isOpen={showExplanation} 
        onClose={() => setShowExplanation(false)} 
      />
    </div>
  );
}