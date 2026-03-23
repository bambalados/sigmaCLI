import {
  type PublicClient,
  type Hash,
  parseUnits,
  formatUnits,
  parseAbi,
} from 'viem';
import { ADDRESSES, VOTE_MODULE, VOTER } from '../contracts/addresses.js';
import {
  type BscWalletClient,
  readVoteModule,
  writeVoteModule,
  readVoter,
  writeVoter,
  readFeeDistributor,
  writeFeeDistributor,
  readErc20,
  writeErc20,
} from '../contracts/clients.js';
import { voterAbi } from '../contracts/abis/Voter.js';
import { voteModuleAbi } from '../contracts/abis/VoteModule.js';
import { feeDistributorAbi } from '../contracts/abis/FeeDistributor.js';
import type { TxResult } from '../types.js';
import { txUrl } from '../config.js';

function wc(p: PublicClient, w: BscWalletClient) { return { public: p, wallet: w }; }
function rc(p: PublicClient) { return { public: p }; }

// ── Types ──

export interface GaugeInfo {
  gauge: string;
  pool: string;
  name: string;
  alive: boolean;
  feeDistributor: string;
}

export interface UserVote {
  pool: string;
  name: string;
  weight: string;
}

// ── Read functions ──

/** Get all gauges with pool mappings and names */
export async function getGauges(publicClient: PublicClient): Promise<GaugeInfo[]> {
  const c = rc(publicClient);
  const voter = readVoter(c);

  const gaugeAddresses = await voter.read.getAllGauges();

  const nameAbi = parseAbi(['function name() view returns (string)', 'function symbol() view returns (string)']);

  const gauges: GaugeInfo[] = [];
  for (const gauge of gaugeAddresses) {
    const [pool, alive, fd] = await Promise.all([
      voter.read.poolForGauge([gauge]),
      voter.read.isAlive([gauge]),
      voter.read.feeDistributorForGauge([gauge]),
    ]);

    // Try to get pool name
    let name = pool.slice(0, 10) + '...';
    try {
      const poolName = await publicClient.readContract({
        address: pool,
        abi: nameAbi,
        functionName: 'name',
      });
      name = poolName;
    } catch {
      try {
        const sym = await publicClient.readContract({
          address: pool,
          abi: nameAbi,
          functionName: 'symbol',
        });
        name = sym;
      } catch { /* keep truncated address */ }
    }

    gauges.push({
      gauge,
      pool,
      name,
      alive,
      feeDistributor: fd,
    });
  }

  return gauges;
}

/** Get user's current vote allocation for the next period */
export async function getUserVote(publicClient: PublicClient, userAddress: `0x${string}`): Promise<UserVote[]> {
  const c = rc(publicClient);
  const voter = readVoter(c);

  // Voter.getVotes(user, period) — votes are for nextPeriod = getPeriod() + 1
  const currentPeriod = await voter.read.getPeriod();
  const nextPeriod = currentPeriod + 1n;

  let poolAddrs: readonly `0x${string}`[];
  let weights: readonly bigint[];
  try {
    [poolAddrs, weights] = await voter.read.getVotes([userAddress, nextPeriod]);
  } catch {
    return [];
  }
  if (poolAddrs.length === 0) return [];

  // Get pool names
  const gauges = await getGauges(publicClient);
  const poolMap = new Map(gauges.map((g) => [g.pool.toLowerCase(), g]));

  const votes: UserVote[] = [];
  for (let i = 0; i < poolAddrs.length; i++) {
    const info = poolMap.get(poolAddrs[i].toLowerCase());
    votes.push({
      pool: poolAddrs[i],
      name: info?.name || poolAddrs[i].slice(0, 10) + '...',
      weight: formatUnits(weights[i], 18),
    });
  }

  return votes;
}

// ── Write functions ──

/** Cast votes on gauge emission allocation
 *  NOTE: Voter.vote takes POOL addresses, not gauge addresses!
 *  The SDK accepts either and resolves pools from gauges if needed.
 */
export async function castVote(params: {
  publicClient: PublicClient;
  walletClient: BscWalletClient;
  pools: `0x${string}`[];
  weights: bigint[];
  dryRun?: boolean;
}): Promise<TxResult> {
  const { publicClient, walletClient, pools, weights, dryRun } = params;
  const account = walletClient.account!;

  if (dryRun) {
    await publicClient.simulateContract({
      address: VOTER,
      abi: voterAbi,
      functionName: 'vote',
      args: [account.address, pools, weights],
      account: account.address,
    });
    return { hash: '0x0' as Hash, explorerUrl: 'DRY RUN - not executed' };
  }

  const hash = await writeVoter(wc(publicClient, walletClient)).write.vote([account.address, pools, weights]);
  await publicClient.waitForTransactionReceipt({ hash });
  return { hash, explorerUrl: txUrl(hash) };
}

/** Reset all votes */
export async function resetVote(params: {
  publicClient: PublicClient; walletClient: BscWalletClient; dryRun?: boolean;
}): Promise<TxResult> {
  const { publicClient, walletClient, dryRun } = params;
  const account = walletClient.account!;

  if (dryRun) {
    await publicClient.simulateContract({
      address: VOTER, abi: voterAbi,
      functionName: 'reset', args: [account.address],
      account: account.address,
    });
    return { hash: '0x0' as Hash, explorerUrl: 'DRY RUN - not executed' };
  }

  const hash = await writeVoter(wc(publicClient, walletClient)).write.reset([account.address]);
  await publicClient.waitForTransactionReceipt({ hash });
  return { hash, explorerUrl: txUrl(hash) };
}

/** Refresh/update vote weights */
export async function pokeVote(params: {
  publicClient: PublicClient; walletClient: BscWalletClient; dryRun?: boolean;
}): Promise<TxResult> {
  const { publicClient, walletClient, dryRun } = params;
  const account = walletClient.account!;

  if (dryRun) {
    await publicClient.simulateContract({
      address: VOTER, abi: voterAbi,
      functionName: 'poke', args: [account.address],
      account: account.address,
    });
    return { hash: '0x0' as Hash, explorerUrl: 'DRY RUN - not executed' };
  }

  const hash = await writeVoter(wc(publicClient, walletClient)).write.poke([account.address]);
  await publicClient.waitForTransactionReceipt({ hash });
  return { hash, explorerUrl: txUrl(hash) };
}

/** Claim staking rewards (rebase) from VoteModule */
export async function claimRebase(params: {
  publicClient: PublicClient; walletClient: BscWalletClient; dryRun?: boolean;
}): Promise<TxResult> {
  const { publicClient, walletClient, dryRun } = params;
  const account = walletClient.account!;

  if (dryRun) {
    await publicClient.simulateContract({
      address: VOTE_MODULE, abi: voteModuleAbi,
      functionName: 'getReward', account: account.address,
    });
    return { hash: '0x0' as Hash, explorerUrl: 'DRY RUN - not executed' };
  }

  const hash = await writeVoteModule(wc(publicClient, walletClient)).write.getReward();
  await publicClient.waitForTransactionReceipt({ hash });
  return { hash, explorerUrl: txUrl(hash) };
}

/** Claim vote incentives from fee distributors (via Voter contract) */
export async function claimIncentives(params: {
  publicClient: PublicClient;
  walletClient: BscWalletClient;
  gaugeAddresses?: `0x${string}`[];
  dryRun?: boolean;
}): Promise<TxResult> {
  const { publicClient, walletClient, dryRun } = params;
  const account = walletClient.account!;
  const c = rc(publicClient);

  // Get all gauges if none specified
  let targetGauges = params.gaugeAddresses;
  if (!targetGauges || targetGauges.length === 0) {
    const voter = readVoter(c);
    targetGauges = (await voter.read.getAllGauges()) as `0x${string}`[];
  }

  // Build feeDistributor + token arrays
  const feeDistributors: `0x${string}`[] = [];
  const tokenArrays: `0x${string}`[][] = [];

  const voter = readVoter(c);
  for (const gauge of targetGauges) {
    const fdAddr = await voter.read.feeDistributorForGauge([gauge]);
    const fd = readFeeDistributor(fdAddr, c);
    const tokens = await fd.read.getRewardTokens();

    if (tokens.length > 0) {
      feeDistributors.push(fdAddr);
      tokenArrays.push(tokens as `0x${string}`[]);
    }
  }

  if (feeDistributors.length === 0) {
    return { hash: '0x0' as Hash, explorerUrl: 'No incentives to claim' };
  }

  if (dryRun) {
    await publicClient.simulateContract({
      address: VOTER,
      abi: voterAbi,
      functionName: 'claimIncentives',
      args: [account.address, feeDistributors, tokenArrays],
      account: account.address,
    });
    return { hash: '0x0' as Hash, explorerUrl: 'DRY RUN - not executed' };
  }

  const hash = await writeVoter(wc(publicClient, walletClient)).write.claimIncentives([account.address, feeDistributors, tokenArrays]);
  await publicClient.waitForTransactionReceipt({ hash });
  return { hash, explorerUrl: txUrl(hash) };
}

/** Deposit incentive tokens for a gauge's voters */
export async function depositIncentive(params: {
  publicClient: PublicClient;
  walletClient: BscWalletClient;
  gaugeAddress: `0x${string}`;
  tokenAddress: `0x${string}`;
  amount: string;
  decimals?: number;
  dryRun?: boolean;
}): Promise<TxResult> {
  const { publicClient, walletClient, gaugeAddress, tokenAddress, amount, decimals = 18, dryRun } = params;
  const account = walletClient.account!;
  const amountWei = parseUnits(amount, decimals);

  // Get fee distributor for this gauge
  const voter = readVoter(rc(publicClient));
  const fdAddr = await voter.read.feeDistributorForGauge([gaugeAddress]);

  // Approve token spend by fee distributor
  const allowance = await readErc20(tokenAddress, rc(publicClient)).read.allowance([account.address, fdAddr]);
  if (allowance < amountWei) {
    const approveHash = await writeErc20(tokenAddress, wc(publicClient, walletClient)).write.approve([fdAddr, amountWei]);
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
  }

  if (dryRun) {
    await publicClient.simulateContract({
      address: fdAddr,
      abi: feeDistributorAbi,
      functionName: 'notifyRewardAmount',
      args: [tokenAddress, amountWei],
      account: account.address,
    });
    return { hash: '0x0' as Hash, explorerUrl: 'DRY RUN - not executed' };
  }

  const hash = await writeFeeDistributor(fdAddr, wc(publicClient, walletClient)).write.notifyRewardAmount([tokenAddress, amountWei]);
  await publicClient.waitForTransactionReceipt({ hash });
  return { hash, explorerUrl: txUrl(hash) };
}

/** Resolve a gauge address to its pool address */
export async function gaugeToPool(publicClient: PublicClient, gauge: `0x${string}`): Promise<`0x${string}`> {
  const voter = readVoter(rc(publicClient));
  return await voter.read.poolForGauge([gauge]);
}
