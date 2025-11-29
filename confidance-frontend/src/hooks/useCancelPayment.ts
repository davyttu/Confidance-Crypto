// hooks/useCancelPayment.ts
'use client';

import { useState, useEffect } from 'react';
import { useAccount, usePublicClient, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { scheduledPaymentAbi } from '@/lib/contracts/scheduledPaymentAbi';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface CancelPaymentParams {
  contractAddress: `0x${string}`;
  paymentId: string;
  payerAddress?: string; // Adresse du payer depuis la DB (optionnel pour vérification)
}

type CancelStatus = 'idle' | 'checking' | 'cancelling' | 'confirming' | 'updating-db' | 'success' | 'error';

interface UseCancelPaymentReturn {
  cancelPayment: (params: CancelPaymentParams) => Promise<void>;
  status: CancelStatus;
  error: Error | null;
  txHash: `0x${string}` | undefined;
  reset: () => void;
}

export function useCancelPayment(): UseCancelPaymentReturn {
  const { address: connectedAddress, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient();
  const [status, setStatus] = useState<CancelStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [currentPaymentId, setCurrentPaymentId] = useState<string | null>(null);

  const {
    writeContract,
    data: txHash,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: confirmError,
  } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const cancelPayment = async ({ contractAddress, paymentId, payerAddress: payerAddressFromDB }: CancelPaymentParams) => {
    try {
      setError(null);
      setCurrentPaymentId(paymentId);

      // Étape 0 : Vérifier que le wallet est connecté
      if (!connectedAddress || !isConnected) {
        throw new Error('Veuillez connecter votre wallet pour annuler le paiement');
      }

      // Vérifier le chainId (Base Mainnet = 8453)
      if (chainId !== 8453) {
        throw new Error(`Vous devez être connecté à Base Mainnet (chainId: 8453). Vous êtes actuellement sur chainId: ${chainId}`);
      }

      // Étape 1 : Vérifier que l'adresse connectée correspond au payer
      setStatus('checking');
      console.log('🔍 Vérification du payer pour:', contractAddress);
      
      let payerAddress: string;
      
      // Utiliser payerAddress depuis la DB si disponible, sinon lire depuis le contrat
      if (payerAddressFromDB) {
        console.log('📋 Utilisation du payer depuis la DB:', payerAddressFromDB);
        payerAddress = payerAddressFromDB;
      } else {
        if (!publicClient) {
          throw new Error('Client blockchain non disponible');
        }
        
        // Lire l'adresse du payer directement depuis le contrat
        console.log('📡 Lecture du payer depuis le contrat...');
        payerAddress = (await publicClient.readContract({
          address: contractAddress,
          abi: scheduledPaymentAbi,
          functionName: 'payer',
        })) as string;
        
        console.log('📡 Payer lu depuis le contrat:', payerAddress);
      }

      // Vérifier que ce n'est pas l'adresse de la Factory (qui serait une erreur)
      const FACTORY_ADDRESS = '0x7F80CB9c88b1993e8267dab207f33EDf8f4ef744';
      if (payerAddress.toLowerCase() === FACTORY_ADDRESS.toLowerCase()) {
        throw new Error(
          'Erreur : L\'adresse du payer correspond à la Factory. Le contrat_address dans la base de données semble incorrect. Veuillez vérifier que l\'adresse est celle du ScheduledPayment et non de la Factory.'
        );
      }

      // Vérifier aussi que contractAddress n'est pas la Factory
      if (contractAddress.toLowerCase() === FACTORY_ADDRESS.toLowerCase()) {
        throw new Error(
          'Erreur : L\'adresse du contrat est celle de la Factory. Veuillez utiliser l\'adresse du ScheduledPayment individuel créé, pas celle de la Factory.'
        );
      }

      // Vérifier que l'adresse connectée correspond au payer (comparaison case-insensitive)
      const payerAddressLower = payerAddress.toLowerCase();
      const connectedAddressLower = connectedAddress.toLowerCase();

      if (payerAddressLower !== connectedAddressLower) {
        throw new Error(
          `Seul le créateur du paiement peut l'annuler. Adresse requise: ${payerAddress}, Adresse connectée: ${connectedAddress}`
        );
      }

      // Vérifier toutes les conditions du contrat avant d'appeler cancel()
      if (!publicClient) {
        throw new Error('Client blockchain non disponible');
      }

      console.log('🔍 Vérification des conditions du contrat...');
      
      // Lire toutes les variables nécessaires depuis le contrat
      const [contractCancellable, contractCancelled, contractReleased, contractReleaseTime] = await Promise.all([
        publicClient.readContract({
          address: contractAddress,
          abi: scheduledPaymentAbi,
          functionName: 'cancellable',
        }) as Promise<boolean>,
        publicClient.readContract({
          address: contractAddress,
          abi: scheduledPaymentAbi,
          functionName: 'cancelled',
        }) as Promise<boolean>,
        publicClient.readContract({
          address: contractAddress,
          abi: scheduledPaymentAbi,
          functionName: 'released',
        }) as Promise<boolean>,
        publicClient.readContract({
          address: contractAddress,
          abi: scheduledPaymentAbi,
          functionName: 'releaseTime',
        }) as Promise<bigint>,
      ]);

      console.log('📋 État du contrat:', {
        contractAddress,
        cancellable: contractCancellable,
        cancelled: contractCancelled,
        released: contractReleased,
        releaseTime: Number(contractReleaseTime),
        releaseTimeReadable: new Date(Number(contractReleaseTime) * 1000).toLocaleString('fr-FR'),
        currentTime: Math.floor(Date.now() / 1000),
        currentTimeReadable: new Date().toLocaleString('fr-FR'),
        timeUntilRelease: Number(contractReleaseTime) - Math.floor(Date.now() / 1000),
        payerAddress,
        connectedAddress,
        addressesMatch: payerAddress.toLowerCase() === connectedAddress.toLowerCase(),
      });

      // Vérifier les conditions du contrat
      if (!contractCancellable) {
        throw new Error('Ce paiement n\'est pas annulable (cancellable = false)');
      }

      if (contractCancelled) {
        throw new Error('Ce paiement a déjà été annulé');
      }

      if (contractReleased) {
        throw new Error('Ce paiement a déjà été libéré, il ne peut plus être annulé');
      }

      const currentTime = Math.floor(Date.now() / 1000);
      const releaseTimeNumber = Number(contractReleaseTime);
      
      if (currentTime >= releaseTimeNumber) {
        const releaseDate = new Date(releaseTimeNumber * 1000).toLocaleString('fr-FR');
        throw new Error(
          `Trop tard pour annuler ! La date de libération (${releaseDate}) est déjà passée. Vous ne pouvez annuler qu'avant cette date.`
        );
      }

      // Vérification finale : s'assurer que le contrat existe et a le code déployé
      const contractCode = await publicClient.getBytecode({ address: contractAddress });
      if (!contractCode || contractCode === '0x') {
        throw new Error(`Aucun contrat trouvé à l'adresse ${contractAddress}. Vérifiez que l'adresse est correcte.`);
      }
      console.log('✅ Contrat vérifié - code présent');

      // Vérification supplémentaire : s'assurer que le contrat a bien la fonction cancel()
      // En essayant de lire les fonctions view du contrat
      try {
        const contractPayer = await publicClient.readContract({
          address: contractAddress,
          abi: scheduledPaymentAbi,
          functionName: 'payer',
        });
        console.log('✅ Contrat a bien la structure ScheduledPayment (payer trouvé:', contractPayer, ')');
        
        // Vérifier que le contrat a bien les fonctions nécessaires
        // On essaie de lire cancellable qui devrait exister dans ScheduledPayment V2
        try {
          await publicClient.readContract({
            address: contractAddress,
            abi: scheduledPaymentAbi,
            functionName: 'cancellable',
          });
          console.log('✅ Contrat a bien la fonction cancellable() - C\'est un ScheduledPayment V2');
        } catch (cancellableError) {
          console.warn('⚠️ ATTENTION: Le contrat n\'a peut-être pas la fonction cancellable(). Vérifiez sur Basescan si c\'est bien un ScheduledPayment V2:');
          console.warn(`   https://basescan.org/address/${contractAddress}`);
          console.warn('   Si c\'est une ancienne version du contrat, elle n\'a peut-être pas la fonction cancel()');
        }
      } catch (verifyError) {
        console.error('❌ Erreur vérification structure contrat:', verifyError);
        throw new Error(`Le contrat à l'adresse ${contractAddress} ne semble pas être un ScheduledPayment valide. Vérifiez l'adresse sur Basescan: https://basescan.org/address/${contractAddress}`);
      }

      // Toutes les conditions sont remplies, appeler cancel() DIRECTEMENT
      console.log('✅ Toutes les conditions vérifiées, appel de cancel()...');
      console.log('📋 Détails:', {
        contractAddress,
        connectedAddress,
        chainId,
        payerAddress,
        cancellable: contractCancellable,
        cancelled: contractCancelled,
        released: contractReleased,
      });
      
      setStatus('cancelling');
      
      // Appel DIRECT de writeContract, comme dans useCreatePayment
      writeContract({
        abi: scheduledPaymentAbi,
        address: contractAddress,
        functionName: 'cancel',
      });
      
      console.log('📤 writeContract appelé');
      
    } catch (err) {
      console.error('❌ Erreur annulation:', err);
      setError(err as Error);
      setStatus('error');
    }
  };

  // Effet : Gérer la confirmation et la mise à jour de la DB
  useEffect(() => {
    const updateDatabaseStatus = async () => {
      if (isConfirmed && currentPaymentId) {
        try {
          setStatus('updating-db');
          console.log('📝 Mise à jour du statut dans la base de données...');

          const response = await fetch(`${API_URL}/api/payments/${currentPaymentId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: 'cancelled',
              cancelled_at: new Date().toISOString()
            }),
          });

          if (!response.ok) {
            throw new Error('Erreur lors de la mise à jour du statut');
          }

          const result = await response.json();
          console.log('✅ Statut mis à jour:', result);

          setStatus('success');
        } catch (err) {
          console.error('❌ Erreur mise à jour DB:', err);
          // Ne pas bloquer l'utilisateur si la DB fail, la transaction blockchain est OK
          setStatus('success');
        }
      }
    };

    // Déclencheur : Quand la transaction est confirmée
    if (isConfirming && status !== 'confirming') {
      setStatus('confirming');
    }

    if (isConfirmed && status === 'confirming') {
      updateDatabaseStatus();
    }
  }, [isConfirming, isConfirmed, currentPaymentId, status]);

  // Effet : Gestion des erreurs de writeContract
  useEffect(() => {
    if (writeError && (status === 'cancelling' || status === 'checking')) {
      console.error('❌ Erreur writeContract:', writeError);
      console.error('❌ Détails erreur:', JSON.stringify(writeError, null, 2));
      
      // Analyser l'erreur pour donner un message plus clair
      let errorMessage = 'Erreur lors de la préparation de la transaction';
      
      if (writeError instanceof Error) {
        const errorMsg = writeError.message.toLowerCase();
        
        if (errorMsg.includes('unauthorized') || errorMsg.includes('permission')) {
          errorMessage = 'Erreur de permissions MetaMask. Veuillez :\n1. Vérifier que vous êtes connecté avec le bon compte\n2. Rafraîchir la page et réessayer\n3. Vérifier que MetaMask est à jour';
        } else if (errorMsg.includes('user rejected') || errorMsg.includes('user denied')) {
          errorMessage = 'Transaction annulée par l\'utilisateur';
        } else if (errorMsg.includes('insufficient funds')) {
          errorMessage = 'Fonds insuffisants pour payer les frais de transaction (gas)';
        } else if (errorMsg.includes('execution reverted')) {
          errorMessage = 'La transaction a été rejetée par le contrat. Une des conditions d\'annulation n\'est pas remplie.';
        } else if (errorMsg.includes('missing data')) {
          errorMessage = 'Erreur: Données manquantes. Vérifiez que le contrat est correctement configuré.';
        } else {
          errorMessage = `Erreur: ${writeError.message}`;
        }
      } else {
        // Si l'erreur n'est pas une Error, essayer de la convertir
        const errorStr = String(writeError);
        if (errorStr.includes('unauthorized') || errorStr.includes('permission')) {
          errorMessage = 'Erreur de permissions MetaMask. Veuillez rafraîchir la page et réessayer.';
        }
      }
      
      setError(new Error(errorMessage));
      setStatus('error');
    }
  }, [writeError, status]);

  useEffect(() => {
    if (confirmError && status !== 'error') {
      console.error('❌ Erreur confirmation:', confirmError);
      setError(confirmError as Error);
      setStatus('error');
    }
  }, [confirmError, status]);

  const reset = () => {
    setStatus('idle');
    setError(null);
    setCurrentPaymentId(null);
    resetWrite();
  };

  return {
    cancelPayment,
    status,
    error,
    txHash,
    reset,
  };
}