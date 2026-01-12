// src/lib/contracts/paymentFactoryAbi.ts

export const paymentFactoryAbi = [
  // ============================================================
  // SINGLE PAYMENT ETH
  // ============================================================
  {
    inputs: [
      { name: '_payee', type: 'address' },
      { name: '_amountToPayee', type: 'uint256' },
      { name: '_releaseTime', type: 'uint256' },
      { name: '_cancellable', type: 'bool' },
    ],
    name: 'createPaymentETH',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'payable',
    type: 'function',
  },

  // ============================================================
  // SINGLE PAYMENT ERC20
  // ============================================================
  {
    inputs: [
      { name: '_payee', type: 'address' },
      { name: '_tokenAddress', type: 'address' },
      { name: '_amountToPayee', type: 'uint256' },
      { name: '_releaseTime', type: 'uint256' },
      { name: '_cancellable', type: 'bool' },
    ],
    name: 'createPaymentERC20',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },

  // ============================================================
  // BATCH PAYMENT ETH
  // ============================================================
  {
    inputs: [
      { name: '_payees', type: 'address[]' },
      { name: '_amounts', type: 'uint256[]' },
      { name: '_releaseTime', type: 'uint256' },
      { name: '_cancellable', type: 'bool' },
    ],
    name: 'createBatchPaymentETH',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'payable',
    type: 'function',
  },

  // ============================================================
  // BATCH PAYMENT ERC20
  // ============================================================
  {
    inputs: [
      { name: '_tokenAddress', type: 'address' },
      { name: '_payees', type: 'address[]' },
      { name: '_amounts', type: 'uint256[]' },
      { name: '_releaseTime', type: 'uint256' },
      { name: '_cancellable', type: 'bool' },
    ],
    name: 'createBatchPaymentERC20',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },

  // ============================================================
  // 🆕 RECURRING PAYMENT ERC20 - ✅ ORDRE PARAMÈTRES CORRIGÉ
  // ============================================================
  {
    inputs: [
      { name: '_payee', type: 'address' },
      { name: '_tokenAddress', type: 'address' },
      { name: '_monthlyAmount', type: 'uint256' },
      { name: '_firstPaymentTime', type: 'uint256' },
      { name: '_totalMonths', type: 'uint256' },
      { name: '_dayOfMonth', type: 'uint256' },
    ],
    name: 'createRecurringPaymentERC20',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },

  // ============================================================
  // ⚡ INSTANT PAYMENT ETH - 0% FEES
  // ============================================================
  {
    inputs: [
      { name: '_payee', type: 'address' },
    ],
    name: 'createInstantPaymentETH',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'payable',
    type: 'function',
  },

  // ============================================================
  // ⚡ INSTANT PAYMENT ERC20 - 0% FEES
  // ============================================================
  {
    inputs: [
      { name: '_payee', type: 'address' },
      { name: '_tokenAddress', type: 'address' },
      { name: '_amount', type: 'uint256' },
    ],
    name: 'createInstantPaymentERC20',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },

  // ============================================================
  // ⚡ INSTANT BATCH PAYMENT ETH - 0% FEES
  // ============================================================
  {
    inputs: [
      { name: '_payees', type: 'address[]' },
      { name: '_amounts', type: 'uint256[]' },
    ],
    name: 'createInstantBatchPaymentETH',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },

  // ============================================================
  // ⚡ INSTANT BATCH PAYMENT ERC20 - 0% FEES
  // ============================================================
  {
    inputs: [
      { name: '_tokenAddress', type: 'address' },
      { name: '_payees', type: 'address[]' },
      { name: '_amounts', type: 'uint256[]' },
    ],
    name: 'createInstantBatchPaymentERC20',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },

  // ============================================================
  // HELPERS
  // ============================================================
  {
    inputs: [{ name: 'amountToPayee', type: 'uint256' }],
    name: 'calculateSingleTotal',
    outputs: [
      { name: 'protocolFee', type: 'uint256' },
      { name: 'totalRequired', type: 'uint256' },
    ],
    stateMutability: 'pure',
    type: 'function',
  },
  {
    inputs: [{ name: 'amounts', type: 'uint256[]' }],
    name: 'calculateBatchTotal',
    outputs: [
      { name: 'totalToBeneficiaries', type: 'uint256' },
      { name: 'protocolFee', type: 'uint256' },
      { name: 'totalRequired', type: 'uint256' },
    ],
    stateMutability: 'pure',
    type: 'function',
  },
  {
    inputs: [
      { name: 'monthlyAmount', type: 'uint256' },
      { name: 'totalMonths', type: 'uint256' },
    ],
    name: 'calculateRecurringTotal',
    outputs: [
      { name: 'protocolFeePerMonth', type: 'uint256' },
      { name: 'totalPerMonth', type: 'uint256' },
      { name: 'totalRequired', type: 'uint256' },
    ],
    stateMutability: 'pure',
    type: 'function',
  },
  {
    inputs: [{ name: 'amount', type: 'uint256' }],
    name: 'previewFee',
    outputs: [{ name: 'fee', type: 'uint256' }],
    stateMutability: 'pure',
    type: 'function',
  },

  // ============================================================
  // EVENTS
  // ============================================================
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'payer', type: 'address' },
      { indexed: true, name: 'payee', type: 'address' },
      { indexed: false, name: 'paymentContract', type: 'address' },
      { indexed: false, name: 'releaseTime', type: 'uint256' },
      { indexed: false, name: 'amountToPayee', type: 'uint256' },
      { indexed: false, name: 'protocolFee', type: 'uint256' },
      { indexed: false, name: 'totalSent', type: 'uint256' },
      { indexed: false, name: 'cancellable', type: 'bool' },
    ],
    name: 'PaymentCreatedETH',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'payer', type: 'address' },
      { indexed: true, name: 'payee', type: 'address' },
      { indexed: true, name: 'tokenAddress', type: 'address' },
      { indexed: false, name: 'paymentContract', type: 'address' },
      { indexed: false, name: 'releaseTime', type: 'uint256' },
      { indexed: false, name: 'amountToPayee', type: 'uint256' },
      { indexed: false, name: 'protocolFee', type: 'uint256' },
      { indexed: false, name: 'cancellable', type: 'bool' },
    ],
    name: 'PaymentCreatedERC20',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'payer', type: 'address' },
      { indexed: false, name: 'paymentContract', type: 'address' },
      { indexed: false, name: 'beneficiariesCount', type: 'uint256' },
      { indexed: false, name: 'totalToBeneficiaries', type: 'uint256' },
      { indexed: false, name: 'protocolFee', type: 'uint256' },
      { indexed: false, name: 'totalSent', type: 'uint256' },
      { indexed: false, name: 'releaseTime', type: 'uint256' },
      { indexed: false, name: 'cancellable', type: 'bool' },
    ],
    name: 'BatchPaymentCreatedETH',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'payer', type: 'address' },
      { indexed: false, name: 'paymentContract', type: 'address' },
      { indexed: true, name: 'tokenAddress', type: 'address' },
      { indexed: false, name: 'beneficiariesCount', type: 'uint256' },
      { indexed: false, name: 'totalToBeneficiaries', type: 'uint256' },
      { indexed: false, name: 'protocolFee', type: 'uint256' },
      { indexed: false, name: 'releaseTime', type: 'uint256' },
      { indexed: false, name: 'cancellable', type: 'bool' },
    ],
    name: 'BatchPaymentCreatedERC20',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'payer', type: 'address' },
      { indexed: true, name: 'payee', type: 'address' },
      { indexed: true, name: 'tokenAddress', type: 'address' },
      { indexed: false, name: 'paymentContract', type: 'address' },
      { indexed: false, name: 'monthlyAmount', type: 'uint256' },
      { indexed: false, name: 'protocolFeePerMonth', type: 'uint256' },
      { indexed: false, name: 'startDate', type: 'uint256' },
      { indexed: false, name: 'totalMonths', type: 'uint256' },
    ],
    name: 'RecurringPaymentCreatedERC20',
    type: 'event',
  },

  // ============================================================
  // ⚡ INSTANT PAYMENT EVENTS
  // ============================================================
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'payer', type: 'address' },
      { indexed: true, name: 'payee', type: 'address' },
      { indexed: false, name: 'paymentContract', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'timestamp', type: 'uint256' },
    ],
    name: 'InstantPaymentCreatedETH',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'payer', type: 'address' },
      { indexed: true, name: 'payee', type: 'address' },
      { indexed: true, name: 'tokenAddress', type: 'address' },
      { indexed: false, name: 'paymentContract', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'timestamp', type: 'uint256' },
    ],
    name: 'InstantPaymentCreatedERC20',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'payer', type: 'address' },
      { indexed: false, name: 'beneficiariesCount', type: 'uint256' },
      { indexed: false, name: 'totalAmount', type: 'uint256' },
      { indexed: false, name: 'timestamp', type: 'uint256' },
    ],
    name: 'InstantBatchPaymentCreatedETH',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'payer', type: 'address' },
      { indexed: true, name: 'tokenAddress', type: 'address' },
      { indexed: false, name: 'beneficiariesCount', type: 'uint256' },
      { indexed: false, name: 'totalAmount', type: 'uint256' },
      { indexed: false, name: 'timestamp', type: 'uint256' },
    ],
    name: 'InstantBatchPaymentCreatedERC20',
    type: 'event',
  },

  // ============================================================
  // CONSTANTS (optionnel, pour lecture)
  // ============================================================
  {
    inputs: [],
    name: 'PROTOCOL_WALLET',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'FEE_BASIS_POINTS',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// ✅ Export séparés pour les deux factories
// Les deux factories partagent la même interface ABI
// Wagmi n'appellera que les fonctions disponibles sur chaque contrat
export const paymentFactoryScheduledAbi = paymentFactoryAbi;
export const paymentFactoryInstantAbi = paymentFactoryAbi;