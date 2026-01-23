'use client';

interface ProtectionInfoDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProtectionInfoDrawer({ isOpen, onClose }: ProtectionInfoDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-2xl overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 sticky top-0 bg-white pb-4 border-b">
            <h2 className="text-2xl font-bold">Comment fonctionne la protection ?</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <p className="text-gray-600 mb-8">
            Votre liquidité est protégée en 5 étapes simples
          </p>
          
          {/* Les 5 cartes explicatives (identiques à la page Liquidité) */}
          
          {/* Carte 1 */}
          <div className="bg-white rounded-xl p-6 mb-4 border-2 border-blue-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">🔐</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">1. Tu déposes ton ETH</h3>
                <p className="text-gray-600 text-sm mb-3">
                  Ton ETH reste en sécurité et continue d'exister. Il sert simplement de garantie.
                </p>
                <div className="p-3 bg-blue-50 rounded-lg text-sm">
                  <strong>Exemple :</strong> Tu déposes 1 ETH (≈ 2 000 €)
                </div>
              </div>
            </div>
          </div>
          
          {/* Carte 2 */}
          <div className="bg-white rounded-xl p-6 mb-4 border-2 border-green-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">💧</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">2. Tu reçois de la liquidité</h3>
                <p className="text-gray-600 text-sm mb-3">
                  Immédiatement, tu reçois de l'USDC ou USDT que tu peux utiliser librement.
                </p>
                <div className="p-3 bg-green-50 rounded-lg text-sm">
                  <strong>Exemple :</strong> Tu reçois 1 200 USDC
                </div>
              </div>
            </div>
          </div>
          
          {/* Carte 3 */}
          <div className="bg-white rounded-xl p-6 mb-4 border-2 border-purple-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">✅</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">3. Tout va bien si le marché est stable</h3>
                <p className="text-gray-600 text-sm mb-3">
                  Tant que l'ETH maintient sa valeur, ta position est saine.
                </p>
                <div className="p-3 bg-purple-50 rounded-lg text-sm">
                  <strong>Coût :</strong> 6% par an, soit 72 USDC sur 1 an
                </div>
              </div>
            </div>
          </div>
          
          {/* Carte 4 */}
          <div className="bg-white rounded-xl p-6 mb-4 border-2 border-yellow-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">⚡</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">4. Alerte si le prix baisse trop</h3>
                <p className="text-gray-600 text-sm mb-3">
                  Si l'ETH perd de la valeur, tu reçois une notification pour agir.
                </p>
                <div className="p-3 bg-yellow-50 rounded-lg text-sm">
                  <strong>Seuil :</strong> Alerte si ton ETH ne couvre plus qu'à 70%
                </div>
              </div>
            </div>
          </div>
          
          {/* Carte 5 */}
          <div className="bg-white rounded-xl p-6 mb-6 border-2 border-red-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">🛡️</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">5. Protection automatique</h3>
                <p className="text-gray-600 text-sm mb-3">
                  Si tu ne réagis pas, le système vend juste assez d'ETH pour préserver le reste.
                </p>
                <div className="p-3 bg-red-50 rounded-lg text-sm">
                  <strong>Priorité :</strong> Vente partielle uniquement
                </div>
              </div>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="w-full py-3 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 transition-colors sticky bottom-0"
          >
            J'ai compris
          </button>
        </div>
      </div>
    </div>
  );
}