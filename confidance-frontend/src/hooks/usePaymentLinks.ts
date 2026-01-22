// src/hooks/usePaymentLinks.ts
'use client';

import { useCallback, useState } from 'react';
import type { PaymentLink } from '@/lib/Supabase/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const DEFAULT_TIMEOUT_MS = 10000;

const fetchWithTimeout = async (
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new Error('Request timeout. Please retry.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
};

export function usePaymentLinks() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createLink = useCallback(async (payload: {
    creator: string;
    amount: string;
    first_month_amount?: string | null;
    is_first_month_custom?: boolean | null;
    token: string;
    token_address?: string | null;
    payment_type: 'instant' | 'scheduled' | 'recurring';
    frequency?: 'monthly' | 'weekly' | null;
    periods?: number | null;
    start_at?: number | null;
    execute_at?: number | null;
    chain_id: number;
    description?: string | null;
    payment_label?: string | null;
    payment_categorie?: string | null;
    payment_category?: string | null;
    device_id?: string | null;
    user_agent?: string | null;
    ip_address?: string | null;
  }): Promise<PaymentLink> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchWithTimeout(`${API_URL}/api/payment-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error('Failed to create payment link');
      }
      const data = await response.json();
      return data.paymentLink as PaymentLink;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchLink = useCallback(async (id: string): Promise<PaymentLink> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchWithTimeout(`${API_URL}/api/payment-links/${id}`);
      if (!response.ok) {
        throw new Error('Payment link not found');
      }
      const data = await response.json();
      return data.paymentLink as PaymentLink;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const listLinks = useCallback(async (creator: string): Promise<PaymentLink[]> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchWithTimeout(
        `${API_URL}/api/payment-links?creator=${encodeURIComponent(creator)}`
      );
      if (!response.ok) {
        throw new Error('Failed to load payment links');
      }
      const data = await response.json();
      return (data.paymentLinks || []) as PaymentLink[];
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateLinkStatus = useCallback(async (id: string, status: string, payer_address?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchWithTimeout(`${API_URL}/api/payment-links/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, payer_address }),
      });
      if (!response.ok) {
        throw new Error('Failed to update payment link');
      }
      const data = await response.json();
      return data.paymentLink as PaymentLink;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    error,
    createLink,
    fetchLink,
    listLinks,
    updateLinkStatus,
  };
}
