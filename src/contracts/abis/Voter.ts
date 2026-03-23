// Voter ABI — Shadow/Solidly-style gauge voter
// Contract: 0x3E8832E6395A148e4Db357E659E887CB7580F56E
// Manages gauges, maps gauges↔pools, tracks vote weights
// Handles: vote, reset, poke, claimIncentives (these are on Voter, NOT VoteModule)
export const voterAbi = [
  // ── Write functions ──

  // Vote on gauge emission allocation (takes POOLS, not gauges!)
  {
    type: 'function',
    name: 'vote',
    inputs: [
      { name: '_user', type: 'address' },
      { name: '_pools', type: 'address[]' },
      { name: '_weights', type: 'uint256[]' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Reset all votes
  {
    type: 'function',
    name: 'reset',
    inputs: [{ name: '_user', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Refresh/update vote weights
  {
    type: 'function',
    name: 'poke',
    inputs: [{ name: '_user', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Claim vote incentives from fee distributors
  {
    type: 'function',
    name: 'claimIncentives',
    inputs: [
      { name: '_owner', type: 'address' },
      { name: '_feeDistributors', type: 'address[]' },
      { name: '_tokens', type: 'address[][]' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Distribute emissions to all gauges (permissionless epoch flipper)
  {
    type: 'function',
    name: 'distributeAll',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // ── View functions ──

  // Get all registered gauges
  {
    type: 'function',
    name: 'getAllGauges',
    inputs: [],
    outputs: [{ type: 'address[]' }],
    stateMutability: 'view',
  },
  // Check if gauge is alive (receiving emissions)
  {
    type: 'function',
    name: 'isAlive',
    inputs: [{ name: '_gauge', type: 'address' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  // Check if address is a registered gauge
  {
    type: 'function',
    name: 'isGauge',
    inputs: [{ name: '_gauge', type: 'address' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  // Get pool address for a gauge
  {
    type: 'function',
    name: 'poolForGauge',
    inputs: [{ name: '_gauge', type: 'address' }],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  // Get gauge address for a pool
  {
    type: 'function',
    name: 'gaugeForPool',
    inputs: [{ name: '_pool', type: 'address' }],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  // Get fee distributor (incentive contract) for a gauge
  {
    type: 'function',
    name: 'feeDistributorForGauge',
    inputs: [{ name: '_gauge', type: 'address' }],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  // Get user's vote allocation for a given period
  {
    type: 'function',
    name: 'getVotes',
    inputs: [
      { name: '_user', type: 'address' },
      { name: '_period', type: 'uint256' },
    ],
    outputs: [
      { name: 'votes', type: 'address[]' },
      { name: 'weights', type: 'uint256[]' },
    ],
    stateMutability: 'view',
  },
  // Get current period number (block.timestamp / 1 week)
  {
    type: 'function',
    name: 'getPeriod',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  // Access hub address
  {
    type: 'function',
    name: 'accessHub',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
] as const;
