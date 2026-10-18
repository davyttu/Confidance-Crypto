import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Legal Notice & Terms of Use | Confidance',
  description:
    'Legal notice for the Confidance non-custodial programmable payment protocol: architecture, fees, user responsibility, and limitations.',
  alternates: { canonical: `${SITE_URL}/legal` },
  robots: { index: true, follow: true },
};

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
