import { Command } from 'commander';
import { createInterface } from 'readline';
import { program } from '../../cli.js';
import { outputSuccess, outputError, outputKeyValue, outputWarn } from '../../output.js';
import {
  isKeychainAvailable,
  setPrivateKeyInKeychain,
  getPrivateKeyFromKeychain,
  deletePrivateKeyFromKeychain,
  setRpcKeyInKeychain,
  getRpcKeyFromKeychain,
  deleteRpcKeyFromKeychain,
} from '../../keychain.js';
import { getRpcUrl } from '../../config.js';

function readHidden(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    process.stdout.write(prompt);
    // Disable echo
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    let input = '';
    const onData = (ch: Buffer) => {
      const c = ch.toString();
      if (c === '\n' || c === '\r') {
        if (process.stdin.isTTY) process.stdin.setRawMode(false);
        process.stdin.removeListener('data', onData);
        process.stdout.write('\n');
        rl.close();
        resolve(input);
      } else if (c === '\u007F' || c === '\b') {
        // backspace
        input = input.slice(0, -1);
      } else if (c === '\u0003') {
        // Ctrl+C
        if (process.stdin.isTTY) process.stdin.setRawMode(false);
        rl.close();
        process.exit(0);
      } else {
        input += c;
      }
    };
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}

function storePrivateKey(key: string): void {
  const normalized = key.startsWith('0x') ? key : `0x${key}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    outputError('Invalid private key format. Must be 64 hex characters.');
    process.exit(1);
  }
  try {
    setPrivateKeyInKeychain(normalized);
    outputSuccess('Private key stored in Apple Keychain.');
  } catch (e) {
    outputError(`Failed to store key: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }
}

const config = new Command('config').description('Manage wallet keys and RPC configuration');

config
  .command('set-key')
  .description('Store private key in Apple Keychain (macOS only)')
  .argument('[key]', 'Private key (64 hex chars). Omit to enter securely via hidden prompt.')
  .action(async (key?: string) => {
    if (!isKeychainAvailable()) {
      outputError('Apple Keychain is only available on macOS. Use SIGMA_PRIVATE_KEY env var or --private-key flag.');
      process.exit(1);
    }
    if (key) {
      storePrivateKey(key);
    } else {
      console.log('Input is hidden for security — paste your key and press Enter.');
      const input = await readHidden('Private key: ');
      if (!input.trim()) {
        outputError('No key entered.');
        process.exit(1);
      }
      storePrivateKey(input.trim());
    }
  });

config
  .command('set-rpc-key')
  .description('Store NodeReal API key in Apple Keychain (macOS only). Pass the API key only, not the full URL. Wrap in quotes if it contains special characters.')
  .argument('<apiKey>', 'NodeReal API key (just the key, not the full URL)')
  .action((apiKey: string) => {
    if (!isKeychainAvailable()) {
      outputError('Apple Keychain is only available on macOS. Use SIGMA_NODEREAL_KEY env var instead.');
      process.exit(1);
    }
    try {
      setRpcKeyInKeychain(apiKey);
      outputSuccess('NodeReal API key stored in Apple Keychain.');
      outputSuccess(`RPC URL: https://bsc-mainnet.nodereal.io/v1/${apiKey.slice(0, 6)}...`);
    } catch (e) {
      outputError(`Failed to store key: ${e instanceof Error ? e.message : e}`);
      process.exit(1);
    }
  });

config
  .command('show')
  .description('Show current configuration (keys are masked)')
  .action(() => {
    const pairs: Record<string, string> = {};

    // Private key source
    if (process.env.SIGMA_PRIVATE_KEY) {
      pairs['Private Key'] = `env var (${process.env.SIGMA_PRIVATE_KEY.slice(0, 6)}...${process.env.SIGMA_PRIVATE_KEY.slice(-4)})`;
    } else if (isKeychainAvailable()) {
      const kc = getPrivateKeyFromKeychain();
      pairs['Private Key'] = kc ? `Keychain (${kc.slice(0, 6)}...${kc.slice(-4)})` : 'not set';
    } else {
      pairs['Private Key'] = process.env.SIGMA_PRIVATE_KEY ? 'env var' : 'not set';
    }

    // RPC
    pairs['RPC URL'] = getRpcUrl();

    // NodeReal key
    if (process.env.SIGMA_NODEREAL_KEY) {
      pairs['NodeReal Key'] = `env var (${process.env.SIGMA_NODEREAL_KEY.slice(0, 6)}...)`;
    } else if (isKeychainAvailable()) {
      const rk = getRpcKeyFromKeychain();
      pairs['NodeReal Key'] = rk ? `Keychain (${rk.slice(0, 6)}...)` : 'not set';
    }

    pairs['Keychain'] = isKeychainAvailable() ? 'available (macOS)' : 'not available';

    outputKeyValue(pairs);
  });

config
  .command('clear-key')
  .description('Remove private key from Apple Keychain')
  .action(() => {
    if (!isKeychainAvailable()) {
      outputWarn('Keychain not available on this platform.');
      return;
    }
    deletePrivateKeyFromKeychain()
      ? outputSuccess('Private key removed from Keychain.')
      : outputWarn('No private key found in Keychain.');
  });

config
  .command('clear-rpc-key')
  .description('Remove NodeReal API key from Apple Keychain')
  .action(() => {
    if (!isKeychainAvailable()) {
      outputWarn('Keychain not available on this platform.');
      return;
    }
    deleteRpcKeyFromKeychain()
      ? outputSuccess('NodeReal API key removed from Keychain.')
      : outputWarn('No NodeReal API key found in Keychain.');
  });

program.addCommand(config);
