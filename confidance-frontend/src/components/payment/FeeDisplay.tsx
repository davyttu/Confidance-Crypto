'use client';

import {
  type TokenSymbol,
  getToken,
  calculateFees,
  formatTokenAmount,
  PROTOCOL_FEE_PERCENTAGE,
} from '@/config/tokens';

interface FeeDisplayProps {
  amount: bigint | null;
  tokenSymbol: TokenSymbol;
  showDetails?: boolean;
}

export default function FeeDisplay({
  amount,
  tokenSymbol,
  showDetails = true,
}: FeeDisplayProps) {
  const token = getToken(tokenSymbol);

  if (!amount || amount === BigInt(0)) {
    return null;
  }

  const fees = calculateFees(amount, token.decimals);

  return (
    <div className="space-y-4">
      {/* Titre */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Récapitulatif
        </h3>
        <span className="text-xs text-gray-500">
          Frais : {PROTOCOL_FEE_PERCENTAGE}%
        </span>
      </div>

      {/* Card récapitulatif */}
      <div className="glass rounded-2xl p-6 space-y-4">
        {/* Montant bénéficiaire */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Bénéficiaire recevra
          </span>
          <span className="text-lg font-bold text-green-600 dark:text-green-400">
            {formatTokenAmount(fees.recipientAmount, token.decimals, tokenSymbol)}
          </span>
        </div>

        {showDetails && (
          <>
            {/* Frais protocole */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  + Frais protocole ({PROTOCOL_FEE_PERCENTAGE}%)
                </span>
                <div className="group relative">
                  <svg
                    className="w-4 h-4 text-gray-400 cursor-help"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl z-10">
                    Ces frais maintiennent la plateforme et le keeper 24/7
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900" />
                  </div>
                </div>
              </div>
              <span className="text-sm font-medium text-orange-600 dark:text-orange-400">
                {formatTokenAmount(fees.protocolFee, token.decimals, tokenSymbol)}
              </span>
            </div>

            {/* Séparateur */}
            <div className="border-t-2 border-gray-300 dark:border-gray-600" />
          </>
        )}

        {/* TOTAL à envoyer */}
        <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/30 -m-6 mt-0 p-6 rounded-b-2xl">
          <span className="text-base font-bold text-gray-900 dark:text-white">
            TOTAL à envoyer
          </span>
          <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
            {formatTokenAmount(fees.totalAmount, token.decimals, tokenSymbol)}
          </span>
        </div>
      </div>

      {/* Info box */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
        <svg
          className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
        <div className="text-sm text-blue-900 dark:text-blue-300">
          <p className="font-medium mb-1">
            🔒 Paiement sécurisé et automatique
          </p>
          <p className="text-xs">
            Vos fonds sont verrouillés dans un smart contract et seront
            automatiquement libérés à la date choisie. Aucune action manuelle
            nécessaire.
          </p>
        </div>
      </div>
    </div>
  );
}