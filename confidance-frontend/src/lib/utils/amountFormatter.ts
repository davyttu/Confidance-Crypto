// lib/utils/amountFormatter.ts
import { formatEther, formatUnits } from 'viem';

/**
 * Formate un montant ETH pour affichage
 */
export function formatAmount(
  amountWei: string | bigint,
  decimals: number = 18,
  maxDecimals: number = 4
): string {
  try {
    const formatted = decimals === 18 
      ? formatEther(BigInt(amountWei))
      : formatUnits(BigInt(amountWei), decimals);
    
    const num = parseFloat(formatted);
    
    // Arrondir au nombre de décimales souhaité
    return num.toFixed(maxDecimals).replace(/\.?0+$/, '');
  } catch (error) {
    console.error('Erreur formatAmount:', error);
    return '0';
  }
}

/**
 * Formate un montant avec le symbole du token
 */
export function formatAmountWithSymbol(
  amountWei: string | bigint,
  symbol: string,
  decimals: number = 18
): string {
  const amount = formatAmount(amountWei, decimals);
  return `${amount} ${symbol}`;
}

/**
 * Formate un montant en français (avec espace comme séparateur de milliers)
 */
export function formatAmountFR(
  amountWei: string | bigint,
  decimals: number = 18
): string {
  const amount = formatAmount(amountWei, decimals);
  const num = parseFloat(amount);
  
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(num);
}

/**
 * Calcule le total d'un tableau de montants
 */
export function sumAmounts(amounts: Array<string | bigint>): bigint {
  return amounts.reduce((sum, amount) => {
    return sum + BigInt(amount);
  }, BigInt(0));
}