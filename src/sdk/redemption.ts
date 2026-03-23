import { type PublicClient, type Hash, parseUnits, maxUint256 } from 'viem';
import { ADDRESSES } from '../contracts/addresses.js';
import { type BscWalletClient, writePoolManager, readErc20, writeErc20 } from '../contracts/clients.js';
import { poolManagerAbi } from '../contracts/abis/PoolManager.js';
import type { TxResult } from '../types.js';
import { txUrl } from '../config.js';

export async function redeemBnbUsd(params: {
  publicClient: PublicClient; walletClient: BscWalletClient;
  amount: string; minCollateral?: string; dryRun?: boolean;
}): Promise<TxResult> {
  const { publicClient, walletClient, amount, minCollateral, dryRun } = params;
  const account = walletClient.account!;
  const amountWei = parseUnits(amount, 18);
  const minCollWei = minCollateral ? parseUnits(minCollateral, 18) : 0n;

  const allowance = await readErc20(ADDRESSES.BNBUSD, { public: publicClient }).read.allowance([account.address, ADDRESSES.POOL_MANAGER]);
  if (allowance < amountWei) {
    const hash = await writeErc20(ADDRESSES.BNBUSD, { public: publicClient, wallet: walletClient }).write.approve([ADDRESSES.POOL_MANAGER, maxUint256]);
    await publicClient.waitForTransactionReceipt({ hash });
  }

  // redeem takes individual args (pool, debts, minColls), not arrays
  const pool = ADDRESSES.BNBUSD_BASE_POOL;

  if (dryRun) {
    await publicClient.simulateContract({ address: ADDRESSES.POOL_MANAGER, abi: poolManagerAbi, functionName: 'redeem', args: [pool, amountWei, minCollWei], account: account.address });
    return { hash: '0x0' as Hash, explorerUrl: 'DRY RUN - not executed' };
  }

  const hash = await writePoolManager({ public: publicClient, wallet: walletClient }).write.redeem([pool, amountWei, minCollWei]);
  await publicClient.waitForTransactionReceipt({ hash });
  return { hash, explorerUrl: txUrl(hash) };
}
