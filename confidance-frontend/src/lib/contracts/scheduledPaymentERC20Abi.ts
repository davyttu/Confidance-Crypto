// src/lib/contracts/scheduledPaymentERC20Abi.ts

export const scheduledPaymentERC20Abi = [
  {
    inputs: [
      { name: '_payee', type: 'address' },
      { name: '_tokenAddress', type: 'address' },
      { name: '_amount', type: 'uint256' },
      { name: '_releaseTime', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
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
    name: 'tokenAddress',
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
  {
    inputs: [],
    name: 'release',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getAmounts',
    outputs: [
      { name: 'totalAmount', type: 'uint256' },
      { name: 'protocolFee', type: 'uint256' },
      { name: 'recipientAmount', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'payee', type: 'address' },
      { indexed: false, name: 'recipientAmount', type: 'uint256' },
      { indexed: false, name: 'protocolFee', type: 'uint256' },
    ],
    name: 'Released',
    type: 'event',
  },
] as const;