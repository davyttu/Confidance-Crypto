// hooks/useBeneficiaries.ts
'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAccount } from 'wagmi';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export type BeneficiaryCategory = 'Famille' | 'Travail' | 'Perso' | 'Autre';

export interface Beneficiary {
  id: string;
  user_address: string;
  beneficiary_address: string;
  display_name: string;
  category: BeneficiaryCategory | null;
  email?: string | null;
  phone?: string | null;
  created_at: string;
  updated_at: string;
}

interface UseBeneficiariesReturn {
  beneficiaries: Beneficiary[];
  isLoading: boolean;
  error: Error | null;
  createBeneficiary: (address: string, name: string, category?: BeneficiaryCategory, email?: string | null, phone?: string | null) => Promise<void>;
  updateBeneficiary: (id: string, name: string, category?: BeneficiaryCategory, email?: string | null, phone?: string | null) => Promise<void>;
  deleteBeneficiary: (id: string) => Promise<void>;
  getBeneficiaryName: (address: string) => string | null;
  refetch: () => Promise<void>;
}

export function useBeneficiaries(): UseBeneficiariesReturn {
  const { t } = useTranslation();
  const { address } = useAccount();
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchBeneficiaries = async () => {
    if (!address) {
      setBeneficiaries([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${API_URL}/api/beneficiaries/${address}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setBeneficiaries([]);
          return;
        }
        throw new Error('Erreur lors du chargement des bénéficiaires');
      }

      const data = await response.json();
      setBeneficiaries(data.beneficiaries || []);
    } catch (err) {
      console.error('Erreur useBeneficiaries:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  const createBeneficiary = async (
    beneficiaryAddress: string,
    displayName: string,
    category?: BeneficiaryCategory,
    email?: string | null,
    phone?: string | null
  ) => {
    if (!address) throw new Error(t('dashboard.auth.walletNotConnected.title', { defaultValue: 'Wallet not connected' }));

    const response = await fetch(`${API_URL}/api/beneficiaries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_address: address,
        beneficiary_address: beneficiaryAddress,
        display_name: displayName,
        category: category || null,
        email: email && String(email).trim() ? String(email).trim() : null,
        phone: phone && String(phone).trim() ? String(phone).trim() : null,
      }),
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la création du bénéficiaire');
    }

    await fetchBeneficiaries();
  };

  const updateBeneficiary = async (
    id: string,
    displayName: string,
    category?: BeneficiaryCategory,
    email?: string | null,
    phone?: string | null
  ) => {
    const response = await fetch(`${API_URL}/api/beneficiaries/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        display_name: displayName,
        category: category || null,
        email: email !== undefined ? (email && String(email).trim() ? String(email).trim() : null) : undefined,
        phone: phone !== undefined ? (phone && String(phone).trim() ? String(phone).trim() : null) : undefined,
      }),
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la mise à jour du bénéficiaire');
    }

    await fetchBeneficiaries();
  };

  const deleteBeneficiary = async (id: string) => {
    const response = await fetch(`${API_URL}/api/beneficiaries/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la suppression du bénéficiaire');
    }

    await fetchBeneficiaries();
  };

  const getBeneficiaryName = (beneficiaryAddress: string): string | null => {
    const beneficiary = beneficiaries.find(
      b => b.beneficiary_address.toLowerCase() === beneficiaryAddress.toLowerCase()
    );
    return beneficiary ? beneficiary.display_name : null;
  };

  useEffect(() => {
    fetchBeneficiaries();
  }, [address]);

  return {
    beneficiaries,
    isLoading,
    error,
    createBeneficiary,
    updateBeneficiary,
    deleteBeneficiary,
    getBeneficiaryName,
    refetch: fetchBeneficiaries,
  };
}