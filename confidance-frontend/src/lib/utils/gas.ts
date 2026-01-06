// lib/utils/gas.ts
// Utilitaires pour calculer les frais de gas depuis les transaction receipts

import type { TransactionReceipt } from 'viem';

// Cache pour le prix de l'ETH (valide pendant 60 secondes)
let ethPriceCache: { price: number; timestamp: number } | null = null;
const CACHE_DURATION = 60000; // 60 secondes

/**
 * Récupère le prix actuel de l'ETH en USD depuis CoinGecko
 * Utilise un cache de 60 secondes pour éviter trop de requêtes
 */
async function getEthPriceUsd(): Promise<number> {
  // Vérifier le cache
  if (ethPriceCache && Date.now() - ethPriceCache.timestamp < CACHE_DURATION) {
    console.log('📊 Prix ETH (cache):', ethPriceCache.price, 'USD');
    return ethPriceCache.price;
  }

  try {
    // Appel à CoinGecko API (gratuit, sans clé API)
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    const price = data.ethereum?.usd;

    if (!price) {
      throw new Error('Prix ETH non disponible dans la réponse');
    }

    // Mettre à jour le cache
    ethPriceCache = { price, timestamp: Date.now() };
    console.log('📊 Prix ETH (nouveau):', price, 'USD');

    return price;
  } catch (error) {
    console.error('❌ Erreur récupération prix ETH:', error);
    // Fallback : utiliser le dernier prix connu ou une valeur par défaut
    return ethPriceCache?.price || 3000; // Prix par défaut si pas de cache
  }
}

/**
 * Calcule les frais de gas totaux depuis un transaction receipt
 * 
 * @param receipt - Transaction receipt depuis viem
 * @returns Object avec gas_used, gas_price, et total_gas_fee (en wei)
 */
export function calculateGasFromReceipt(receipt: TransactionReceipt): {
  gas_used: string;
  gas_price: string;
  total_gas_fee: string;
} {
  // gasUsed est toujours présent dans un receipt
  const gasUsed = receipt.gasUsed;
  
  // gasPrice peut être dans effectiveGasPrice (EIP-1559) ou gasPrice (legacy)
  let gasPrice: bigint;
  
  if ('effectiveGasPrice' in receipt && receipt.effectiveGasPrice) {
    // EIP-1559 transaction
    gasPrice = receipt.effectiveGasPrice;
  } else if ('gasPrice' in receipt && receipt.gasPrice) {
    // Legacy transaction
    gasPrice = receipt.gasPrice;
  } else {
    // Fallback: utiliser 0 si pas disponible (ne devrait pas arriver)
    console.warn('⚠️ gasPrice non trouvé dans le receipt, utilisation de 0');
    gasPrice = BigInt(0);
  }
  
  // Calculer le total: gasUsed * gasPrice
  const totalGasFee = gasUsed * gasPrice;
  
  return {
    gas_used: gasUsed.toString(),
    gas_price: gasPrice.toString(),
    total_gas_fee: totalGasFee.toString(),
  };
}

/**
 * Enregistre une transaction individuelle dans Supabase via l'API
 *
 * @param params - Paramètres pour l'enregistrement d'une transaction
 */
export async function saveGasTransaction(params: {
  scheduledPaymentId: string;
  userAddress: string;
  chainId: number;
  txHash: string;
  txType: 'approve' | 'create' | 'execute';
  tokenAddress: string | null;
  gasUsed: string;
  gasPrice: string;
  gasCostNative: string;
  gasCostUsd?: number;
}): Promise<void> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  try {
    // Calculer le coût en USD si non fourni
    let gasCostUsd = params.gasCostUsd;

    if (!gasCostUsd) {
      try {
        // Récupérer le prix de l'ETH
        const ethPriceUsd = await getEthPriceUsd();

        // Convertir le coût de wei en ETH puis en USD
        const gasCostEth = Number(params.gasCostNative) / 1e18;
        gasCostUsd = gasCostEth * ethPriceUsd;

        console.log('💵 Calcul coût USD:', {
          gas_cost_native: params.gasCostNative,
          gas_cost_eth: gasCostEth.toFixed(6),
          eth_price_usd: ethPriceUsd,
          gas_cost_usd: gasCostUsd.toFixed(4),
        });
      } catch (error) {
        console.error('❌ Erreur calcul coût USD:', error);
        gasCostUsd = 0;
      }
    }

    const response = await fetch(`${API_URL}/api/payment-transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scheduled_payment_id: params.scheduledPaymentId,
        user_address: params.userAddress,
        chain_id: params.chainId,
        tx_hash: params.txHash,
        tx_type: params.txType,
        token_address: params.tokenAddress,
        gas_used: params.gasUsed,
        gas_price: params.gasPrice,
        gas_cost_native: params.gasCostNative,
        gas_cost_usd: gasCostUsd,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erreur enregistrement transaction gas:', errorText);
      // Ne pas throw pour ne pas bloquer le flow principal
      return;
    }

    const result = await response.json();
    console.log('✅ Transaction gas enregistrée:', result.id || 'OK');
  } catch (error) {
    console.error('❌ Erreur API enregistrement transaction gas:', error);
    // Ne pas throw pour ne pas bloquer le flow principal
  }
}







