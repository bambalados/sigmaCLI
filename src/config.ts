import { bsc } from 'viem/chains';
import { createPublicClient, http, type PublicClient, type Chain } from 'viem';
import { getRpcKeyFromKeychain } from './keychain.js';

export const BSC_CHAIN: Chain = bsc;

export const DEFAULT_RPC = 'https://bsc-dataseed.binance.org/';
const NODEREAL_BASE = 'https://bsc-mainnet.nodereal.io/v1/';

export function getRpcUrl(): string {
  if (process.env.SIGMA_RPC_URL) return process.env.SIGMA_RPC_URL;

  // Check for NodeReal API key: env var first, then Keychain
  const apiKey = process.env.SIGMA_NODEREAL_KEY || getRpcKeyFromKeychain();
  if (apiKey) return `${NODEREAL_BASE}${apiKey}`;

  return DEFAULT_RPC;
}

export function createBscPublicClient(): PublicClient {
  return createPublicClient({
    chain: BSC_CHAIN,
    transport: http(getRpcUrl()),
  });
}

export const EXPLORER_URL = 'https://bscscan.com';

export function txUrl(hash: string): string {
  return `${EXPLORER_URL}/tx/${hash}`;
}

export function addressUrl(address: string): string {
  return `${EXPLORER_URL}/address/${address}`;
}
