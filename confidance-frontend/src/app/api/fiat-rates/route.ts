// app/api/fiat-rates/route.ts
// Proxie Frankfurter (BCE) pour taux de change réels

import { NextResponse } from 'next/server';

const SOURCES = [
  'https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR,CNY,RUB',
  'https://api.frankfurter.app/latest?from=USD&to=EUR,CNY,RUB',
];

const TIMEOUT_MS = 8000;

async function fetchWithTimeout(url: string, opts: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...opts,
      cache: 'no-store',
      signal: ctrl.signal,
      headers: { 'Accept': 'application/json' },
    });
    return res;
  } finally {
    clearTimeout(id);
  }
}

function parseRates(data: unknown): { EUR: number; CNY: number; RUB: number } | null {
  const r = (data as { rates?: Record<string, number> })?.rates;
  if (!r || typeof r.EUR !== 'number' || typeof r.CNY !== 'number' || typeof r.RUB !== 'number') {
    return null;
  }
  return { EUR: r.EUR, CNY: r.CNY, RUB: r.RUB };
}

export async function GET() {
  for (const url of SOURCES) {
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) continue;
      const data = await res.json();
      const rates = parseRates(data);
      if (rates) {
        return NextResponse.json(rates);
      }
    } catch (err) {
      console.warn('[fiat-rates] Source failed:', url, (err as Error)?.message ?? err);
    }
  }
  return NextResponse.json(
    { error: 'Failed to fetch exchange rates from any source' },
    { status: 500 }
  );
}
