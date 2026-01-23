'use client';

interface StatusExplanationProps {
  position: {
    status: 'healthy' | 'warning' | 'critical';
    accumulatedInterest: string;
    daysElapsed: number;
    token: 'USDC' | 'USDT';
    recommendedETHToAdd?: string;
    recommendedToRepay?: string;
    liquidatedETH?: string;
    remainingETH?: string;
  };
  onShowProtectionInfo: () => void;
}

export default function StatusExplanation({ position, onShowProtectionInfo }: StatusExplanationProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-8">
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        Que se passe-t-il maintenant ?
      </h2>
      
      {/* État : Position saine */}
      {position.status === 'healthy' && (
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl">✅</span>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 mb-2">
              Tout va bien
            </h3>
            <p className="text-gray-600 leading-relaxed mb-4">
              Votre ETH couvre largement votre liquidité. Vous pouvez continuer à utiliser 
              vos {position.token} en toute tranquillité, ou rembourser quand vous le souhaitez.
            </p>
            
            {/* Détails supplémentaires */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl">
              <div>
                <div className="text-sm text-gray-600 mb-1">Intérêts accumulés</div>
                <div className="font-semibold text-gray-900">{position.accumulatedInterest} {position.token}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Temps écoulé</div>
                <div className="font-semibold text-gray-900">{position.daysElapsed} jours</div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* État : À surveiller */}
      {position.status === 'warning' && (
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl">⚡</span>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 mb-2">
              À surveiller
            </h3>
            <p className="text-gray-600 leading-relaxed mb-4">
              Le prix de l'ETH a baissé. Votre position reste sécurisée, mais vous pouvez 
              la renforcer en ajoutant de l'ETH ou en remboursant une partie pour rester serein.
            </p>
            
            {/* Actions recommandées */}
            <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-200">
              <div className="text-sm font-medium text-yellow-800 mb-2">
                💡 Actions recommandées :
              </div>
              <ul className="space-y-1 text-sm text-yellow-700">
                <li>• Ajouter {position.recommendedETHToAdd} ETH pour revenir en zone saine</li>
                <li>• Ou rembourser {position.recommendedToRepay} {position.token}</li>
              </ul>
            </div>
            
            <button
              onClick={onShowProtectionInfo}
              className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              → Comment fonctionne la protection ?
            </button>
          </div>
        </div>
      )}
      
      {/* État : Protection activée */}
      {position.status === 'critical' && (
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl">🛡️</span>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 mb-2">
              Protection activée
            </h3>
            <p className="text-gray-600 leading-relaxed mb-4">
              Une partie de votre ETH a été automatiquement vendue pour sécuriser votre liquidité 
              et préserver le reste de votre dépôt.
            </p>
            
            {/* Détails de la liquidation */}
            <div className="p-4 bg-red-50 rounded-xl border border-red-200">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-red-600 mb-1">ETH vendu</div>
                  <div className="font-semibold text-red-800">{position.liquidatedETH} ETH</div>
                </div>
                <div>
                  <div className="text-red-600 mb-1">ETH restant</div>
                  <div className="font-semibold text-red-800">{position.remainingETH} ETH</div>
                </div>
              </div>
            </div>
            
            <p className="text-sm text-gray-600 mt-3">
              Vous pouvez clôturer votre position pour récupérer l'ETH restant.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}