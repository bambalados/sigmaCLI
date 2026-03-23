// BNBUSDBasePool (Stability Pool) ABI - from f(x) Protocol FxUSDBasePool
export const bnbusdBasePoolAbi = [
  // Deposit into stability pool
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
    stateMutability: 'nonpayable',
  },
  // Request redeem (standard withdrawal with cooldown)
  {
    type: 'function',
    name: 'requestRedeem',
    inputs: [{ name: 'shares', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Redeem after cooldown (takes receiver + shares)
  {
    type: 'function',
    name: 'redeem',
    inputs: [
      { name: 'receiver', type: 'address' },
      { name: 'shares', type: 'uint256' },
    ],
    outputs: [
      { name: 'amountYieldOut', type: 'uint256' },
      { name: 'amountStableOut', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
  },
  // Instant redeem with fee
  {
    type: 'function',
    name: 'instantRedeem',
    inputs: [
      { name: 'receiver', type: 'address' },
      { name: 'shares', type: 'uint256' },
    ],
    outputs: [
      { name: 'amountYieldOut', type: 'uint256' },
      { name: 'amountStableOut', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
  },
  // Rebalance (4-arg version)
  {
    type: 'function',
    name: 'rebalance',
    inputs: [
      { name: 'pool', type: 'address' },
      { name: 'tokenIn', type: 'address' },
      { name: 'maxAmount', type: 'uint256' },
      { name: 'minBaseOut', type: 'uint256' },
    ],
    outputs: [
      { name: 'tokenUsed', type: 'uint256' },
      { name: 'baseOut', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
  },
  // Liquidate
  {
    type: 'function',
    name: 'liquidate',
    inputs: [
      { name: 'pool', type: 'address' },
      { name: 'tokenIn', type: 'address' },
      { name: 'maxAmount', type: 'uint256' },
      { name: 'minBaseOut', type: 'uint256' },
    ],
    outputs: [
      { name: 'tokenUsed', type: 'uint256' },
      { name: 'baseOut', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
  },
  // Read functions
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
    name: 'totalYieldToken',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalStableToken',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'nav',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'redeemRequests',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [
      { name: 'amount', type: 'uint128' },
      { name: 'unlockAt', type: 'uint128' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'previewDeposit',
    inputs: [
      { name: 'tokenIn', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: 'amountSharesOut', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'previewRedeem',
    inputs: [{ name: 'amountSharesToRedeem', type: 'uint256' }],
    outputs: [
      { name: 'amountYieldOut', type: 'uint256' },
      { name: 'amountStableOut', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getStableTokenPrice',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'redeemCoolDownPeriod',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'instantRedeemFeeRatio',
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
    name: 'stableToken',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'poolManager',
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
  {
    type: 'function',
    name: 'allowance',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;
