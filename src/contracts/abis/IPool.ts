// IPool interface — the actual pool contracts that hold leveraged positions
// Positions are NFTs; each pool has collateralToken, priceOracle, debt ratio thresholds
export const iPoolAbi = [
  // Position queries
  { type: 'function', name: 'getPosition', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: 'rawColls', type: 'uint256' }, { name: 'rawDebts', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'getPositionDebtRatio', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: 'debtRatio', type: 'uint256' }], stateMutability: 'view' },

  // Pool parameters
  { type: 'function', name: 'getDebtRatioRange', inputs: [], outputs: [{ name: 'minDebtRatio', type: 'uint256' }, { name: 'maxDebtRatio', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'getRebalanceRatios', inputs: [], outputs: [{ name: 'debtRatio', type: 'uint256' }, { name: 'bonusRatio', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'getLiquidateRatios', inputs: [], outputs: [{ name: 'debtRatio', type: 'uint256' }, { name: 'bonusRatio', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'getDebtAndCollateralIndex', inputs: [], outputs: [{ name: 'debtIndex', type: 'uint256' }, { name: 'collIndex', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'getDebtAndCollateralShares', inputs: [], outputs: [{ name: 'debtShares', type: 'uint256' }, { name: 'collShares', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'getMaxRedeemRatioPerTick', inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },

  // Aggregated pool data
  { type: 'function', name: 'getTotalRawCollaterals', inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'getTotalRawDebts', inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'getTopTick', inputs: [], outputs: [{ name: '', type: 'int16' }], stateMutability: 'view' },
  { type: 'function', name: 'getNextPositionId', inputs: [], outputs: [{ name: '', type: 'uint32' }], stateMutability: 'view' },
  { type: 'function', name: 'getNextTreeNodeId', inputs: [], outputs: [{ name: '', type: 'uint48' }], stateMutability: 'view' },

  // Pool addresses
  { type: 'function', name: 'counterparty', inputs: [], outputs: [{ name: '', type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'fxUSD', inputs: [], outputs: [{ name: '', type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'poolManager', inputs: [], outputs: [{ name: '', type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'configuration', inputs: [], outputs: [{ name: '', type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'collateralToken', inputs: [], outputs: [{ name: '', type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'priceOracle', inputs: [], outputs: [{ name: '', type: 'address' }], stateMutability: 'view' },

  // Status
  { type: 'function', name: 'isBorrowPaused', inputs: [], outputs: [{ name: '', type: 'bool' }], stateMutability: 'view' },
  { type: 'function', name: 'isRedeemPaused', inputs: [], outputs: [{ name: '', type: 'bool' }], stateMutability: 'view' },

  // Write functions (called via PoolManager, but useful for reference)
  { type: 'function', name: 'operate', inputs: [{ name: 'positionId', type: 'uint256' }, { name: 'newRawColl', type: 'int256' }, { name: 'newRawDebt', type: 'int256' }, { name: 'owner', type: 'address' }], outputs: [{ name: 'actualPositionId', type: 'uint256' }, { name: 'actualRawColl', type: 'int256' }, { name: 'actualRawDebt', type: 'int256' }, { name: 'protocolFees', type: 'uint256' }], stateMutability: 'nonpayable' },
  { type: 'function', name: 'redeem', inputs: [{ name: 'rawDebts', type: 'uint256' }], outputs: [{ name: 'actualRawDebts', type: 'uint256' }, { name: 'rawColls', type: 'uint256' }], stateMutability: 'nonpayable' },
  { type: 'function', name: 'rebalance', inputs: [{ name: 'maxRawDebts', type: 'uint256' }], outputs: [{ name: 'result', type: 'tuple', components: [{ name: 'rawColls', type: 'uint256' }, { name: 'rawDebts', type: 'uint256' }, { name: 'bonusRawColls', type: 'uint256' }] }], stateMutability: 'nonpayable' },
  { type: 'function', name: 'liquidate', inputs: [{ name: 'maxRawDebts', type: 'uint256' }, { name: 'reservedRawColls', type: 'uint256' }], outputs: [{ name: 'result', type: 'tuple', components: [{ name: 'rawColls', type: 'uint256' }, { name: 'rawDebts', type: 'uint256' }, { name: 'bonusRawColls', type: 'uint256' }, { name: 'bonusFromReserve', type: 'uint256' }] }], stateMutability: 'nonpayable' },

  // Events
  { type: 'event', name: 'PositionSnapshot', inputs: [{ name: 'position', type: 'uint256', indexed: false }, { name: 'tick', type: 'int16', indexed: false }, { name: 'collShares', type: 'uint256', indexed: false }, { name: 'debtShares', type: 'uint256', indexed: false }, { name: 'price', type: 'uint256', indexed: false }] },
] as const;
