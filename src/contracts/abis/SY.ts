// SY (Standardized Yield) wrapper ABI
export const syAbi = [
  {
    type: 'function',
    name: 'deposit',
    inputs: [
      { name: 'receiver', type: 'address' },
      { name: 'tokenIn', type: 'address' },
      { name: 'amountTokenToDeposit', type: 'uint256' },
      { name: 'minSharesOut', type: 'uint256' },
    ],
    outputs: [{ name: 'amountSharesOut', type: 'uint256' }],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'redeem',
    inputs: [
      { name: 'receiver', type: 'address' },
      { name: 'amountSharesToRedeem', type: 'uint256' },
      { name: 'tokenOut', type: 'address' },
      { name: 'minTokenOut', type: 'uint256' },
      { name: 'burnFromInternalBalance', type: 'bool' },
    ],
    outputs: [{ name: 'amountTokenOut', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'exchangeRate',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalSupply',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'yieldToken',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'approve',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const;
