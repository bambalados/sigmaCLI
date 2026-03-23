// FeeDistributor ABI — Per-gauge incentive/bribe distribution
// Each gauge has its own FeeDistributor (found via Voter.feeDistributorForGauge)
// Handles depositing incentives and claiming rewards for voters
export const feeDistributorAbi = [
  // ── Write functions ──

  // Deposit incentive tokens for voters
  {
    type: 'function',
    name: 'notifyRewardAmount',
    inputs: [
      { name: '_token', type: 'address' },
      { name: '_amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Claim rewards (usually called via VoteModule.claimIncentives)
  {
    type: 'function',
    name: 'getReward',
    inputs: [
      { name: '_account', type: 'address' },
      { name: '_tokens', type: 'address[]' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // ── View functions ──

  // Get all reward token addresses
  {
    type: 'function',
    name: 'getRewardTokens',
    inputs: [],
    outputs: [{ type: 'address[]' }],
    stateMutability: 'view',
  },
  // Voter contract reference
  {
    type: 'function',
    name: 'voter',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  // First period with rewards
  {
    type: 'function',
    name: 'firstPeriod',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  // Reward for a specific period
  {
    type: 'function',
    name: 'getPeriodReward',
    inputs: [
      { name: '_period', type: 'uint256' },
      { name: '_index', type: 'uint256' },
      { name: '_account', type: 'address' },
      { name: '_token', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  // Voting power for an account
  {
    type: 'function',
    name: 'votingPower',
    inputs: [{ name: '_account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  // Total voting power
  {
    type: 'function',
    name: 'totalVotingPower',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;
