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
import { useAuth } from '@/contexts/AuthContext';

// âš ï¸ ADRESSE DE LA FACTORY - DÃ©ployÃ©e sur Base Mainnet
const FACTORY_ADDRESS: `0x${string}` = '0xd8dEfFea55D69045dA5c30FdC075702FeFDd0542';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface CreatePaymentParams {
  tokenSymbol: TokenSymbol;
  beneficiary: `0x${string}`;
  amount: bigint;
  releaseTime: number; // Unix timestamp en secondes
  cancellable?: boolean; // Optionnel, par dÃ©faut false
}

type PaymentStatus = 
  | 'idle' 
  | 'approving' 
  | 'creating' 
  | 'confirming' 
  | 'success' 
  | 'error';

interface UseCreatePaymentReturn {
  // Ã‰tat
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

  // Guest email
  isAuthenticated: boolean;
  needsGuestEmail: boolean;
  setGuestEmail: (email: string) => void;
}

export function useCreatePayment(): UseCreatePaymentReturn {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { user, isAuthenticated } = useAuth();

  // Ã‰tat local
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [contractAddress, setContractAddress] = useState<`0x${string}` | undefined>();
  const [currentParams, setCurrentParams] = useState<CreatePaymentParams | null>(null);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [capturedPayerAddress, setCapturedPayerAddress] = useState<`0x${string}` | undefined>(); // ðŸ†• AJOUTÃ‰
  
  // Guest email
  const [guestEmail, setGuestEmail] = useState<string>('');
  const [needsGuestEmail, setNeedsGuestEmail] = useState(false);

  // Hook pour Ã©crire les transactions
  const {
    writeContract,
    data: createTxHash,
    error: writeError,
    reset: resetWrite,
    isPending: isWritePending,
  } = useWriteContract();

  // Attendre confirmation de la transaction de crÃ©ation
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

  // Fonction principale de crÃ©ation
  const createPayment = async (params: CreatePaymentParams) => {
    if (!address) {
      setError(new Error('Wallet non connectÃ©'));
      return;
    }

    try {
      setError(null);
      setCurrentParams(params);
      setCapturedPayerAddress(address); // ðŸ†• AJOUTÃ‰ - Capture l'adresse immÃ©diatement
      const tokenData = getToken(params.tokenSymbol);

      // CAS 1 : ETH NATIF (1 seule transaction)
      if (tokenData.isNative) {
        setStatus('creating');
        setProgressMessage('CrÃ©ation du paiement ETH...');

        // Le montant saisi par l'utilisateur est le montant pour le bÃ©nÃ©ficiaire
        const amountToPayee = params.amount;
        
        // Calculer les fees (1.79%)
        const protocolFee = (amountToPayee * BigInt(179)) / BigInt(10000);
        
        // Total Ã  envoyer = montant bÃ©nÃ©ficiaire + fees
        const totalRequired = amountToPayee + protocolFee;

        console.log('ðŸ’° Calcul paiement:', {
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
          value: totalRequired,  // âœ… Envoyer le total calculÃ©
        });
      }
      // CAS 2 : ERC20 (2 transactions : approve + create)
      else {
        // VÃ©rifier si approbation nÃ©cessaire
        if (!approvalHook.isAllowanceSufficient) {
          setStatus('approving');
          setProgressMessage(`Approbation ${tokenData.symbol}...`);
          approvalHook.approve();
        } else {
          // Approbation dÃ©jÃ  suffisante, passer directement Ã  la crÃ©ation
          setStatus('creating');
          setProgressMessage('CrÃ©ation du paiement...');

          // âœ… FIX : VÃ©rifier que tokenData.address existe
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
      setProgressMessage('Erreur lors de la crÃ©ation');
    }
  };

  // Effect : Passer de l'approbation Ã  la crÃ©ation
  useEffect(() => {
    if (
      status === 'approving' &&
      approvalHook.isApproveSuccess &&
      currentParams &&
      token &&
      !token.isNative
    ) {
      // L'approbation est confirmÃ©e, lancer la crÃ©ation
      setStatus('creating');
      setProgressMessage('CrÃ©ation du paiement...');

      // âœ… FIX : VÃ©rifier que token.address existe
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

  // Effect : Extraction de l'adresse du contrat crÃ©Ã© ET enregistrement Supabase
  useEffect(() => {
    const extractAndSave = async () => {
      if (isConfirmed && createTxHash && publicClient && !contractAddress) {
        try {
          setStatus('confirming');
          setProgressMessage('RÃ©cupÃ©ration de l\'adresse du contrat...');

          // ✅ FIX: Attendre 2 secondes pour être sûr que le receipt existe
        await new Promise(resolve => setTimeout(resolve, 2000));

          const receipt = await publicClient.getTransactionReceipt({
            hash: createTxHash,
          });

          console.log('ðŸ“‹ Receipt complet:', receipt);
          console.log('ðŸ“‹ Nombre de logs:', receipt.logs.length);

          let foundAddress: `0x${string}` | undefined;

          // MÃ©thode 1 : Chercher dans les logs l'adresse qui N'EST PAS la Factory
          for (let i = 0; i < receipt.logs.length; i++) {
            const log = receipt.logs[i];
            console.log(`ðŸ” Log ${i}:`, {
              address: log.address,
              isFactory: log.address.toLowerCase() === FACTORY_ADDRESS.toLowerCase(),
            });

            if (log.address.toLowerCase() !== FACTORY_ADDRESS.toLowerCase()) {
              foundAddress = log.address as `0x${string}`;
              console.log('âœ… Contrat ScheduledPayment trouvÃ©:', foundAddress);
              break;
            }
          }

          // MÃ©thode 2 : Si pas trouvÃ©, essayer de dÃ©coder les events
          if (!foundAddress) {
            console.log('âš ï¸ MÃ©thode 1 Ã©chouÃ©e, essai mÃ©thode 2...');
            
            const factoryLog = receipt.logs.find(
              log => log.address.toLowerCase() === FACTORY_ADDRESS.toLowerCase()
            );

            if (factoryLog && factoryLog.data && factoryLog.data.length >= 66) {
              const addressHex = `0x${factoryLog.data.slice(26, 66)}`;
              foundAddress = addressHex as `0x${string}`;
              console.log('âœ… Adresse extraite des data:', foundAddress);
            }
          }

          if (foundAddress) {
            setContractAddress(foundAddress);

            // Enregistrer dans Supabase via API
            try {
              setProgressMessage('Enregistrement dans la base de donnÃ©es...');
              
              // Capturer les valeurs actuelles
              const params = currentParams;
              const userAddress = capturedPayerAddress; // ðŸ†• MODIFIÃ‰ - Utilise l'adresse capturÃ©e
              const tokenData = token;

              if (!params || !userAddress) {
                console.error('âŒ ParamÃ¨tres manquants pour enregistrement');
                console.error('âŒ DEBUG:', { params, userAddress, capturedPayerAddress, address }); // ðŸ†• AJOUTÃ‰
                setStatus('success');
                setProgressMessage('Paiement crÃ©Ã© ! (Non enregistrÃ© dans la DB)');
                return;
              }

              console.log('ðŸ“¤ Envoi Ã  l\'API:', {
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
                  // Utilisateur connecté OU invité
                  ...(isAuthenticated && user ? { user_id: user.id } : { guest_email: guestEmail }),
                }),
              });

              if (!response.ok) {
                const errorText = await response.text();
                console.error('âŒ Erreur enregistrement:', errorText);
              } else {
                const result = await response.json();
                console.log('âœ… Paiement enregistrÃ© dans Supabase:', result.payment.id);
              }
            } catch (apiError) {
              console.error('âŒ Erreur API:', apiError);
            }

            setStatus('success');
            setProgressMessage('Paiement crÃ©Ã© avec succÃ¨s !');
          } else {
            console.error('âŒ Impossible de trouver l\'adresse');
            setStatus('success');
            setProgressMessage('Paiement crÃ©Ã© ! (VÃ©rifiez Basescan)');
          }
        } catch (err) {
          console.error('âŒ Erreur:', err);
          setStatus('success');
          setProgressMessage('Paiement crÃ©Ã© !');
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
      setProgressMessage('Transaction annulÃ©e ou Ã©chouÃ©e');
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
    setCapturedPayerAddress(undefined); // ðŸ†• AJOUTÃ‰
    setGuestEmail('');
    setNeedsGuestEmail(false);
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
    isAuthenticated,
    needsGuestEmail,
    setGuestEmail,
  };
}