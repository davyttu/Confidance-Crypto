import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { useAuth } from './useAuth';

/**
 * Hook pour lier automatiquement le wallet à l'utilisateur connecté
 * S'exécute automatiquement quand :
 * - L'utilisateur est connecté (isAuthenticated)
 * - Un wallet est connecté (address)
 */
export function useLinkWallet() {
  const { address, isConnected } = useAccount();
  const { isAuthenticated, user } = useAuth();
  const [isLinking, setIsLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Ne rien faire si pas authentifié ou pas de wallet
    if (!isAuthenticated || !isConnected || !address || !user) {
      return;
    }

    // Éviter les double appels
    if (isLinking) {
      return;
    }

    // Fonction pour lier le wallet
    const linkWallet = async () => {
      try {
        setIsLinking(true);
        setError(null);

        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        if (!token) {
          console.log('⏭️ [AUTO-LINK] Pas de token, liaison ignorée');
          setIsLinking(false);
          return;
        }

        console.log('🔗 [AUTO-LINK] Tentative de liaison du wallet', address, 'pour user', user.email);

        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
        const response = await fetch(`${backendUrl}/api/link-wallet`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            wallet_address: address
          })
        });

        // Vérifier si la réponse est bien du JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.warn('⚠️ [AUTO-LINK] Backend non disponible ou route incorrecte');
          return;
        }

        const data = await response.json();

        if (response.ok) {
          console.log('✅ [AUTO-LINK] Wallet lié avec succès');
        } else {
          // Si "Non authentifié", c'est normal (utilisateur pas encore chargé)
          if (data.error === 'Non authentifié') {
            console.log('⏭️ [AUTO-LINK] Utilisateur non authentifié, ignoré');
            return;
          }
          console.error('❌ [AUTO-LINK] Erreur:', data.error);
          setError(data.error);
        }
      } catch (err: any) {
        // Ne pas afficher d'erreur si c'est juste que le backend n'est pas disponible
        if (err.message?.includes('JSON') || err.message?.includes('DOCTYPE')) {
          console.warn('⚠️ [AUTO-LINK] Backend non disponible, ignoré');
        } else {
          console.error('❌ [AUTO-LINK] Erreur réseau:', err);
          setError('Erreur de connexion');
        }
      } finally {
        setIsLinking(false);
      }
    };

    // Attendre 2 secondes après la connexion avant de lier
    // (pour s'assurer que le token d'auth est bien chargé)
    const timer = setTimeout(() => {
      linkWallet();
    }, 2000);

    return () => clearTimeout(timer);
  }, [isAuthenticated, isConnected, address, user?.id]);

  return { isLinking, error };
}
