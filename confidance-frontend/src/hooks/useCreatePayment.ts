// src/hooks/useCreatePayment.ts

import { useState, useEffect } from 'react';
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from 'wagmi';
import { type TokenSymbol, getToken } from '@/config/tokens';
import { useTokenApproval } from './useTokenApproval';
import { paymentFactoryAbi } from '@/lib/contracts/paymentFactoryAbi';

// ⚠️ ADRESSE DE LA FACTORY - Déployée sur Base Mainnet
const FACTORY_ADDRESS: `0x${string}` = '0xFc3435c0cC56E7F9cBeb32Ea664e69fD6750B197';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface CreatePaymentParams {
  tokenSymbol: TokenSymbol;
  beneficiary: `0x${string}`;
  amount: bigint;
  releaseTime: number; // Unix timestamp en secondes
  cancellable?: boolean; // Optionnel, par défaut false
}

type PaymentStatus = 
  | 'idle' 
  | 'approving' 
  | 'creating' 
  | 'confirming' 
  | 'success' 
  | 'error';

interface UseCreatePaymentReturn {
  // État
  status: PaymentStatus;
  error: Error | null;
  
  // Transactions
  approveTxHash: `0x${string}` | undefined;
  createTxHash: `0x${string}` | undefined;
  contractAddress: `0x${string}` | undefined;

  // Actions
  createPayment: (params: CreatePaymentParams) => Promise<void>;
  reset: () => void;

  // Progress (pour UI)
  currentStep: number; // 0, 1 ou 2
  totalSteps: number; // 1 (ETH) ou 2 (ERC20)
  progressMessage: string;
}

export function useCreatePayment(): UseCreatePaymentReturn {
  const { address } = useAccount();
  const publicClient = usePublicClient();

  // État local
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [contractAddress, setContractAddress] = useState<`0x${string}` | undefined>();
  const [currentParams, setCurrentParams] = useState<CreatePaymentParams | null>(null);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [capturedPayerAddress, setCapturedPayerAddress] = useState<`0x${string}` | undefined>(); // 🆕 AJOUTÉ

  // Hook pour écrire les transactions
  const {
    writeContract,
    data: createTxHash,
    error: writeError,
    reset: resetWrite,
    isPending: isWritePending,
  } = useWriteContract();

  // Attendre confirmation de la transaction de création
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: confirmError,
  } = useWaitForTransactionReceipt({
    hash: createTxHash,
  });

  // Hook d'approbation (pour ERC20)
  const token = currentParams ? getToken(currentParams.tokenSymbol) : null;
  const approvalHook = useTokenApproval({
    tokenSymbol: currentParams?.tokenSymbol || 'ETH',
    spenderAddress: FACTORY_ADDRESS,
    amount: currentParams?.amount || BigInt(0),
  });

  // Fonction principale de création
  const createPayment = async (params: CreatePaymentParams) => {
    if (!address) {
      setError(new Error('Wallet non connecté'));
      return;
    }

    try {
      setError(null);
      setCurrentParams(params);
      setCapturedPayerAddress(address); // 🆕 AJOUTÉ - Capture l'adresse immédiatement
      const tokenData = getToken(params.tokenSymbol);

      // CAS 1 : ETH NATIF (1 seule transaction)
      if (tokenData.isNative) {
        setStatus('creating');
        setProgressMessage('Création du paiement ETH...');

        // Le montant saisi par l'utilisateur est le montant pour le bénéficiaire
        const amountToPayee = params.amount;
        
        // Calculer les fees (1.79%)
        const protocolFee = (amountToPayee * BigInt(179)) / BigInt(10000);
        
        // Total à envoyer = montant bénéficiaire + fees
        const totalRequired = amountToPayee + protocolFee;

        console.log('💰 Calcul paiement:', {
          amountToPayee: amountToPayee.toString(),
          protocolFee: protocolFee.toString(),
          totalRequired: totalRequired.toString()
        });

        writeContract({
          abi: paymentFactoryAbi,
          address: FACTORY_ADDRESS,
          functionName: 'createPaymentETH',
          args: [
            params.beneficiary,
            amountToPayee,
            BigInt(params.releaseTime),
            params.cancellable || false,
          ],
          value: totalRequired,  // ✅ Envoyer le total calculé
        });
      }
      // CAS 2 : ERC20 (2 transactions : approve + create)
      else {
        // Vérifier si approbation nécessaire
        if (!approvalHook.isAllowanceSufficient) {
          setStatus('approving');
          setProgressMessage(`Approbation ${tokenData.symbol}...`);
          approvalHook.approve();
        } else {
          // Approbation déjà suffisante, passer directement à la création
          setStatus('creating');
          setProgressMessage('Création du paiement...');

          // ✅ FIX : Vérifier que tokenData.address existe
          if (!tokenData.address) {
            throw new Error(`Token ${params.tokenSymbol} n'a pas d'adresse de contrat`);
          }

          writeContract({
            abi: paymentFactoryAbi,
            address: FACTORY_ADDRESS,
            functionName: 'createPaymentERC20',
            args: [
              params.beneficiary,
              tokenData.address as `0x${string}`,
              params.amount,
              BigInt(params.releaseTime),
              params.cancellable || false,
            ],
          });
        }
      }
    } catch (err) {
      console.error('Erreur createPayment:', err);
      setError(err as Error);
      setStatus('error');
      setProgressMessage('Erreur lors de la création');
    }
  };

  // Effect : Passer de l'approbation à la création
  useEffect(() => {
    if (
      status === 'approving' &&
      approvalHook.isApproveSuccess &&
      currentParams &&
      token &&
      !token.isNative
    ) {
      // L'approbation est confirmée, lancer la création
      setStatus('creating');
      setProgressMessage('Création du paiement...');

      // ✅ FIX : Vérifier que token.address existe
      if (!token.address) {
        setError(new Error(`Token ${currentParams.tokenSymbol} n'a pas d'adresse de contrat`));
        setStatus('error');
        return;
      }

      writeContract({
        abi: paymentFactoryAbi,
        address: FACTORY_ADDRESS,
        functionName: 'createPaymentERC20',
        args: [
          currentParams.beneficiary,
          token.address as `0x${string}`,
          currentParams.amount,
          BigInt(currentParams.releaseTime),
          currentParams.cancellable || false,
        ],
      });
    }
  }, [approvalHook.isApproveSuccess, status]);

  // Effect : Extraction de l'adresse du contrat créé ET enregistrement Supabase
  useEffect(() => {
    const extractAndSave = async () => {
      if (isConfirmed && createTxHash && publicClient && !contractAddress) {
        try {
          setStatus('confirming');
          setProgressMessage('Récupération de l\'adresse du contrat...');

          const receipt = await publicClient.getTransactionReceipt({
            hash: createTxHash,
          });

          console.log('📋 Receipt complet:', receipt);
          console.log('📋 Nombre de logs:', receipt.logs.length);

          let foundAddress: `0x${string}` | undefined;

          // Méthode 1 : Chercher dans les logs l'adresse qui N'EST PAS la Factory
          for (let i = 0; i < receipt.logs.length; i++) {
            const log = receipt.logs[i];
            console.log(`🔍 Log ${i}:`, {
              address: log.address,
              isFactory: log.address.toLowerCase() === FACTORY_ADDRESS.toLowerCase(),
            });

            if (log.address.toLowerCase() !== FACTORY_ADDRESS.toLowerCase()) {
              foundAddress = log.address as `0x${string}`;
              console.log('✅ Contrat ScheduledPayment trouvé:', foundAddress);
              break;
            }
          }

          // Méthode 2 : Si pas trouvé, essayer de décoder les events
          if (!foundAddress) {
            console.log('⚠️ Méthode 1 échouée, essai méthode 2...');
            
            const factoryLog = receipt.logs.find(
              log => log.address.toLowerCase() === FACTORY_ADDRESS.toLowerCase()
            );

            if (factoryLog && factoryLog.data && factoryLog.data.length >= 66) {
              const addressHex = `0x${factoryLog.data.slice(26, 66)}`;
              foundAddress = addressHex as `0x${string}`;
              console.log('✅ Adresse extraite des data:', foundAddress);
            }
          }

          if (foundAddress) {
            setContractAddress(foundAddress);

            // Enregistrer dans Supabase via API
            try {
              setProgressMessage('Enregistrement dans la base de données...');
              
              // Capturer les valeurs actuelles
              const params = currentParams;
              const userAddress = capturedPayerAddress; // 🆕 MODIFIÉ - Utilise l'adresse capturée
              const tokenData = token;

              if (!params || !userAddress) {
                console.error('❌ Paramètres manquants pour enregistrement');
                console.error('❌ DEBUG:', { params, userAddress, capturedPayerAddress, address }); // 🆕 AJOUTÉ
                setStatus('success');
                setProgressMessage('Paiement créé ! (Non enregistré dans la DB)');
                return;
              }

              console.log('📤 Envoi à l\'API:', {
                contract_address: foundAddress,
                payer_address: userAddress,
                payee_address: params.beneficiary,
                release_time: params.releaseTime,
              });

              const response = await fetch(`${API_URL}/api/payments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contract_address: foundAddress,
                  payer_address: userAddress,
                  payee_address: params.beneficiary,
                  token_symbol: params.tokenSymbol,
                  token_address: tokenData?.address || null,
                  amount: params.amount.toString(),
                  release_time: params.releaseTime,
                  cancellable: params.cancellable || false,
                  network: 'base_mainnet',
                  transaction_hash: createTxHash,
                }),
              });

              if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Erreur enregistrement:', errorText);
              } else {
                const result = await response.json();
                console.log('✅ Paiement enregistré dans Supabase:', result.payment.id);
              }
            } catch (apiError) {
              console.error('❌ Erreur API:', apiError);
            }

            setStatus('success');
            setProgressMessage('Paiement créé avec succès !');
          } else {
            console.error('❌ Impossible de trouver l\'adresse');
            setStatus('success');
            setProgressMessage('Paiement créé ! (Vérifiez Basescan)');
          }
        } catch (err) {
          console.error('❌ Erreur:', err);
          setStatus('success');
          setProgressMessage('Paiement créé !');
        }
      }
    };

    extractAndSave();
  }, [isConfirmed, createTxHash, publicClient, contractAddress]);

  // Effect : Gestion des erreurs
  useEffect(() => {
    if (writeError) {
      setError(writeError);
      setStatus('error');
      setProgressMessage('Transaction annulée ou échouée');
    }
    if (confirmError) {
      setError(confirmError);
      setStatus('error');
      setProgressMessage('Erreur de confirmation');
    }
  }, [writeError, confirmError]);

  // Reset
  const reset = () => {
    setStatus('idle');
    setError(null);
    setContractAddress(undefined);
    setCurrentParams(null);
    setProgressMessage('');
    setCapturedPayerAddress(undefined); // 🆕 AJOUTÉ
    resetWrite();
    approvalHook.reset();
  };

  // Calculer les steps
  const totalSteps = token?.isNative ? 1 : 2;
  let currentStep = 0;
  if (status === 'approving') currentStep = 1;
  if (status === 'creating' || status === 'confirming') currentStep = token?.isNative ? 1 : 2;
  if (status === 'success') currentStep = totalSteps;

  return {
    status,
    error,
    approveTxHash: approvalHook.approveTxHash,
    createTxHash,
    contractAddress,
    createPayment,
    reset,
    currentStep,
    totalSteps,
    progressMessage,
  };
}
