import {
  type PublicClient,
  type TransactionReceipt,
  maxUint256,
} from 'viem';
import { type BscWalletClient, readErc20, writeErc20 } from '../contracts/clients.js';
import { ADDRESSES } from '../contracts/addresses.js';

/** Approve `spender` for `amount` of `token` if current allowance is insufficient. */
export async function ensureAllowance(
  publicClient: PublicClient, walletClient: BscWalletClient,
  token: `0x${string}`, spender: `0x${string}`, amount: bigint,
): Promise<void> {
  const account = walletClient.account!;
  const allowance = await readErc20(token, { public: publicClient }).read.allowance([account.address, spender]);
  if (allowance < amount) {
    const hash = await writeErc20(token, { public: publicClient, wallet: walletClient }).write.approve([spender, maxUint256]);
    await publicClient.waitForTransactionReceipt({ hash });
  }
}

/** Extract position ID from PoolManager Operate event in a transaction receipt. */
export function extractPositionId(receipt: TransactionReceipt): number | null {
  // Operate(address indexed pool, uint256 indexed position, int256 deltaColls, int256 deltaDebts, uint256 protocolFees)
  const operateTopic = '0x9a243f0f02273a4b80be965697988a178f95cd11863de2122e69f811445dff44';
  const pmAddr = ADDRESSES.POOL_MANAGER.toLowerCase();
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() === pmAddr && log.topics[0] === operateTopic && log.topics[2]) {
      // topics[2] is the indexed position ID (uint256)
      return Number(BigInt(log.topics[2]));
    }
  }
  return null;
}
