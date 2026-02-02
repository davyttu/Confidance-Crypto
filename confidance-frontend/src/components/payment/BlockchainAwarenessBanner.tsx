'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAccount, useChainId, useChains, useSwitchChain } from 'wagmi';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, Info } from 'lucide-react';
import { CHAINS } from '@/config/chains';

const CHAIN_ICON_BY_ID: Record<number, string> = {
  8453: '/blockchains/base.svg',
  42161: '/blockchains/arbitrum.svg',
  43114: '/blockchains/avalanche.svg',
  137: '/blockchains/polygon.svg',
  84532: '/globe.svg',
};

const CHAIN_GRADIENT_BY_ID: Record<number, string> = {
  8453: 'from-[#0052FF] to-[#00D4FF]', // Base
  42161: 'from-[#28A0F0] to-[#0D4C8C]', // Arbitrum
  43114: 'from-[#E84142] to-[#F7931A]', // Avalanche
  137: 'from-[#8247E5] to-[#A855F7]', // Polygon
  84532: 'from-[#0052FF] via-[#6366F1] to-[#8B5CF6]', // Base Sepolia
};

export default function BlockchainAwarenessBanner() {
  const { t, ready } = useTranslation();
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const chains = useChains();
  const switchChain = useSwitchChain();
  const [isMounted, setIsMounted] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [infoTooltipOpen, setInfoTooltipOpen] = useState(false);
  const [popoverRect, setPopoverRect] = useState<{ top: number; left: number } | null>(null);
  const infoButtonRef = useRef<HTMLButtonElement>(null);

  const infoTooltipText = isMounted && ready
    ? t('create.blockchain.stepSubtitle', { defaultValue: 'Funds will be sent on this network' })
    : 'Funds will be sent on this network';

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!infoTooltipOpen || !infoButtonRef.current) return;
    const rect = infoButtonRef.current.getBoundingClientRect();
    setPopoverRect({ top: rect.bottom + 6, left: rect.left });
    const close = () => setInfoTooltipOpen(false);
    const t = setTimeout(() => document.addEventListener('click', close), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('click', close);
      setPopoverRect(null);
    };
  }, [infoTooltipOpen]);

  if (!isConnected) return null;

  const currentChain = CHAINS[chainId as keyof typeof CHAINS];
  const chainName = currentChain?.name ?? `Chain ${chainId}`;
  const icon = CHAIN_ICON_BY_ID[chainId as keyof typeof CHAIN_ICON_BY_ID] ?? '/globe.svg';
  const gradient = CHAIN_GRADIENT_BY_ID[chainId as keyof typeof CHAIN_GRADIENT_BY_ID] ?? 'from-primary-500 to-purple-500';
  const availableChains = chains.filter((c) => CHAINS[c.id as keyof typeof CHAINS]);

  const checklistItems = [
    { key: 'create.blockchainChecklist.address', fallback: "I've verified the recipient's address" },
    { key: 'create.blockchainChecklist.network', fallback: 'Their wallet supports this network' },
    { key: 'create.blockchainChecklist.receive', fallback: 'They will receive funds on this network' },
  ];

  return (
    <div className="glass rounded-2xl p-6 mb-6 relative overflow-visible">
      {/* Gradient accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${gradient} opacity-80`} />

      <div className="pl-1">
        {/* Step label — première option importante */}
        <div className="flex items-center gap-3 mb-4">
          <span
            className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-white font-bold text-sm bg-gradient-to-br ${gradient} shadow-md`}
          >
            1
          </span>
          <div className="flex items-center gap-1.5">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white tracking-tight">
              {isMounted && ready
                ? t('create.blockchain.stepLabel', { defaultValue: 'Choose your blockchain' })
                : 'Choose your blockchain'}
            </h3>
            <span className="relative inline-flex">
              <button
                ref={infoButtonRef}
                type="button"
                onClick={() => setInfoTooltipOpen((o) => !o)}
                className="p-0.5 -m-0.5 rounded focus:outline-none focus:ring-2 focus:ring-primary-400 cursor-pointer"
                aria-label={isMounted && ready ? t('create.blockchain.checklistTitle', { defaultValue: 'Info' }) : 'Info'}
                aria-expanded={infoTooltipOpen}
              >
                <Info
                  className="w-4 h-4 text-gray-400 dark:text-gray-500 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
                  aria-hidden
                />
              </button>
              {infoTooltipOpen && popoverRect && isMounted && typeof document !== 'undefined' && createPortal(
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="fixed px-4 py-3 pb-4 rounded-lg text-xs font-normal text-white bg-gray-900 dark:bg-gray-700 min-w-[240px] max-w-[300px] z-[9999] shadow-xl text-left"
                  style={{ top: popoverRect.top, left: popoverRect.left }}
                >
                  <span className="absolute left-5 top-0 w-0 h-0 border-l-[6px] border-r-[6px] border-b-[6px] border-transparent -translate-y-full border-b-gray-900 dark:border-b-gray-700" />
                  <p className="mb-2">{infoTooltipText}</p>
                  <ul className="space-y-1.5 mb-3">
                    {checklistItems.map(({ key, fallback }) => (
                      <li key={key} className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-primary-300 flex-shrink-0" strokeWidth={2.5} />
                        {isMounted && ready ? t(key, { defaultValue: fallback }) : fallback}
                      </li>
                    ))}
                  </ul>
                  <p className="text-primary-200 text-[11px] leading-relaxed border-t border-gray-600 pt-3">
                    {isMounted && ready
                      ? t('create.blockchain.switchHint', {
                          defaultValue: 'To switch blockchain, use the network selector at the top-right — one click and you\'re good to go!',
                        })
                      : 'To switch blockchain, use the network selector at the top-right — one click and you\'re good to go!'}
                  </p>
                </div>,
                document.body
              )}
            </span>
          </div>
        </div>

        {/* Selected chain card — style proche du CurrencySelector */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            <div
              className={`
                relative overflow-hidden rounded-2xl p-5 min-w-[200px]
                border-2 transition-all duration-300
                bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900
                border-primary-400 dark:border-primary-600
                shadow-lg shadow-primary-500/10
              `}
            >
              <div className={`absolute inset-0 opacity-[0.07] bg-gradient-to-br ${gradient}`} />
              <div className="relative flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-white dark:bg-gray-800 shadow-sm flex items-center justify-center border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
                  <img src={icon} alt={chainName} className="w-8 h-8 object-contain" />
                </div>
                <div>
                  <p className="font-bold text-base text-gray-900 dark:text-white">{chainName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {isMounted && ready
                      ? t('create.blockchain.selected', { defaultValue: 'Selected network' })
                      : 'Selected network'}
                  </p>
                </div>
                <div className="absolute top-3 right-3">
                  <Check className="w-5 h-5 text-primary-500" strokeWidth={2.5} />
                </div>
              </div>
            </div>

            {availableChains.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setDropdownOpen((o) => !o)}
                  className="absolute -bottom-2 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 shadow hover:border-primary-400 dark:hover:border-primary-500 transition-colors"
                >
                  {isMounted && ready
                    ? t('create.blockchain.switchNetwork', { defaultValue: 'Switch network' })
                    : 'Switch network'}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {dropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                    <div className="absolute left-0 top-full mt-2 z-20 w-56 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl overflow-hidden">
                      {availableChains
                        .filter((c) => c.id !== chainId)
                        .map((chain) => {
                          const cfg = CHAINS[chain.id as keyof typeof CHAINS];
                          const name = cfg?.name ?? chain.name ?? `Chain ${chain.id}`;
                          const chainIcon = CHAIN_ICON_BY_ID[chain.id as keyof typeof CHAIN_ICON_BY_ID] ?? '/globe.svg';
                          const chainGrad = CHAIN_GRADIENT_BY_ID[chain.id as keyof typeof CHAIN_GRADIENT_BY_ID] ?? 'from-primary-500 to-purple-500';
                          return (
                            <button
                              key={chain.id}
                              type="button"
                              onClick={() => {
                                switchChain.mutate({ chainId: chain.id });
                                setDropdownOpen(false);
                              }}
                              disabled={switchChain.isPending}
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/80 text-left transition-colors border-b border-gray-100 dark:border-gray-800 last:border-0"
                            >
                              <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${chainGrad} p-0.5`}>
                                <div className="w-full h-full rounded-[6px] bg-white dark:bg-gray-900 flex items-center justify-center">
                                  <img src={chainIcon} alt="" className="w-5 h-5" />
                                </div>
                              </div>
                              <span className="font-medium text-gray-900 dark:text-white">{name}</span>
                            </button>
                          );
                        })}
                    </div>
                  </>
                )}
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
