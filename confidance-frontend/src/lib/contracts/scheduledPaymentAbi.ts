// src/lib/contracts/scheduledPaymentAbi.ts

export const scheduledPaymentAbi = [
  {
    inputs: [
      { name: '_payee', type: 'address' },
      { name: '_releaseTime', type: 'uint256' },
    ],
    stateMutability: 'payable',
    type: 'constructor',
  },
  {
    inputs: [],
    name: 'payer',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'payee',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'amount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'releaseTime',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'released',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  // ✅ AJOUT : Variables cancellable et cancelled
  {
    inputs: [],
    name: 'cancellable',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'cancelled',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'release',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // ✅ AJOUT : Fonction cancel()
  {
    inputs: [],
    name: 'cancel',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'payee', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
    name: 'Released',
    type: 'event',
  },
  // ✅ AJOUT : Event Cancelled
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'payer', type: 'address' },
      { indexed: false, name: 'refundedAmount', type: 'uint256' },
    ],
    name: 'Cancelled',
    type: 'event',
  },
] as const;