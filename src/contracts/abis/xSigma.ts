// xSIGMA ABI — New migrated contract (Shadow/Solidly-style vesting model)
// Contract: 0x66A24749dFaF0DB981a0bbB2C3A8aB70292e8442
// Migrated 2026-03-18 from old xSIGMA 0x5876123273560059cb5798f10e2990ed493247a9
export const xSigmaAbi = [
  // ── Write functions ──

  // Convert SIGMA emissions to xSIGMA (1:1, used by minter/operator)
  {
    type: 'function',
    name: 'convertEmissionsToken',
    inputs: [{ name: '_amount', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Instant exit xSIGMA → SIGMA with slashing penalty
  {
    type: 'function',
    name: 'exit',
    inputs: [{ name: '_amount', type: 'uint256' }],
    outputs: [{ name: '_exitedAmount', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  // Create a linear vesting position (xSIGMA locked, SIGMA received over time)
  {
    type: 'function',
    name: 'createVest',
    inputs: [{ name: '_amount', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Exit (cancel) a specific vest by ID, receiving vested portion
  {
    type: 'function',
    name: 'exitVest',
    inputs: [{ name: '_vestID', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Trigger rebase distribution
  {
    type: 'function',
    name: 'rebase',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Operator redeem
  {
    type: 'function',
    name: 'operatorRedeem',
    inputs: [{ name: '_amount', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // ── View functions ──

  // Pending rebase amount
  {
    type: 'function',
    name: 'pendingRebase',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  // Balance of SIGMA residing in contract
  {
    type: 'function',
    name: 'getBalanceResiding',
    inputs: [],
    outputs: [{ name: '_amount', type: 'uint256' }],
    stateMutability: 'view',
  },
  // Vest info for a specific vest
  {
    type: 'function',
    name: 'vestInfo',
    inputs: [
      { name: '', type: 'address' },
      { name: '', type: 'uint256' },
    ],
    outputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'start', type: 'uint256' },
      { name: 'maxEnd', type: 'uint256' },
      { name: 'vestID', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  // Total number of vests for an address
  {
    type: 'function',
    name: 'usersTotalVests',
    inputs: [{ name: '_who', type: 'address' }],
    outputs: [{ name: '_length', type: 'uint256' }],
    stateMutability: 'view',
  },
  // Slashing penalty for instant exit (basis points or percentage)
  {
    type: 'function',
    name: 'SLASHING_PENALTY',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  // Max vest duration (seconds)
  {
    type: 'function',
    name: 'MAX_VEST',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  // Min vest duration (seconds)
  {
    type: 'function',
    name: 'MIN_VEST',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  // Whether rebase has been started
  {
    type: 'function',
    name: 'rebaseStarted',
    inputs: [],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  // Whether contract is paused
  {
    type: 'function',
    name: 'paused',
    inputs: [],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },

  // ── ERC-20 standard ──

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
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;
