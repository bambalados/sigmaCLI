// PoolManager ABI - from f(x) Protocol FxUSDRegeneracy
// Core function: operate() for all position mutations
export const poolManagerAbi = [
  // Position operations (nonpayable - BNB must be wrapped to WBNB first)
  {
    type: 'function',
    name: 'operate',
    inputs: [
      { name: 'pool', type: 'address' },
      { name: 'positionId', type: 'uint256' },
      { name: 'newColl', type: 'int256' },
      { name: 'newDebt', type: 'int256' },
    ],
    outputs: [{ name: 'actualPositionId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  // Redeem bnbUSD for collateral (individual args, not arrays)
  {
    type: 'function',
    name: 'redeem',
    inputs: [
      { name: 'pool', type: 'address' },
      { name: 'debts', type: 'uint256' },
      { name: 'minColls', type: 'uint256' },
    ],
    outputs: [
      { name: 'actualDebts', type: 'uint256' },
      { name: 'colls', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
  },
  // Harvest rewards from pool
  {
    type: 'function',
    name: 'harvest',
    inputs: [{ name: 'pool', type: 'address' }],
    outputs: [
      { name: 'amountRewards', type: 'uint256' },
      { name: 'amountFunding', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
  },
  // Read functions
  {
    type: 'function',
    name: 'fxUSD',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'counterparty',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'configuration',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'rewardSplitter',
    inputs: [{ name: 'pool', type: 'address' }],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getTokenScalingFactor',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ name: 'scalingFactor', type: 'uint256' }],
    stateMutability: 'view',
  },
  // Events
  {
    type: 'event',
    name: 'Operate',
    inputs: [
      { name: 'pool', type: 'address', indexed: true },
      { name: 'position', type: 'uint256', indexed: true },
      { name: 'deltaColls', type: 'int256', indexed: false },
      { name: 'deltaDebts', type: 'int256', indexed: false },
      { name: 'protocolFees', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Redeem',
    inputs: [
      { name: 'pool', type: 'address', indexed: true },
      { name: 'colls', type: 'uint256', indexed: false },
      { name: 'debts', type: 'uint256', indexed: false },
      { name: 'protocolFees', type: 'uint256', indexed: false },
    ],
  },
] as const;
