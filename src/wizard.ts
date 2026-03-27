import { createInterface } from 'readline';
import pc from 'picocolors';
import { createPublicClient, http, formatUnits } from 'viem';
import { bsc } from 'viem/chains';
import { printBanner } from './banner.js';
import { withSpinner } from './spinner.js';
import {
  isKeychainAvailable,
  getPrivateKeyFromKeychain,
  setPrivateKeyInKeychain,
  getRpcKeyFromKeychain,
  setRpcKeyInKeychain,
} from './keychain.js';
import { DEFAULT_RPC } from './config.js';

// --- Input helpers ---

function createRl(): ReturnType<typeof createInterface> {
  return createInterface({ input: process.stdin, output: process.stdout });
}

function ask(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

function readHidden(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createRl();
    process.stdout.write(prompt);
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
        input = input.slice(0, -1);
      } else if (c === '\u0003') {
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

function pickOption(rl: ReturnType<typeof createInterface>, options: string[], prompt: string): Promise<number> {
  return new Promise(async (resolve) => {
    for (let i = 0; i < options.length; i++) {
      console.log(`  ${pc.yellow(`${i + 1})`)} ${options[i]}`);
    }
    console.log();
    const answer = await ask(rl, prompt);
    const idx = parseInt(answer.trim(), 10) - 1;
    if (idx >= 0 && idx < options.length) {
      resolve(idx);
    } else {
      console.log(pc.red('  Invalid choice. Defaulting to option 1.'));
      resolve(0);
    }
  });
}

// --- First-run detection ---

export function isFirstRun(): boolean {
  // First run = no private key configured anywhere
  const hasEnvKey = !!process.env.SIGMA_PRIVATE_KEY;
  const hasKeychainKey = isKeychainAvailable() && !!getPrivateKeyFromKeychain();
  return !hasEnvKey && !hasKeychainKey;
}

// --- Connectivity test ---

async function testRpcAndGetBnbPrice(rpcUrl: string): Promise<string> {
  const client = createPublicClient({
    chain: bsc,
    transport: http(rpcUrl),
  });

  // BNB/USD Chainlink feed on BSC
  const CHAINLINK_BNB_USD = '0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE' as const;
  const abi = [
    {
      name: 'latestRoundData',
      type: 'function',
      stateMutability: 'view',
      inputs: [],
      outputs: [
        { name: 'roundId', type: 'uint80' },
        { name: 'answer', type: 'int256' },
        { name: 'startedAt', type: 'uint256' },
        { name: 'updatedAt', type: 'uint256' },
        { name: 'answeredInRound', type: 'uint80' },
      ],
    },
  ] as const;

  const [, answer] = await client.readContract({
    address: CHAINLINK_BNB_USD,
    abi,
    functionName: 'latestRoundData',
  });

  return parseFloat(formatUnits(answer, 8)).toFixed(2);
}

// --- Wizard ---

export async function runSetupWizard(): Promise<void> {
  printBanner();

  console.log(pc.bold('  Welcome to Sigma.Money CLI!'));
  console.log(pc.dim('  Let\'s get you set up in under a minute.\n'));

  let rl = createRl();

  // Step 1: Wallet setup
  console.log(pc.bold(pc.yellow('  1. Wallet Setup\n')));

  if (isKeychainAvailable()) {
    const choice = await pickOption(
      rl,
      [
        `${pc.bold('macOS Keychain')} ${pc.dim('(recommended — encrypted, persistent)')}`,
        `${pc.bold('Environment variable')} ${pc.dim('(set SIGMA_PRIVATE_KEY in your shell)')}`,
        `${pc.bold('.env file')} ${pc.dim('(store in project .env file)')}`,
      ],
      `  ${pc.cyan('Choose wallet storage [1-3]:')} `,
    );

    if (choice === 0) {
      // Keychain — readHidden uses raw mode which breaks the current rl
      rl.close();
      console.log(pc.dim('  Input is hidden for security — paste your key and press Enter.\n'));
      const key = await readHidden(`  ${pc.cyan('Private key:')} `);
      // Recreate rl after raw mode input
      rl = createRl();
      const trimmed = key.trim();
      if (!trimmed) {
        console.log(pc.red('\n  No key entered. You can set it later with: sigma config set-key'));
      } else {
        const normalized = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;
        if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
          console.log(pc.red('\n  Invalid key format. Must be 64 hex characters.'));
          console.log(pc.dim('  You can set it later with: sigma config set-key\n'));
        } else {
          setPrivateKeyInKeychain(normalized);
          console.log(pc.green('  ✓ Private key stored in macOS Keychain\n'));
        }
      }
    } else if (choice === 1) {
      console.log(pc.dim('\n  Add to your shell profile (~/.zshrc or ~/.bashrc):'));
      console.log(pc.bold('  export SIGMA_PRIVATE_KEY=0x...\n'));
    } else {
      console.log(pc.dim('\n  Add to your project .env file:'));
      console.log(pc.bold('  SIGMA_PRIVATE_KEY=0x...\n'));
    }
  } else {
    console.log(pc.dim('  macOS Keychain not available on this platform.'));
    console.log(pc.dim('  Set your private key via environment variable or .env file:'));
    console.log(pc.bold('  export SIGMA_PRIVATE_KEY=0x...\n'));
  }

  // Step 2: RPC setup
  console.log(pc.bold(pc.yellow('  2. RPC Setup\n')));

  const rpcChoice = await pickOption(
    rl,
    [
      `${pc.bold('Default free RPC')} ${pc.dim('(Binance public — works out of the box)')}`,
      `${pc.bold('NodeReal API key')} ${pc.dim('(free tier — better rate limits)')}`,
    ],
    `  ${pc.cyan('Choose RPC provider [1-2]:')} `,
  );

  let rpcUrl = DEFAULT_RPC;

  if (rpcChoice === 1) {
    const apiKey = await ask(rl, `  ${pc.cyan('Enter NodeReal API key:')} `);
    const trimmedKey = apiKey.trim();
    if (trimmedKey) {
      if (isKeychainAvailable()) {
        setRpcKeyInKeychain(trimmedKey);
        console.log(pc.green('  ✓ NodeReal API key stored in macOS Keychain\n'));
      } else {
        console.log(pc.dim('\n  Add to your shell profile:'));
        console.log(pc.bold(`  export SIGMA_NODEREAL_KEY=${trimmedKey}\n`));
      }
      rpcUrl = `https://bsc-mainnet.nodereal.io/v1/${trimmedKey}`;
    } else {
      console.log(pc.dim('  No key entered. Using default RPC.\n'));
    }
  } else {
    console.log(pc.green('  ✓ Using default Binance public RPC\n'));
  }

  rl.close();

  // Step 3: Connectivity test
  console.log(pc.bold(pc.yellow('  3. Connectivity Test\n')));

  try {
    const price = await withSpinner('  Connecting to BNB Chain...', () =>
      testRpcAndGetBnbPrice(rpcUrl),
    );
    console.log(`  ${pc.bold('BNB Price:')} ${pc.green(`$${price}`)}\n`);
  } catch {
    console.log(pc.yellow('  ⚠ Could not connect to RPC. Check your configuration.\n'));
  }

  // Done
  console.log(pc.bold(pc.green('  Setup complete!')));
  console.log(pc.dim('  Run ') + pc.bold('sigma --help') + pc.dim(' to see available commands.\n'));
}
