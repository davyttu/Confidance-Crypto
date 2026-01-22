// components/Dashboard/PeriodSelector.tsx
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { getCurrentYearMonths } from '@/lib/utils/dateFormatter';
import { usePublicClient } from 'wagmi';
import { formatUnits } from 'viem';
import { useEthUsdPrice } from '@/hooks/useEthUsdPrice';
import { getToken, isZeroAddress } from '@/config/tokens';
import { erc20Abi } from '@/lib/contracts/erc20Abi';

type WalletInfo = {
  id?: string;
  wallet_address: string;
  is_primary?: boolean;
};

type WalletTotal = {
  eth: bigint;
  usdc: bigint;
  usdt: bigint;
};

interface PeriodSelectorProps {
  onChange: (periodType: 'all' | 'month' | 'wallet', periodValue?: string | number | string[]) => void;
  wallets?: WalletInfo[];
  walletsLoading?: boolean;
  connectedWallet?: string | null;
  walletAliases?: Record<string, string>;
  onRenameWallet?: (address: string, name: string) => void;
  onDeleteWallet?: (address: string) => void;
  onSetPrimaryWallet?: (address: string) => void;
}

export function PeriodSelector({
  onChange,
  wallets = [],
  walletsLoading = false,
  connectedWallet,
  walletAliases = {},
  onRenameWallet,
  onDeleteWallet,
  onSetPrimaryWallet,
}: PeriodSelectorProps) {
  const { t, ready: translationsReady } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);
  const [periodType, setPeriodType] = useState<'all' | 'month' | 'wallet'>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [editingWallet, setEditingWallet] = useState<string | null>(null);
  const [walletNameInput, setWalletNameInput] = useState('');
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const walletMenuRef = useRef<HTMLDivElement | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);
  const [selectedWallets, setSelectedWallets] = useState<string[]>([]);
  const publicClient = usePublicClient();
  const { priceUsd } = useEthUsdPrice();
  const [walletTotals, setWalletTotals] = useState<Record<string, WalletTotal>>({});
  const [walletTotalsLoading, setWalletTotalsLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const currentYearMonths = getCurrentYearMonths();
  const normalizedConnected = connectedWallet?.toLowerCase() || '';

  const openWalletMenu = () => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setWalletMenuOpen(true);
  };

  const scheduleCloseWalletMenu = () => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
    }
    closeTimeoutRef.current = window.setTimeout(() => {
      setWalletMenuOpen(false);
      closeTimeoutRef.current = null;
    }, 200);
  };

  useEffect(() => {
    if (periodType !== 'wallet') return;
    if (!normalizedConnected) return;

    if (!selectedWallets.includes(normalizedConnected)) {
      const next = [normalizedConnected, ...selectedWallets];
      setSelectedWallets(next);
      setSelectedPeriod(normalizedConnected);
      onChange('wallet', next);
    }
  }, [periodType, selectedWallets, normalizedConnected, onChange]);

  useEffect(() => {
    if (!walletMenuOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (walletMenuRef.current && target && !walletMenuRef.current.contains(target)) {
        setWalletMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [walletMenuOpen]);

  const walletLabels = useMemo(() => {
    const entries = wallets.map((wallet) => {
      const address = wallet.wallet_address;
      const lower = address.toLowerCase();
      const alias = walletAliases[lower];
      return [lower, alias || formatAddress(address)] as const;
    });
    return Object.fromEntries(entries);
  }, [wallets, walletAliases]);

  const walletsToDisplay = useMemo(() => {
    const normalized = normalizedConnected || '';
    const hasConnected = normalized
      ? wallets.some((wallet) => wallet.wallet_address.toLowerCase() === normalized)
      : false;

    const connectedEntry = normalized && !hasConnected
      ? [{
        wallet_address: normalizedConnected,
        is_primary: false,
        id: 'connected',
      }]
      : [];

    return [
      ...connectedEntry,
      ...wallets,
    ];
  }, [wallets, normalizedConnected]);

  useEffect(() => {
    if (!publicClient || walletsToDisplay.length === 0) {
      setWalletTotals({});
      setWalletTotalsLoading({});
      return;
    }

    let isMounted = true;
    const usdcToken = getToken('USDC');
    const usdtToken = getToken('USDT');
    const canReadToken = (token: { address: string; isNative: boolean }) =>
      !token.isNative && !isZeroAddress(token.address);

    const readTokenBalance = async (token: typeof usdcToken, wallet: `0x${string}`) => {
      if (!canReadToken(token)) return 0n;
      try {
        return await publicClient.readContract({
          address: token.address,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [wallet],
        }) as bigint;
      } catch (err) {
        console.warn('⚠️ BalanceOf failed for token', token.symbol, err);
        return 0n;
      }
    };

    const loadTotals = async () => {
      const nextLoading: Record<string, boolean> = {};
      walletsToDisplay.forEach((wallet) => {
        nextLoading[wallet.wallet_address.toLowerCase()] = true;
      });
      setWalletTotalsLoading(nextLoading);

      try {
        const results = await Promise.all(
          walletsToDisplay.map(async (wallet) => {
            const addressValue = wallet.wallet_address as `0x${string}`;
            const [eth, usdc, usdt] = await Promise.all([
              publicClient.getBalance({ address: addressValue }),
              readTokenBalance(usdcToken, addressValue),
              readTokenBalance(usdtToken, addressValue),
            ]);

            return {
              address: wallet.wallet_address.toLowerCase(),
              eth,
              usdc,
              usdt,
            };
          })
        );

        if (!isMounted) return;

        const totals: Record<string, WalletTotal> = {};
        results.forEach((entry) => {
          totals[entry.address] = {
            eth: entry.eth,
            usdc: entry.usdc,
            usdt: entry.usdt,
          };
        });
        setWalletTotals(totals);
      } catch (error) {
        if (isMounted) {
          console.error('❌ Error loading wallet totals:', error);
        }
      } finally {
        if (isMounted) {
          const nextLoading: Record<string, boolean> = {};
          walletsToDisplay.forEach((wallet) => {
            nextLoading[wallet.wallet_address.toLowerCase()] = false;
          });
          setWalletTotalsLoading(nextLoading);
        }
      }
    };

    loadTotals();

    return () => {
      isMounted = false;
    };
  }, [publicClient, walletsToDisplay]);

  const handlePeriodTypeChange = (type: 'all' | 'month' | 'wallet') => {
    setPeriodType(type);
    setSelectedPeriod('');
    if (type !== 'wallet') {
      setSelectedWallets([]);
      onChange(type);
      return;
    }
    
    if (type === 'all') {
      onChange('all');
    }
  };

  const handleMonthChange = (monthValue: string) => {
    setSelectedPeriod(monthValue);
    onChange('month', monthValue);
  };

  const handleWalletSelect = (address: string) => {
    setPeriodType('wallet');
    setSelectedPeriod(address);

    const normalized = address.toLowerCase();
    const isConnectedWallet = normalized === normalizedConnected;
    const isAlreadySelected = selectedWallets.includes(normalized);
    const next = isAlreadySelected
      ? selectedWallets.filter((wallet) => wallet !== normalized)
      : [...selectedWallets, normalized];

    // Le wallet connecté reste toujours affiché
    if (isConnectedWallet && isAlreadySelected) {
      return;
    }

    setSelectedWallets(next);
    onChange('wallet', next);
  };

  const startRename = (address: string) => {
    const lower = address.toLowerCase();
    setEditingWallet(lower);
    setWalletNameInput(walletAliases[lower] || '');
  };

  const saveRename = () => {
    if (!editingWallet || !onRenameWallet) return;
    const name = walletNameInput.trim();
    onRenameWallet(editingWallet, name);
    setEditingWallet(null);
    setWalletNameInput('');
  };

  const cancelRename = () => {
    setEditingWallet(null);
    setWalletNameInput('');
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Type de période */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handlePeriodTypeChange('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                periodType === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {isMounted && translationsReady ? t('dashboard.period.all') : 'Tout'}
            </button>
            
            <button
              onClick={() => handlePeriodTypeChange('month')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                periodType === 'month'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {isMounted && translationsReady ? t('dashboard.period.byMonth') : 'Par mois'}
            </button>

            <div
              className="relative z-40"
              ref={walletMenuRef}
              onMouseEnter={openWalletMenu}
              onMouseLeave={scheduleCloseWalletMenu}
            >
              <button
                type="button"
                onClick={() => {
                  handlePeriodTypeChange('wallet');
                  setWalletMenuOpen((open) => !open);
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors inline-flex items-center gap-2 ${
                  periodType === 'wallet'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span>{isMounted && translationsReady ? t('dashboard.period.byWallet', { defaultValue: 'By wallet' }) : 'By wallet'}</span>
                {periodType === 'wallet' && selectedWallets.length > 0 && (
                  <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full truncate max-w-[140px]">
                    {selectedWallets.length === 1
                      ? (walletLabels[selectedWallets[0]] || formatAddress(selectedWallets[0]))
                      : (isMounted && translationsReady
                        ? t('dashboard.wallets.selectedCount', { count: selectedWallets.length, defaultValue: `${selectedWallets.length} wallets` })
                        : `${selectedWallets.length} wallets`)}
                  </span>
                )}
              </button>

              <div
                onMouseEnter={openWalletMenu}
                onMouseLeave={scheduleCloseWalletMenu}
                className={`absolute left-0 top-full mt-2 w-96 rounded-xl border border-gray-200 bg-white shadow-xl opacity-0 pointer-events-none transition-all z-50 ${
                  walletMenuOpen ? 'opacity-100 pointer-events-auto' : ''
                }`}
              >
                <div className="p-4 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-900">
                    {isMounted && translationsReady ? t('dashboard.wallets.title', { defaultValue: 'Linked wallets' }) : 'Linked wallets'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {isMounted && translationsReady
                      ? t('dashboard.wallets.subtitle', { defaultValue: 'Choose which wallet to display. Balances remain available even when the wallet is disconnected.' })
                      : 'Choose which wallet to display. Balances remain available even when the wallet is disconnected.'}
                  </p>
                </div>

                <div className="max-h-72 overflow-y-auto p-2">
                  {walletsLoading ? (
                    <div className="px-3 py-4 text-sm text-gray-500">
                      {isMounted && translationsReady ? t('dashboard.wallets.loading', { defaultValue: 'Loading wallets...' }) : 'Loading wallets...'}
                    </div>
                  ) : wallets.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-gray-500">
                      {isMounted && translationsReady ? t('dashboard.wallets.empty', { defaultValue: 'No wallets linked yet.' }) : 'No wallets linked yet.'}
                    </div>
                  ) : (
                    walletsToDisplay.map((wallet) => {
                      const address = wallet.wallet_address;
                      const lower = address.toLowerCase();
                      const isConnected = lower === normalizedConnected;
                      const alias = walletAliases[lower];
                      const displayName = alias || formatAddress(address);
                      const isEditing = editingWallet === lower;
                      const isSelected = selectedWallets.includes(lower) || (isConnected && periodType === 'wallet');
                      const totals = walletTotals[lower];
                      const isTotalsLoading = walletTotalsLoading[lower];
                      const totalUsd = totals ? formatWalletUsdTotal(totals, priceUsd) : null;
                      const breakdown = totals ? formatWalletBreakdown(totals) : '';

                      return (
                        <div
                          key={address}
                          className={`flex items-center gap-3 rounded-lg px-3 py-2 transition ${
                            isSelected && periodType === 'wallet'
                              ? 'bg-blue-50 border border-blue-200'
                              : 'hover:bg-gray-50 border border-transparent'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleWalletSelect(address)}
                            className="flex flex-1 items-center gap-3 text-left"
                          >
                            <span className="flex flex-col min-w-0">
                              <span className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-gray-900 truncate max-w-[200px] relative group">
                                  {displayName}
                                  {alias && (
                                    <span className="absolute left-0 top-full mt-1 z-10 w-max max-w-[240px] rounded-md bg-gray-900 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                      {maskAddress(address)}
                                    </span>
                                  )}
                                </span>
                              </span>
                              <span className="text-xs text-gray-500">
                                {isConnected
                                  ? (isMounted && translationsReady ? t('dashboard.wallets.connected', { defaultValue: 'Connected' }) : 'Connected')
                                  : (isMounted && translationsReady ? t('dashboard.wallets.saved', { defaultValue: 'Saved wallet' }) : 'Saved wallet')}
                              </span>
                            </span>
                          </button>

                          <div className="flex items-center gap-3">
                            <span
                              className="text-xs font-semibold text-gray-600 whitespace-nowrap"
                              title={breakdown || undefined}
                            >
                              {isTotalsLoading
                                ? '...'
                                : totalUsd !== null
                                  ? `${formatNumber(totalUsd, 2)} USD`
                                  : '—'}
                            </span>
                            <button
                              type="button"
                              aria-pressed={isSelected}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleWalletSelect(address);
                              }}
                              className={`h-3 w-3 rounded-full transition ${isSelected ? 'bg-emerald-500 shadow-emerald-300 shadow-sm' : 'bg-gray-300 hover:bg-emerald-200'}`}
                              title={isMounted && translationsReady
                                ? (isSelected
                                  ? t('dashboard.wallets.displayed', { defaultValue: 'Displayed' })
                                  : t('dashboard.wallets.showWallet', { defaultValue: 'Show in dashboard' }))
                                : (isSelected ? 'Displayed' : 'Show in dashboard')}
                            />

                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <input
                                  value={walletNameInput}
                                  onChange={(e) => setWalletNameInput(e.target.value)}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                      saveRename();
                                    }
                                    if (event.key === 'Escape') {
                                      cancelRename();
                                    }
                                  }}
                                  className="w-32 rounded-md border border-gray-200 px-2 py-1 text-xs focus:border-blue-400 focus:outline-none"
                                  placeholder={isMounted && translationsReady ? t('dashboard.wallets.renamePlaceholder', { defaultValue: 'Wallet name' }) : 'Wallet name'}
                                />
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    saveRename();
                                  }}
                                  className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-50"
                                  title={isMounted && translationsReady ? t('common.save', { defaultValue: 'Save' }) : 'Save'}
                                >
                                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586l-3.293-3.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z" clipRule="evenodd" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    cancelRename();
                                  }}
                                  className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
                                  title={isMounted && translationsReady ? t('common.cancel', { defaultValue: 'Cancel' }) : 'Cancel'}
                                >
                                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                  </svg>
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  startRename(address);
                                }}
                                className="rounded-md p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                                title={isMounted && translationsReady ? t('dashboard.wallets.rename', { defaultValue: 'Rename' }) : 'Rename'}
                              >
                                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                  <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                                  <path fillRule="evenodd" d="M2 15a1 1 0 011-1h6a1 1 0 010 2H4v1a1 1 0 01-2 0v-2z" clipRule="evenodd" />
                                </svg>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onDeleteWallet?.(address);
                              }}
                              className="rounded-md p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50"
                              title={isMounted && translationsReady ? t('dashboard.wallets.delete', { defaultValue: 'Delete' }) : 'Delete'}
                            >
                              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fillRule="evenodd" d="M6 7a1 1 0 011 1v7a1 1 0 11-2 0V8a1 1 0 011-1zm4 0a1 1 0 011 1v7a1 1 0 11-2 0V8a1 1 0 011-1zm5-3a1 1 0 010 2h-1v10a2 2 0 01-2 2H6a2 2 0 01-2-2V6H3a1 1 0 110-2h4l1-1h4l1 1h4z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="sm:ml-3 sm:pl-3 sm:border-l sm:border-gray-200">
            <Link
              href="/dashboard/links"
              className="group relative inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-blue-700 bg-gradient-to-r from-white to-blue-50 border border-blue-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <span className="absolute inset-0 rounded-lg bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="relative">
                {isMounted && translationsReady ? t('links.dashboard.button') : 'Mes liens'}
              </span>
            </Link>
          </div>
        </div>

        {/* Sélecteur de mois */}
        {periodType === 'month' && (
          <select
            value={selectedPeriod}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">{isMounted && translationsReady ? t('dashboard.period.selectMonth') : 'Sélectionner un mois'}</option>
            {currentYearMonths.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

function formatAddress(address: string) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function maskAddress(address: string) {
  if (!address) return '';
  return `${address.slice(0, 4)}••••${address.slice(-4)}`;
}

function formatNumber(value: number, maxDecimals: number) {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  });
}

function formatWalletUsdTotal(totals: WalletTotal, ethPrice: number | null) {
  if (!ethPrice) return null;
  const ethValue = Number(formatUnits(totals.eth, 18));
  const usdcValue = Number(formatUnits(totals.usdc, 6));
  const usdtValue = Number(formatUnits(totals.usdt, 6));
  return ethValue * ethPrice + usdcValue + usdtValue;
}

function formatWalletBreakdown(totals: WalletTotal) {
  const ethValue = Number(formatUnits(totals.eth, 18));
  const usdcValue = Number(formatUnits(totals.usdc, 6));
  const usdtValue = Number(formatUnits(totals.usdt, 6));
  return `ETH ${formatNumber(ethValue, 4)} + USDC ${formatNumber(usdcValue, 2)} + USDT ${formatNumber(usdtValue, 2)}`;
}
