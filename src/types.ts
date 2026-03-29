import type { Address, Hash } from 'viem';

// Global CLI options passed to all commands
export interface GlobalOptions {
  json?: boolean;
  dryRun?: boolean;
  privateKey?: string;
  rpc?: string;
}

// Transaction result
export interface TxResult {
  hash: Hash;
  explorerUrl: string;
}

// Token balances
export interface TokenBalances {
  bnb: string;
  wbnb: string;
  bnbusd: string;
  sigma: string;
  xsigma: string;
  xsigmaStaked: string;
  usdt: string;
  u: string;
  lp: {
    'bnbUSD-USDT': { wallet: string; staked: string };
    'SIGMA-bnbUSD': { wallet: string; staked: string };
    'bnbUSD-U': { wallet: string };
  };
}

// Position info (basic display)
export interface PositionInfo {
  side: 'long' | 'short';
  collateral: string;
  collateralAmount: string;
  debt: string;
  debtAmount: string;
  leverage: string;
  ltvPercent: string;
  pnlPercent: string;
}

// Detailed position data from IPool
export interface PositionData {
  positionId: number;
  poolAddress: string;
  rawColls: string;
  rawDebts: string;
  debtRatio: string;
  leverage: string;
  healthFactor: string;
  collateralValue: string;
  debtValue: string;
  equity: string;
  side?: 'long' | 'short';
  entryPrice?: string;
  pnl?: string;
  pnlPercent?: string;
}

// Pool risk parameters
export interface PoolRiskParams {
  minDebtRatio: string;
  maxDebtRatio: string;
  rebalanceDebtRatio: string;
  rebalanceBonusRatio: string;
  liquidateDebtRatio: string;
  liquidateBonusRatio: string;
}

// Mint result
export interface MintResult extends TxResult {
  amountMinted?: string;
}

// Stability pool deposit
export interface PoolDepositInfo {
  pool: string;
  shares: string;
  value: string;
}

// Pool stats
export interface PoolStats {
  pool: string;
  tvl: string;
  bnbusdAmount: string;
  usdtAmount: string;
  bnbusdPercent: string;
  apr: string;
}

// Protocol overview stats
export interface ProtocolStats {
  bnbPrice: string;
  bnbusdSupply: string;
  bnbusdPrice: string;
  totalCollateral: string;
  totalDebt: string;
  stabilityPoolTvl: string;
}

// Collateral types for trading
export type CollateralType = 'BNB' | 'WBNB' | 'USDT' | 'bnbUSD';

// Stability pool names
export type PoolName = 'SP' | 'SP1' | 'SP2' | 'SP3';

// LP pool names
export type LpPoolName = 'bnbUSD-USDT' | 'SIGMA-bnbUSD' | 'bnbUSD-U';
