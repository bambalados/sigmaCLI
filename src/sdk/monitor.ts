import type { PublicClient } from 'viem';
import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { getBnbPrice } from './read.js';
import { closePosition } from './trading.js';
import type { BscWalletClient } from '../contracts/clients.js';
import { getAllOrders, removeOrder, type Order } from '../order-store.js';
import { getEntry } from '../position-store.js';

const STORE_DIR = join(homedir(), '.sigma-money');
const PID_PATH = join(STORE_DIR, 'monitor.pid');

function writePidFile(): void {
  if (!existsSync(STORE_DIR)) mkdirSync(STORE_DIR, { recursive: true });
  writeFileSync(PID_PATH, String(process.pid));
}

function removePidFile(): void {
  try { unlinkSync(PID_PATH); } catch {}
}

export function isMonitorRunning(): boolean {
  try {
    if (!existsSync(PID_PATH)) return false;
    const pid = parseInt(readFileSync(PID_PATH, 'utf-8').trim(), 10);
    if (isNaN(pid)) return false;
    // Check if the process is alive (signal 0 doesn't kill, just checks)
    process.kill(pid, 0);
    return true;
  } catch {
    // Process doesn't exist — stale PID file
    removePidFile();
    return false;
  }
}

export interface CloseResult {
  order: Order;
  exitPrice: string;
  entryPrice?: string;
  entryEquity?: string;
  pnlUsd?: string;
  pnlPercent?: string;
  outputAmount?: string;
  outputTokenName?: string;
}

export function shouldTrigger(order: Order, currentPrice: number): boolean {
  const trigger = parseFloat(order.triggerPrice);
  if (order.side === 'long') {
    return order.type === 'take-profit'
      ? currentPrice >= trigger
      : currentPrice <= trigger;
  } else {
    // Short: profit when price drops, loss when price rises
    return order.type === 'take-profit'
      ? currentPrice <= trigger
      : currentPrice >= trigger;
  }
}

export interface MonitorCallbacks {
  onTick?: (price: string, orderCount: number) => void;
  onTrigger?: (order: Order, price: string) => void;
  onClose?: (result: CloseResult) => void;
  onError?: (order: Order, error: string) => void;
  onAutoCancel?: (order: Order, reason: string) => void;
  onPriceError?: (error: string) => void;
}

// Track in-flight closes to prevent double-triggering across ticks
const inFlight = new Set<string>();
// Track consecutive "position not found" failures per position
const failureCounts = new Map<string, number>();
const MAX_NOT_FOUND_FAILURES = 3;

export async function checkAndExecuteOrders(
  publicClient: PublicClient,
  walletClient: BscWalletClient,
  callbacks?: MonitorCallbacks,
): Promise<{ triggered: Order[]; errors: Array<{ order: Order; error: string }> }> {
  const triggered: Order[] = [];
  const errors: Array<{ order: Order; error: string }> = [];

  let priceData: { formatted: string };
  try {
    priceData = await getBnbPrice(publicClient);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    callbacks?.onPriceError?.(msg);
    return { triggered, errors };
  }

  const currentPrice = parseFloat(priceData.formatted);
  const walletAddress = walletClient.account!.address;

  // Filter to this wallet's orders only
  const allOrders = getAllOrders().filter(
    (o) => o.walletAddress.toLowerCase() === walletAddress.toLowerCase(),
  );

  callbacks?.onTick?.(priceData.formatted, allOrders.length);

  // Process sequentially to avoid nonce conflicts
  for (const order of allOrders) {
    if (!shouldTrigger(order, currentPrice)) continue;

    // Skip if already processing this position
    const posKey = `${order.positionId}`;
    if (inFlight.has(posKey)) continue;
    inFlight.add(posKey);

    callbacks?.onTrigger?.(order, priceData.formatted);

    // Capture entry data before close (close may remove it from store)
    const posEntry = getEntry(order.walletAddress, order.positionId);

    try {
      const closeResult = await closePosition({
        publicClient,
        walletClient,
        positionId: order.positionId,
        percent: order.percent,
        outputToken: order.outputToken as any,
      });
      removeOrder(order.walletAddress, order.positionId, order.type);
      // Also remove the other order type for same position (TP if SL triggered, or vice versa)
      const otherType = order.type === 'take-profit' ? 'stop-loss' : 'take-profit';
      removeOrder(order.walletAddress, order.positionId, otherType);
      triggered.push(order);

      // Compute PnL from entry data
      const result: CloseResult = {
        order,
        exitPrice: priceData.formatted,
        outputAmount: closeResult.outputAmount,
        outputTokenName: closeResult.outputTokenName,
      };
      if (posEntry) {
        result.entryPrice = posEntry.entryPrice;
        result.entryEquity = posEntry.entryEquity;
        const entryEquity = parseFloat(posEntry.entryEquity);
        const entryPrice = parseFloat(posEntry.entryPrice.replace('$', ''));
        // PnL based on price movement × leverage
        if (entryPrice > 0 && entryEquity > 0) {
          const priceChange = (currentPrice - entryPrice) / entryPrice;
          // For longs: profit when price goes up. For shorts: profit when price goes down.
          const direction = order.side === 'long' ? 1 : -1;
          // Approximate leverage from entry data
          const entryColls = parseFloat(posEntry.entryColls);
          const entryDebts = parseFloat(posEntry.entryDebts);
          let leverage = 1;
          if (order.side === 'long' && entryColls > 0) {
            const collValue = entryColls * entryPrice;
            leverage = collValue > entryEquity ? collValue / entryEquity : 1;
          } else if (order.side === 'short' && entryDebts > 0) {
            const debtValue = entryDebts * entryPrice;
            leverage = debtValue > 0 ? (entryEquity + debtValue) / entryEquity : 1;
          }
          const pnlPct = direction * priceChange * leverage * 100;
          const pnl = entryEquity * (pnlPct / 100);
          result.pnlUsd = (pnl >= 0 ? '+$' : '-$') + Math.abs(pnl).toFixed(2);
          result.pnlPercent = (pnlPct >= 0 ? '+' : '') + pnlPct.toFixed(2) + '%';
        }
      }
      callbacks?.onClose?.(result);
      inFlight.delete(posKey);
    } catch (e) {
      inFlight.delete(posKey);
      const msg = e instanceof Error ? e.message : String(e);
      callbacks?.onError?.(order, msg);
      errors.push({ order, error: msg });

      // Auto-cancel after repeated "not found" failures (position was redeemed/liquidated)
      if (msg.includes('not found or already closed')) {
        const count = (failureCounts.get(posKey) ?? 0) + 1;
        failureCounts.set(posKey, count);
        if (count >= MAX_NOT_FOUND_FAILURES) {
          const reason = 'Position no longer exists on-chain (likely redeemed or liquidated)';
          removeOrder(order.walletAddress, order.positionId, 'take-profit');
          removeOrder(order.walletAddress, order.positionId, 'stop-loss');
          failureCounts.delete(posKey);
          callbacks?.onAutoCancel?.(order, reason);
        }
      } else {
        // Reset counter for non-"not found" errors (transient RPC errors etc.)
        failureCounts.delete(posKey);
      }
    }
  }

  return { triggered, errors };
}

export function startMonitor(params: {
  publicClient: PublicClient;
  walletClient: BscWalletClient;
  intervalMs: number;
  callbacks: MonitorCallbacks;
  signal?: AbortSignal;
}): void {
  const { publicClient, walletClient, intervalMs, callbacks, signal } = params;

  writePidFile();

  const cleanup = () => {
    removePidFile();
  };
  process.on('exit', cleanup);

  const run = () => checkAndExecuteOrders(publicClient, walletClient, callbacks);

  // Run immediately on start
  run();

  const timer = setInterval(() => {
    run();
  }, intervalMs);

  if (signal) {
    signal.addEventListener('abort', () => {
      clearInterval(timer);
      cleanup();
    });
  }
}
