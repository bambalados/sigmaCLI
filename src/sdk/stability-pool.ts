import {
  type PublicClient,
  type Hash,
  parseUnits,
  formatUnits,
} from 'viem';
import { ADDRESSES, STABILITY_POOLS, SP_GAUGES, type StabilityPoolName } from '../contracts/addresses.js';
import { type BscWalletClient, writeStabilityPool, writeCurveGauge, readErc20 } from '../contracts/clients.js';
import { curveGaugeAbi } from '../contracts/abis/CurveGauge.js';
import { bnbusdBasePoolAbi } from '../contracts/abis/BNBUSDBasePool.js';
import type { TxResult } from '../types.js';
import { txUrl } from '../config.js';
import { ensureAllowance } from './utils.js';

function getTokenAddress(token: 'bnbUSD' | 'USDT'): `0x${string}` {
  return token === 'bnbUSD' ? ADDRESSES.BNBUSD : ADDRESSES.USDT;
}

// Suspended pools — deposits blocked, withdrawals still allowed
const SUSPENDED_POOLS: Partial<Record<StabilityPoolName, string>> = {
  SP: 'SP (Lista-MEV Vault) is suspended due to liquidity constraints by MEV. Deposits are disabled. Existing deposits can still be withdrawn.',
};

export async function deposit(params: {
  publicClient: PublicClient; walletClient: BscWalletClient;
  pool: StabilityPoolName; token: 'bnbUSD' | 'USDT'; amount: string; dryRun?: boolean;
}): Promise<TxResult> {
  const { publicClient, walletClient, pool, token, amount, dryRun } = params;

  const suspendedMsg = SUSPENDED_POOLS[pool];
  if (suspendedMsg) throw new Error(suspendedMsg);
  const account = walletClient.account!;
  const poolAddr = STABILITY_POOLS[pool];
  const amountWei = parseUnits(amount, 18);

  await ensureAllowance(publicClient, walletClient, getTokenAddress(token), poolAddr, amountWei);

  if (dryRun) {
    await publicClient.simulateContract({
      address: poolAddr, abi: bnbusdBasePoolAbi, functionName: 'deposit',
      args: [account.address, getTokenAddress(token), amountWei, 0n], account: account.address,
    });
    return { hash: '0x0' as Hash, explorerUrl: 'DRY RUN - not executed' };
  }

  const hash = await writeStabilityPool(poolAddr, { public: publicClient, wallet: walletClient }).write.deposit([account.address, getTokenAddress(token), amountWei, 0n]);
  await publicClient.waitForTransactionReceipt({ hash });
  return { hash, explorerUrl: txUrl(hash) };
}

export async function requestWithdraw(params: {
  publicClient: PublicClient; walletClient: BscWalletClient;
  pool: StabilityPoolName; amount: string; dryRun?: boolean;
}): Promise<TxResult> {
  const { publicClient, walletClient, pool, amount, dryRun } = params;
  const account = walletClient.account!;
  const poolAddr = STABILITY_POOLS[pool];
  const amountWei = parseUnits(amount, 18);

  if (dryRun) {
    await publicClient.simulateContract({
      address: poolAddr, abi: bnbusdBasePoolAbi, functionName: 'requestRedeem',
      args: [amountWei], account: account.address,
    });
    return { hash: '0x0' as Hash, explorerUrl: 'DRY RUN - not executed' };
  }

  const hash = await writeStabilityPool(poolAddr, { public: publicClient, wallet: walletClient }).write.requestRedeem([amountWei]);
  await publicClient.waitForTransactionReceipt({ hash });
  return { hash, explorerUrl: txUrl(hash) };
}

export async function instantWithdraw(params: {
  publicClient: PublicClient; walletClient: BscWalletClient;
  pool: StabilityPoolName; amount: string; dryRun?: boolean;
}): Promise<TxResult> {
  const { publicClient, walletClient, pool, amount, dryRun } = params;
  const account = walletClient.account!;
  const poolAddr = STABILITY_POOLS[pool];
  const amountWei = parseUnits(amount, 18);

  if (dryRun) {
    await publicClient.simulateContract({
      address: poolAddr, abi: bnbusdBasePoolAbi, functionName: 'instantRedeem',
      args: [account.address, amountWei], account: account.address,
    });
    return { hash: '0x0' as Hash, explorerUrl: 'DRY RUN - not executed' };
  }

  const hash = await writeStabilityPool(poolAddr, { public: publicClient, wallet: walletClient }).write.instantRedeem([account.address, amountWei]);
  await publicClient.waitForTransactionReceipt({ hash });
  return { hash, explorerUrl: txUrl(hash) };
}

export async function claimWithdrawal(params: {
  publicClient: PublicClient; walletClient: BscWalletClient;
  pool: StabilityPoolName; shares: string; dryRun?: boolean;
}): Promise<TxResult> {
  const { publicClient, walletClient, pool, shares, dryRun } = params;
  const account = walletClient.account!;
  const poolAddr = STABILITY_POOLS[pool];
  const sharesWei = parseUnits(shares, 18);

  if (dryRun) {
    await publicClient.simulateContract({
      address: poolAddr, abi: bnbusdBasePoolAbi, functionName: 'redeem',
      args: [account.address, sharesWei], account: account.address,
    });
    return { hash: '0x0' as Hash, explorerUrl: 'DRY RUN - not executed' };
  }

  const hash = await writeStabilityPool(poolAddr, { public: publicClient, wallet: walletClient }).write.redeem([account.address, sharesWei]);
  await publicClient.waitForTransactionReceipt({ hash });
  return { hash, explorerUrl: txUrl(hash) };
}

// ── Stability Pool Gauge Staking ──

function getSpGaugeAddr(pool: StabilityPoolName): `0x${string}` {
  const addr = SP_GAUGES[pool];
  if (!addr) throw new Error(`No gauge available for stability pool ${pool}`);
  return addr;
}

export async function stakeSpShares(params: {
  publicClient: PublicClient; walletClient: BscWalletClient;
  pool: StabilityPoolName; amount: string; dryRun?: boolean;
}): Promise<TxResult> {
  const { publicClient, walletClient, pool, amount, dryRun } = params;
  const account = walletClient.account!;

  const suspendedMsg = SUSPENDED_POOLS[pool];
  if (suspendedMsg) throw new Error(suspendedMsg);

  const gaugeAddr = getSpGaugeAddr(pool);
  const poolAddr = STABILITY_POOLS[pool];
  const amountWei = parseUnits(amount, 18);

  // Approve SP shares (the pool token) for gauge spending
  await ensureAllowance(publicClient, walletClient, poolAddr, gaugeAddr, amountWei);

  if (dryRun) {
    await publicClient.simulateContract({
      address: gaugeAddr, abi: curveGaugeAbi, functionName: 'deposit',
      args: [amountWei], account: account.address,
    });
    return { hash: '0x0' as Hash, explorerUrl: 'DRY RUN - not executed' };
  }

  const hash = await writeCurveGauge(gaugeAddr, { public: publicClient, wallet: walletClient }).write.deposit([amountWei]);
  await publicClient.waitForTransactionReceipt({ hash });
  return { hash, explorerUrl: txUrl(hash) };
}

export async function unstakeSpShares(params: {
  publicClient: PublicClient; walletClient: BscWalletClient;
  pool: StabilityPoolName; amount: string; dryRun?: boolean;
}): Promise<TxResult> {
  const { publicClient, walletClient, pool, amount, dryRun } = params;
  const account = walletClient.account!;
  const gaugeAddr = getSpGaugeAddr(pool);
  const amountWei = parseUnits(amount, 18);

  if (dryRun) {
    await publicClient.simulateContract({
      address: gaugeAddr, abi: curveGaugeAbi, functionName: 'withdraw',
      args: [amountWei], account: account.address,
    });
    return { hash: '0x0' as Hash, explorerUrl: 'DRY RUN - not executed' };
  }

  const hash = await writeCurveGauge(gaugeAddr, { public: publicClient, wallet: walletClient }).write.withdraw([amountWei]);
  await publicClient.waitForTransactionReceipt({ hash });
  return { hash, explorerUrl: txUrl(hash) };
}

export async function claimSpRewards(params: {
  publicClient: PublicClient; walletClient: BscWalletClient;
  pool: StabilityPoolName; dryRun?: boolean;
}): Promise<TxResult> {
  const { publicClient, walletClient, pool, dryRun } = params;
  const account = walletClient.account!;
  const gaugeAddr = getSpGaugeAddr(pool);

  if (dryRun) {
    await publicClient.simulateContract({
      address: gaugeAddr, abi: curveGaugeAbi, functionName: 'claim_rewards',
      args: [], account: account.address,
    });
    return { hash: '0x0' as Hash, explorerUrl: 'DRY RUN - not executed' };
  }

  const hash = await writeCurveGauge(gaugeAddr, { public: publicClient, wallet: walletClient }).write.claim_rewards();
  await publicClient.waitForTransactionReceipt({ hash });
  return { hash, explorerUrl: txUrl(hash) };
}

export async function depositAndStake(params: {
  publicClient: PublicClient; walletClient: BscWalletClient;
  pool: StabilityPoolName; token: 'bnbUSD' | 'USDT'; amount: string; dryRun?: boolean;
}): Promise<TxResult & { staked: boolean; shareAmount?: string; stakeError?: string }> {
  const { publicClient, walletClient, pool, dryRun } = params;
  const account = walletClient.account!;
  const poolAddr = STABILITY_POOLS[pool];

  if (dryRun) {
    const result = await deposit(params);
    return { ...result, staked: false };
  }

  // Snapshot share balance before
  const sharesBefore = await readErc20(poolAddr, { public: publicClient }).read.balanceOf([account.address]);

  const result = await deposit(params);

  // Compute share delta
  const sharesAfter = await readErc20(poolAddr, { public: publicClient }).read.balanceOf([account.address]);
  const shareDelta = sharesAfter - sharesBefore;

  if (shareDelta <= 0n) {
    return { ...result, staked: false, stakeError: 'No shares received' };
  }

  // Check if gauge exists for this pool
  const gaugeAddr = SP_GAUGES[pool];
  if (!gaugeAddr) {
    return { ...result, staked: false, shareAmount: formatUnits(shareDelta, 18), stakeError: 'No gauge available for this pool' };
  }

  // Auto-stake shares into gauge
  try {
    await stakeSpShares({
      publicClient, walletClient, pool,
      amount: formatUnits(shareDelta, 18),
    });
    return { ...result, staked: true, shareAmount: formatUnits(shareDelta, 18) };
  } catch (e) {
    return {
      ...result,
      staked: false,
      shareAmount: formatUnits(shareDelta, 18),
      stakeError: e instanceof Error ? e.message : String(e),
    };
  }
}
