/**
 * Custom ERC20 tokens registered by the user (max 3, persisted in localStorage).
 * Used only in the payment form; contracts are token-agnostic.
 */

export type CustomToken = {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
};

const STORAGE_KEY = 'confidance.customTokens';
const MAX_CUSTOM_TOKENS = 3;

export function getCustomTokens(): CustomToken[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const normalized = parsed
      .filter(
        (item): item is CustomToken =>
          item &&
          typeof item === 'object' &&
          typeof item.address === 'string' &&
          typeof item.name === 'string' &&
          typeof item.symbol === 'string' &&
          typeof item.decimals === 'number'
      )
      .map((item) => ({
        address: item.address.trim(),
        name: String(item.name).trim(),
        symbol: String(item.symbol).trim().toUpperCase() || '???',
        decimals: Math.min(18, Math.max(0, Math.floor(item.decimals))),
      }))
      .filter((item) => /^0x[a-fA-F0-9]{40}$/.test(item.address))
      .slice(0, MAX_CUSTOM_TOKENS);
    return normalized;
  } catch {
    return [];
  }
}

export function saveCustomTokens(tokens: CustomToken[]): void {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = tokens
      .slice(0, MAX_CUSTOM_TOKENS)
      .map((t) => ({
        address: t.address.trim(),
        name: t.name.trim(),
        symbol: t.symbol.trim().toUpperCase() || '???',
        decimals: Math.min(18, Math.max(0, Math.floor(t.decimals))),
      }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore
  }
}

export function addCustomToken(token: CustomToken): CustomToken[] {
  const current = getCustomTokens();
  const exists = current.some(
    (t) => t.address.toLowerCase() === token.address.toLowerCase()
  );
  if (exists) {
    return current.map((t) =>
      t.address.toLowerCase() === token.address.toLowerCase() ? token : t
    );
  }
  const next = [...current, token].slice(0, MAX_CUSTOM_TOKENS);
  saveCustomTokens(next);
  return next;
}

export { MAX_CUSTOM_TOKENS };
