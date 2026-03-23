import {
  type PublicClient,
  type Hash,
  parseUnits,
  formatUnits,
} from 'viem';
import { ADDRESSES } from '../contracts/addresses.js';
import { type BscWalletClient, writeWbnb, writeSigmaController, writePoolManager, writeSy } from '../contracts/clients.js';
import { poolManagerAbi } from '../contracts/abis/PoolManager.js';
import { getBnbPrice, getPoolRiskParams, discoverPools } from './read.js';
import type { TxResult, MintResult } from '../types.js';
import { txUrl } from '../config.js';
import { ensureAllowance, extractPositionId } from './utils.js';
import { saveEntry } from '../position-store.js';
import { PRECISION } from './constants.js';

async function wrapBnb(
  publicClient: PublicClient, walletClient: BscWalletClient, amount: bigint,
): Promise<void> {
  const wbnb = writeWbnb({ public: publicClient, wallet: walletClient });
  const hash = await wbnb.write.deposit({ value: amount });
  await publicClient.waitForTransactionReceipt({ hash });
}

// ── Mint Range Calculation ──

export interface MintRangeInfo {
  collateralAmount: string;
  collateralValueUsd: string;
  bnbPrice: string;
  minBorrow: string;
  maxBorrow: string;
  minLtv: string;
  maxLtv: string;
  rebalanceLtv: string;
  liquidateLtv: string;
}

export async function getMintRange(
  publicClient: PublicClient,
  collateralAmount: string,
): Promise<MintRangeInfo> {
  const amountWei = parseUnits(collateralAmount, 18);
  const { price, formatted: bnbPriceFmt } = await getBnbPrice(publicClient);
  const collValueUsd = (amountWei * price) / PRECISION;

  const pools = await discoverPools(publicClient);
  const riskParams = await getPoolRiskParams(publicClient, pools[0]);

  const minDebtRatio = parseFloat(riskParams.minDebtRatio);
  const maxDebtRatio = parseFloat(riskParams.maxDebtRatio);
  const rebalanceRatio = parseFloat(riskParams.rebalanceDebtRatio);
  const liquidateRatio = parseFloat(riskParams.liquidateDebtRatio);

  const collValueNum = Number(formatUnits(collValueUsd, 18));
  const minBorrow = collValueNum * minDebtRatio;
  const maxBorrow = collValueNum * maxDebtRatio;

  return {
    collateralAmount,
    collateralValueUsd: '$' + collValueNum.toFixed(2),
    bnbPrice: '$' + bnbPriceFmt,
    minBorrow: '$' + minBorrow.toFixed(2),
    maxBorrow: '$' + maxBorrow.toFixed(2),
    minLtv: (minDebtRatio * 100).toFixed(2) + '%',
    maxLtv: (maxDebtRatio * 100).toFixed(2) + '%',
    rebalanceLtv: (rebalanceRatio * 100).toFixed(2) + '%',
    liquidateLtv: (liquidateRatio * 100).toFixed(2) + '%',
  };
}

export function computeRebalancePrice(
  collateralAmount: string,
  borrowAmount: string,
  rebalanceDebtRatio: number,
): string {
  const coll = parseFloat(collateralAmount);
  const debt = parseFloat(borrowAmount);
  if (coll <= 0 || rebalanceDebtRatio <= 0) return 'N/A';
  // Rebalance when: debt / (coll * price) >= rebalanceRatio
  // => price <= debt / (coll * rebalanceRatio)
  const rebalPrice = debt / (coll * rebalanceDebtRatio);
  return '$' + rebalPrice.toFixed(2);
}

// ── Position-based Minting (operate) ──

export async function mintWithPosition(params: {
  publicClient: PublicClient;
  walletClient: BscWalletClient;
  collateral: 'BNB' | 'WBNB';
  amount: string;
  borrow: string;
  positionId?: number;
  dryRun?: boolean;
}): Promise<MintResult & { positionId?: string }> {
  const { publicClient, walletClient, collateral, amount, borrow, dryRun, positionId } = params;
  const account = walletClient.account!;
  const amountWei = parseUnits(amount, 18);
  const borrowWei = parseUnits(borrow, 18);
  const posId = BigInt(positionId ?? 0);

  const pools = await discoverPools(publicClient);
  const pool = pools[0];

  if (dryRun) {
    return {
      hash: '0x0' as Hash,
      explorerUrl: 'DRY RUN - not executed',
      amountMinted: borrow + ' bnbUSD',
    };
  }

  // 1. If WBNB, unwrap to native BNB first (SY only accepts native BNB)
  if (collateral === 'WBNB') {
    const wbnb = writeWbnb({ public: publicClient, wallet: walletClient });
    const unwrapHash = await wbnb.write.withdraw([amountWei]);
    await publicClient.waitForTransactionReceipt({ hash: unwrapHash });
  }

  // 2. Deposit native BNB into SY (payable, tokenIn = address(0))
  const NATIVE_BNB = '0x0000000000000000000000000000000000000000' as `0x${string}`;
  const wc = { public: publicClient, wallet: walletClient };
  const sy = writeSy(wc);
  const syHash = await sy.write.deposit(
    [account.address, NATIVE_BNB, amountWei, 0n],
    { value: amountWei },
  );
  const syReceipt = await publicClient.waitForTransactionReceipt({ hash: syHash });

  // Extract SY amount from Transfer event to avoid RPC caching issues
  const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
  const syAddr = ADDRESSES.SY.toLowerCase();
  let syReceived = 0n;
  for (const log of syReceipt.logs) {
    if (log.address.toLowerCase() === syAddr && log.topics[0] === transferTopic) {
      const to = '0x' + (log.topics[2]?.slice(26) ?? '');
      if (to.toLowerCase() === account.address.toLowerCase() && log.data) {
        syReceived = BigInt(log.data);
        break;
      }
    }
  }
  if (syReceived === 0n) throw new Error('SY deposit failed: no Transfer event found');

  // 3. Approve SY to PoolManager
  await ensureAllowance(publicClient, walletClient, ADDRESSES.SY, ADDRESSES.POOL_MANAGER, syReceived);

  // 4. Call operate with SY amount as collateral
  const hash = await writePoolManager(wc).write.operate(
    [pool, posId, BigInt(syReceived), BigInt(borrowWei)],
  );
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  // Save PnL entry (only for new positions)
  try {
    const newPosId = positionId ? null : extractPositionId(receipt);
    if (newPosId) {
      const { price } = await getBnbPrice(publicClient);
      const collValueUsd = (amountWei * price) / PRECISION;
      const equityNum = Number(formatUnits(collValueUsd - borrowWei, 18));
      saveEntry({
        positionId: newPosId,
        walletAddress: account.address,
        poolAddress: pool,
        side: 'long',
        entryColls: formatUnits(amountWei, 18),
        entryDebts: formatUnits(borrowWei, 18),
        entryPrice: '$' + formatUnits(price, 18),
        entryEquity: equityNum.toFixed(6),
        timestamp: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.error('Warning: Failed to save PnL entry:', e instanceof Error ? e.message : e);
  }

  return { hash, explorerUrl: txUrl(hash), positionId: (positionId ?? extractPositionId(receipt))?.toString() };
}

export async function mintAndEarnBnbUsd(params: {
  publicClient: PublicClient;
  walletClient: BscWalletClient;
  collateral: 'BNB' | 'WBNB';
  amount: string;
  minOut?: string;
  dryRun?: boolean;
}): Promise<MintResult> {
  const { publicClient, walletClient, collateral, amount, minOut, dryRun } = params;
  const account = walletClient.account!;
  const amountWei = parseUnits(amount, 18);
  const minOutWei = minOut ? parseUnits(minOut, 18) : 0n;

  if (dryRun) {
    return { hash: '0x0' as Hash, explorerUrl: 'DRY RUN - not executed' };
  }

  if (collateral === 'BNB') {
    await wrapBnb(publicClient, walletClient, amountWei);
  }

  await ensureAllowance(publicClient, walletClient, ADDRESSES.WBNB, ADDRESSES.SIGMA_CONTROLLER, amountWei);

  const controller = writeSigmaController({ public: publicClient, wallet: walletClient });
  const hash = await controller.write.mintAndEarn([ADDRESSES.WBNB, amountWei, account.address, minOutWei]);
  await publicClient.waitForTransactionReceipt({ hash });
  return { hash, explorerUrl: txUrl(hash) };
}

// ── Close / Modify Position (withdraw collateral and/or repay debt) ──

export async function closeMintPosition(params: {
  publicClient: PublicClient;
  walletClient: BscWalletClient;
  positionId: number;
  withdrawCollateral?: string;
  repayDebt?: string;
  dryRun?: boolean;
}): Promise<TxResult> {
  const { publicClient, walletClient, positionId, withdrawCollateral, repayDebt, dryRun } = params;
  const account = walletClient.account!;

  const collDelta = withdrawCollateral ? -parseUnits(withdrawCollateral, 18) : 0n;
  const debtDelta = repayDebt ? -parseUnits(repayDebt, 18) : 0n;

  const pools = await discoverPools(publicClient);
  const pool = pools[0];

  // If repaying debt, approve bnbUSD to PoolManager
  if (repayDebt) {
    const repayWei = parseUnits(repayDebt, 18);
    await ensureAllowance(publicClient, walletClient, ADDRESSES.BNBUSD, ADDRESSES.POOL_MANAGER, repayWei);
  }

  if (dryRun) {
    await publicClient.simulateContract({
      address: ADDRESSES.POOL_MANAGER,
      abi: poolManagerAbi,
      functionName: 'operate',
      args: [pool, BigInt(positionId), collDelta, debtDelta],
      account: account.address,
    });
    return { hash: '0x0' as Hash, explorerUrl: 'DRY RUN - not executed' };
  }

  const wc = { public: publicClient, wallet: walletClient };
  const hash = await writePoolManager(wc).write.operate(
    [pool, BigInt(positionId), collDelta, debtDelta],
  );
  await publicClient.waitForTransactionReceipt({ hash });
  return { hash, explorerUrl: txUrl(hash) };
}
