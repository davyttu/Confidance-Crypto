// src/lib/contracts/paymentFactoryAbi.ts

export const paymentFactoryAbi = [
  // createPaymentETH
  {
    inputs: [
      { name: '_payee', type: 'address' },
      { name: '_releaseTime', type: 'uint256' },
      { name: '_cancellable', type: 'bool' },
    ],
    name: 'createPaymentETH',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'payable',
    type: 'function',
  },
  // createPaymentERC20
  {
    inputs: [
      { name: '_payee', type: 'address' },
      { name: '_tokenAddress', type: 'address' },
      { name: '_amount', type: 'uint256' },
      { name: '_releaseTime', type: 'uint256' },
      { name: '_cancellable', type: 'bool' },
    ],
    name: 'createPaymentERC20',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // previewFees
  {
    inputs: [{ name: 'amount', type: 'uint256' }],
    name: 'previewFees',
    outputs: [
      { name: 'protocolFee', type: 'uint256' },
      { name: 'amountToPayee', type: 'uint256' },
    ],
    stateMutability: 'pure',
    type: 'function',
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'payer', type: 'address' },
      { indexed: true, name: 'payee', type: 'address' },
      { indexed: false, name: 'paymentContract', type: 'address' },
      { indexed: false, name: 'releaseTime', type: 'uint256' },
      { indexed: false, name: 'totalAmount', type: 'uint256' },
      { indexed: false, name: 'amountToPayee', type: 'uint256' },
      { indexed: false, name: 'protocolFee', type: 'uint256' },
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
      { indexed: false, name: 'totalAmount', type: 'uint256' },
      { indexed: false, name: 'amountToPayee', type: 'uint256' },
      { indexed: false, name: 'protocolFee', type: 'uint256' },
      { indexed: false, name: 'cancellable', type: 'bool' },
    ],
    name: 'PaymentCreatedERC20',
    type: 'event',
  },
] as const;