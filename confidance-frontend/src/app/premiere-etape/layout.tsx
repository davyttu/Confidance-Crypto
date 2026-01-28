import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Guide : Créer votre Wallet Crypto | Confidance',
  description:
    'Apprenez à créer votre premier wallet crypto en moins de 5 minutes. Guide complet pour débuter avec Confidance et la DeFi.',
  keywords: ['wallet crypto', 'créer wallet', 'MetaMask', 'DeFi', 'Confidance', 'guide débutant'],
};

export default function PremiereEtapeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
