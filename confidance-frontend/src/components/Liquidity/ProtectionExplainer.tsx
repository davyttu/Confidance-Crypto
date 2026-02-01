'use client';

import { useTranslation } from 'react-i18next';

interface ProtectionExplainerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProtectionExplainer({ isOpen, onClose }: ProtectionExplainerProps) {
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">{t('liquidity.protectionExplainer.howItWorks')}</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Carte 1 */}
            <div className="bg-white rounded-xl p-6 mb-4 border border-gray-200">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">🔐</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">1. Tu déposes ton ETH</h3>
                  <p className="text-gray-600">
                    Ton ETH reste en sécurité et continue d'exister. Il sert simplement de garantie.
                  </p>
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm">
                    <strong>Exemple :</strong> Tu déposes 1 ETH (≈ 2 000 €)
                  </div>
                </div>
              </div>
            </div>
            
            {/* Carte 2 */}
            <div className="bg-white rounded-xl p-6 mb-4 border border-gray-200">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">💧</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">{t('liquidity.protectionExplainer.step2Title')}</h3>
                  <p className="text-gray-600">
                    {t('liquidity.protectionExplainer.step2Desc')}
                  </p>
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm">
                    {t('liquidity.protectionExplainer.step2Example')}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Carte 3 */}
            <div className="bg-white rounded-xl p-6 mb-4 border border-gray-200">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">✅</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">3. Tout va bien si le marché est stable</h3>
                  <p className="text-gray-600">
                    Tant que l'ETH maintient sa valeur, ta position est saine et tu ne paies que les intérêts.
                  </p>
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm">
                    <strong>Coût :</strong> 6% par an, soit environ 72 USDC sur 1 an
                  </div>
                </div>
              </div>
            </div>
            
            {/* Carte 4 */}
            <div className="bg-white rounded-xl p-6 mb-4 border border-gray-200">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">⚡</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">{t('liquidity.protectionExplainer.step4Title')}</h3>
                  <p className="text-gray-600">
                    {t('liquidity.protectionExplainer.step4Desc')}
                  </p>
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm">
                    {t('liquidity.protectionExplainer.step4Threshold')}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Carte 5 */}
            <div className="bg-white rounded-xl p-6 mb-4 border border-gray-200">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">🛡️</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">5. Protection automatique</h3>
                  <p className="text-gray-600">
                    Si tu ne réagis pas, le système vend juste assez d'ETH pour préserver le reste de ton dépôt.
                  </p>
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm">
                    <strong>Priorité :</strong> Vente partielle uniquement, on protège ton capital
                  </div>
                </div>
              </div>
            </div>
            
            <button 
              onClick={onClose}
              className="w-full mt-6 py-3 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 transition-colors"
            >
              {t('liquidity.protectionExplainer.understood')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}