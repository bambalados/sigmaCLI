import {
  type PublicClient,
  type Hash,
  type Address,
  type TransactionReceipt,
  parseUnits,
  formatUnits,
} from 'viem';
import { ADDRESSES, SHORT_POOL } from '../contracts/addresses.js';
import { type BscWalletClient, writePoolManager, writeShortPoolManager, writeWbnb, readIPool, writeSy, readSy } from '../contracts/clients.js';
import { poolManagerAbi } from '../contracts/abis/PoolManager.js';
import { getBnbPrice, discoverPools, getPositionData, getUserPositions, getPoolRiskParams } from './read.js';
import type { CollateralType, TxResult, PositionData } from '../types.js';
import { txUrl } from '../config.js';
import { saveEntry, removeEntry, getEntry } from '../position-store.js';
import { ensureAllowance, extractPositionId } from './utils.js';
import { convertProceeds, convertToNativeBnb, convertToBnbusd, getDefaultOutputToken, type OutputToken } from './swap.js';
import { MIN_LEVERAGE, MAX_LEVERAGE } from './constants.js';

const NATIVE_BNB = '0x0000000000000000000000000000000000000000' as `0x${string}`;

async function unwrapWbnb(
  publicClient: PublicClient, walletClient: BscWalletClient, amount: bigint,
): Promise<void> {
  const wbnb = writeWbnb({ public: publicClient, wallet: walletClient });
  const hash = await wbnb.write.withdraw([amount]);
  await publicClient.waitForTransactionReceipt({ hash });
}

/** Deposit native BNB into SY and return the SY amount received (from receipt logs) */
async function depositBnbToSy(
  publicClient: PublicClient, walletClient: BscWalletClient,
  account: { address: `0x${string}` }, amountWei: bigint,
): Promise<bigint> {
  const wc = { public: publicClient, wallet: walletClient };
  const sy = writeSy(wc);
  const syHash = await sy.write.deposit(
    [account.address, NATIVE_BNB, amountWei, 0n],
    { value: amountWei },
  );
  const receipt = await publicClient.waitForTransactionReceipt({ hash: syHash });

  // Read SY balance at the receipt's block to avoid RPC caching issues
  const syBal = await publicClient.readContract({
    address: ADDRESSES.SY,
    abi: [{ type: 'function', name: 'balanceOf', inputs: [{ name: '', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' }] as const,
    functionName: 'balanceOf',
    args: [account.address],
    blockNumber: receipt.blockNumber,
  });

  // Find the Transfer event to our address to get the exact amount minted
  const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
  const syAddr = ADDRESSES.SY.toLowerCase();
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() === syAddr && log.topics[0] === transferTopic) {
      const to = '0x' + (log.topics[2]?.slice(26) ?? '');
      if (to.toLowerCase() === account.address.toLowerCase() && log.data) {
        return BigInt(log.data);
      }
    }
  }

  // Fallback: return full SY balance at receipt block (less precise but works)
  return syBal;
}

// Discover the actual IPool address for trading from SigmaController.getMarkets()
// Markets are IPool contracts that accept collateral for leveraged positions
let cachedPoolAddresses: Address[] | null = null;

async function getPoolAddresses(publicClient: PublicClient): Promise<Address[]> {
  if (cachedPoolAddresses) return cachedPoolAddresses;
  cachedPoolAddresses = await discoverPools(publicClient);
  return cachedPoolAddresses;
}

// Get the first available pool address (most protocols have one main pool)
async function getDefaultPoolAddress(publicClient: PublicClient): Promise<Address> {
  const pools = await getPoolAddresses(publicClient);
  if (pools.length === 0) throw new Error('No pools discovered from SigmaController.getMarkets()');
  return pools[0];
}

// ── Open Positions ──

export async function openLongPosition(params: {
  publicClient: PublicClient;
  walletClient: BscWalletClient;
  collateral: CollateralType;
  amount: string;
  leverage: number;
  dryRun?: boolean;
}): Promise<TxResult & { positionId?: string }> {
  const { publicClient, walletClient, collateral, amount, leverage, dryRun } = params;
  const account = walletClient.account!;

  if (leverage < MIN_LEVERAGE || leverage > MAX_LEVERAGE) throw new Error(`Leverage must be between ${MIN_LEVERAGE} and ${MAX_LEVERAGE}`);

  const amountWei = parseUnits(amount, 18);
  const pool = await getDefaultPoolAddress(publicClient);

  if (dryRun) {
    return {
      hash: '0x0' as Hash,
      explorerUrl: 'DRY RUN - not executed',
    };
  }

  const wc = { public: publicClient, wallet: walletClient };

  // 1. Convert any collateral to native BNB
  let bnbAmount: bigint;
  if (collateral === 'BNB') {
    bnbAmount = amountWei;
  } else if (collateral === 'WBNB') {
    await unwrapWbnb(publicClient, walletClient, amountWei);
    bnbAmount = amountWei;
  } else {
    const result = await convertToNativeBnb({ publicClient, walletClient, fromToken: collateral, amount: amountWei });
    bnbAmount = result.bnbAmount;
  }

  // 2. Calculate debt based on actual BNB amount after conversion
  const { price } = await getBnbPrice(publicClient);
  const collValueInUsd = (bnbAmount * price) / (10n ** 18n);
  const leverageBps = BigInt(Math.floor(leverage * 1000));
  const debtAmount = (collValueInUsd * (leverageBps - 1000n)) / leverageBps;

  // 3. Deposit native BNB into SY (payable, tokenIn = address(0))
  const syBal = await depositBnbToSy(publicClient, walletClient, account, bnbAmount);

  // 4. Approve SY to PoolManager and operate
  await ensureAllowance(publicClient, walletClient, ADDRESSES.SY, ADDRESSES.POOL_MANAGER, syBal);

  const hash = await writePoolManager(wc).write.operate([pool, 0n, BigInt(syBal), BigInt(debtAmount)]);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  try {
    const posId = extractPositionId(receipt);
    if (posId) {
      const equityNum = Number(formatUnits(collValueInUsd - debtAmount, 18));
      saveEntry({ positionId: posId, walletAddress: account.address, poolAddress: pool, side: 'long', entryColls: formatUnits(bnbAmount, 18), entryDebts: formatUnits(debtAmount, 18), entryPrice: '$' + formatUnits(price, 18), entryEquity: equityNum.toFixed(6), timestamp: new Date().toISOString() });
    }
  } catch (e) {
    console.error('Warning: Failed to save PnL entry:', e instanceof Error ? e.message : e);
  }

  return { hash, explorerUrl: txUrl(hash), positionId: extractPositionId(receipt)?.toString() };
}

export async function openShortPosition(params: {
  publicClient: PublicClient;
  walletClient: BscWalletClient;
  collateral: CollateralType;
  amount: string;
  leverage: number;
  dryRun?: boolean;
}): Promise<TxResult & { positionId?: string }> {
  const { publicClient, walletClient, collateral, amount, leverage, dryRun } = params;
  const account = walletClient.account!;

  if (leverage < MIN_LEVERAGE || leverage > MAX_LEVERAGE) throw new Error(`Leverage must be between ${MIN_LEVERAGE} and ${MAX_LEVERAGE}`);

  const amountWei = parseUnits(amount, 18);

  // Convert any collateral to bnbUSD
  let bnbusdAmount: bigint;
  if (collateral === 'bnbUSD') {
    bnbusdAmount = amountWei;
  } else {
    if (dryRun) {
      return { hash: '0x0' as Hash, explorerUrl: 'DRY RUN - not executed' };
    }
    const result = await convertToBnbusd({ publicClient, walletClient, fromToken: collateral, amount: amountWei });
    bnbusdAmount = result.bnbusdAmount;
  }

  const { price } = await getBnbPrice(publicClient);

  // For shorts: collateral is bnbUSD, debt is SY (volatile asset).
  // debt in SY terms = collValue_usd * (L-1) / L / bnbPrice
  const leverageBps = BigInt(Math.floor(leverage * 1000));
  const debtValueUsd = (bnbusdAmount * (leverageBps - 1000n)) / leverageBps;
  // Convert USD debt value to SY units (divide by BNB price)
  const debtInSy = (debtValueUsd * (10n ** 18n)) / price;

  const pool = SHORT_POOL;

  if (dryRun) {
    return {
      hash: '0x0' as Hash,
      explorerUrl: 'DRY RUN - not executed',
    };
  }

  // Approve bnbUSD to ShortPoolManager
  await ensureAllowance(publicClient, walletClient, ADDRESSES.BNBUSD, ADDRESSES.SHORT_POOL_MANAGER, bnbusdAmount);

  const hash = await writeShortPoolManager({ public: publicClient, wallet: walletClient }).write.operate(
    [pool, 0n, BigInt(bnbusdAmount), BigInt(debtInSy)],
  );
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  // Extract position ID from Operate event (ShortPoolManager emits same event)
  const posId = extractShortPositionId(receipt);

  // Save entry for PnL tracking
  try {
    if (posId) {
      const equityNum = Number(formatUnits(bnbusdAmount - debtValueUsd, 18));
      saveEntry({
        positionId: posId,
        walletAddress: account.address,
        poolAddress: pool,
        side: 'short',
        entryColls: formatUnits(bnbusdAmount, 18),
        entryDebts: formatUnits(debtInSy, 18),
        entryPrice: '$' + formatUnits(price, 18),
        entryEquity: equityNum.toFixed(6),
        timestamp: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.error('Warning: Failed to save PnL entry:', e instanceof Error ? e.message : e);
  }

  return { hash, explorerUrl: txUrl(hash), positionId: posId?.toString() };
}

/** Extract position ID from ShortPoolManager Operate event */
function extractShortPositionId(receipt: TransactionReceipt): number | null {
  const operateTopic = '0x9a243f0f02273a4b80be965697988a178f95cd11863de2122e69f811445dff44';
  const spmAddr = ADDRESSES.SHORT_POOL_MANAGER.toLowerCase();
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() === spmAddr && log.topics[0] === operateTopic && log.topics[2]) {
      return Number(BigInt(log.topics[2]));
    }
  }
  return null;
}

// ── Close Position ──

export async function closePosition(params: {
  publicClient: PublicClient;
  walletClient: BscWalletClient;
  positionId: number;
  percent: number;
  outputToken?: OutputToken;
  dryRun?: boolean;
}): Promise<TxResult & { outputAmount?: string; outputTokenName?: string }> {
  const { publicClient, walletClient, positionId, percent, dryRun } = params;
  const account = walletClient.account!;

  // Auto-detect if this is a short position from the position store
  const entry = getEntry(account.address, positionId);
  const isShort = entry?.side === 'short';

  // Pick the right pool and manager based on position side
  const pool = isShort ? SHORT_POOL : await getDefaultPoolAddress(publicClient);
  const managerAddress = isShort ? ADDRESSES.SHORT_POOL_MANAGER : ADDRESSES.POOL_MANAGER;

  // Read current position from the pool
  const ipool = readIPool(pool, { public: publicClient });
  const [rawColls, rawDebts] = await ipool.read.getPosition([BigInt(positionId)]);

  if (rawColls === 0n && rawDebts === 0n) {
    throw new Error(`Position ${positionId} not found or already closed`);
  }

  // Calculate deltas for partial/full close
  let collDelta: bigint;
  let debtDelta: bigint;

  if (percent >= 100) {
    const INT256_MIN = -(2n ** 255n);
    collDelta = INT256_MIN;
    debtDelta = INT256_MIN;
  } else {
    collDelta = -(rawColls * BigInt(percent)) / 100n;
    debtDelta = -(rawDebts * BigInt(percent)) / 100n;
  }

  if (isShort) {
    // Short: debt is in WBNB (user received WBNB when opening).
    // To close, user must return WBNB to repay the debt.
    if (debtDelta < 0n) {
      const debtToRepay = -debtDelta;
      await ensureAllowance(publicClient, walletClient, ADDRESSES.WBNB, ADDRESSES.SHORT_POOL_MANAGER, debtToRepay);
    }
  } else {
    // Long: need bnbUSD to repay debt
    if (debtDelta < 0n) {
      const debtToRepay = -debtDelta;
      await ensureAllowance(publicClient, walletClient, ADDRESSES.BNBUSD, ADDRESSES.POOL_MANAGER, debtToRepay);
    }
  }

  if (dryRun) {
    await publicClient.simulateContract({
      address: managerAddress, abi: poolManagerAbi, functionName: 'operate',
      args: [pool, BigInt(positionId), collDelta, debtDelta],
      account: account.address,
    });
    return { hash: '0x0' as Hash, explorerUrl: 'DRY RUN - not executed' };
  }

  const writeManager = isShort
    ? writeShortPoolManager({ public: publicClient, wallet: walletClient })
    : writePoolManager({ public: publicClient, wallet: walletClient });

  const side: 'long' | 'short' = isShort ? 'short' : 'long';
  const desiredOutput = params.outputToken ?? getDefaultOutputToken(side);

  const balanceOfAbi = [{ type: 'function', name: 'balanceOf', inputs: [{ name: '', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' }] as const;

  // Snapshot balances before close so we only convert the delta (proceeds)
  const [syBefore, slisBefore, bnbusdBefore] = await Promise.all([
    !isShort ? readSy({ public: publicClient }).read.balanceOf([account.address]) : Promise.resolve(0n),
    !isShort ? publicClient.readContract({ address: ADDRESSES.SLISBNB, abi: balanceOfAbi, functionName: 'balanceOf', args: [account.address] }) : Promise.resolve(0n),
    isShort ? publicClient.readContract({ address: ADDRESSES.BNBUSD, abi: balanceOfAbi, functionName: 'balanceOf', args: [account.address] }) : Promise.resolve(0n),
  ]);

  const hash = await writeManager.write.operate(
    [pool, BigInt(positionId), collDelta, debtDelta],
  );
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  let outputAmount: string | undefined;
  let outputTokenName: string | undefined;

  if (!isShort) {
    // Long close: SY is returned as collateral. Redeem SY → slisBNB first.
    try {
      const syAfter = await publicClient.readContract({
        address: ADDRESSES.SY, abi: balanceOfAbi,
        functionName: 'balanceOf', args: [account.address],
        blockNumber: receipt.blockNumber,
      });
      const syDelta = syAfter - syBefore;
      if (syDelta > 0n) {
        const sy = writeSy({ public: publicClient, wallet: walletClient });
        const redeemHash = await sy.write.redeem([account.address, syDelta, ADDRESSES.SLISBNB, 0n, false]);
        await publicClient.waitForTransactionReceipt({ hash: redeemHash });
      }
    } catch (e) {
      console.error('Warning: SY redeem failed:', e instanceof Error ? e.message : e);
    }

    // Convert slisBNB proceeds to desired output token
    if (desiredOutput !== 'slisBNB') {
      const slisAfter = await publicClient.readContract({
        address: ADDRESSES.SLISBNB, abi: balanceOfAbi,
        functionName: 'balanceOf', args: [account.address],
      });
      const slisDelta = slisAfter - slisBefore;
      if (slisDelta > 0n) {
        try {
          const result = await convertProceeds({
            publicClient, walletClient,
            fromToken: 'slisBNB',
            toToken: desiredOutput,
            amount: slisDelta,
          });
          outputAmount = formatUnits(result.outputAmount, 18);
          outputTokenName = result.outputToken;
        } catch (e) {
          console.error('Warning: Failed to convert slisBNB proceeds:', e instanceof Error ? e.message : e);
          outputAmount = formatUnits(slisDelta, 18);
          outputTokenName = 'slisBNB (unconverted)';
        }
      }
    }
  } else {
    // Short close: bnbUSD is returned as collateral. Convert if needed.
    if (desiredOutput !== 'bnbUSD') {
      const bnbusdAfter = await publicClient.readContract({
        address: ADDRESSES.BNBUSD, abi: balanceOfAbi,
        functionName: 'balanceOf', args: [account.address],
        blockNumber: receipt.blockNumber,
      });
      const bnbusdDelta = bnbusdAfter - bnbusdBefore;
      if (bnbusdDelta > 0n) {
        try {
          const result = await convertProceeds({
            publicClient, walletClient,
            fromToken: 'bnbUSD',
            toToken: desiredOutput,
            amount: bnbusdDelta,
          });
          outputAmount = formatUnits(result.outputAmount, 18);
          outputTokenName = result.outputToken;
        } catch (e) {
          console.error('Warning: Failed to convert bnbUSD proceeds:', e instanceof Error ? e.message : e);
          outputAmount = formatUnits(bnbusdDelta, 18);
          outputTokenName = 'bnbUSD (unconverted)';
        }
      }
    }
  }

  // Remove PnL entry on full close
  if (percent >= 100) {
    try { removeEntry(account.address, positionId); } catch {}
  }

  return { hash, explorerUrl: txUrl(hash), outputAmount, outputTokenName };
}

// ── Adjust Leverage ──

export async function adjustLeverage(params: {
  publicClient: PublicClient;
  walletClient: BscWalletClient;
  positionId: number;
  newLeverage: number;
  dryRun?: boolean;
}): Promise<TxResult> {
  const { publicClient, walletClient, positionId, newLeverage, dryRun } = params;
  const account = walletClient.account!;

  if (newLeverage < MIN_LEVERAGE || newLeverage > MAX_LEVERAGE) throw new Error(`Leverage must be between ${MIN_LEVERAGE} and ${MAX_LEVERAGE}`);

  // Auto-detect short positions
  const entry = getEntry(account.address, positionId);
  const isShort = entry?.side === 'short';
  const pool = isShort ? SHORT_POOL : await getDefaultPoolAddress(publicClient);
  const managerAddress = isShort ? ADDRESSES.SHORT_POOL_MANAGER : ADDRESSES.POOL_MANAGER;

  const ipool = readIPool(pool, { public: publicClient });
  const [rawColls, rawDebts] = await ipool.read.getPosition([BigInt(positionId)]);

  if (rawColls === 0n && rawDebts === 0n) {
    throw new Error(`Position ${positionId} not found`);
  }

  const { price } = await getBnbPrice(publicClient);

  let debtDelta: bigint;

  if (isShort) {
    // Short: collateral is bnbUSD (rawColls), debt is SY (rawDebts)
    // collValue in USD = rawColls (already in bnbUSD)
    // debtValue in USD = rawDebts * price
    const debtValueUsd = (rawDebts * price) / (10n ** 18n);
    const equity = rawColls - debtValueUsd;
    // targetDebtUsd = rawColls - rawColls/leverage
    const targetDebtUsd = rawColls - (rawColls * 1000n) / BigInt(Math.floor(newLeverage * 1000));
    // Convert USD target to SY units
    const targetDebtSy = (targetDebtUsd * (10n ** 18n)) / price;
    debtDelta = targetDebtSy - rawDebts;

    if (debtDelta < 0n) {
      // Decreasing short leverage — repay WBNB debt
      await ensureAllowance(publicClient, walletClient, ADDRESSES.WBNB, ADDRESSES.SHORT_POOL_MANAGER, -debtDelta);
    }
  } else {
    // Long: collateral is SY (rawColls), debt is bnbUSD (rawDebts)
    const collValue = (rawColls * price) / (10n ** 18n);
    const targetDebt = collValue - (collValue * 1000n) / BigInt(Math.floor(newLeverage * 1000));
    debtDelta = targetDebt - rawDebts;

    if (debtDelta < 0n) {
      await ensureAllowance(publicClient, walletClient, ADDRESSES.BNBUSD, ADDRESSES.POOL_MANAGER, -debtDelta);
    }
  }

  if (dryRun) {
    await publicClient.simulateContract({
      address: managerAddress, abi: poolManagerAbi, functionName: 'operate',
      args: [pool, BigInt(positionId), 0n, debtDelta],
      account: account.address,
    });
    return { hash: '0x0' as Hash, explorerUrl: 'DRY RUN - not executed' };
  }

  const writeManager = isShort
    ? writeShortPoolManager({ public: publicClient, wallet: walletClient })
    : writePoolManager({ public: publicClient, wallet: walletClient });

  const hash = await writeManager.write.operate(
    [pool, BigInt(positionId), 0n, debtDelta],
  );
  await publicClient.waitForTransactionReceipt({ hash });
  return { hash, explorerUrl: txUrl(hash) };
}

// ── Add Collateral ──

export async function addToPosition(params: {
  publicClient: PublicClient;
  walletClient: BscWalletClient;
  positionId: number;
  collateral: CollateralType;
  amount: string;
  dryRun?: boolean;
}): Promise<TxResult> {
  const { publicClient, walletClient, positionId, collateral, amount, dryRun } = params;
  const account = walletClient.account!;
  const amountWei = parseUnits(amount, 18);

  // Auto-detect short positions
  const entry = getEntry(account.address, positionId);
  const isShort = entry?.side === 'short';
  const pool = isShort ? SHORT_POOL : await getDefaultPoolAddress(publicClient);

  if (dryRun) {
    return { hash: '0x0' as Hash, explorerUrl: 'DRY RUN - not executed' };
  }

  if (isShort) {
    // Short: convert any collateral to bnbUSD
    let bnbusdAmount: bigint;
    if (collateral === 'bnbUSD') {
      bnbusdAmount = amountWei;
    } else {
      const result = await convertToBnbusd({ publicClient, walletClient, fromToken: collateral, amount: amountWei });
      bnbusdAmount = result.bnbusdAmount;
    }
    await ensureAllowance(publicClient, walletClient, ADDRESSES.BNBUSD, ADDRESSES.SHORT_POOL_MANAGER, bnbusdAmount);
    const hash = await writeShortPoolManager({ public: publicClient, wallet: walletClient }).write.operate(
      [pool, BigInt(positionId), BigInt(bnbusdAmount), 0n],
    );
    await publicClient.waitForTransactionReceipt({ hash });
    return { hash, explorerUrl: txUrl(hash) };
  } else {
    // Long: convert any collateral to native BNB → SY
    let bnbAmount: bigint;
    if (collateral === 'BNB') {
      bnbAmount = amountWei;
    } else if (collateral === 'WBNB') {
      await unwrapWbnb(publicClient, walletClient, amountWei);
      bnbAmount = amountWei;
    } else {
      const result = await convertToNativeBnb({ publicClient, walletClient, fromToken: collateral, amount: amountWei });
      bnbAmount = result.bnbAmount;
    }
    const syBal = await depositBnbToSy(publicClient, walletClient, account, bnbAmount);
    await ensureAllowance(publicClient, walletClient, ADDRESSES.SY, ADDRESSES.POOL_MANAGER, syBal);
    const hash = await writePoolManager({ public: publicClient, wallet: walletClient }).write.operate(
      [pool, BigInt(positionId), BigInt(syBal), 0n],
    );
    await publicClient.waitForTransactionReceipt({ hash });
    return { hash, explorerUrl: txUrl(hash) };
  }
}

// ── Position Summary ──

export async function getPositionSummary(
  publicClient: PublicClient,
  positionId: number,
  walletAddress?: `0x${string}`,
): Promise<PositionData | null> {
  // Check if this is a short position (try short pool first if entry exists)
  if (walletAddress) {
    const entry = getEntry(walletAddress, positionId);
    if (entry?.side === 'short') {
      return getPositionData(publicClient, SHORT_POOL, BigInt(positionId), walletAddress);
    }
  }

  // Try long pool first
  const longResult = await getPositionData(publicClient, await getDefaultPoolAddress(publicClient), BigInt(positionId), walletAddress);
  if (longResult) return longResult;

  // Fallback: try short pool
  return getPositionData(publicClient, SHORT_POOL, BigInt(positionId), walletAddress);
}

export async function listUserPositions(
  publicClient: PublicClient,
  userAddress: `0x${string}`,
): Promise<PositionData[]> {
  // Query both long and short pools
  const pools = await getPoolAddresses(publicClient);
  const allPools = [...pools, SHORT_POOL];
  const allPositions: PositionData[] = [];

  for (const pool of allPools) {
    const positions = await getUserPositions(publicClient, pool, userAddress);
    allPositions.push(...positions);
  }

  return allPositions;
}
