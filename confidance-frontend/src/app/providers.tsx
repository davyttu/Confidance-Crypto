// src/app/providers.tsx
'use client';

import { useEffect, useState } from 'react';
import '@rainbow-me/rainbowkit/styles.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { config } from '@/lib/wagmi';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { I18nextProvider, useTranslation } from 'react-i18next';
import i18n from '@/lib/i18n';
import { WalletConnectErrorHandler } from '@/components/WalletConnectErrorHandler';

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

// Composant interne pour accéder à la langue i18n
function RainbowKitProviderWithLocale({ children }: { children: React.ReactNode }) {
  const { i18n: i18nInstance } = useTranslation();
  const [locale, setLocale] = useState<string>('en-US');

  useEffect(() => {
    // Mapper les langues i18n vers les locales RainbowKit complètes
    const langMap: Record<string, string> = {
      'fr': 'fr-FR',
      'en': 'en-US',
      'es': 'es-419',
      'ru': 'ru-RU',
      'zh': 'zh-CN',
    };
    
    const currentLang = i18nInstance.language || 'fr';
    const baseLang = currentLang.split('-')[0];
    const mappedLocale = langMap[currentLang] || langMap[baseLang] || 'en-US';
    setLocale(mappedLocale);
  }, [i18nInstance.language]);

  return (
    <RainbowKitProvider theme={darkTheme()} modalSize="compact" locale={locale as any}>
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
            <ThemeProvider>
              {children}
            </ThemeProvider>
          </RainbowKitProviderWithLocale>
        </QueryClientProvider>
      </WagmiProvider>
    </I18nextProvider>
  );
}
