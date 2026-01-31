'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useChainId } from 'wagmi';
import { TOKEN_LIST, type TokenSymbol, type Token } from '@/config/tokens';
import type { CustomToken } from '@/lib/custom-tokens';
import { MAX_CUSTOM_TOKENS } from '@/lib/custom-tokens';

interface CurrencySelectorProps {
  selectedToken: TokenSymbol | string;
  onSelectToken: (token: TokenSymbol | string) => void;
  customTokens?: CustomToken[];
  onOpenAddModal?: () => void;
}

// Composant pour afficher l'icône du token avec fallback
function TokenIcon({ token }: { token: Token }) {
  const [imageError, setImageError] = useState(false);

  if (imageError) {
    return (
      <div
        className="w-full h-full flex items-center justify-center text-white font-bold text-lg"
        style={{ backgroundColor: token.color }}
      >
        {token.symbol.charAt(0)}
      </div>
    );
  }

  return (
    <img
      src={token.icon}
      alt={token.name}
      className="w-full h-full object-contain p-2"
      onError={() => setImageError(true)}
    />
  );
}

function CustomTokenCard({
  token,
  isSelected,
  onClick,
  isTestnet,
  testnetWarningLabel,
}: {
  token: CustomToken;
  isSelected: boolean;
  onClick: () => void;
  isTestnet: boolean;
  testnetWarningLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
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

      <div className="absolute inset-0 opacity-10 bg-gradient-to-br from-gray-400 to-gray-600" />

      <div className="relative space-y-3">
        <div className="w-12 h-12 rounded-full flex items-center justify-center overflow-hidden bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 font-bold text-lg">
          {token.symbol.charAt(0)}
        </div>

        <div className="text-left">
          <div className="font-bold text-lg text-gray-900 dark:text-white">
            {token.symbol}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 truncate" title={token.name}>
            {token.name}
          </div>
        </div>

        {isTestnet && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
            {t('create.customToken.testnetWarning', { defaultValue: 'Unverified token (testnet)' })}
          </span>
        )}
      </div>
    </button>
  );
}

export default function CurrencySelector({
  selectedToken,
  onSelectToken,
  customTokens = [],
  onOpenAddModal,
}: CurrencySelectorProps) {
  const { t, ready } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);
  const chainId = useChainId();
  const isTestnet = chainId === 84532; // Base Sepolia

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const totalCount = TOKEN_LIST.length + customTokens.length;
  const canAddMore = customTokens.length < MAX_CUSTOM_TOKENS;
  const selectedBuiltIn = TOKEN_LIST.find((t) => t.symbol === selectedToken);
  const selectedCustom = customTokens.find(
    (t) => t.address.toLowerCase() === String(selectedToken).toLowerCase()
  );
  const isNative = selectedBuiltIn?.isNative ?? false;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {isMounted && ready ? t('create.currency.select') : 'Choisissez la crypto à envoyer'}
        </label>
        <span className="text-xs text-gray-500">
          {totalCount} {isMounted && ready ? t('create.currency.available') : 'disponibles'}
        </span>
      </div>

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

              <div
                className={`
                  absolute inset-0 opacity-10 bg-gradient-to-br 
                  ${token.gradient}
                `}
              />

              <div className="relative space-y-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center overflow-hidden bg-white dark:bg-gray-700">
                  <TokenIcon token={token} />
                </div>

                <div className="text-left">
                  <div className="font-bold text-lg text-gray-900 dark:text-white">
                    {token.symbol}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {token.name}
                  </div>
                </div>

                {token.isNative && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    Natif
                  </span>
                )}
              </div>
            </button>
          );
        })}

        {customTokens.map((token) => (
          <CustomTokenCard
            key={token.address}
            token={token}
            isSelected={selectedToken === token.address}
            onClick={() => onSelectToken(token.address)}
            isTestnet={isTestnet}
            testnetWarningLabel={t('create.customToken.testnetWarning', { defaultValue: 'Unverified token (testnet)' })}
          />
        ))}

        {canAddMore && onOpenAddModal && (
          <button
            type="button"
            onClick={onOpenAddModal}
            className="
              relative overflow-hidden rounded-2xl p-6 
              border-2 border-dashed border-gray-300 dark:border-gray-600 
              bg-gray-50 dark:bg-gray-800/50 
              hover:border-primary-400 hover:bg-primary-50/50 dark:hover:bg-primary-950/20 
              transition-all duration-300 flex flex-col items-center justify-center gap-2 min-h-[140px]
            "
          >
            <span className="text-2xl" aria-hidden>➕</span>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400 text-center">
              {t('create.currency.registerCrypto', { defaultValue: 'Register a cryptocurrency' })}
            </span>
          </button>
        )}
      </div>

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
          {isNative ? (
            <p>
              <strong>{t('create.currency.native', { defaultValue: 'Native ETH: 1 transaction required' })}</strong>
            </p>
          ) : selectedCustom ? (
            <p>
              <strong>{t('create.currency.erc20', { defaultValue: 'ERC20 Token: 2 transactions required (approval + creation)' })}</strong>
            </p>
          ) : (
            <p>
              <strong>{t('create.currency.erc20', { defaultValue: 'ERC20 Token: 2 transactions required (approval + creation)' })}</strong>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
