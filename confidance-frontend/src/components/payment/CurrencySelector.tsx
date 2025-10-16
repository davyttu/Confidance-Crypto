'use client';

import { useState } from 'react';
import { TOKEN_LIST, type TokenSymbol } from '@/config/tokens';

interface CurrencySelectorProps {
  selectedToken: TokenSymbol;
  onSelectToken: (token: TokenSymbol) => void;
}

export default function CurrencySelector({
  selectedToken,
  onSelectToken,
}: CurrencySelectorProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Choisissez la crypto à envoyer
        </label>
        <span className="text-xs text-gray-500">
          {TOKEN_LIST.length} disponibles
        </span>
      </div>

      {/* Grille de sélection - 2 colonnes sur mobile, 3 sur desktop */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {TOKEN_LIST.map((token) => {
          const isSelected = token.symbol === selectedToken;

          return (
            <button
              key={token.symbol}
              type="button"
              onClick={() => onSelectToken(token.symbol)}
              className={`
                relative overflow-hidden rounded-2xl p-6 
                transition-all duration-300 
                border-2
                ${
                  isSelected
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30 scale-105'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:scale-105'
                }
              `}
            >
              {/* Badge sélectionné */}
              {isSelected && (
                <div className="absolute top-3 right-3">
                  <svg
                    className="w-5 h-5 text-primary-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}

              {/* Dégradé background */}
              <div
                className={`
                  absolute inset-0 opacity-10 bg-gradient-to-br 
                  ${token.gradient}
                `}
              />

              {/* Contenu */}
              <div className="relative space-y-3">
                {/* Icône - Placeholder temporaire */}
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                  style={{ backgroundColor: token.color }}
                >
                  {token.symbol.charAt(0)}
                </div>

                {/* Infos */}
                <div className="text-left">
                  <div className="font-bold text-lg text-gray-900 dark:text-white">
                    {token.symbol}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {token.name}
                  </div>
                </div>

                {/* Badge natif */}
                {token.isNative && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    Natif
                  </span>
                )}
              </div>
            </button>
          );
        })}
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
          {TOKEN_LIST.find((t) => t.symbol === selectedToken)?.isNative ? (
            <p>
              <strong>ETH natif :</strong> 1 seule transaction nécessaire
            </p>
          ) : (
            <p>
              <strong>Token ERC20 :</strong> 2 transactions nécessaires
              (approbation + création)
            </p>
          )}
        </div>
      </div>
    </div>
  );
}