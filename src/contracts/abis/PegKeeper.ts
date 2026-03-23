// PegKeeper ABI - maintains bnbUSD peg
export const pegKeeperAbi = [
  {
    type: 'function',
    name: 'getFxUSDPrice',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isBorrowAllowed',
    inputs: [],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isRedeemAllowed',
    inputs: [],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isFundingEnabled',
    inputs: [],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'fxUSD',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'stable',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'curvePool',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'priceThreshold',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  // PegKeeper operations
  {
    type: 'function',
    name: 'buyback',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'bonusOut', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'stabilize',
    inputs: [
      { name: 'srcToken', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'bonusOut', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
  },
] as const;
