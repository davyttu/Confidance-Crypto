import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Trouver ma preuve sur Basescan | Confidance',
  description:
    'Guide pas à pas pour localiser un paiement Confidance sur Basescan (Base Mainnet ou Sepolia).',
  alternates: { canonical: `${SITE_URL}/find-proof` },
  robots: { index: true, follow: true },
};

export default function FindProofLayout({ children }: { children: React.ReactNode }) {
  return children;
}
