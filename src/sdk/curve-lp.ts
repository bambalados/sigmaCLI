import {
  type PublicClient,
  type Hash,
  type Address,
  parseUnits,
  formatUnits,
} from 'viem';
import { ADDRESSES } from '../contracts/addresses.js';
import { type BscWalletClient, writeCurvePool, writeCurveTwocrypto, writeCurveGauge, readErc20 } from '../contracts/clients.js';
import type { TxResult, LpPoolName } from '../types.js';
import { txUrl } from '../config.js';
import { ensureAllowance } from './utils.js';

const LP_GAUGE_MAP: Record<string, `0x${string}` | null> = {
  'bnbUSD-USDT': ADDRESSES.GAUGE_USDT_BNBUSD,
  'SIGMA-bnbUSD': ADDRESSES.GAUGE_SIGMA_BNBUSD,
  'bnbUSD-U': null, // No gauge yet for bnbUSD/U pool
};

function getGaugeAddr(pool: LpPoolName): `0x${string}` {
  const addr = LP_GAUGE_MAP[pool];
  if (!addr) throw new Error(`No gauge available for pool ${pool}. Staking not supported.`);
  return addr;
}

const LP_POOL_MAP: Record<string, Address> = {
  'bnbUSD-USDT': ADDRESSES.CURVE_BNBUSD_USDT,
  'SIGMA-bnbUSD': ADDRESSES.CURVE_SIGMA_BNBUSD,
  'bnbUSD-U': ADDRESSES.CURVE_BNBUSD_U,
};

// Twocrypto pools use fixed uint256[2] arrays; stable-ng pools use dynamic uint256[]
const TWOCRYPTO_POOLS: Set<string> = new Set(['SIGMA-bnbUSD']);

function getLpTokenAddress(_publicClient: PublicClient, pool: LpPoolName): Address {
  return LP_POOL_MAP[pool];
}

export async function addLiquidity(params: {
  publicClient: PublicClient; walletClient: BscWalletClient;
  pool: LpPoolName; amounts: [string, string]; dryRun?: boolean;
}): Promise<TxResult> {
  const { publicClient, walletClient, pool, amounts, dryRun } = params;
  const account = walletClient.account!;
  const wc = { public: publicClient, wallet: walletClient };
  const lpToken = getLpTokenAddress(publicClient, pool);
  const amount0 = parseUnits(amounts[0], 18);
  const amount1 = parseUnits(amounts[1], 18);

  if (dryRun) {
    return { hash: '0x0' as Hash, explorerUrl: 'DRY RUN - not executed' };
  }

  const cpRead = writeCurvePool(lpToken, wc);
  const coin0 = await cpRead.read.coins([0n]) as Address;
  const coin1 = await cpRead.read.coins([1n]) as Address;
  if (amount0 > 0n) await ensureAllowance(publicClient, walletClient, coin0, lpToken, amount0);
  if (amount1 > 0n) await ensureAllowance(publicClient, walletClient, coin1, lpToken, amount1);

  let hash: Hash;
  if (TWOCRYPTO_POOLS.has(pool)) {
    const cp = writeCurveTwocrypto(lpToken, wc);
    hash = await cp.write.add_liquidity([[amount0, amount1], 0n, account.address]);
  } else {
    const cp = writeCurvePool(lpToken, wc);
    hash = await cp.write.add_liquidity([[amount0, amount1], 0n, account.address]);
  }
  await publicClient.waitForTransactionReceipt({ hash });
  return { hash, explorerUrl: txUrl(hash) };
}

export async function removeLiquidity(params: {
  publicClient: PublicClient; walletClient: BscWalletClient;
  pool: LpPoolName; amount: string; dryRun?: boolean;
}): Promise<TxResult> {
  const { publicClient, walletClient, pool, amount, dryRun } = params;
  const account = walletClient.account!;
  const lpToken = getLpTokenAddress(publicClient, pool);
  const amountWei = parseUnits(amount, 18);
  if (dryRun) {
    return { hash: '0x0' as Hash, explorerUrl: 'DRY RUN - not executed' };
  }
  let hash: Hash;
  if (TWOCRYPTO_POOLS.has(pool)) {
    hash = await writeCurveTwocrypto(lpToken, { public: publicClient, wallet: walletClient }).write.remove_liquidity([amountWei, [0n, 0n], account.address]);
  } else {
    hash = await writeCurvePool(lpToken, { public: publicClient, wallet: walletClient }).write.remove_liquidity([amountWei, [0n, 0n], account.address]);
  }
  await publicClient.waitForTransactionReceipt({ hash });
  return { hash, explorerUrl: txUrl(hash) };
}

export async function stakeLp(params: {
  publicClient: PublicClient; walletClient: BscWalletClient;
  pool: LpPoolName; amount: string; dryRun?: boolean;
}): Promise<TxResult> {
  const { publicClient, walletClient, pool, amount, dryRun } = params;
  const gaugeAddr = getGaugeAddr(pool);
  const lpToken = getLpTokenAddress(publicClient, pool);
  const amountWei = parseUnits(amount, 18);
  if (dryRun) {
    return { hash: '0x0' as Hash, explorerUrl: 'DRY RUN - not executed' };
  }
  await ensureAllowance(publicClient, walletClient, lpToken, gaugeAddr, amountWei);
  const hash = await writeCurveGauge(gaugeAddr, { public: publicClient, wallet: walletClient }).write.deposit([amountWei]);
  await publicClient.waitForTransactionReceipt({ hash });
  return { hash, explorerUrl: txUrl(hash) };
}

export async function unstakeLp(params: {
  publicClient: PublicClient; walletClient: BscWalletClient;
  pool: LpPoolName; amount: string; dryRun?: boolean;
}): Promise<TxResult> {
  const { publicClient, walletClient, pool, amount, dryRun } = params;
  const gaugeAddr = getGaugeAddr(pool);
  const amountWei = parseUnits(amount, 18);
  if (dryRun) {
    return { hash: '0x0' as Hash, explorerUrl: 'DRY RUN - not executed' };
  }
  const hash = await writeCurveGauge(gaugeAddr, { public: publicClient, wallet: walletClient }).write.withdraw([amountWei]);
  await publicClient.waitForTransactionReceipt({ hash });
  return { hash, explorerUrl: txUrl(hash) };
}

export async function addLiquidityAndStake(params: {
  publicClient: PublicClient; walletClient: BscWalletClient;
  pool: LpPoolName; amounts: [string, string]; dryRun?: boolean;
}): Promise<TxResult & { staked: boolean; lpAmount?: string; stakeError?: string }> {
  const { publicClient, walletClient, pool, dryRun } = params;
  const account = walletClient.account!;
  const lpToken = getLpTokenAddress(publicClient, pool);

  if (dryRun) {
    const result = await addLiquidity(params);
    return { ...result, staked: false };
  }

  // Snapshot LP balance before
  const lpBefore = await readErc20(lpToken, { public: publicClient }).read.balanceOf([account.address]);

  const result = await addLiquidity(params);

  // Compute LP delta
  const lpAfter = await readErc20(lpToken, { public: publicClient }).read.balanceOf([account.address]);
  const lpDelta = lpAfter - lpBefore;

  if (lpDelta <= 0n) {
    return { ...result, staked: false, stakeError: 'No LP tokens received' };
  }

  // Check if gauge exists for this pool
  const gaugeAddr = LP_GAUGE_MAP[pool];
  if (!gaugeAddr) {
    return { ...result, staked: false, lpAmount: formatUnits(lpDelta, 18), stakeError: 'No gauge available for this pool' };
  }

  // Auto-stake LP into gauge
  try {
    await stakeLp({
      publicClient, walletClient, pool,
      amount: formatUnits(lpDelta, 18),
    });
    return { ...result, staked: true, lpAmount: formatUnits(lpDelta, 18) };
  } catch (e) {
    return {
      ...result,
      staked: false,
      lpAmount: formatUnits(lpDelta, 18),
      stakeError: e instanceof Error ? e.message : String(e),
    };
  }
}
