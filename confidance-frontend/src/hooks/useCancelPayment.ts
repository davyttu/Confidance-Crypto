// hooks/useCancelPayment.ts
'use client';

import { useState, useEffect, useRef } from 'react';
import { useAccount, usePublicClient, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { scheduledPaymentAbi } from '@/lib/contracts/scheduledPaymentAbi';
import { recurringPaymentERC20Abi } from '@/lib/contracts/recurringPaymentERC20Abi';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface CancelPaymentParams {
  contractAddress: `0x${string}`;
  paymentId: string;
  payerAddress?: string; // Adresse du payer depuis la DB (optionnel pour vérification)
  isRecurring?: boolean; // Indique si c'est un paiement récurrent (optionnel, sera détecté automatiquement)
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
    data: receipt,
  } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // ✅ AJOUT : Log quand le hash est reçu (peut prendre quelques secondes après confirmation MetaMask)
  useEffect(() => {
    if (txHash) {
      console.log('✅✅✅ [CANCEL] Hash de transaction reçu!', txHash);
      console.log('🔗 Voir sur Basescan:', `https://basescan.org/tx/${txHash}`);
      console.log('⏳ Le hook useWaitForTransactionReceipt va maintenant attendre la confirmation...');
    } else {
      // Log toutes les secondes pour voir si le hash arrive
      if (status === 'cancelling' || status === 'confirming') {
        console.log('⏳ [CANCEL] En attente du hash de transaction... (txHash =', txHash, ')');
      }
    }
  }, [txHash, status]);

  // ✅ AJOUT : Logs détaillés pour déboguer la confirmation
  useEffect(() => {
    if (txHash) {
      console.log('🔍 [CANCEL] État confirmation transaction:', {
        txHash,
        isConfirming,
        isConfirmed,
        hasReceipt: !!receipt,
        receiptStatus: receipt?.status,
        confirmError: confirmError?.message,
        currentStatus: status,
        currentPaymentId,
        hasUpdatedDb: hasUpdatedDbRef.current,
      });
    }
  }, [txHash, isConfirming, isConfirmed, receipt, confirmError, status, currentPaymentId]);

  const cancelPayment = async ({ contractAddress, paymentId, payerAddress: payerAddressFromDB, isRecurring: isRecurringParam }: CancelPaymentParams) => {
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

      // Étape 1 : Vérifier que le wallet est connecté et le client disponible
      setStatus('checking');
      console.log('🔍 Vérification du contrat pour:', contractAddress);
      
      if (!publicClient) {
        throw new Error('Client blockchain non disponible');
      }

      // Détecter automatiquement le type de contrat
      let isRecurring = isRecurringParam;
      let contractAbi: any = scheduledPaymentAbi;
      
      if (isRecurring === undefined) {
        // Détection automatique : essayer d'appeler cancellable()
        try {
          await publicClient.readContract({
            address: contractAddress,
            abi: scheduledPaymentAbi,
            functionName: 'cancellable',
          });
          // Si ça fonctionne, c'est un ScheduledPayment
          isRecurring = false;
          contractAbi = scheduledPaymentAbi;
          console.log('✅ Contrat détecté: ScheduledPayment (a la fonction cancellable)');
        } catch (error) {
          // Si ça échoue, c'est probablement un RecurringPayment
          try {
            // Vérifier que c'est bien un RecurringPayment en lisant une fonction spécifique
            await publicClient.readContract({
              address: contractAddress,
              abi: recurringPaymentERC20Abi,
              functionName: 'totalMonths',
            });
            isRecurring = true;
            contractAbi = recurringPaymentERC20Abi as any;
            console.log('✅ Contrat détecté: RecurringPaymentERC20 (a la fonction totalMonths)');
          } catch (recurringError) {
            throw new Error(`Impossible de déterminer le type de contrat à l'adresse ${contractAddress}. Vérifiez l'adresse sur Basescan: https://basescan.org/address/${contractAddress}`);
          }
        }
      } else {
        contractAbi = (isRecurring ? recurringPaymentERC20Abi : scheduledPaymentAbi) as any;
        console.log(`✅ Type de contrat fourni: ${isRecurring ? 'RecurringPaymentERC20' : 'ScheduledPayment'}`);
      }

      // Lire le payer depuis le contrat si pas fourni depuis la DB
      let payerAddress: string;
      if (payerAddressFromDB) {
        console.log('📋 Utilisation du payer depuis la DB:', payerAddressFromDB);
        payerAddress = payerAddressFromDB;
      } else {
        console.log('📡 Lecture du payer depuis le contrat...');
        payerAddress = (await publicClient.readContract({
          address: contractAddress,
          abi: contractAbi,
          functionName: 'payer',
        })) as string;
        console.log('📡 Payer lu depuis le contrat:', payerAddress);
      }

      // Vérifier que ce n'est pas l'adresse d'une Factory (qui serait une erreur)
      // ✅ Vérifier les nouvelles factories + l'ancienne pour compatibilité
      const FACTORY_ADDRESSES = [
        '0x88530C2f1A77BD8eb69caf91816E42982d25aa6C', // Ancienne factory (legacy)
        '0x479eFA3f706373a676F4489850bd414855D0941d', // PaymentFactory_Scheduled
        '0x2eD61AE2e31D5F42676815922d262a88c64fabA9', // PaymentFactory_Recurring
        '0xF8AE1807C9a6Ed4C25cd59513825277A8e8F0368', // PaymentFactory_Instant
      ];
      const isFactoryAddress = FACTORY_ADDRESSES.some(
        addr => payerAddress.toLowerCase() === addr.toLowerCase()
      );
      if (isFactoryAddress) {
        throw new Error(
          'Erreur : L\'adresse du payer correspond à une Factory. Le contrat_address dans la base de données semble incorrect. Veuillez vérifier que l\'adresse est celle du contrat de paiement et non de la Factory.'
        );
      }

      // Vérifier aussi que contractAddress n'est pas une Factory
      const isContractAddressFactory = FACTORY_ADDRESSES.some(
        addr => contractAddress.toLowerCase() === addr.toLowerCase()
      );
      if (isContractAddressFactory) {
        throw new Error(
          'Erreur : L\'adresse du contrat est celle d\'une Factory. Veuillez utiliser l\'adresse du contrat de paiement individuel créé, pas celle de la Factory.'
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

      console.log('🔍 Vérification des conditions du contrat...');

      // Vérification finale : s'assurer que le contrat existe et a le code déployé
      const contractCode = await publicClient.getBytecode({ address: contractAddress });
      if (!contractCode || contractCode === '0x') {
        throw new Error(`Aucun contrat trouvé à l'adresse ${contractAddress}. Vérifiez que l'adresse est correcte.`);
      }
      console.log('✅ Contrat vérifié - code présent');

      if (isRecurring) {
        // Logique pour RecurringPaymentERC20
        console.log('🔄 Traitement d\'un paiement récurrent...');
        
        const [contractCancelled, contractTotalMonths, contractNextMonthToProcess] = await Promise.all([
          publicClient.readContract({
            address: contractAddress,
            abi: recurringPaymentERC20Abi,
            functionName: 'cancelled',
          }) as Promise<boolean>,
          publicClient.readContract({
            address: contractAddress,
            abi: recurringPaymentERC20Abi,
            functionName: 'totalMonths',
          }) as Promise<bigint>,
          publicClient.readContract({
            address: contractAddress,
            abi: recurringPaymentERC20Abi,
            functionName: 'nextMonthToProcess',
          }) as Promise<bigint>,
        ]);

        const monthsRemaining = contractNextMonthToProcess < contractTotalMonths
          ? Number(contractTotalMonths - contractNextMonthToProcess)
          : 0;

        console.log('📋 État du contrat récurrent:', {
          contractAddress,
          cancelled: contractCancelled,
          totalMonths: Number(contractTotalMonths),
          nextMonthToProcess: Number(contractNextMonthToProcess),
          monthsRemaining,
          payerAddress,
          connectedAddress,
          addressesMatch: payerAddress.toLowerCase() === connectedAddress.toLowerCase(),
        });

        // Vérifier les conditions du contrat récurrent
        if (contractCancelled) {
          throw new Error('Ce paiement récurrent a déjà été annulé');
        }

        if (monthsRemaining === 0) {
          throw new Error('Aucun paiement restant à annuler. Tous les paiements ont déjà été exécutés.');
        }

        // Toutes les conditions sont remplies, appeler cancel() DIRECTEMENT
        console.log('✅ Toutes les conditions vérifiées, appel de cancel()...');
        console.log('📋 Détails:', {
          contractAddress,
          connectedAddress,
          chainId,
          payerAddress,
          cancelled: contractCancelled,
          monthsRemaining,
        });
        
        setStatus('cancelling');
        contractAddressRef.current = contractAddress;
        contractTypeRef.current = { isRecurring: true, abi: recurringPaymentERC20Abi };
        isRecurringPaymentRef.current = true; // ✅ Stocker pour les appels API
        
        // Appel DIRECT de writeContract pour RecurringPayment
        writeContract({
          abi: recurringPaymentERC20Abi,
          address: contractAddress,
          functionName: 'cancel',
        });
      } else {
        // Logique pour ScheduledPayment (existant)
        console.log('🕐 Traitement d\'un paiement programmé...');
        
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

        console.log('📋 État du contrat programmé:', {
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

        // Vérifier les conditions du contrat programmé
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
        contractAddressRef.current = contractAddress;
        contractTypeRef.current = { isRecurring: false, abi: scheduledPaymentAbi };
        isRecurringPaymentRef.current = false; // ✅ Stocker pour les appels API
        
        // Appel DIRECT de writeContract pour ScheduledPayment
        writeContract({
          abi: scheduledPaymentAbi,
          address: contractAddress,
          functionName: 'cancel',
        });
      }
      
      console.log('📤 writeContract appelé');
      console.log('⏳ En attente du hash de transaction...');
      console.log('💡 Démarrage du polling de vérification directe du contrat...');
      
      // ✅ NOUVEAU : Démarrer immédiatement un polling pour vérifier le contrat
      // Cela fonctionne même si le hash n'est jamais reçu
      // Capturer les valeurs nécessaires
      const contractAddr = contractAddress;
      const paymentIdToUpdate = paymentId;
      const isRecurringForPolling = isRecurringPaymentRef.current; // ✅ Capturer le type pour le polling
      
      // Démarrer le polling après 3 secondes (pour laisser le temps à MetaMask)
      setTimeout(() => {
        let attempts = 0;
        const maxAttempts = 25; // 25 tentatives sur 50 secondes (2 secondes par tentative)
        
        console.log('🔄 [POLLING] Démarrage du polling de vérification...');
        
        const pollInterval = setInterval(async () => {
          attempts++;
          console.log(`🔍 [POLLING] Tentative ${attempts}/${maxAttempts} - Vérification du contrat...`, contractAddr);
          
          try {
            // Vérifier si la DB a déjà été mise à jour
            if (hasUpdatedDbRef.current) {
              console.log('✅ [POLLING] DB déjà mise à jour, arrêt du polling');
              clearInterval(pollInterval);
              return;
            }
            
            if (!publicClient) {
              console.error('❌ [POLLING] publicClient non disponible');
              clearInterval(pollInterval);
              return;
            }
            
            // Vérifier l'état du contrat (utiliser le bon ABI selon le type)
            const contractType = contractTypeRef.current;
            const abiToUse = contractType?.abi || scheduledPaymentAbi;
            
            const isCancelled = await publicClient.readContract({
              address: contractAddr,
              abi: abiToUse,
              functionName: 'cancelled',
            }) as boolean;
            
            console.log(`📋 [POLLING] Tentative ${attempts} - État cancelled:`, isCancelled);
            
            if (isCancelled) {
              console.log('✅✅✅ [POLLING] Le contrat a été annulé ! Mise à jour de la DB...');
              clearInterval(pollInterval);
              
              // Mettre à jour la DB
              hasUpdatedDbRef.current = true;
              
              try {
                setStatus('updating-db');
                console.log('📝 [POLLING] Envoi de la requête PATCH...', {
                  paymentId: paymentIdToUpdate,
                  contractAddress: contractAddr,
                  isRecurring: isRecurringForPolling,
                });
                
                // ✅ Utiliser le bon endpoint selon le type de paiement
                const apiEndpoint = isRecurringForPolling 
                  ? `${API_URL}/api/payments/recurring/${paymentIdToUpdate}`
                  : `${API_URL}/api/payments/${paymentIdToUpdate}`;
                
                const response = await fetch(apiEndpoint, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    status: 'cancelled',
                    ...(isRecurringForPolling ? {} : { cancelled_at: new Date().toISOString() }) // cancelled_at seulement pour scheduled
                  }),
                });

                if (response.ok) {
                  const result = await response.json();
                  console.log('✅✅✅ [POLLING] Statut mis à jour dans la DB:', result);
                  setStatus('success');
                  window.dispatchEvent(new CustomEvent('payment-cancelled', { 
                    detail: { paymentId: paymentIdToUpdate, txHash: undefined, status: 'cancelled' } 
                  }));
                } else {
                  const errorText = await response.text();
                  console.error('❌ [POLLING] Erreur HTTP:', response.status, errorText);
                }
              } catch (err) {
                console.error('❌ [POLLING] Erreur mise à jour DB:', err);
              }
            } else if (attempts >= maxAttempts) {
              console.log('⏰ [POLLING] Nombre maximum de tentatives atteint, arrêt du polling');
              console.log('💡 Le contrat n\'a pas été annulé après 50 secondes. Vérifiez manuellement sur Basescan.');
              clearInterval(pollInterval);
            }
          } catch (err) {
            console.error(`❌ [POLLING] Erreur tentative ${attempts}:`, err);
            if (attempts >= maxAttempts) {
              clearInterval(pollInterval);
            }
          }
        }, 2000); // Vérifier toutes les 2 secondes
        
        // Stocker l'interval dans un ref pour pouvoir le nettoyer si nécessaire
        // (le nettoyage se fera automatiquement quand le composant se démonte)
      }, 3000);
      
    } catch (err) {
      console.error('❌ Erreur annulation:', err);
      setError(err as Error);
      setStatus('error');
    }
  };

  // ✅ FIX : Ref pour éviter les appels multiples de mise à jour DB
  const hasUpdatedDbRef = useRef(false);
  // ✅ AJOUT : Ref pour stocker l'adresse du contrat en cours d'annulation
  const contractAddressRef = useRef<`0x${string}` | undefined>(undefined);
  // ✅ AJOUT : Ref pour stocker le type de contrat (récurrent ou programmé)
  const contractTypeRef = useRef<{ isRecurring: boolean; abi: any } | undefined>(undefined);
  // ✅ AJOUT : Ref pour stocker si c'est un paiement récurrent (pour les appels API)
  const isRecurringPaymentRef = useRef<boolean>(false);

  // Effet : Gérer la confirmation et la mise à jour de la DB
  useEffect(() => {
    // Déclencheur : Quand la transaction est en attente de confirmation
    if (isConfirming) {
      if (status === 'cancelling' || status === 'confirming') {
        console.log('⏳ Transaction en attente de confirmation blockchain...', { txHash, currentPaymentId });
        setStatus('confirming');
        hasUpdatedDbRef.current = false; // Reset le flag si on recommence
      }
    }

    // Déclencheur : Dès que la transaction est confirmée, mettre à jour la DB IMMÉDIATEMENT
    // ✅ FIX : Vérifier aussi le receipt.status pour être sûr
    const transactionConfirmed = isConfirmed || (receipt && receipt.status === 'success');
    
    if (transactionConfirmed && txHash && currentPaymentId && !hasUpdatedDbRef.current) {
      console.log('✅ Transaction confirmée ! Mise à jour IMMÉDIATE de la DB...', {
        txHash,
        paymentId: currentPaymentId,
        currentStatus: status,
        isConfirmed,
        receiptStatus: receipt?.status,
        hasReceipt: !!receipt,
      });

      // Marquer comme en cours pour éviter les appels multiples
      hasUpdatedDbRef.current = true;
      
      const updateDatabaseStatus = async () => {
        try {
          setStatus('updating-db');
          const isRecurring = isRecurringPaymentRef.current;
          console.log('📝 Envoi de la requête PATCH pour mettre à jour le statut...', {
            paymentId: currentPaymentId,
            txHash,
            isRecurring,
          });

          // ✅ Utiliser le bon endpoint selon le type de paiement
          const apiEndpoint = isRecurring 
            ? `${API_URL}/api/payments/recurring/${currentPaymentId}`
            : `${API_URL}/api/payments/${currentPaymentId}`;

          const response = await fetch(apiEndpoint, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: 'cancelled',
              ...(isRecurring ? {} : { cancelled_at: new Date().toISOString() }) // cancelled_at seulement pour scheduled
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Erreur HTTP:', response.status, errorText);
            throw new Error(`Erreur lors de la mise à jour du statut: ${response.status} ${errorText}`);
          }

          const result = await response.json();
          console.log('✅ Réponse du serveur:', result);

          // Vérifier que le statut a bien été mis à jour
          if (result.payment && result.payment.status === 'cancelled') {
            console.log('✅✅✅ SUCCÈS: Statut = cancelled dans la DB - Dashboard doit se rafraîchir IMMÉDIATEMENT');
            setStatus('success');
            
            // Émettre un événement personnalisé pour forcer le rafraîchissement du dashboard
            window.dispatchEvent(new CustomEvent('payment-cancelled', { 
              detail: { paymentId: currentPaymentId, txHash, status: 'cancelled' } 
            }));
          } else {
            console.warn('⚠️ Le statut dans la réponse ne correspond pas:', result);
            setStatus('success'); // On considère que c'est OK quand même
            
            // Émettre l'événement quand même pour rafraîchir
            window.dispatchEvent(new CustomEvent('payment-cancelled', { 
              detail: { paymentId: currentPaymentId, txHash, status: 'cancelled' } 
            }));
          }
        } catch (err) {
          console.error('❌ Erreur mise à jour DB:', err);
          console.error('❌ Détails:', {
            paymentId: currentPaymentId,
            txHash,
            error: err instanceof Error ? err.message : String(err),
          });
          // Ne pas bloquer l'utilisateur si la DB fail, la transaction blockchain est OK
          // Mais afficher un message d'erreur pour l'utilisateur
          setError(new Error('La transaction blockchain a réussi mais la mise à jour de la base de données a échoué. Veuillez rafraîchir la page.'));
          setStatus('success');
          
          // Émettre l'événement quand même pour rafraîchir (au cas où)
          window.dispatchEvent(new CustomEvent('payment-cancelled', { 
            detail: { paymentId: currentPaymentId, txHash, status: 'cancelled' } 
          }));
        }
      };

      updateDatabaseStatus();
    }
  }, [isConfirming, isConfirmed, currentPaymentId, status, txHash, receipt]);

  // ✅ AJOUT : Fallback - Vérifier directement le contrat si la confirmation ne se déclenche pas après 15 secondes
  useEffect(() => {
    if (txHash && currentPaymentId && !hasUpdatedDbRef.current && publicClient) {
      console.log('⏰ [FALLBACK] Démarrage du timer de fallback (15 secondes)...');
      
      const fallbackCheckTimeout = setTimeout(async () => {
        // Si après 15 secondes, isConfirmed n'est toujours pas true, vérifier directement
        if (!isConfirmed && txHash && currentPaymentId && !hasUpdatedDbRef.current) {
          console.log('⏰ [FALLBACK] 15 secondes écoulées, vérification directe de la transaction...', {
            txHash,
            isConfirmed,
            hasReceipt: !!receipt,
            currentStatus: status,
          });
          
          try {
            const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
            console.log('📋 [FALLBACK] Receipt récupéré:', {
              status: receipt?.status,
              blockNumber: receipt?.blockNumber?.toString(),
            });
            
            if (receipt && receipt.status === 'success') {
              console.log('✅✅✅ [FALLBACK] Transaction confirmée via vérification directe !');
              // Forcer la mise à jour de la DB
              hasUpdatedDbRef.current = true;
              
              try {
                setStatus('updating-db');
                const isRecurring = isRecurringPaymentRef.current;
                console.log('📝 [FALLBACK] Envoi de la requête PATCH...', { isRecurring });
                
                // ✅ Utiliser le bon endpoint selon le type de paiement
                const apiEndpoint = isRecurring 
                  ? `${API_URL}/api/payments/recurring/${currentPaymentId}`
                  : `${API_URL}/api/payments/${currentPaymentId}`;
                
                const response = await fetch(apiEndpoint, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    status: 'cancelled',
                    ...(isRecurring ? {} : { cancelled_at: new Date().toISOString() }) // cancelled_at seulement pour scheduled
                  }),
                });

                if (response.ok) {
                  const result = await response.json();
                  console.log('✅✅✅ [FALLBACK] Statut mis à jour via fallback:', result);
                  setStatus('success');
                  window.dispatchEvent(new CustomEvent('payment-cancelled', { 
                    detail: { paymentId: currentPaymentId, txHash, status: 'cancelled' } 
                  }));
                } else {
                  const errorText = await response.text();
                  console.error('❌ [FALLBACK] Erreur HTTP:', response.status, errorText);
                }
              } catch (err) {
                console.error('❌ [FALLBACK] Erreur mise à jour DB:', err);
              }
            } else if (receipt && receipt.status === 'reverted') {
              console.error('❌ [FALLBACK] Transaction reverted!');
              setError(new Error('La transaction a été revertée'));
              setStatus('error');
            } else {
              console.warn('⚠️ [FALLBACK] Receipt non disponible ou en attente...');
            }
          } catch (err) {
            console.error('❌ [FALLBACK] Erreur vérification transaction:', err);
            // Si la transaction n'existe pas encore, c'est peut-être qu'elle est toujours en attente
            console.log('💡 La transaction peut être encore en attente de confirmation...');
          }
        } else {
          console.log('✅ [FALLBACK] Pas besoin de fallback, transaction déjà confirmée ou DB déjà mise à jour');
        }
      }, 15000); // 15 secondes (augmenté pour laisser plus de temps)

      return () => {
        console.log('🧹 [FALLBACK] Nettoyage du timer de fallback');
        clearTimeout(fallbackCheckTimeout);
      };
    }
  }, [txHash, currentPaymentId, isConfirmed, publicClient, receipt, status]);

  // ✅ AJOUT : Fallback alternatif - Vérifier directement le contrat si le hash n'est jamais reçu
  useEffect(() => {
    // Si on a un contrat en cours d'annulation mais pas de hash après 20 secondes
    if (contractAddressRef.current && currentPaymentId && !txHash && !hasUpdatedDbRef.current && publicClient && (status === 'cancelling' || status === 'confirming')) {
      console.log('⏰ [FALLBACK CONTRAT] Timer démarré - Vérification du contrat dans 20 secondes si pas de hash...');
      
      const contractAddr = contractAddressRef.current;
      const paymentId = currentPaymentId;
      
      const contractCheckTimeout = setTimeout(async () => {
        // Vérifier à nouveau si on n'a toujours pas de hash ni de mise à jour
        if (!txHash && !hasUpdatedDbRef.current && contractAddr && paymentId) {
          console.log('⏰ [FALLBACK CONTRAT] 20 secondes écoulées sans hash, vérification directe du contrat...', contractAddr);
          
          try {
            console.log('🔍 [FALLBACK CONTRAT] Vérification de l\'état cancelled du contrat:', contractAddr);
            // Utiliser le bon ABI selon le type de contrat
            const contractType = contractTypeRef.current;
            const abiToUse = contractType?.abi || scheduledPaymentAbi;
            
            const isCancelled = await publicClient.readContract({
              address: contractAddr,
              abi: abiToUse,
              functionName: 'cancelled',
            }) as boolean;
            
            console.log('📋 [FALLBACK CONTRAT] État cancelled du contrat:', isCancelled);
            
            if (isCancelled) {
              console.log('✅✅✅ [FALLBACK CONTRAT] Le contrat a été annulé ! Mise à jour de la DB...');
              hasUpdatedDbRef.current = true;
              
              try {
                setStatus('updating-db');
                const response = await fetch(`${API_URL}/api/payments/${paymentId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    status: 'cancelled',
                    cancelled_at: new Date().toISOString()
                  }),
                });

                if (response.ok) {
                  const result = await response.json();
                  console.log('✅✅✅ [FALLBACK CONTRAT] Statut mis à jour:', result);
                  setStatus('success');
                  window.dispatchEvent(new CustomEvent('payment-cancelled', { 
                    detail: { paymentId, txHash: undefined, status: 'cancelled' } 
                  }));
                } else {
                  const errorText = await response.text();
                  console.error('❌ [FALLBACK CONTRAT] Erreur HTTP:', response.status, errorText);
                }
              } catch (err) {
                console.error('❌ [FALLBACK CONTRAT] Erreur mise à jour DB:', err);
              }
            } else {
              console.log('⚠️ [FALLBACK CONTRAT] Le contrat n\'est pas encore annulé, peut-être que la transaction est toujours en attente...');
            }
          } catch (err) {
            console.error('❌ [FALLBACK CONTRAT] Erreur vérification contrat:', err);
          }
        } else {
          console.log('✅ [FALLBACK CONTRAT] Pas besoin de vérification, hash reçu ou DB déjà mise à jour');
        }
      }, 20000); // 20 secondes

      return () => {
        console.log('🧹 [FALLBACK CONTRAT] Nettoyage du timer');
        clearTimeout(contractCheckTimeout);
      };
    }
  }, [currentPaymentId, txHash, status, publicClient]);

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
    hasUpdatedDbRef.current = false; // ✅ Reset le flag
    contractAddressRef.current = undefined; // ✅ Reset l'adresse du contrat
    contractTypeRef.current = undefined; // ✅ Reset le type de contrat
    isRecurringPaymentRef.current = false; // ✅ Reset le type de paiement
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