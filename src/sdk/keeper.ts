import { type PublicClient, type Hash, type Address, maxUint256 } from 'viem';
import { ADDRESSES } from '../contracts/addresses.js';
import { type BscWalletClient, writeBnbUsdBasePool, readErc20, writeErc20 } from '../contracts/clients.js';
import { bnbusdBasePoolAbi } from '../contracts/abis/BNBUSDBasePool.js';
import type { TxResult } from '../types.js';
import { txUrl } from '../config.js';

// Rebalance and liquidate live on BNBUSDBasePool, not PoolManager
// They take (pool, tokenIn, maxAmount, minBaseOut)

export async function rebalance(params: {
  publicClient: PublicClient; walletClient: BscWalletClient;
  pool?: Address; tokenIn?: Address; maxAmount?: bigint; dryRun?: boolean;
}): Promise<TxResult> {
  const { publicClient, walletClient, dryRun } = params;
  const account = walletClient.account!;
  const targetPool = params.pool || ADDRESSES.BNBUSD_BASE_POOL;
  const tokenIn = params.tokenIn || ADDRESSES.BNBUSD;
  const maxAmount = params.maxAmount || maxUint256;

  if (dryRun) {
    await publicClient.simulateContract({
      address: ADDRESSES.BNBUSD_BASE_POOL, abi: bnbusdBasePoolAbi,
      functionName: 'rebalance', args: [targetPool, tokenIn, maxAmount, 0n],
      account: account.address,
    });
    return { hash: '0x0' as Hash, explorerUrl: 'DRY RUN - not executed' };
  }

  const basePool = writeBnbUsdBasePool({ public: publicClient, wallet: walletClient });
  const hash = await basePool.write.rebalance([targetPool, tokenIn, maxAmount, 0n]);
  await publicClient.waitForTransactionReceipt({ hash });
  return { hash, explorerUrl: txUrl(hash) };
}

export async function liquidate(params: {
  publicClient: PublicClient; walletClient: BscWalletClient;
  pool?: Address; tokenIn?: Address; maxAmount?: bigint; dryRun?: boolean;
}): Promise<TxResult> {
  const { publicClient, walletClient, dryRun } = params;
  const account = walletClient.account!;
  const targetPool = params.pool || ADDRESSES.BNBUSD_BASE_POOL;
  const tokenIn = params.tokenIn || ADDRESSES.BNBUSD;
  const maxAmount = params.maxAmount || maxUint256;

  if (dryRun) {
    await publicClient.simulateContract({
      address: ADDRESSES.BNBUSD_BASE_POOL, abi: bnbusdBasePoolAbi,
      functionName: 'liquidate', args: [targetPool, tokenIn, maxAmount, 0n],
      account: account.address,
    });
    return { hash: '0x0' as Hash, explorerUrl: 'DRY RUN - not executed' };
  }

  const basePool = writeBnbUsdBasePool({ public: publicClient, wallet: walletClient });
  const hash = await basePool.write.liquidate([targetPool, tokenIn, maxAmount, 0n]);
  await publicClient.waitForTransactionReceipt({ hash });
  return { hash, explorerUrl: txUrl(hash) };
}
