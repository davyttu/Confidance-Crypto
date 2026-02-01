'use client';

import { useEffect, useRef } from 'react';
import { useConnect } from 'wagmi';
import { toast } from 'sonner';

const TARGET_CHAIN = process.env.NEXT_PUBLIC_CHAIN;
const IS_BASE_SEPOLIA = TARGET_CHAIN === 'base_sepolia';

const BASE_SEPOLIA_PARAMS = {
  chainId: '0x14a34', // 84532
  chainName: 'Base Sepolia',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://sepolia.base.org'],
  blockExplorerUrls: ['https://sepolia.basescan.org'],
};

/**
 * Affiche un toast quand la connexion wallet échoue (ex. "Failed to connect to MetaMask")
 * et guide l'utilisateur (débloquer MetaMask, ajouter le réseau, déconnecter le site puis réessayer).
 */
export function WalletConnectErrorHandler() {
  const { error, isError, status } = useConnect();
  const lastErrorRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isError || !error?.message || status !== 'idle') return;
    const msg = error.message;
    if (msg === lastErrorRef.current) return;
    lastErrorRef.current = msg;

    const isMetaMask = /metamask|Failed to connect/i.test(msg);

    const addNetworkHint = IS_BASE_SEPOLIA
      ? ' Ajoutez le réseau "Base Sepolia" dans MetaMask (Paramètres > Réseaux > Ajouter un réseau) puis réessayez.'
      : '';

    const description = [
      addNetworkHint || 'Vérifiez que le wallet est déverrouillé.',
      'Déconnectez ce site dans MetaMask (Paramètres → Sites connectés) puis réessayez.',
    ].join(' ');

    toast.error(
      isMetaMask ? 'Connexion MetaMask impossible' : 'Connexion wallet impossible',
      {
        description,
        duration: 10000,
        ...(IS_BASE_SEPOLIA && {
          action: {
            label: 'Ajouter Base Sepolia',
            onClick: () => addBaseSepoliaToWallet().then((ok) => ok && toast.success('Réseau ajouté. Réessayez de vous connecter.')),
          },
        }),
      }
    );

    return () => {
      lastErrorRef.current = null;
    };
  }, [isError, error?.message, status]);

  return null;
}

/**
 * Appeler depuis window pour ajouter Base Sepolia dans MetaMask (utile si l’utilisateur n’a pas le réseau).
 */
function getEthereum(): { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
}

export async function addBaseSepoliaToWallet(): Promise<boolean> {
  const ethereum = getEthereum();
  if (!ethereum) return false;
  try {
    await ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [BASE_SEPOLIA_PARAMS],
    });
    return true;
  } catch {
    return false;
  }
}
