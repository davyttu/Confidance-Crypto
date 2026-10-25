'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { useTranslation } from 'react-i18next';
import { Check, Info } from 'lucide-react';
import { CHAINS } from '@/config/chains';
import { COMING_SOON_CHAIN_IDS } from '@/components/wallet/DisabledChainsGuard';

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

const LIVE_CHAIN_IDS = [8453, 42161] as const;

function chainCard(id: number) {
  return {
    chainId: id,
    name: CHAINS[id]?.name ?? `Chain ${id}`,
    icon: CHAIN_ICON_BY_ID[id] ?? '/globe.svg',
    gradient: CHAIN_GRADIENT_BY_ID[id] ?? 'from-gray-400 to-gray-500',
  };
}

const LIVE_CHAINS = LIVE_CHAIN_IDS.map(chainCard);
const COMING_SOON_CHAINS = COMING_SOON_CHAIN_IDS.map(chainCard);

export default function BlockchainAwarenessBanner() {
  const { t, ready } = useTranslation();
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const [isMounted, setIsMounted] = useState(false);
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

  const gradient = CHAIN_GRADIENT_BY_ID[chainId as keyof typeof CHAIN_GRADIENT_BY_ID] ?? 'from-primary-500 to-purple-500';
  const selectedLabel = isMounted && ready
    ? t('create.blockchain.selected', { defaultValue: 'Selected network' })
    : 'Selected network';

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
                          defaultValue:
                            'Payments run on Base or Arbitrum. Select a network here and confirm the switch in your wallet.',
                        })
                      : 'Payments run on Base or Arbitrum. Select a network here and confirm the switch in your wallet.'}
                  </p>
                </div>,
                document.body
              )}
            </span>
          </div>
        </div>

        {/* Base and Arbitrum are selectable. Polygon and Avalanche stay closed. */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {LIVE_CHAINS.map((chain) => {
            const isSelected = chainId === chain.chainId;
            return (
              <button
                key={chain.chainId}
                type="button"
                disabled={isSelected || isSwitching}
                aria-pressed={isSelected}
                onClick={() => switchChain({ chainId: chain.chainId })}
                className={`
                  relative overflow-hidden rounded-2xl p-5 text-left
                  border-2 transition-all duration-300
                  bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900
                  ${isSelected
                    ? 'border-primary-400 dark:border-primary-600 shadow-lg shadow-primary-500/10 cursor-default'
                    : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 cursor-pointer'}
                  disabled:cursor-default
                `}
              >
                <div className={`absolute inset-0 opacity-[0.07] bg-gradient-to-br ${chain.gradient}`} />
                <div className="relative flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-white dark:bg-gray-800 shadow-sm flex items-center justify-center border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
                    <img src={chain.icon} alt={chain.name} className="w-8 h-8 object-contain" />
                  </div>
                  <div>
                    <p className="font-bold text-base text-gray-900 dark:text-white">{chain.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 min-h-[1rem]">
                      {isSelected ? selectedLabel : '\u00A0'}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}

          {COMING_SOON_CHAINS.map((chain) => {
            const comingSoonLabel = isMounted && ready
              ? t('wallet.chainComingSoon', { defaultValue: 'Bientôt disponible' })
              : 'Bientôt disponible';

            return (
              <button
                key={chain.chainId}
                type="button"
                disabled
                aria-disabled="true"
                title={comingSoonLabel}
                className="
                  group relative overflow-hidden rounded-2xl p-5 text-left
                  border-2 border-gray-200 dark:border-gray-700
                  bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900
                  opacity-45 grayscale cursor-not-allowed
                  transition-all duration-300
                "
              >
                <div className={`absolute inset-0 opacity-[0.07] bg-gradient-to-br ${chain.gradient}`} />
                <div className="relative flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-white dark:bg-gray-800 shadow-sm flex items-center justify-center border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
                    <img src={chain.icon} alt={chain.name} className="w-8 h-8 object-contain" />
                  </div>
                  <div>
                    <p className="font-bold text-base text-gray-900 dark:text-white">{chain.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {comingSoonLabel}
                    </p>
                  </div>
                </div>
                <span
                  className="
                    pointer-events-none absolute inset-x-3 top-1/2 -translate-y-1/2
                    rounded-md bg-gray-900/95 px-2 py-1 text-center text-xs font-medium text-gray-100
                    opacity-0 shadow-lg transition-opacity duration-150
                    group-hover:opacity-100
                  "
                >
                  {comingSoonLabel}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
