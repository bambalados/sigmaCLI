import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const STORE_DIR = join(homedir(), '.sigma-money');
const STORE_PATH = join(STORE_DIR, 'positions.json');

export interface PositionEntry {
  positionId: number;
  walletAddress: string;
  poolAddress: string;
  side: 'long' | 'short';
  entryColls: string;
  entryDebts: string;
  entryPrice: string;
  entryEquity: string;
  timestamp: string;
}

interface Store {
  positions: Record<string, PositionEntry>;
}

function loadStore(): Store {
  try {
    if (existsSync(STORE_PATH)) {
      return JSON.parse(readFileSync(STORE_PATH, 'utf-8'));
    }
  } catch {}
  return { positions: {} };
}

function saveStore(store: Store): void {
  if (!existsSync(STORE_DIR)) {
    mkdirSync(STORE_DIR, { recursive: true });
  }
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

function entryKey(walletAddress: string, positionId: number): string {
  return `${walletAddress.toLowerCase()}:${positionId}`;
}

export function saveEntry(entry: PositionEntry): void {
  const store = loadStore();
  store.positions[entryKey(entry.walletAddress, entry.positionId)] = entry;
  saveStore(store);
}

export function getEntry(walletAddress: string, positionId: number): PositionEntry | null {
  const store = loadStore();
  return store.positions[entryKey(walletAddress, positionId)] ?? null;
}

export function getEntriesForWallet(walletAddress: string): PositionEntry[] {
  const store = loadStore();
  const prefix = walletAddress.toLowerCase() + ':';
  return Object.entries(store.positions)
    .filter(([key]) => key.startsWith(prefix))
    .map(([, entry]) => entry);
}

export function removeEntry(walletAddress: string, positionId: number): void {
  const store = loadStore();
  delete store.positions[entryKey(walletAddress, positionId)];
  saveStore(store);
}
