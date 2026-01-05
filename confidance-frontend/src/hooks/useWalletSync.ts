// hooks/useWalletSync.ts
'use client';

import { useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { useAuth } from '@/hooks/useAuth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Hook qui enregistre automatiquement le wallet connecté dans user_wallets
 * Se déclenche une seule fois par wallet et uniquement si l'utilisateur est authentifié
 */
export function useWalletSync() {
  const { address, isConnected } = useAccount();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const syncedWallets = useRef<Set<string>>(new Set());

  useEffect(() => {
    console.log('🔍 useWalletSync - État:', { 
      isConnected, 
      address, 
      isAuthenticated,
      authLoading,
      alreadySynced: address ? syncedWallets.current.has(address.toLowerCase()) : false 
    });

    const syncWallet = async () => {
      // Conditions pour ne pas sync
      if (!isConnected || !address) {
        console.log('⏸️ Pas de sync:', { isConnected, hasAddress: !!address });
        return;
      }
      
      // Attendre que l'authentification soit chargée
      if (authLoading) {
        console.log('⏸️ En attente de l\'authentification...');
        return;
      }

      // Vérifier que l'utilisateur est authentifié
      if (!isAuthenticated) {
        console.log('⏸️ Utilisateur non authentifié, wallet non synchronisé');
        return;
      }

      if (syncedWallets.current.has(address.toLowerCase())) {
        console.log('⏸️ Wallet déjà synchronisé:', address);
        return;
      }

      try {
        console.log('🔄 Synchronisation du wallet:', address);

        // Récupérer le token depuis localStorage
        const token = localStorage.getItem('token');
        if (!token) {
          console.log('⚠️ Token non trouvé, impossible de synchroniser');
          return;
        }

        const response = await fetch(`${API_URL}/api/users/wallets`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`, // Envoyer le token dans les headers
          },
          credentials: 'include', // Envoie aussi le cookie JWT si disponible
          body: JSON.stringify({
            walletAddress: address,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log('✅ Wallet enregistré:', data.wallet);
          syncedWallets.current.add(address.toLowerCase());
        } else if (response.status === 409) {
          // Wallet déjà associé (normal)
          console.log('ℹ️ Wallet déjà enregistré');
          syncedWallets.current.add(address.toLowerCase());
        } else if (response.status === 401) {
          // Utilisateur non authentifié (token invalide ou expiré)
          console.log('⚠️ Utilisateur non authentifié, wallet non enregistré');
          // Nettoyer le token invalide
          localStorage.removeItem('token');
        } else {
          const error = await response.json();
          console.error('❌ Erreur enregistrement wallet:', error);
        }
      } catch (error) {
        console.error('❌ Erreur sync wallet:', error);
      }
    };

    syncWallet();
  }, [address, isConnected, isAuthenticated, authLoading]);

  return null;
}