// src/app/providers.tsx
'use client';

import { useEffect, useState } from 'react';
import '@rainbow-me/rainbowkit/styles.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme, type Locale } from '@rainbow-me/rainbowkit';
import { config } from '@/lib/wagmi';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { I18nextProvider, useTranslation } from 'react-i18next';
import i18n from '@/lib/i18n';
import { WalletConnectErrorHandler } from '@/components/WalletConnectErrorHandler';
import { DisabledChainsGuard } from '@/components/wallet/DisabledChainsGuard';

/** Map app i18n codes → RainbowKit locales (modal Connect Wallet). */
const RAINBOW_LOCALE_MAP: Record<string, Locale> = {
  fr: 'fr-FR',
  en: 'en-US',
  es: 'es-419',
  ru: 'ru-RU',
  zh: 'zh-CN',
};

function resolveRainbowKitLocale(lang?: string | null): Locale {
  const stored =
    typeof window !== 'undefined' ? window.localStorage.getItem('i18nextLng') : null;
  const raw = (lang || stored || 'en').trim();
  const base = raw.split('-')[0]?.toLowerCase() || 'en';
  return RAINBOW_LOCALE_MAP[raw] || RAINBOW_LOCALE_MAP[base] || 'en-US';
}

// Singleton pour éviter les multiples initialisations de WalletConnect Core
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
  if (typeof window === 'undefined') {
    // Côté serveur: nouvelle instance à chaque fois
    return makeQueryClient();
  } else {
    // Côté navigateur: réutilise la même instance
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}

// Sync RainbowKit modal language with the app language switcher
function RainbowKitProviderWithLocale({ children }: { children: React.ReactNode }) {
  const { i18n: i18nInstance } = useTranslation();
  const [locale, setLocale] = useState<Locale>(() =>
    resolveRainbowKitLocale(i18nInstance.language)
  );

  useEffect(() => {
    const apply = (lng?: string) => {
      setLocale(resolveRainbowKitLocale(lng || i18nInstance.language));
    };

    apply(i18nInstance.language);
    i18nInstance.on('languageChanged', apply);
    return () => {
      i18nInstance.off('languageChanged', apply);
    };
  }, [i18nInstance]);

  return (
    <RainbowKitProvider
      key={locale}
      theme={darkTheme()}
      modalSize="compact"
      locale={locale}
    >
      {children}
    </RainbowKitProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <I18nextProvider i18n={i18n}>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProviderWithLocale>
            <WalletConnectErrorHandler />
            <DisabledChainsGuard />
            <ThemeProvider>
              {children}
            </ThemeProvider>
          </RainbowKitProviderWithLocale>
        </QueryClientProvider>
      </WagmiProvider>
    </I18nextProvider>
  );
}
