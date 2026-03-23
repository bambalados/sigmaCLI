import { type PublicClient, type Hash, parseUnits } from 'viem';
import { ADDRESSES } from '../contracts/addresses.js';
import { type BscWalletClient, readSy, writeSy } from '../contracts/clients.js';
import { syAbi } from '../contracts/abis/SY.js';
import type { TxResult } from '../types.js';
import { txUrl } from '../config.js';

export async function unwrapSy(params: {
  publicClient: PublicClient; walletClient: BscWalletClient; amount: string; dryRun?: boolean;
}): Promise<TxResult> {
  const { publicClient, walletClient, amount, dryRun } = params;
  const account = walletClient.account!;
  const amountWei = parseUnits(amount, 18);
  const yieldToken = await readSy({ public: publicClient }).read.yieldToken();

  if (dryRun) {
    await publicClient.simulateContract({ address: ADDRESSES.SY, abi: syAbi, functionName: 'redeem', args: [account.address, amountWei, yieldToken, 0n, false], account: account.address });
    return { hash: '0x0' as Hash, explorerUrl: 'DRY RUN - not executed' };
  }

  const hash = await writeSy({ public: publicClient, wallet: walletClient }).write.redeem([account.address, amountWei, yieldToken, 0n, false]);
  await publicClient.waitForTransactionReceipt({ hash });
  return { hash, explorerUrl: txUrl(hash) };
}
