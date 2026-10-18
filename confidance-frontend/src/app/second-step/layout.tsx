import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Lire la blockchain — Preuves de paiement | Confidance',
  description:
    'Comprendre où trouver la preuve on-chain d’un paiement Confidance : explorateur Base, ETH vs tokens, Internal Transactions et Token Transfers.',
  alternates: { canonical: `${SITE_URL}/second-step` },
  openGraph: {
    title: 'Lire la blockchain — Confidance',
    description: 'Chaque paiement laisse une trace publique, vérifiable et inaltérable.',
    url: `${SITE_URL}/second-step`,
    siteName: 'Confidance',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export default function SecondStepLayout({ children }: { children: React.ReactNode }) {
  return children;
}
