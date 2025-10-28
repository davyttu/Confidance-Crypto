// src/config/tokens.ts

export type TokenSymbol = 'ETH' | 'USDC' | 'USDT' | 'cbBTC' | 'WBTC';

export interface Token {
  symbol: TokenSymbol;
  name: string;
  address: `0x${string}` | 'NATIVE';
  decimals: number;
  icon: string; // Chemin vers l'icône dans /public/tokens/
  isNative: boolean;
  color: string; // Couleur pour l'UI
  gradient: string; // Dégradé pour les cards
  description?: string; // Description courte pour l'UI
}

// Adresses VÉRIFIÉES sur Base Mainnet (chainId: 8453)
// Source: Basescan (octobre 2025)
export const SUPPORTED_TOKENS: Record<TokenSymbol, Token> = {
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    address: 'NATIVE',
    decimals: 18,
    icon: '/tokens/eth.svg',
    isNative: true,
    color: '#627EEA',
    gradient: 'from-[#627EEA] to-[#8A92B2]',
    description: 'Token natif Base',
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    decimals: 6,
    icon: '/tokens/usdc.svg',
    isNative: false,
    color: '#2775CA',
    gradient: 'from-[#2775CA] to-[#5B9FE3]',
    description: 'Stablecoin dollar',
  },
  USDT: {
    symbol: 'USDT',
    name: 'Tether USD',
    address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
    decimals: 6,
    icon: '/tokens/usdt.svg',
    isNative: false,
    color: '#26A17B',
    gradient: 'from-[#26A17B] to-[#50AF95]',
    description: 'Stablecoin dollar',
  },
  cbBTC: {
    symbol: 'cbBTC',
    name: 'Coinbase Wrapped BTC',
    address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
    decimals: 8,
    icon: '/tokens/cbbtc.svg',
    isNative: false,
    color: '#F7931A',
    gradient: 'from-[#F7931A] to-[#FBB034]',
    description: 'Bitcoin wrapped officiel Coinbase',
  },
  WBTC: {
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    address: '0x0555E30da8f98308EdB960aa94C0Db47230d2B9c',
    decimals: 8,
    icon: '/tokens/wbtc.svg',
    isNative: false,
    color: '#F09242',
    gradient: 'from-[#F09242] to-[#F5AC6B]',
    description: 'Bitcoin wrapped standard',
  },
};

// Helper pour obtenir un token par symbole
export const getToken = (symbol: TokenSymbol): Token => {
  return SUPPORTED_TOKENS[symbol];
};

// Liste des tokens pour l'UI
export const TOKEN_LIST: Token[] = Object.values(SUPPORTED_TOKENS);

// Tokens recommandés (affichés en premier)
export const RECOMMENDED_TOKENS: TokenSymbol[] = ['ETH', 'USDC', 'cbBTC'];

// Helper pour filtrer les tokens Bitcoin
export const BTC_TOKENS: TokenSymbol[] = ['cbBTC', 'WBTC'];

// Protocole fees
export const PROTOCOL_FEE_PERCENTAGE = 1.79; // 1.79%
export const PROTOCOL_WALLET = '0xa34eDf91Cc494450000Eef08e6563062B2F115a9' as const;

// Helper pour calculer les fees
// ✅ V2 - Fees additives
export const calculateFees = (amountToPayee: bigint, decimals: number) => {
  const feeBasisPoints = BigInt(179); // 1.79%
  const protocolFee = (amountToPayee * feeBasisPoints) / BigInt(10000);
  const totalRequired = amountToPayee + protocolFee;
  
  return {
    totalAmount: totalRequired,      // Ce que l'user envoie
    protocolFee: protocolFee,        // Les fees (1.79%)
    recipientAmount: amountToPayee,  // Ce que reçoit le bénéficiaire
  };
};

// Helper pour formater les montants
export const formatTokenAmount = (
  amount: bigint,
  decimals: number,
  symbol: TokenSymbol
): string => {
  const divisor = BigInt(10 ** decimals);
  const integerPart = amount / divisor;
  const fractionalPart = amount % divisor;
  
  const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
  const trimmedFractional = fractionalStr.replace(/0+$/, '');
  
  if (trimmedFractional === '') {
    return `${integerPart} ${symbol}`;
  }
  
  return `${integerPart}.${trimmedFractional} ${symbol}`;
};