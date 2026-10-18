import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Documentation — Confidance Protocol Vocabulary',
  description:
    'Official Confidance vocabulary: Payment, Execution, payment types (instant, scheduled, recurring), identity, statuses, timeline, categories, and advisory AI rules.',
  alternates: { canonical: `${SITE_URL}/docs` },
  openGraph: {
    title: 'Confidance Documentation',
    description:
      'Core concepts and frozen vocabulary for the Confidance programmable payment protocol.',
    url: `${SITE_URL}/docs`,
    siteName: 'Confidance',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
