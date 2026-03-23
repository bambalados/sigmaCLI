// SigmaController / bnbUSD token contract
// Handles minting bnbUSD from collateral, redeeming, wrapping/unwrapping
export const sigmaControllerAbi = [
  // Minting
  { type: 'function', name: 'mint', inputs: [{ name: 'baseToken', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'receiver', type: 'address' }, { name: 'minOut', type: 'uint256' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'nonpayable' },
  { type: 'function', name: 'mintAndEarn', inputs: [{ name: 'baseToken', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'receiver', type: 'address' }, { name: 'minOut', type: 'uint256' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'nonpayable' },
  { type: 'function', name: 'earn', inputs: [{ name: 'baseToken', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'receiver', type: 'address' }], outputs: [], stateMutability: 'nonpayable' },

  // Redeeming
  { type: 'function', name: 'redeem', inputs: [{ name: '_baseToken', type: 'address' }, { name: '_amountIn', type: 'uint256' }, { name: '_receiver', type: 'address' }, { name: '_minOut', type: 'uint256' }], outputs: [{ name: '_amountOut', type: 'uint256' }, { name: '_bonusOut', type: 'uint256' }], stateMutability: 'nonpayable' },
  { type: 'function', name: 'redeemFrom', inputs: [{ name: '_pool', type: 'address' }, { name: '_amountIn', type: 'uint256' }, { name: '_receiver', type: 'address' }, { name: '_minOut', type: 'uint256' }], outputs: [{ name: '_amountOut', type: 'uint256' }, { name: '_bonusOut', type: 'uint256' }], stateMutability: 'nonpayable' },
  { type: 'function', name: 'autoRedeem', inputs: [{ name: '_amountIn', type: 'uint256' }, { name: '_receiver', type: 'address' }, { name: '_minOuts', type: 'uint256[]' }], outputs: [{ name: '_baseTokens', type: 'address[]' }, { name: '_amountOuts', type: 'uint256[]' }, { name: '_bonusOuts', type: 'uint256[]' }], stateMutability: 'nonpayable' },

  // Wrapping
  { type: 'function', name: 'wrap', inputs: [{ name: '_baseToken', type: 'address' }, { name: '_amount', type: 'uint256' }, { name: '_receiver', type: 'address' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'unwrap', inputs: [{ name: '_baseToken', type: 'address' }, { name: '_amount', type: 'uint256' }, { name: '_receiver', type: 'address' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'wrapFrom', inputs: [{ name: '_pool', type: 'address' }, { name: '_amount', type: 'uint256' }, { name: '_receiver', type: 'address' }], outputs: [], stateMutability: 'nonpayable' },

  // Buyback
  { type: 'function', name: 'buyback', inputs: [{ name: 'amountIn', type: 'uint256' }, { name: 'receiver', type: 'address' }, { name: 'data', type: 'bytes' }], outputs: [{ name: 'amountOut', type: 'uint256' }, { name: 'bonusOut', type: 'uint256' }], stateMutability: 'nonpayable' },

  // View functions
  { type: 'function', name: 'getMarkets', inputs: [], outputs: [{ name: '_tokens', type: 'address[]' }], stateMutability: 'view' },
  { type: 'function', name: 'getRebalancePools', inputs: [], outputs: [{ name: '_pools', type: 'address[]' }], stateMutability: 'view' },
  { type: 'function', name: 'nav', inputs: [], outputs: [{ name: '_nav', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'isUnderCollateral', inputs: [], outputs: [{ name: '', type: 'bool' }], stateMutability: 'view' },
  { type: 'function', name: 'poolManager', inputs: [], outputs: [{ name: '', type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'stableToken', inputs: [], outputs: [{ name: '', type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'pegKeeper', inputs: [], outputs: [{ name: '', type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'legacyTotalSupply', inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },

  // ERC20
  { type: 'function', name: 'name', inputs: [], outputs: [{ name: '', type: 'string' }], stateMutability: 'view' },
  { type: 'function', name: 'symbol', inputs: [], outputs: [{ name: '', type: 'string' }], stateMutability: 'view' },
  { type: 'function', name: 'decimals', inputs: [], outputs: [{ name: '', type: 'uint8' }], stateMutability: 'view' },
  { type: 'function', name: 'totalSupply', inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'balanceOf', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'allowance', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'approve', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable' },
  { type: 'function', name: 'transfer', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable' },
  { type: 'function', name: 'transferFrom', inputs: [{ name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable' },
] as const;
