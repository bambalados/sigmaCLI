import { Command } from 'commander';
import { config } from 'dotenv';
import { outputError, outputJson } from './output.js';

// Load .env before anything else
config();

export const program = new Command();

program
  .name('sigma')
  .description('CLI for Sigma.Money DeFi protocol on BNB Chain')
  .version('1.1.0')
  .option('--json', 'Output results as JSON (for agents/scripts)')
  .option('--dry-run', 'Simulate transaction without executing')
  .option('--private-key <key>', 'Private key for signing transactions')
  .option('--rpc <url>', 'Custom BSC RPC URL');

// Override RPC from CLI flag
program.hook('preAction', (thisCommand) => {
  const opts = thisCommand.opts();
  if (opts.rpc) {
    process.env.SIGMA_RPC_URL = opts.rpc;
  }
});

// Global error handler
export function handleError(error: unknown, json?: boolean): never {
  const msg = error instanceof Error ? error.message : String(error);
  if (json) {
    outputJson({ error: msg });
  } else {
    outputError(msg);
  }
  process.exit(1);
}
