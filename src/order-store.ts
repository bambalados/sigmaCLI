import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const STORE_DIR = join(homedir(), '.sigma-money');
const STORE_PATH = join(STORE_DIR, 'orders.json');

export interface Order {
  positionId: number;
  walletAddress: string;
  side: 'long' | 'short';
  type: 'take-profit' | 'stop-loss';
  triggerPrice: string;
  percent: number;
  outputToken?: string;
  createdAt: string;
}

interface OrderStore {
  orders: Record<string, Order>;
}

function loadStore(): OrderStore {
  try {
    if (existsSync(STORE_PATH)) {
      return JSON.parse(readFileSync(STORE_PATH, 'utf-8'));
    }
  } catch {}
  return { orders: {} };
}

function saveStore(store: OrderStore): void {
  if (!existsSync(STORE_DIR)) {
    mkdirSync(STORE_DIR, { recursive: true });
  }
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

function orderKey(walletAddress: string, positionId: number, type: string): string {
  return `${walletAddress.toLowerCase()}:${positionId}:${type}`;
}

export function saveOrder(order: Order): void {
  const store = loadStore();
  store.orders[orderKey(order.walletAddress, order.positionId, order.type)] = order;
  saveStore(store);
}

export function getOrder(walletAddress: string, positionId: number, type: string): Order | null {
  const store = loadStore();
  return store.orders[orderKey(walletAddress, positionId, type)] ?? null;
}

export function getOrdersForWallet(walletAddress: string): Order[] {
  const store = loadStore();
  const prefix = walletAddress.toLowerCase() + ':';
  return Object.entries(store.orders)
    .filter(([key]) => key.startsWith(prefix))
    .map(([, order]) => order);
}

export function getAllOrders(): Order[] {
  const store = loadStore();
  return Object.values(store.orders);
}

export function removeOrder(walletAddress: string, positionId: number, type: string): boolean {
  const store = loadStore();
  const key = orderKey(walletAddress, positionId, type);
  if (key in store.orders) {
    delete store.orders[key];
    saveStore(store);
    return true;
  }
  return false;
}
