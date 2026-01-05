// src/app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { AuthProvider } from '@/contexts/AuthContext';
import { WalletSyncProvider } from '@/components/WalletSyncProvider';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { HelpWidget } from '@/components/HelpWidget';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Confidance Crypto - Paiements Programmés',
  description: 'Plateforme DeFi pour programmer des paiements automatiques on-chain',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          <AuthProvider>
            <WalletSyncProvider>
              <Navbar />
              <main className="pt-16">
                {children}
              </main>
              <Footer />
              <HelpWidget />
            </WalletSyncProvider>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}