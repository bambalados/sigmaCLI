import {
  type PublicClient,
  type Hash,
  parseUnits,
  formatUnits,
} from 'viem';
import { ADDRESSES, VOTE_MODULE, GAUGE_POOLS, SP_GAUGES } from '../contracts/addresses.js';
import { type BscWalletClient, readErc20, writeErc20, writeXSigma, readXSigma, readVoteModule, writeVoteModule, readSigma, readCurveGauge, writeCurveGauge } from '../contracts/clients.js';
import { xSigmaAbi } from '../contracts/abis/xSigma.js';
import { voteModuleAbi } from '../contracts/abis/VoteModule.js';
import type { TxResult } from '../types.js';
import { txUrl } from '../config.js';
import { ensureAllowance } from './utils.js';

function wc(p: PublicClient, w: BscWalletClient) { return { public: p, wallet: w }; }
function rc(p: PublicClient) { return { public: p }; }

// ── Read functions ──

export async function getXSigmaInfo(publicClient: PublicClient, userAddress?: `0x${string}`) {
  const c = rc(publicClient);
  const xs = readXSigma(c);

  const [totalSupply, pendingRebase, balanceResiding, slashPenalty, maxVest, minVest, rebaseStarted, paused] =
    await Promise.all([
      xs.read.totalSupply(),
      xs.read.pendingRebase(),
      xs.read.getBalanceResiding(),
      xs.read.SLASHING_PENALTY(),
      xs.read.MAX_VEST(),
      xs.read.MIN_VEST(),
      xs.read.rebaseStarted(),
      xs.read.paused(),
    ]);

  const result: Record<string, string | boolean> = {
    totalSupply: formatUnits(totalSupply, 18),
    pendingRebase: formatUnits(pendingRebase, 18),
    balanceResiding: formatUnits(balanceResiding, 18),
    slashingPenalty: slashPenalty.toString(),
    maxVestDays: (Number(maxVest) / 86400).toFixed(0),
    minVestDays: (Number(minVest) / 86400).toFixed(0),
    rebaseStarted,
    paused,
  };

  // VoteModule stats
  const vm = readVoteModule(c);
  const totalStaked = await vm.read.totalSupply();
  result.totalStaked = formatUnits(totalStaked, 18);

  if (userAddress) {
    const [balance, vestCount, stakedBalance] = await Promise.all([
      xs.read.balanceOf([userAddress]),
      xs.read.usersTotalVests([userAddress]),
      vm.read.balanceOf([userAddress]),
    ]);
    result.balance = formatUnits(balance, 18);
    result.vestCount = vestCount.toString();
    result.stakedBalance = formatUnits(stakedBalance, 18);

    // Voting power = staked balance (in Shadow forks, VoteModule balanceOf IS voting power)
    result.votingPower = formatUnits(stakedBalance, 18);
  }

  return result;
}

export async function getUserVests(publicClient: PublicClient, userAddress: `0x${string}`) {
  const xs = readXSigma(rc(publicClient));
  const vestCount = await xs.read.usersTotalVests([userAddress]);
  const count = Number(vestCount);
  const vests: Array<{ amount: string; start: string; maxEnd: string; vestID: string }> = [];

  for (let i = 0; i < count; i++) {
    const [amount, start, maxEnd, vestID] = await xs.read.vestInfo([userAddress, BigInt(i)]);
    if (amount > 0n) {
      vests.push({
        amount: formatUnits(amount, 18),
        start: new Date(Number(start) * 1000).toISOString().split('T')[0],
        maxEnd: new Date(Number(maxEnd) * 1000).toISOString().split('T')[0],
        vestID: vestID.toString(),
      });
    }
  }
  return vests;
}

// ── Write functions ──

/** Convert SIGMA → xSIGMA (via convertEmissionsToken) */
export async function convertToXSigma(params: {
  publicClient: PublicClient; walletClient: BscWalletClient; amount: string; dryRun?: boolean;
}): Promise<TxResult> {
  const { publicClient, walletClient, amount, dryRun } = params;
  const account = walletClient.account!;
  const amountWei = parseUnits(amount, 18);

  // Approve SIGMA spend by xSIGMA contract
  const sigmaAllowance = await readErc20(ADDRESSES.SIGMA, rc(publicClient)).read.allowance([account.address, ADDRESSES.XSIGMA]);
  if (sigmaAllowance < amountWei) {
    const approveHash = await writeErc20(ADDRESSES.SIGMA, wc(publicClient, walletClient)).write.approve([ADDRESSES.XSIGMA, amountWei]);
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
  }

  if (dryRun) {
    await publicClient.simulateContract({
      address: ADDRESSES.XSIGMA, abi: xSigmaAbi,
      functionName: 'convertEmissionsToken', args: [amountWei],
      account: account.address,
    });
    return { hash: '0x0' as Hash, explorerUrl: 'DRY RUN - not executed' };
  }

  const hash = await writeXSigma(wc(publicClient, walletClient)).write.convertEmissionsToken([amountWei]);
  await publicClient.waitForTransactionReceipt({ hash });
  return { hash, explorerUrl: txUrl(hash) };
}

/** Instant exit xSIGMA → SIGMA with slashing penalty */
export async function instantExit(params: {
  publicClient: PublicClient; walletClient: BscWalletClient; amount: string; dryRun?: boolean;
}): Promise<TxResult & { exitedAmount?: string }> {
  const { publicClient, walletClient, amount, dryRun } = params;
  const account = walletClient.account!;
  const amountWei = parseUnits(amount, 18);

  if (dryRun) {
    const { result } = await publicClient.simulateContract({
      address: ADDRESSES.XSIGMA, abi: xSigmaAbi,
      functionName: 'exit', args: [amountWei],
      account: account.address,
    });
    return {
      hash: '0x0' as Hash,
      explorerUrl: 'DRY RUN - not executed',
      exitedAmount: formatUnits(result, 18),
    };
  }

  const hash = await writeXSigma(wc(publicClient, walletClient)).write.exit([amountWei]);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  // Read SIGMA balance after to show actual received
  return { hash, explorerUrl: txUrl(hash) };
}

/** Create a vesting position (lock xSIGMA, receive SIGMA over time) */
export async function createVest(params: {
  publicClient: PublicClient; walletClient: BscWalletClient; amount: string; dryRun?: boolean;
}): Promise<TxResult> {
  const { publicClient, walletClient, amount, dryRun } = params;
  const account = walletClient.account!;
  const amountWei = parseUnits(amount, 18);

  if (dryRun) {
    await publicClient.simulateContract({
      address: ADDRESSES.XSIGMA, abi: xSigmaAbi,
      functionName: 'createVest', args: [amountWei],
      account: account.address,
    });
    return { hash: '0x0' as Hash, explorerUrl: 'DRY RUN - not executed' };
  }

  const hash = await writeXSigma(wc(publicClient, walletClient)).write.createVest([amountWei]);
  await publicClient.waitForTransactionReceipt({ hash });
  return { hash, explorerUrl: txUrl(hash) };
}

/** Exit (cancel) a specific vest by ID */
export async function exitVest(params: {
  publicClient: PublicClient; walletClient: BscWalletClient; vestId: number; dryRun?: boolean;
}): Promise<TxResult> {
  const { publicClient, walletClient, vestId, dryRun } = params;
  const account = walletClient.account!;

  if (dryRun) {
    await publicClient.simulateContract({
      address: ADDRESSES.XSIGMA, abi: xSigmaAbi,
      functionName: 'exitVest', args: [BigInt(vestId)],
      account: account.address,
    });
    return { hash: '0x0' as Hash, explorerUrl: 'DRY RUN - not executed' };
  }

  const hash = await writeXSigma(wc(publicClient, walletClient)).write.exitVest([BigInt(vestId)]);
  await publicClient.waitForTransactionReceipt({ hash });
  return { hash, explorerUrl: txUrl(hash) };
}

/** Trigger rebase distribution */
export async function triggerRebase(params: {
  publicClient: PublicClient; walletClient: BscWalletClient; dryRun?: boolean;
}): Promise<TxResult> {
  const { publicClient, walletClient, dryRun } = params;
  const account = walletClient.account!;

  if (dryRun) {
    await publicClient.simulateContract({
      address: ADDRESSES.XSIGMA, abi: xSigmaAbi,
      functionName: 'rebase',
      account: account.address,
    });
    return { hash: '0x0' as Hash, explorerUrl: 'DRY RUN - not executed' };
  }

  const hash = await writeXSigma(wc(publicClient, walletClient)).write.rebase();
  await publicClient.waitForTransactionReceipt({ hash });
  return { hash, explorerUrl: txUrl(hash) };
}

/** Stake xSIGMA into VoteModule for voting power */
export async function stakeXSigma(params: {
  publicClient: PublicClient; walletClient: BscWalletClient; amount: string; dryRun?: boolean;
}): Promise<TxResult> {
  const { publicClient, walletClient, amount, dryRun } = params;
  const account = walletClient.account!;
  const amountWei = parseUnits(amount, 18);

  // Approve xSIGMA spend by VoteModule
  const allowance = await readErc20(ADDRESSES.XSIGMA, rc(publicClient)).read.allowance([account.address, VOTE_MODULE]);
  if (allowance < amountWei) {
    const approveHash = await writeErc20(ADDRESSES.XSIGMA, wc(publicClient, walletClient)).write.approve([VOTE_MODULE, amountWei]);
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
  }

  if (dryRun) {
    await publicClient.simulateContract({
      address: VOTE_MODULE, abi: voteModuleAbi,
      functionName: 'deposit', args: [amountWei],
      account: account.address,
    });
    return { hash: '0x0' as Hash, explorerUrl: 'DRY RUN - not executed' };
  }

  const hash = await writeVoteModule(wc(publicClient, walletClient)).write.deposit([amountWei]);
  await publicClient.waitForTransactionReceipt({ hash });
  return { hash, explorerUrl: txUrl(hash) };
}

/** Unstake xSIGMA from VoteModule */
export async function unstakeXSigma(params: {
  publicClient: PublicClient; walletClient: BscWalletClient; amount: string; dryRun?: boolean;
}): Promise<TxResult> {
  const { publicClient, walletClient, amount, dryRun } = params;
  const account = walletClient.account!;
  const amountWei = parseUnits(amount, 18);

  if (dryRun) {
    await publicClient.simulateContract({
      address: VOTE_MODULE, abi: voteModuleAbi,
      functionName: 'withdraw', args: [amountWei],
      account: account.address,
    });
    return { hash: '0x0' as Hash, explorerUrl: 'DRY RUN - not executed' };
  }

  const hash = await writeVoteModule(wc(publicClient, walletClient)).write.withdraw([amountWei]);
  await publicClient.waitForTransactionReceipt({ hash });
  return { hash, explorerUrl: txUrl(hash) };
}

// ── Auto-Compound ──

export interface CompoundResult {
  rebaseClaimed: boolean;
  gaugesClaimed: string[];
  sigmaConverted: string;
  xsigmaStaked: string;
  voteRefreshed: boolean;
}

export async function compound(params: {
  publicClient: PublicClient;
  walletClient: BscWalletClient;
  vote?: boolean;
  dryRun?: boolean;
}): Promise<CompoundResult> {
  const { publicClient, walletClient, vote, dryRun } = params;
  const account = walletClient.account!;
  const c = rc(publicClient);
  const w = wc(publicClient, walletClient);

  const result: CompoundResult = {
    rebaseClaimed: false,
    gaugesClaimed: [],
    sigmaConverted: '0',
    xsigmaStaked: '0',
    voteRefreshed: false,
  };

  if (dryRun) return result;

  // 1. Claim staking rewards from VoteModule (xSIGMA)
  try {
    const earned = await readVoteModule(c).read.earned([account.address]);
    if (earned > 0n) {
      const hash = await writeVoteModule(w).write.getReward();
      await publicClient.waitForTransactionReceipt({ hash });
      result.rebaseClaimed = true;
    }
  } catch (e) {
    console.error('Warning: Failed to claim rebase:', e instanceof Error ? e.message : e);
  }

  // 2. Claim SIGMA from all gauges where user has staked balance
  const allGauges: { name: string; addr: `0x${string}` }[] = [
    ...Object.entries(GAUGE_POOLS).map(([name, addr]) => ({ name, addr })),
    ...Object.entries(SP_GAUGES).filter(([, addr]) => addr).map(([name, addr]) => ({ name, addr: addr! })),
  ];

  for (const gauge of allGauges) {
    try {
      const staked = await readCurveGauge(gauge.addr, c).read.balanceOf([account.address]);
      if (staked > 0n) {
        const hash = await writeCurveGauge(gauge.addr, w).write.claim_rewards();
        await publicClient.waitForTransactionReceipt({ hash });
        result.gaugesClaimed.push(gauge.name);
      }
    } catch {}
  }

  // 3. Convert any SIGMA balance to xSIGMA
  const sigmaBalance = await readSigma(c).read.balanceOf([account.address]);
  if (sigmaBalance > 0n) {
    try {
      await ensureAllowance(publicClient, walletClient, ADDRESSES.SIGMA, ADDRESSES.XSIGMA, sigmaBalance);
      const hash = await writeXSigma(w).write.convertEmissionsToken([sigmaBalance]);
      await publicClient.waitForTransactionReceipt({ hash });
      result.sigmaConverted = formatUnits(sigmaBalance, 18);
    } catch (e) {
      console.error('Warning: Failed to convert SIGMA:', e instanceof Error ? e.message : e);
    }
  }

  // 4. Stake all xSIGMA into VoteModule
  const xsigmaBalance = await readXSigma(c).read.balanceOf([account.address]);
  if (xsigmaBalance > 0n) {
    try {
      await ensureAllowance(publicClient, walletClient, ADDRESSES.XSIGMA, VOTE_MODULE, xsigmaBalance);
      const hash = await writeVoteModule(w).write.deposit([xsigmaBalance]);
      await publicClient.waitForTransactionReceipt({ hash });
      result.xsigmaStaked = formatUnits(xsigmaBalance, 18);
    } catch (e) {
      console.error('Warning: Failed to stake xSIGMA:', e instanceof Error ? e.message : e);
    }
  }

  // 5. Refresh vote weights if requested
  if (vote) {
    try {
      const { pokeVote } = await import('./governance.js');
      await pokeVote({ publicClient, walletClient });
      result.voteRefreshed = true;
    } catch (e) {
      console.error('Warning: Failed to refresh votes:', e instanceof Error ? e.message : e);
    }
  }

  return result;
}
