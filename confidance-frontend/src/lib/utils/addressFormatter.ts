// lib/utils/addressFormatter.ts
/**
 * Tronque une adresse Ethereum pour affichage
 * 0x1234567890abcdef... → 0x1234...cdef
 */
export function truncateAddress(
  address: string,
  startChars: number = 6,
  endChars: number = 4
): string {
  if (!address || address.length < startChars + endChars) {
    return address;
  }
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Copie une adresse dans le presse-papiers
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Erreur copie presse-papier:', error);
    return false;
  }
}

/**
 * Formate un hash de transaction pour affichage
 */
export function formatTxHash(hash: string | null): string {
  if (!hash) return 'N/A';
  return truncateAddress(hash, 8, 6);
}