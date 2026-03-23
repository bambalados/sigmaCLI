// Curve Pool ABIs (Vyper-style snake_case)
// factory-stable-ng uses dynamic uint256[] arrays
// factory-twocrypto uses fixed uint256[2] arrays

// Shared read functions
const sharedAbi = [
  {
    type: 'function',
    name: 'get_virtual_price',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'balances',
    inputs: [{ name: 'i', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'coins',
    inputs: [{ name: 'i', type: 'uint256' }],
    outputs: [{ type: 'address' }],
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
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
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

// factory-stable-ng pools (dynamic arrays)
export const curvePoolAbi = [
  {
    type: 'function',
    name: 'exchange',
    inputs: [
      { name: 'i', type: 'int128' },
      { name: 'j', type: 'int128' },
      { name: 'dx', type: 'uint256' },
      { name: 'min_dy', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'get_dy',
    inputs: [
      { name: 'i', type: 'int128' },
      { name: 'j', type: 'int128' },
      { name: 'dx', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'add_liquidity',
    inputs: [
      { name: 'amounts', type: 'uint256[]' },
      { name: 'min_mint_amount', type: 'uint256' },
      { name: 'receiver', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'remove_liquidity',
    inputs: [
      { name: '_amount', type: 'uint256' },
      { name: 'min_amounts', type: 'uint256[]' },
      { name: 'receiver', type: 'address' },
    ],
    outputs: [{ type: 'uint256[]' }],
    stateMutability: 'nonpayable',
  },
  ...sharedAbi,
] as const;

// factory-twocrypto pools (fixed uint256[2] arrays)
export const curveTwocryptoAbi = [
  {
    type: 'function',
    name: 'add_liquidity',
    inputs: [
      { name: 'amounts', type: 'uint256[2]' },
      { name: 'min_mint_amount', type: 'uint256' },
      { name: 'receiver', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'remove_liquidity',
    inputs: [
      { name: '_amount', type: 'uint256' },
      { name: 'min_amounts', type: 'uint256[2]' },
      { name: 'receiver', type: 'address' },
    ],
    outputs: [{ type: 'uint256[2]' }],
    stateMutability: 'nonpayable',
  },
  ...sharedAbi,
] as const;
