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

// ⚠️ ADRESSE DE LA FACTORY - À DÉPLOYER SUR BASE MAINNET
const FACTORY_ADDRESS: `0x${string}` = '0x0C43FDad2D0947d4b28A432125c7aB8F0c85D32A'; // TODO: Remplacer après déploiement

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
      const tokenData = getToken(params.tokenSymbol);

      // CAS 1 : ETH NATIF (1 seule transaction)
      if (tokenData.isNative) {
        setStatus('creating');
        setProgressMessage('Création du paiement ETH...');

        writeContract({
          abi: paymentFactoryAbi,
          address: FACTORY_ADDRESS,
          functionName: 'createPaymentETH',
          args: [params.beneficiary, BigInt(params.releaseTime)],
          value: params.amount,
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

          writeContract({
            abi: paymentFactoryAbi,
            address: FACTORY_ADDRESS,
            functionName: 'createPaymentERC20',
            args: [
              params.beneficiary,
              tokenData.address,
              params.amount,
              BigInt(params.releaseTime),
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

      writeContract({
        abi: paymentFactoryAbi,
        address: FACTORY_ADDRESS,
        functionName: 'createPaymentERC20',
        args: [
          currentParams.beneficiary,
          token.address,
          currentParams.amount,
          BigInt(currentParams.releaseTime),
        ],
      });
    }
  }, [approvalHook.isApproveSuccess, status]);

  // Effect : Extraction de l'adresse du contrat créé
  useEffect(() => {
    const extractContractAddress = async () => {
      if (isConfirmed && createTxHash && publicClient && !contractAddress) {
        try {
          setStatus('confirming');
          setProgressMessage('Récupération de l\'adresse du contrat...');

          const receipt = await publicClient.getTransactionReceipt({
            hash: createTxHash,
          });

          // Extraire l'adresse depuis les logs (événement PaymentCreatedETH ou PaymentCreatedERC20)
          const log = receipt.logs.find((log) => {
            // Le 3ème paramètre (non indexé) dans les events est l'adresse du contrat
            return log.topics[0] === 
              '0x...' || // Topic hash de PaymentCreatedETH
              log.topics[0] === '0x...'; // Topic hash de PaymentCreatedERC20
          });

          if (log && log.data) {
            // Décoder l'adresse depuis les logs
            // Pour simplifier, on peut aussi chercher dans receipt.contractAddress
            // ou parser les logs correctement
            const deployedAddress = `0x${log.data.slice(26, 66)}` as `0x${string}`;
            setContractAddress(deployedAddress);
            setStatus('success');
            setProgressMessage('Paiement créé avec succès !');
          } else {
            throw new Error('Impossible de trouver l\'adresse du contrat');
          }
        } catch (err) {
          console.error('Erreur extraction adresse:', err);
          setError(err as Error);
          setStatus('error');
          setProgressMessage('Erreur lors de la confirmation');
        }
      }
    };

    extractContractAddress();
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