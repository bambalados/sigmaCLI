// VoteModule ABI — Shadow/Solidly-style staking module for xSIGMA
// Contract: 0x3FAb767ff8340973a87975Db13999fD1eaf99965
// Staking xSIGMA here grants voting power (voting itself is on Voter contract)
// Also handles staking rewards (getReward = claim rebase)
export const voteModuleAbi = [
  // ── Write functions ──

  // Stake xSIGMA into VoteModule
  {
    type: 'function',
    name: 'deposit',
    inputs: [{ name: '_amount', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Stake all xSIGMA balance
  {
    type: 'function',
    name: 'depositAll',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Unstake xSIGMA from VoteModule
  {
    type: 'function',
    name: 'withdraw',
    inputs: [{ name: '_amount', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Unstake all xSIGMA
  {
    type: 'function',
    name: 'withdrawAll',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Claim staking rewards (rebase distribution)
  {
    type: 'function',
    name: 'getReward',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // ── View functions ──

  // Total staked xSIGMA
  {
    type: 'function',
    name: 'totalSupply',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  // User's staked xSIGMA balance
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: '_account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  // User's earned rewards
  {
    type: 'function',
    name: 'earned',
    inputs: [{ name: '_account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  // Period finish timestamp
  {
    type: 'function',
    name: 'periodFinish',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  // xSIGMA token address
  {
    type: 'function',
    name: 'xShadow',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  // Voter contract address
  {
    type: 'function',
    name: 'voter',
    inputs: [],
    outputs: [{ type: 'address' }],
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
