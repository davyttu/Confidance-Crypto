import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Centre d’aide | Confidance',
  description:
    'Centre d’aide Confidance : débuter, guides, FAQ, contact et ressources pour utiliser le protocole de paiements programmables.',
  alternates: { canonical: `${SITE_URL}/aide` },
  robots: { index: true, follow: true },
};

export default function AideLayout({ children }: { children: React.ReactNode }) {
  return children;
}
