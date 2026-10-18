import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Guide : Créer votre Wallet Crypto | Confidance',
  description:
    'Apprenez à créer votre premier wallet crypto en moins de 5 minutes. Guide complet pour débuter avec Confidance et la DeFi.',
  keywords: ['wallet crypto', 'créer wallet', 'MetaMask', 'DeFi', 'Confidance', 'guide débutant'],
  alternates: { canonical: `${SITE_URL}/premiere-etape` },
  robots: { index: true, follow: true },
};

export default function PremiereEtapeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
