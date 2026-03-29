import type { Address, PublicClient } from 'viem';
import { formatUnits } from 'viem';
import { ADDRESSES, STABILITY_POOLS, LEVERAGE_POOL, SHORT_POOL } from '../contracts/addresses.js';
import {
  readBnbUsd,
  readSigma,
  readXSigma,
  readWbnb,
  readUsdt,
  readPegKeeper,
  readPriceOracle,
  readBnbUsdBasePool,
  readStabilityPool,
  readIPool,
  readErc20,
  readVoteModule,
  readCurveGauge,
} from '../contracts/clients.js';
import type { TokenBalances, ProtocolStats, PoolDepositInfo, PoolStats, PositionData, PoolRiskParams } from '../types.js';
import { getEntry, getEntriesForWallet } from '../position-store.js';
import { PRECISION, BPS } from './constants.js';

// ── Token Balances ──

export async function getBalances(
  publicClient: PublicClient,
  address: Address,
): Promise<TokenBalances> {
  const c = { public: publicClient };

  const [
    bnbRaw, wbnbRaw, bnbusdRaw, sigmaRaw, xsigmaRaw, xsigmaStakedRaw, usdtRaw, uRaw,
    lpBnbusdUsdt, lpSigmaBnbusd, lpBnbusdU,
    gaugeBnbusdUsdt, gaugeSigmaBnbusd,
  ] = await Promise.all([
    publicClient.getBalance({ address }),
    readWbnb(c).read.balanceOf([address]),
    readBnbUsd(c).read.balanceOf([address]),
    readSigma(c).read.balanceOf([address]),
    readXSigma(c).read.balanceOf([address]),
    readVoteModule(c).read.balanceOf([address]),
    readUsdt(c).read.balanceOf([address]),
    readErc20(ADDRESSES.U_TOKEN, c).read.balanceOf([address]),
    // LP token balances (in wallet)
    readErc20(ADDRESSES.CURVE_BNBUSD_USDT, c).read.balanceOf([address]),
    readErc20(ADDRESSES.CURVE_SIGMA_BNBUSD, c).read.balanceOf([address]),
    readErc20(ADDRESSES.CURVE_BNBUSD_U, c).read.balanceOf([address]),
    // Gauge balances (staked LP)
    readCurveGauge(ADDRESSES.GAUGE_USDT_BNBUSD, c).read.balanceOf([address]),
    readCurveGauge(ADDRESSES.GAUGE_SIGMA_BNBUSD, c).read.balanceOf([address]),
  ]);

  return {
    bnb: formatUnits(bnbRaw, 18),
    wbnb: formatUnits(wbnbRaw, 18),
    bnbusd: formatUnits(bnbusdRaw, 18),
    sigma: formatUnits(sigmaRaw, 18),
    xsigma: formatUnits(xsigmaRaw, 18),
    xsigmaStaked: formatUnits(xsigmaStakedRaw, 18),
    usdt: formatUnits(usdtRaw, 18),
    u: formatUnits(uRaw, 18),
    lp: {
      'bnbUSD-USDT': { wallet: formatUnits(lpBnbusdUsdt, 18), staked: formatUnits(gaugeBnbusdUsdt, 18) },
      'SIGMA-bnbUSD': { wallet: formatUnits(lpSigmaBnbusd, 18), staked: formatUnits(gaugeSigmaBnbusd, 18) },
      'bnbUSD-U': { wallet: formatUnits(lpBnbusdU, 18) },
    },
  };
}

// ── Price Queries ──

export async function getBnbPrice(publicClient: PublicClient): Promise<{
  price: bigint;
  formatted: string;
  decimals: number;
}> {
  const oracle = readPriceOracle({ public: publicClient });
  const price = await oracle.read.getPrice();
  return { price, formatted: formatUnits(price, 18), decimals: 18 };
}

export async function getBnbUsdPrice(publicClient: PublicClient): Promise<{
  isValid: boolean;
  price: string;
}> {
  const pegKeeper = readPegKeeper({ public: publicClient });

  try {
    const price = await pegKeeper.read.getFxUSDPrice();
    return { isValid: true, price: formatUnits(price, 18) };
  } catch {
    return { isValid: true, price: '1.0000' };
  }
}

// ── Pool Discovery ──

export async function discoverPools(_publicClient: PublicClient): Promise<Address[]> {
  // SigmaController.getMarkets() reverts on proxy — use known pool address
  // SY_POOL (0xe8a1...) is the main leverage pool with IPool interface
  return [LEVERAGE_POOL];
}

// ── Position Reading ──

export async function getPositionData(
  publicClient: PublicClient,
  poolAddr: Address,
  positionId: bigint,
  walletAddress?: Address,
): Promise<PositionData | null> {
  const c = { public: publicClient };
  const pool = readIPool(poolAddr, c);

  try {
    const [position, debtRatioRaw] = await Promise.all([
      pool.read.getPosition([positionId]),
      pool.read.getPositionDebtRatio([positionId]),
    ]);

    const [rawColls, rawDebts] = position;
    if (rawColls === 0n && rawDebts === 0n) return null;

    const { price } = await getBnbPrice(publicClient);

    // Detect if this is a short pool (collateral = bnbUSD, debt = SY volatile)
    const isShortPool = poolAddr.toLowerCase() === SHORT_POOL.toLowerCase();

    let collValueUsd: bigint;
    let debtValueUsd: bigint;

    if (isShortPool) {
      // Short: collateral is bnbUSD (already USD), debt is SY (needs price conversion)
      collValueUsd = rawColls;
      debtValueUsd = (rawDebts * price) / PRECISION;
    } else {
      // Long: collateral is SY (needs price conversion), debt is bnbUSD (already USD)
      collValueUsd = (rawColls * price) / PRECISION;
      debtValueUsd = rawDebts;
    }

    const equity = collValueUsd - debtValueUsd;
    const leverage = equity > 0n ? (collValueUsd * PRECISION) / equity : 0n;

    // Health factor: distance from liquidation threshold
    const riskParams = await getPoolRiskParams(publicClient, poolAddr);
    const liquidateRatio = BigInt(Math.floor(parseFloat(riskParams.liquidateDebtRatio) * 1e18));
    const healthFactor = liquidateRatio > 0n && debtRatioRaw > 0n
      ? (liquidateRatio * PRECISION) / debtRatioRaw
      : 0n;

    const result: PositionData = {
      positionId: Number(positionId),
      poolAddress: poolAddr,
      rawColls: formatUnits(rawColls, 18),
      rawDebts: formatUnits(rawDebts, 18),
      debtRatio: (Number(debtRatioRaw) / 1e18 * 100).toFixed(2) + '%',
      leverage: (Number(leverage) / 1e18).toFixed(2) + 'x',
      healthFactor: (Number(healthFactor) / 1e18).toFixed(4),
      collateralValue: '$' + formatUnits(collValueUsd, 18),
      debtValue: '$' + formatUnits(debtValueUsd, 18),
      equity: '$' + formatUnits(equity, 18),
      side: isShortPool ? 'short' : 'long',
    };

    // Compute PnL from stored entry (keyed by wallet address)
    const entry = walletAddress ? getEntry(walletAddress, Number(positionId)) : null;
    if (entry) {
      result.entryPrice = entry.entryPrice;
      const currentEquityNum = Number(formatUnits(equity, 18));
      const entryEquityNum = parseFloat(entry.entryEquity);
      if (entryEquityNum > 0) {
        const pnl = currentEquityNum - entryEquityNum;
        const pnlPct = (pnl / entryEquityNum) * 100;
        result.pnl = (pnl >= 0 ? '+$' : '-$') + Math.abs(pnl).toFixed(2);
        result.pnlPercent = (pnlPct >= 0 ? '+' : '') + pnlPct.toFixed(2) + '%';
      }
    }

    return result;
  } catch {
    return null;
  }
}

export async function getUserPositions(
  publicClient: PublicClient,
  poolAddr: Address,
  userAddress: Address,
): Promise<PositionData[]> {
  const positions: PositionData[] = [];

  // First: check locally stored position IDs for this wallet, filtered by pool
  const storedEntries = getEntriesForWallet(userAddress);
  const poolEntries = storedEntries.filter(
    e => e.poolAddress.toLowerCase() === poolAddr.toLowerCase(),
  );
  const storedIds = new Set(poolEntries.map(e => e.positionId));

  for (const posId of storedIds) {
    const posData = await getPositionData(publicClient, poolAddr, BigInt(posId), userAddress);
    if (posData) positions.push(posData);
  }

  // Fallback: if no stored entries for this pool, scan position IDs (shows all positions, not just user's)
  if (storedIds.size === 0 && poolEntries.length === 0 && storedEntries.length === 0) {
    try {
      const c = { public: publicClient };
      const pool = readIPool(poolAddr, c);
      const nextId = await pool.read.getNextPositionId();
      const scanLimit = Math.min(Number(nextId), 200);

      for (let start = 1; start < scanLimit; start += 10) {
        const batch = [];
        for (let id = start; id < Math.min(start + 10, scanLimit); id++) {
          batch.push(getPositionData(publicClient, poolAddr, BigInt(id), userAddress));
        }
        const results = await Promise.all(batch);
        for (const posData of results) {
          if (posData) positions.push(posData);
        }
      }
    } catch {}
  }

  return positions;
}

// ── Pool Risk Parameters ──

export async function getPoolRiskParams(
  publicClient: PublicClient,
  poolAddr: Address,
): Promise<PoolRiskParams> {
  const c = { public: publicClient };
  const pool = readIPool(poolAddr, c);

  const [debtRange, rebalanceRatios, liquidateRatios] = await Promise.all([
    pool.read.getDebtRatioRange(),
    pool.read.getRebalanceRatios(),
    pool.read.getLiquidateRatios(),
  ]);

  return {
    minDebtRatio: formatUnits(debtRange[0], 18),
    maxDebtRatio: formatUnits(debtRange[1], 18),
    rebalanceDebtRatio: formatUnits(rebalanceRatios[0], 18),
    rebalanceBonusRatio: formatUnits(rebalanceRatios[1], 18),
    liquidateDebtRatio: formatUnits(liquidateRatios[0], 18),
    liquidateBonusRatio: formatUnits(liquidateRatios[1], 18),
  };
}

export async function getPoolInfo(
  publicClient: PublicClient,
  poolAddr: Address,
): Promise<{
  collateralToken: Address;
  totalCollateral: string;
  totalDebt: string;
  isBorrowPaused: boolean;
  isRedeemPaused: boolean;
  topTick: number;
  nextPositionId: number;
}> {
  const c = { public: publicClient };
  const pool = readIPool(poolAddr, c);

  const [collToken, totalColls, totalDebts, borrowPaused, redeemPaused, topTick, nextPosId] =
    await Promise.all([
      pool.read.collateralToken(),
      pool.read.getTotalRawCollaterals(),
      pool.read.getTotalRawDebts(),
      pool.read.isBorrowPaused(),
      pool.read.isRedeemPaused(),
      pool.read.getTopTick(),
      pool.read.getNextPositionId(),
    ]);

  return {
    collateralToken: collToken as Address,
    totalCollateral: formatUnits(totalColls, 18),
    totalDebt: formatUnits(totalDebts, 18),
    isBorrowPaused: borrowPaused,
    isRedeemPaused: redeemPaused,
    topTick: Number(topTick),
    nextPositionId: Number(nextPosId),
  };
}

// ── System Health ──

export async function getSystemHealth(publicClient: PublicClient): Promise<{
  totalCollateral: string;
  totalDebt: string;
  collateralizationRatio: string;
}> {
  const pools = await discoverPools(publicClient);
  let totalCollRaw = 0n;
  let totalDebtRaw = 0n;

  for (const poolAddr of pools) {
    const pool = readIPool(poolAddr as `0x${string}`, { public: publicClient });
    const [colls, debts] = await Promise.all([
      pool.read.getTotalRawCollaterals().catch(() => 0n),
      pool.read.getTotalRawDebts().catch(() => 0n),
    ]);
    totalCollRaw += colls;
    totalDebtRaw += debts;
  }

  const { price } = await getBnbPrice(publicClient);
  const collValue = (totalCollRaw * price) / PRECISION;
  const ratio = totalDebtRaw > 0n ? (collValue * BPS) / totalDebtRaw : 0n;

  return {
    totalCollateral: formatUnits(collValue, 18),
    totalDebt: formatUnits(totalDebtRaw, 18),
    collateralizationRatio: (Number(ratio) / 100).toFixed(2) + '%',
  };
}

// ── Stability Pool Queries ──

export async function getStabilityPoolDeposits(
  publicClient: PublicClient,
  address: Address,
): Promise<PoolDepositInfo[]> {
  const c = { public: publicClient };
  const deposits: PoolDepositInfo[] = [];

  for (const [name, poolAddr] of Object.entries(STABILITY_POOLS)) {
    try {
      const pool = readStabilityPool(poolAddr, c);
      const shares = await pool.read.balanceOf([address]);
      if (shares > 0n) {
        deposits.push({
          pool: name,
          shares: formatUnits(shares, 18),
          value: formatUnits(shares, 18),
        });
      }
    } catch {
      // Pool may not support this interface
    }
  }

  return deposits;
}

export async function getPoolStats(
  publicClient: PublicClient,
  poolName?: string,
): Promise<PoolStats[]> {
  const c = { public: publicClient };
  const stats: PoolStats[] = [];

  const poolsToQuery = poolName
    ? { [poolName]: STABILITY_POOLS[poolName as keyof typeof STABILITY_POOLS] }
    : STABILITY_POOLS;

  for (const [name, poolAddr] of Object.entries(poolsToQuery)) {
    try {
      const pool = readStabilityPool(poolAddr, c);
      const [totalSupply, totalYield, totalStable] = await Promise.all([
        pool.read.totalSupply(),
        pool.read.totalYieldToken().catch(() => 0n),
        pool.read.totalStableToken().catch(() => 0n),
      ]);

      const total = totalYield + totalStable;
      const bnbusdPct = total > 0n ? (totalYield * BPS) / total : 0n;

      const SUSPENDED_POOLS = new Set(['SP']);
      stats.push({
        pool: SUSPENDED_POOLS.has(name) ? `${name} (SUSPENDED)` : name,
        tvl: formatUnits(total, 18),
        bnbusdAmount: formatUnits(totalYield, 18),
        usdtAmount: formatUnits(totalStable, 18),
        bnbusdPercent: (Number(bnbusdPct) / 100).toFixed(2) + '%',
        apr: SUSPENDED_POOLS.has(name) ? 'SUSPENDED' : 'N/A',
      });
    } catch {
      stats.push({
        pool: name, tvl: 'N/A', bnbusdAmount: 'N/A', usdtAmount: 'N/A',
        bnbusdPercent: 'N/A', apr: 'N/A',
      });
    }
  }

  return stats;
}

export async function getProtocolStats(
  publicClient: PublicClient,
): Promise<ProtocolStats> {
  const c = { public: publicClient };

  const [bnbPriceData, bnbusdPriceData, bnbusdSupply] = await Promise.all([
    getBnbPrice(publicClient),
    getBnbUsdPrice(publicClient),
    readBnbUsd(c).read.totalSupply(),
  ]);

  // Get total collateral/debt from discovered pools
  let totalCollateral = 'N/A';
  let totalDebt = 'N/A';
  try {
    const pools = await discoverPools(publicClient);
    let totalCollRaw = 0n;
    let totalDebtRaw = 0n;
    for (const poolAddr of pools) {
      const pool = readIPool(poolAddr as `0x${string}`, c);
      const [colls, debts] = await Promise.all([
        pool.read.getTotalRawCollaterals().catch(() => 0n),
        pool.read.getTotalRawDebts().catch(() => 0n),
      ]);
      totalCollRaw += colls;
      totalDebtRaw += debts;
    }
    totalCollateral = formatUnits(totalCollRaw, 18);
    totalDebt = formatUnits(totalDebtRaw, 18);
  } catch {}

  let spTvl = 'N/A';
  try {
    const sp = readBnbUsdBasePool(c);
    const supply = await sp.read.totalSupply();
    spTvl = formatUnits(supply, 18);
  } catch {}

  return {
    bnbPrice: `$${bnbPriceData.formatted}`,
    bnbusdSupply: formatUnits(bnbusdSupply, 18),
    bnbusdPrice: `$${bnbusdPriceData.price}`,
    totalCollateral,
    totalDebt,
    stabilityPoolTvl: spTvl,
  };
}
