import { Command } from 'commander';
import { program, handleError } from '../cli.js';
import { createBscPublicClient } from '../config.js';
import { getPrivateKey, createAccount, createBscWalletClient } from '../wallet.js';
import { unwrapSy } from '../sdk/unwrap.js';
import { outputJson, outputTxResult, outputSuccess } from '../output.js';
import type { GlobalOptions } from '../types.js';

const unwrap = new Command('unwrap')
  .description('Unwrap SIGMASY tokens to underlying assets')
  .requiredOption('--amount <n>', 'Amount to unwrap')
  .action(async (cmdOpts) => {
    const opts = program.opts<GlobalOptions>();
    try {
      const key = getPrivateKey(opts.privateKey);
      const account = createAccount(key);
      const publicClient = createBscPublicClient();
      const walletClient = createBscWalletClient(account);

      const result = await unwrapSy({
        publicClient,
        walletClient,
        amount: cmdOpts.amount,
        dryRun: opts.dryRun,
      });

      if (opts.json) outputJson(result);
      else if (opts.dryRun) outputSuccess('Dry run successful');
      else outputTxResult(result.hash, result.explorerUrl);
    } catch (e) {
      handleError(e, opts.json);
    }
  });

program.addCommand(unwrap);
