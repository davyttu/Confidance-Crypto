// src/hooks/useCreateBatchPayment.ts
// VERSION 2 : Fees s'ajoutent au montant (pas déduites)

import { useState, useEffect } from 'react';
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from 'wagmi';
import { parseEther } from 'viem';
import { paymentFactoryAbi } from '@/lib/contracts/paymentFactoryAbi';

const FACTORY_ADDRESS: `0x${string}` = '0xFc3435c0cC56E7F9cBeb32Ea664e69fD6750B197';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const FEE_PERCENTAGE = 179;
const FEE_DENOMINATOR = 10000;

export interface Beneficiary {
  address: string;
  amount: string;
  name?: string;
}

interface CreateBatchPaymentParams {
  beneficiaries: Beneficiary[];
  releaseTime: number;
  cancellable?: boolean;
}

type PaymentStatus = 
  | 'idle' 
  | 'creating' 
  | 'confirming' 
  | 'success' 
  | 'error';

interface UseCreateBatchPaymentReturn {
  status: PaymentStatus;
  error: Error | null;
  createTxHash: `0x${string}` | undefined;
  contractAddress: `0x${string}` | undefined;
  createBatchPayment: (params: CreateBatchPaymentParams) => Promise<void>;
  reset: () => void;
  progressMessage: string;
  totalToBeneficiaries: bigint | null;
  protocolFee: bigint | null;
  totalRequired: bigint | null;
}

function calculateTotalRequired(amounts: bigint[]): {
  totalToBeneficiaries: bigint;
  protocolFee: bigint;
  totalRequired: bigint;
} {
  const totalToBeneficiaries = amounts.reduce((sum, amount) => sum + amount, BigInt(0));
  const protocolFee = (totalToBeneficiaries * BigInt(FEE_PERCENTAGE)) / BigInt(FEE_DENOMINATOR);
  const totalRequired = totalToBeneficiaries + protocolFee;

  return { totalToBeneficiaries, protocolFee, totalRequired };
}

export function useCreateBatchPayment(): UseCreateBatchPaymentReturn {
  const { address } = useAccount();
  const publicClient = usePublicClient();

  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [contractAddress, setContractAddress] = useState<`0x${string}` | undefined>();
  const [progressMessage, setProgressMessage] = useState<string>('');
  
  const [totalToBeneficiaries, setTotalToBeneficiaries] = useState<bigint | null>(null);
  const [protocolFee, setProtocolFee] = useState<bigint | null>(null);
  const [totalRequired, setTotalRequired] = useState<bigint | null>(null);
  
  // ✅ FIX: Ajouter ce state
  const [currentParams, setCurrentParams] = useState<CreateBatchPaymentParams | null>(null);

  const {
    writeContract,
    data: createTxHash,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: confirmError,
  } = useWaitForTransactionReceipt({
    hash: createTxHash,
  });

  const createBatchPayment = async (params: CreateBatchPaymentParams) => {
    if (!address) {
      setError(new Error('Wallet non connecté'));
      return;
    }

    try {
      setError(null);

      if (params.beneficiaries.length === 0 || params.beneficiaries.length > 5) {
        throw new Error('Le nombre de bénéficiaires doit être entre 1 et 5');
      }

      const payees: `0x${string}`[] = [];
      const amounts: bigint[] = [];

      for (const beneficiary of params.beneficiaries) {
        if (!beneficiary.address || !/^0x[a-fA-F0-9]{40}$/.test(beneficiary.address)) {
          throw new Error(`Adresse invalide : ${beneficiary.address}`);
        }

        const amountFloat = parseFloat(beneficiary.amount);
        if (isNaN(amountFloat) || amountFloat <= 0) {
          throw new Error(`Montant invalide : ${beneficiary.amount}`);
        }

        const amountWei = parseEther(beneficiary.amount);
        
        payees.push(beneficiary.address as `0x${string}`);
        amounts.push(amountWei);
      }

      const { 
        totalToBeneficiaries: totalBenef,
        protocolFee: fee,
        totalRequired: total 
      } = calculateTotalRequired(amounts);

      setTotalToBeneficiaries(totalBenef);
      setProtocolFee(fee);
      setTotalRequired(total);
      
      // ✅ FIX: Stocker params avant writeContract
      setCurrentParams(params);

      setStatus('creating');
      setProgressMessage(
        `Création du paiement pour ${payees.length} bénéficiaire(s)...\n` +
        `Montant bénéficiaires: ${(Number(totalBenef) / 1e18).toFixed(4)} ETH\n` +
        `Fees protocole: ${(Number(fee) / 1e18).toFixed(4)} ETH\n` +
        `Total à envoyer: ${(Number(total) / 1e18).toFixed(4)} ETH`
      );

      writeContract({
        abi: paymentFactoryAbi,
        address: FACTORY_ADDRESS,
        functionName: 'createBatchPaymentETH',
        args: [
          payees,
          amounts,
          BigInt(params.releaseTime),
          params.cancellable || false,
        ],
        value: total,
      });

    } catch (err) {
      console.error('Erreur createBatchPayment:', err);
      setError(err as Error);
      setStatus('error');
      setProgressMessage('Erreur lors de la création');
    }
  };

  useEffect(() => {
    const extractAndSave = async () => {
      if (isConfirmed && createTxHash && publicClient && !contractAddress) {
        try {
          setStatus('confirming');
          setProgressMessage('Récupération de l\'adresse du contrat...');

          const receipt = await publicClient.getTransactionReceipt({
            hash: createTxHash,
          });

          let foundAddress: `0x${string}` | undefined;

          for (const log of receipt.logs) {
            if (log.address.toLowerCase() !== FACTORY_ADDRESS.toLowerCase()) {
              foundAddress = log.address as `0x${string}`;
              break;
            }
          }

          if (foundAddress) {
            setContractAddress(foundAddress);

            // ✅ FIX: Vérifier que currentParams existe
            if (currentParams && address) {
              try {
                setProgressMessage('Enregistrement...');
                
                const beneficiariesData = currentParams.beneficiaries.map(b => ({
                  address: b.address,
                  amount: b.amount,
                  name: b.name || '',
                }));

                console.log('🔥 APPEL API:', `${API_URL}/api/payments/batch`);
                console.log('📤 Body:', {
                  contract_address: foundAddress,
                  payer_address: address,
                  beneficiaries: beneficiariesData,
                });

                const response = await fetch(`${API_URL}/api/payments/batch`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    contract_address: foundAddress,
                    payer_address: address,
                    beneficiaries: beneficiariesData,
                    total_to_beneficiaries: totalToBeneficiaries?.toString(),
                    protocol_fee: protocolFee?.toString(),
                    total_sent: totalRequired?.toString(),
                    release_time: currentParams.releaseTime,
                    cancellable: currentParams.cancellable || false,
                    network: 'base_mainnet',
                    transaction_hash: createTxHash,
                  }),
                });

                console.log('📥 Response status:', response.status);

                if (!response.ok) {
                  const errorText = await response.text();
                  console.error('❌ Erreur enregistrement:', errorText);
                } else {
                  const result = await response.json();
                  console.log('✅ Enregistré:', result);
                }
              } catch (apiError) {
                console.error('❌ Erreur API:', apiError);
              }
            }

            setStatus('success');
            setProgressMessage('Paiement batch créé avec succès !');
          } else {
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
  }, [isConfirmed, createTxHash, publicClient, contractAddress, currentParams, address, totalToBeneficiaries, protocolFee, totalRequired]);

  useEffect(() => {
    if (writeError) {
      setError(writeError);
      setStatus('error');
      setProgressMessage('Transaction annulée');
    }
    if (confirmError) {
      setError(confirmError);
      setStatus('error');
      setProgressMessage('Erreur de confirmation');
    }
  }, [writeError, confirmError]);

  const reset = () => {
    setStatus('idle');
    setError(null);
    setContractAddress(undefined);
    setProgressMessage('');
    setTotalToBeneficiaries(null);
    setProtocolFee(null);
    setTotalRequired(null);
    setCurrentParams(null); // ✅ Reset aussi currentParams
    resetWrite();
  };

  return {
    status,
    error,
    createTxHash,
    contractAddress,
    createBatchPayment,
    reset,
    progressMessage,
    totalToBeneficiaries,
    protocolFee,
    totalRequired,
  };
}