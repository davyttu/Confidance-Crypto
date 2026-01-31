'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { usePublicClient, useAccount } from 'wagmi';
import { validateErc20Address } from '@/lib/validate-erc20';
import type { CustomToken } from '@/lib/custom-tokens';

interface AddCustomTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (token: CustomToken) => void;
}

export default function AddCustomTokenModal({
  isOpen,
  onClose,
  onAdd,
}: AddCustomTokenModalProps) {
  const { t } = useTranslation();
  const publicClient = usePublicClient();
  const { address: userAddress } = useAccount();
  const [contractAddress, setContractAddress] = useState('');
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [decimals, setDecimals] = useState<number | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setContractAddress('');
      setName('');
      setSymbol('');
      setDecimals('');
      setError(null);
      setIsLoading(false);
      setIsValidating(false);
    }
  }, [isOpen]);

  const handleFetchToken = async () => {
    const addr = contractAddress.trim();
    if (!addr || !/^0x[a-fA-F0-9]{40}$/.test(addr)) {
      setError(t('create.customToken.errors.invalidAddressFormat', { defaultValue: 'Invalid contract address (must be 0x followed by 40 hexadecimal characters)' }));
      return;
    }
    if (!publicClient || !userAddress) {
      setError(t('create.customToken.errors.connectWallet', { defaultValue: 'Connect your wallet and make sure you are on the correct network.' }));
      return;
    }

    setError(null);
    setIsValidating(true);
    try {
      const info = await validateErc20Address(publicClient, addr, userAddress);
      setName(info.name);
      setSymbol(info.symbol);
      setDecimals(info.decimals);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : t('create.customToken.errors.readContract', { defaultValue: 'Unable to read contract. Check the address and network.' });
      setError(msg);
      setName('');
      setSymbol('');
      setDecimals('');
    } finally {
      setIsValidating(false);
    }
  };

  const handleAddClick = () => {
    const addr = contractAddress.trim();
    if (!addr || !/^0x[a-fA-F0-9]{40}$/.test(addr)) {
      setError(t('create.customToken.errors.invalidAddress', { defaultValue: 'Invalid contract address' }));
      return;
    }
    if (!name || !symbol || decimals === '') {
      setError(t('create.customToken.errors.verifyFirst', { defaultValue: 'Click "Verify" to fill in the token details.' }));
      return;
    }
    if (typeof decimals !== 'number' || decimals > 18) {
      setError(t('create.customToken.errors.decimalsNotSupported', { defaultValue: 'This token uses more than 18 decimals and is not supported.' }));
      return;
    }

    setError(null);
    setIsLoading(true);
    onAdd({
      address: addr,
      name: name.trim(),
      symbol: symbol.trim().toUpperCase(),
      decimals: Math.min(18, Math.max(0, Math.floor(decimals))),
    });
    setIsLoading(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {t('create.customToken.title', { defaultValue: 'Register a cryptocurrency' })}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label={t('common.cancel', { defaultValue: 'Close' })}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('create.customToken.addressLabel', { defaultValue: 'ERC20 contract address' })}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={contractAddress}
                onChange={(e) => {
                  setContractAddress(e.target.value);
                  setError(null);
                }}
                placeholder="0x..."
                className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
              <button
                type="button"
                onClick={handleFetchToken}
                disabled={isValidating || !contractAddress.trim()}
                className="px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isValidating ? '…' : t('create.customToken.verify', { defaultValue: 'Verify' })}
              </button>
            </div>
          </div>

          {(name || symbol || decimals !== '') && (
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900/50 space-y-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-gray-500 dark:text-gray-400">{t('create.customToken.name', { defaultValue: 'Name' })}</span>
                <span className="font-medium text-gray-900 dark:text-white">{name || '—'}</span>
                <span className="text-gray-500 dark:text-gray-400">{t('create.customToken.symbol', { defaultValue: 'Symbol' })}</span>
                <span className="font-medium text-gray-900 dark:text-white">{symbol || '—'}</span>
                <span className="text-gray-500 dark:text-gray-400">{t('create.customToken.decimals', { defaultValue: 'Decimals' })}</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {decimals === '' ? '—' : decimals}
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {t('create.customToken.cancel', { defaultValue: 'Cancel' })}
            </button>
            <button
              type="button"
              onClick={handleAddClick}
              disabled={isLoading || !name || !symbol || decimals === ''}
              className="flex-1 px-4 py-3 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('create.customToken.add', { defaultValue: 'Add' })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
