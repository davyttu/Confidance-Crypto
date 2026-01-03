// lib/utils/amountFormatter.ts
import { formatEther, formatUnits } from 'viem';

/**
 * Formate un montant ETH pour affichage
 */
export function formatAmount(
  amountWei: string | bigint,
  decimals: number = 18,
  maxDecimals: number = 8
): string {
  try {
    const formatted = decimals === 18 
      ? formatEther(BigInt(amountWei))
      : formatUnits(BigInt(amountWei), decimals);
    
    const num = parseFloat(formatted);
    
    // Si le montant est 0, retourner "0"
    if (num === 0) return '0';
    
    // Déterminer le nombre de décimales nécessaires
    let effectiveDecimals = maxDecimals;
    
    // Pour les stablecoins (6 décimales) comme USDC/USDT, utiliser moins de décimales
    if (decimals === 6) {
      // USDC/USDT : toujours afficher 2-4 décimales max
      if (num < 0.01 && num > 0) {
        effectiveDecimals = 4;
      } else {
        effectiveDecimals = 2;
      }
    } else {
      // Pour ETH et autres tokens (18 décimales)
      if (num < 0.0001 && num > 0) {
        effectiveDecimals = 8;
      } else if (num < 0.01 && num > 0) {
        effectiveDecimals = 6;
      } else if (num < 1 && num > 0) {
        effectiveDecimals = 4;
      } else {
        effectiveDecimals = 2;
      }
    }
    
    // Formater avec le bon nombre de décimales et supprimer les zéros inutiles
    return num.toFixed(effectiveDecimals).replace(/\.?0+$/, '');
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