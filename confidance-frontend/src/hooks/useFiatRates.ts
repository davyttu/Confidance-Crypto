// src/hooks/useFiatRates.ts
// Taux de conversion USD → EUR, CNY, RUB via Frankfurter (gratuit, sans clé API)

'use client';

import { useEffect, useState } from 'react';

const API_URL = 'https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR,CNY,RUB';
const CACHE_MS = 60 * 60 * 1000; // 1 heure

export type DisplayCurrency = 'USD' | 'EUR' | 'CNY' | 'RUB';

export interface FiatRates {
  EUR: number;
  CNY: number;
  RUB: number;
}

export function useFiatRates() {
  const [rates, setRates] = useState<FiatRates | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const cached = getCachedRates();
    if (cached) {
      setRates(cached);
      setIsLoading(false);
      return;
    }

    const fetchRates = async () => {
      try {
        const res = await fetch(API_URL, { cache: 'no-store', mode: 'cors' });
        if (!res.ok) throw new Error('Fetch failed');
        const data = await res.json();
        const r = data?.rates;
        if (r && typeof r.EUR === 'number' && typeof r.CNY === 'number' && typeof r.RUB === 'number') {
          const ratesData: FiatRates = { EUR: r.EUR, CNY: r.CNY, RUB: r.RUB };
          if (isMounted) {
            setRates(ratesData);
            cacheRates(ratesData);
          }
        } else {
          throw new Error('Invalid response');
        }
      } catch {
        if (isMounted) setIsError(true);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchRates();
    return () => { isMounted = false; };
  }, []);

  return { rates, isLoading, isError };
}

function getCacheKey() {
  return 'confidance_fiat_rates';
}

function getCachedRates(): FiatRates | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(getCacheKey());
    if (!raw) return null;
    const { rates, ts } = JSON.parse(raw);
    if (rates && ts && Date.now() - ts < CACHE_MS) return rates;
  } catch {}
  return null;
}

function cacheRates(rates: FiatRates) {
  try {
    localStorage.setItem(getCacheKey(), JSON.stringify({ rates, ts: Date.now() }));
  } catch {}
}

export function convertUsdTo(usd: number, currency: DisplayCurrency, rates: FiatRates | null): number {
  if (currency === 'USD' || !rates) return usd;
  const rate = rates[currency];
  return rate ? usd * rate : usd;
}

export function getCurrencySymbol(currency: DisplayCurrency): string {
  switch (currency) {
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'CNY': return '¥';
    case 'RUB': return '₽';
    default: return '$';
  }
}
