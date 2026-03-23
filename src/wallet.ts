import {
  createWalletClient,
  http,
  type WalletClient,
  type Transport,
  type Account,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { BSC_CHAIN, getRpcUrl } from './config.js';
import { getPrivateKeyFromKeychain } from './keychain.js';

export function getPrivateKey(cliFlag?: string): `0x${string}` {
  const key = cliFlag || process.env.SIGMA_PRIVATE_KEY || getPrivateKeyFromKeychain();
  if (!key) {
    throw new Error(
      'No private key provided. Use --private-key flag, set SIGMA_PRIVATE_KEY env var, or run: sigma config set-key'
    );
  }
  const normalized = key.startsWith('0x') ? key : `0x${key}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error('Invalid private key format. Must be 64 hex characters.');
  }
  return normalized as `0x${string}`;
}

export function createAccount(privateKey: `0x${string}`): Account {
  return privateKeyToAccount(privateKey);
}

export function createBscWalletClient(account: Account): WalletClient<Transport, typeof BSC_CHAIN, Account> {
  return createWalletClient({
    account,
    chain: BSC_CHAIN,
    transport: http(getRpcUrl()),
  });
}

export function getWalletAddress(cliFlag?: string): Address {
  const key = getPrivateKey(cliFlag);
  const account = createAccount(key);
  return account.address;
}
