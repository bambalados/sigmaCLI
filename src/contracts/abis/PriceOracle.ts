// BNBPriceOracle ABI - returns BNB price as single uint256
export const priceOracleAbi = [
  {
    type: 'function',
    name: 'getPrice',
    inputs: [],
    outputs: [{ name: 'price', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;
