'use client';

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/** Chains shown in the RainbowKit switcher but not selectable yet (Base launch). */
export const COMING_SOON_CHAIN_IDS = [137, 42161, 43114] as const;

const DISABLED_SELECTOR = COMING_SOON_CHAIN_IDS.map(
  (id) => `[data-testid="rk-chain-option-${id}"]`
).join(',');

/**
 * Greys out Polygon / Arbitrum / Avalanche in RainbowKit's "Switch Networks"
 * modal and blocks selection, with a localized "coming soon" hover label.
 */
export function DisabledChainsGuard() {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    const comingSoon = t('wallet.chainComingSoon', {
      defaultValue: 'Bientôt disponible',
    });

    const markDisabledChains = () => {
      document.querySelectorAll<HTMLElement>(DISABLED_SELECTOR).forEach((el) => {
        el.classList.add('rk-chain-coming-soon');
        el.setAttribute('aria-disabled', 'true');
        el.setAttribute('data-coming-soon', comingSoon);
        el.setAttribute('title', comingSoon);
      });
    };

    const blockInteraction = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest(DISABLED_SELECTOR)) return;
      event.preventDefault();
      event.stopPropagation();
    };

    const blockKeyboard = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      blockInteraction(event);
    };

    markDisabledChains();

    const observer = new MutationObserver(markDisabledChains);
    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener('click', blockInteraction, true);
    document.addEventListener('pointerdown', blockInteraction, true);
    document.addEventListener('keydown', blockKeyboard, true);

    return () => {
      observer.disconnect();
      document.removeEventListener('click', blockInteraction, true);
      document.removeEventListener('pointerdown', blockInteraction, true);
      document.removeEventListener('keydown', blockKeyboard, true);
    };
  }, [t, i18n.language]);

  return null;
}
