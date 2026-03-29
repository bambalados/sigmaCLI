import {
  type PublicClient,
  formatUnits,
  encodeFunctionData,
} from 'viem';
import { ADDRESSES } from '../contracts/addresses.js';
import {
  type BscWalletClient,
  readCurvePool,
  writeCurvePool,
  writeWbnb,
  readErc20,
} from '../contracts/clients.js';
import { pancakeSwapRouterAbi, pancakeQuoterAbi } from '../contracts/abis/PancakeSwapV3.js';
import { ensureAllowance } from './utils.js';

export type OutputToken = 'BNB' | 'WBNB' | 'USDT' | 'bnbUSD' | 'slisBNB';

// Curve bnbUSD-USDT pool: coins[0] = USDT, coins[1] = bnbUSD (int128 → bigint)
const CURVE_BNBUSD_IDX = 1n;
const CURVE_USDT_IDX = 0n;

// PancakeSwap V3 fee tiers (uint24 → number; fee 100 has best rate for slisBNB/WBNB)
const SLISBNB_WBNB_FEE = 100;
const WBNB_USDT_FEE = 500;
const USDT_WBNB_FEE = 500;

// ── Quote Functions ──

/** Get Curve quote: bnbUSD → USDT */
export async function quoteBnbusdToUsdt(
  publicClient: PublicClient, amount: bigint,
): Promise<bigint> {
  const pool = readCurvePool(ADDRESSES.CURVE_BNBUSD_USDT, { public: publicClient });
  return pool.read.get_dy([CURVE_BNBUSD_IDX, CURVE_USDT_IDX, amount]);
}

/** Get Curve quote: USDT → bnbUSD */
export async function quoteUsdtToBnbusd(
  publicClient: PublicClient, amount: bigint,
): Promise<bigint> {
  const pool = readCurvePool(ADDRESSES.CURVE_BNBUSD_USDT, { public: publicClient });
  return pool.read.get_dy([CURVE_USDT_IDX, CURVE_BNBUSD_IDX, amount]);
}

/** Get PancakeSwap V3 quote for a single-hop swap */
async function quotePcsV3(
  publicClient: PublicClient,
  tokenIn: `0x${string}`, tokenOut: `0x${string}`,
  amountIn: bigint, fee: number,
): Promise<bigint> {
  const result = await publicClient.simulateContract({
    address: ADDRESSES.PANCAKE_V3_QUOTER,
    abi: pancakeQuoterAbi,
    functionName: 'quoteExactInputSingle',
    args: [{
      tokenIn, tokenOut, amountIn,
      fee, sqrtPriceLimitX96: 0n,
    }],
  });
  return result.result[0];
}

/** Get quote: slisBNB → WBNB */
export async function quoteSlisbnbToWbnb(
  publicClient: PublicClient, amount: bigint,
): Promise<bigint> {
  return quotePcsV3(publicClient, ADDRESSES.SLISBNB, ADDRESSES.WBNB, amount, SLISBNB_WBNB_FEE);
}

/** Get quote: WBNB → USDT */
export async function quoteWbnbToUsdt(
  publicClient: PublicClient, amount: bigint,
): Promise<bigint> {
  return quotePcsV3(publicClient, ADDRESSES.WBNB, ADDRESSES.USDT, amount, WBNB_USDT_FEE);
}

/** Get quote: USDT → WBNB */
export async function quoteUsdtToWbnb(
  publicClient: PublicClient, amount: bigint,
): Promise<bigint> {
  return quotePcsV3(publicClient, ADDRESSES.USDT, ADDRESSES.WBNB, amount, USDT_WBNB_FEE);
}

// ── Swap Functions ──

/** Swap bnbUSD → USDT via Curve bnbUSD-USDT pool */
async function swapBnbusdToUsdt(
  publicClient: PublicClient, walletClient: BscWalletClient,
  amount: bigint, minOut: bigint,
): Promise<bigint> {
  await ensureAllowance(publicClient, walletClient, ADDRESSES.BNBUSD, ADDRESSES.CURVE_BNBUSD_USDT, amount);
  const pool = writeCurvePool(ADDRESSES.CURVE_BNBUSD_USDT, { public: publicClient, wallet: walletClient });
  const hash = await pool.write.exchange([CURVE_BNBUSD_IDX, CURVE_USDT_IDX, amount, minOut]);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return parseTransferAmount(receipt.logs, ADDRESSES.USDT, walletClient.account!.address);
}

/** Swap USDT → bnbUSD via Curve bnbUSD-USDT pool */
async function swapUsdtToBnbusd(
  publicClient: PublicClient, walletClient: BscWalletClient,
  amount: bigint, minOut: bigint,
): Promise<bigint> {
  await ensureAllowance(publicClient, walletClient, ADDRESSES.USDT, ADDRESSES.CURVE_BNBUSD_USDT, amount);
  const pool = writeCurvePool(ADDRESSES.CURVE_BNBUSD_USDT, { public: publicClient, wallet: walletClient });
  const hash = await pool.write.exchange([CURVE_USDT_IDX, CURVE_BNBUSD_IDX, amount, minOut]);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return parseTransferAmount(receipt.logs, ADDRESSES.BNBUSD, walletClient.account!.address);
}

/** Swap via PancakeSwap V3 exactInputSingle */
async function swapPcsV3(
  publicClient: PublicClient, walletClient: BscWalletClient,
  tokenIn: `0x${string}`, tokenOut: `0x${string}`,
  fee: number, amount: bigint, minOut: bigint,
  recipient: `0x${string}`,
): Promise<bigint> {
  await ensureAllowance(publicClient, walletClient, tokenIn, ADDRESSES.PANCAKE_V3_ROUTER, amount);
  const hash = await walletClient.writeContract({
    address: ADDRESSES.PANCAKE_V3_ROUTER,
    abi: pancakeSwapRouterAbi,
    functionName: 'exactInputSingle',
    args: [{
      tokenIn, tokenOut, fee,
      recipient,
      amountIn: amount,
      amountOutMinimum: minOut,
      sqrtPriceLimitX96: 0n,
    }],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return parseTransferAmount(receipt.logs, tokenOut, recipient);
}

/** Unwrap WBNB → native BNB */
async function unwrapWbnbToNative(
  publicClient: PublicClient, walletClient: BscWalletClient,
  amount: bigint,
): Promise<void> {
  const wbnb = writeWbnb({ public: publicClient, wallet: walletClient });
  const hash = await wbnb.write.withdraw([amount]);
  await publicClient.waitForTransactionReceipt({ hash });
}

/** Wrap native BNB → WBNB */
export async function wrapBnbToWbnb(
  publicClient: PublicClient, walletClient: BscWalletClient,
  amount: bigint,
): Promise<void> {
  const wbnb = writeWbnb({ public: publicClient, wallet: walletClient });
  const hash = await wbnb.write.deposit({ value: amount });
  await publicClient.waitForTransactionReceipt({ hash });
}

// ── Pre-Conversion: Convert any collateral to native BNB ──

export async function convertToNativeBnb(params: {
  publicClient: PublicClient;
  walletClient: BscWalletClient;
  fromToken: 'BNB' | 'WBNB' | 'USDT' | 'bnbUSD';
  amount: bigint;
  slippage?: number;
}): Promise<{ bnbAmount: bigint }> {
  const { publicClient, walletClient, fromToken, amount, slippage = 0.5 } = params;
  const account = walletClient.account!;
  const applySlip = (quote: bigint): bigint =>
    quote * BigInt(Math.floor((100 - slippage) * 100)) / 10000n;

  if (fromToken === 'BNB') {
    return { bnbAmount: amount };
  }

  if (fromToken === 'WBNB') {
    await unwrapWbnbToNative(publicClient, walletClient, amount);
    return { bnbAmount: amount };
  }

  if (fromToken === 'USDT') {
    // USDT → WBNB → unwrap → BNB
    const wbnbQuote = await quoteUsdtToWbnb(publicClient, amount);
    const wbnbOut = await swapPcsV3(
      publicClient, walletClient,
      ADDRESSES.USDT, ADDRESSES.WBNB,
      USDT_WBNB_FEE, amount, applySlip(wbnbQuote),
      account.address,
    );
    await unwrapWbnbToNative(publicClient, walletClient, wbnbOut);
    return { bnbAmount: wbnbOut };
  }

  // bnbUSD → USDT → WBNB → unwrap → BNB
  const usdtQuote = await quoteBnbusdToUsdt(publicClient, amount);
  const usdtOut = await swapBnbusdToUsdt(publicClient, walletClient, amount, applySlip(usdtQuote));
  const wbnbQuote = await quoteUsdtToWbnb(publicClient, usdtOut);
  const wbnbOut = await swapPcsV3(
    publicClient, walletClient,
    ADDRESSES.USDT, ADDRESSES.WBNB,
    USDT_WBNB_FEE, usdtOut, applySlip(wbnbQuote),
    account.address,
  );
  await unwrapWbnbToNative(publicClient, walletClient, wbnbOut);
  return { bnbAmount: wbnbOut };
}

// ── Pre-Conversion: Convert any collateral to bnbUSD ──

export async function convertToBnbusd(params: {
  publicClient: PublicClient;
  walletClient: BscWalletClient;
  fromToken: 'BNB' | 'WBNB' | 'USDT' | 'bnbUSD';
  amount: bigint;
  slippage?: number;
}): Promise<{ bnbusdAmount: bigint }> {
  const { publicClient, walletClient, fromToken, amount, slippage = 0.5 } = params;
  const account = walletClient.account!;
  const applySlip = (quote: bigint): bigint =>
    quote * BigInt(Math.floor((100 - slippage) * 100)) / 10000n;

  if (fromToken === 'bnbUSD') {
    return { bnbusdAmount: amount };
  }

  if (fromToken === 'USDT') {
    // USDT → bnbUSD via Curve
    const bnbusdQuote = await quoteUsdtToBnbusd(publicClient, amount);
    const bnbusdOut = await swapUsdtToBnbusd(publicClient, walletClient, amount, applySlip(bnbusdQuote));
    return { bnbusdAmount: bnbusdOut };
  }

  let wbnbAmount = amount;
  if (fromToken === 'BNB') {
    // Wrap BNB → WBNB first
    await wrapBnbToWbnb(publicClient, walletClient, amount);
    wbnbAmount = amount;
  }

  // WBNB → USDT → bnbUSD
  const usdtQuote = await quoteWbnbToUsdt(publicClient, wbnbAmount);
  const usdtOut = await swapPcsV3(
    publicClient, walletClient,
    ADDRESSES.WBNB, ADDRESSES.USDT,
    WBNB_USDT_FEE, wbnbAmount, applySlip(usdtQuote),
    account.address,
  );
  const bnbusdQuote = await quoteUsdtToBnbusd(publicClient, usdtOut);
  const bnbusdOut = await swapUsdtToBnbusd(publicClient, walletClient, usdtOut, applySlip(bnbusdQuote));
  return { bnbusdAmount: bnbusdOut };
}

// ── Main Conversion Router ──

/**
 * Convert position close proceeds to the desired output token.
 *
 * @param fromToken - The token received from closing (slisBNB for longs, bnbUSD for shorts)
 * @param toToken - The desired output token
 * @param amount - Amount of fromToken to convert
 * @param slippage - Slippage tolerance (default 0.5%)
 * @returns The amount of output token received
 */
export async function convertProceeds(params: {
  publicClient: PublicClient;
  walletClient: BscWalletClient;
  fromToken: 'slisBNB' | 'bnbUSD';
  toToken: OutputToken;
  amount: bigint;
  slippage?: number;
}): Promise<{ outputAmount: bigint; outputToken: OutputToken }> {
  const { publicClient, walletClient, fromToken, toToken, amount, slippage = 0.5 } = params;
  const account = walletClient.account!;

  // No conversion needed
  if (
    (fromToken === 'slisBNB' && toToken === 'slisBNB') ||
    (fromToken === 'bnbUSD' && toToken === 'bnbUSD')
  ) {
    return { outputAmount: amount, outputToken: toToken };
  }

  const applySlippage = (quote: bigint): bigint =>
    quote * BigInt(Math.floor((100 - slippage) * 100)) / 10000n;

  if (fromToken === 'slisBNB') {
    // ── Long close output conversion ──
    switch (toToken) {
      case 'WBNB': {
        const quote = await quoteSlisbnbToWbnb(publicClient, amount);
        const out = await swapPcsV3(
          publicClient, walletClient,
          ADDRESSES.SLISBNB, ADDRESSES.WBNB,
          SLISBNB_WBNB_FEE, amount, applySlippage(quote),
          account.address,
        );
        return { outputAmount: out, outputToken: 'WBNB' };
      }
      case 'BNB': {
        // slisBNB → WBNB → unwrap
        const quote = await quoteSlisbnbToWbnb(publicClient, amount);
        const wbnbOut = await swapPcsV3(
          publicClient, walletClient,
          ADDRESSES.SLISBNB, ADDRESSES.WBNB,
          SLISBNB_WBNB_FEE, amount, applySlippage(quote),
          account.address,
        );
        await unwrapWbnbToNative(publicClient, walletClient, wbnbOut);
        return { outputAmount: wbnbOut, outputToken: 'BNB' };
      }
      case 'USDT': {
        // slisBNB → WBNB → USDT
        const wbnbQuote = await quoteSlisbnbToWbnb(publicClient, amount);
        const wbnbOut = await swapPcsV3(
          publicClient, walletClient,
          ADDRESSES.SLISBNB, ADDRESSES.WBNB,
          SLISBNB_WBNB_FEE, amount, applySlippage(wbnbQuote),
          account.address,
        );
        const usdtQuote = await quoteWbnbToUsdt(publicClient, wbnbOut);
        const usdtOut = await swapPcsV3(
          publicClient, walletClient,
          ADDRESSES.WBNB, ADDRESSES.USDT,
          WBNB_USDT_FEE, wbnbOut, applySlippage(usdtQuote),
          account.address,
        );
        return { outputAmount: usdtOut, outputToken: 'USDT' };
      }
      case 'bnbUSD': {
        // slisBNB → WBNB → USDT → bnbUSD (3 hops)
        const wbnbQuote2 = await quoteSlisbnbToWbnb(publicClient, amount);
        const wbnbOut2 = await swapPcsV3(
          publicClient, walletClient,
          ADDRESSES.SLISBNB, ADDRESSES.WBNB,
          SLISBNB_WBNB_FEE, amount, applySlippage(wbnbQuote2),
          account.address,
        );
        const usdtQuote2 = await quoteWbnbToUsdt(publicClient, wbnbOut2);
        const usdtOut2 = await swapPcsV3(
          publicClient, walletClient,
          ADDRESSES.WBNB, ADDRESSES.USDT,
          WBNB_USDT_FEE, wbnbOut2, applySlippage(usdtQuote2),
          account.address,
        );
        const bnbusdQuote = await quoteUsdtToBnbusd(publicClient, usdtOut2);
        const bnbusdOut = await swapUsdtToBnbusd(
          publicClient, walletClient,
          usdtOut2, applySlippage(bnbusdQuote),
        );
        return { outputAmount: bnbusdOut, outputToken: 'bnbUSD' };
      }
      default:
        throw new Error(`Unsupported output token: ${toToken}`);
    }
  } else {
    // ── Short close output conversion (from bnbUSD) ──
    switch (toToken) {
      case 'USDT': {
        const quote = await quoteBnbusdToUsdt(publicClient, amount);
        const out = await swapBnbusdToUsdt(
          publicClient, walletClient,
          amount, applySlippage(quote),
        );
        return { outputAmount: out, outputToken: 'USDT' };
      }
      case 'WBNB': {
        // bnbUSD → USDT via Curve → USDT → WBNB via PCS V3
        const usdtQuote = await quoteBnbusdToUsdt(publicClient, amount);
        const usdtOut = await swapBnbusdToUsdt(
          publicClient, walletClient,
          amount, applySlippage(usdtQuote),
        );
        const wbnbQuote = await quoteUsdtToWbnb(publicClient, usdtOut);
        const wbnbOut = await swapPcsV3(
          publicClient, walletClient,
          ADDRESSES.USDT, ADDRESSES.WBNB,
          USDT_WBNB_FEE, usdtOut, applySlippage(wbnbQuote),
          account.address,
        );
        return { outputAmount: wbnbOut, outputToken: 'WBNB' };
      }
      case 'BNB': {
        // bnbUSD → USDT → WBNB → unwrap
        const usdtQuote = await quoteBnbusdToUsdt(publicClient, amount);
        const usdtOut = await swapBnbusdToUsdt(
          publicClient, walletClient,
          amount, applySlippage(usdtQuote),
        );
        const wbnbQuote = await quoteUsdtToWbnb(publicClient, usdtOut);
        const wbnbOut = await swapPcsV3(
          publicClient, walletClient,
          ADDRESSES.USDT, ADDRESSES.WBNB,
          USDT_WBNB_FEE, usdtOut, applySlippage(wbnbQuote),
          account.address,
        );
        await unwrapWbnbToNative(publicClient, walletClient, wbnbOut);
        return { outputAmount: wbnbOut, outputToken: 'BNB' };
      }
      case 'slisBNB': {
        throw new Error(
          'Converting bnbUSD to slisBNB is not supported directly. ' +
          'Use --output BNB or WBNB instead.',
        );
      }
      default:
        throw new Error(`Unsupported output token: ${toToken}`);
    }
  }
}

// ── Helpers ──

/** Parse ERC-20 Transfer event to find amount sent to recipient */
function parseTransferAmount(
  logs: readonly { address: string; topics: readonly string[]; data: string }[],
  tokenAddress: `0x${string}`,
  recipient: `0x${string}`,
): bigint {
  const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
  const tokenAddr = tokenAddress.toLowerCase();
  const recipientPadded = recipient.toLowerCase();

  for (const log of logs) {
    if (
      log.address.toLowerCase() === tokenAddr &&
      log.topics[0] === transferTopic &&
      log.topics[2]
    ) {
      const to = '0x' + log.topics[2].slice(26);
      if (to.toLowerCase() === recipientPadded && log.data) {
        return BigInt(log.data);
      }
    }
  }
  return 0n;
}

/** Get the valid output tokens for a position side */
export function getValidOutputTokens(side: 'long' | 'short'): OutputToken[] {
  if (side === 'long') {
    return ['BNB', 'WBNB', 'USDT', 'slisBNB'];
  }
  return ['bnbUSD', 'USDT', 'BNB', 'WBNB'];
}

/** Get the default output token based on position side */
export function getDefaultOutputToken(side: 'long' | 'short'): OutputToken {
  return side === 'long' ? 'BNB' : 'bnbUSD';
}
