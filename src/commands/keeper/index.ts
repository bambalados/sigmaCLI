import { Command } from 'commander';
import { program, handleError } from '../../cli.js';
import { createBscPublicClient } from '../../config.js';
import { getPrivateKey, createAccount, createBscWalletClient } from '../../wallet.js';
import { rebalance, liquidate } from '../../sdk/keeper.js';
import { outputJson, outputTxResult, outputSuccess } from '../../output.js';
import type { GlobalOptions } from '../../types.js';
import type { Address } from 'viem';
import { maybeWithSpinner } from '../../spinner.js';

const keeper = new Command('keeper').description('Permissionless rebalancing and liquidation (earn bounties)');

function getWallet(opts: GlobalOptions) {
  const key = getPrivateKey(opts.privateKey);
  const account = createAccount(key);
  return {
    publicClient: createBscPublicClient(),
    walletClient: createBscWalletClient(account),
  };
}

keeper
  .command('rebalance')
  .description('Execute rebalancing (2.5% bounty)')
  .option('--pool <address>', 'Specific pool address (default: main pool)')
  .action(async (cmdOpts) => {
    const opts = program.opts<GlobalOptions>();
    try {
      const { publicClient, walletClient } = getWallet(opts);
      const result = await maybeWithSpinner('Executing rebalance...', opts.json, () =>
        rebalance({
          publicClient,
          walletClient,
          pool: cmdOpts.pool as Address | undefined,
          dryRun: opts.dryRun,
        })
      );
      if (opts.json) outputJson(result);
      else if (opts.dryRun) outputSuccess('Dry run successful - rebalancing would succeed');
      else outputTxResult(result.hash, result.explorerUrl);
    } catch (e) {
      handleError(e, opts.json);
    }
  });

keeper
  .command('liquidate')
  .description('Execute liquidation (4% bounty)')
  .option('--pool <address>', 'Specific pool address (default: main pool)')
  .action(async (cmdOpts) => {
    const opts = program.opts<GlobalOptions>();
    try {
      const { publicClient, walletClient } = getWallet(opts);
      const result = await maybeWithSpinner('Executing liquidation...', opts.json, () =>
        liquidate({
          publicClient,
          walletClient,
          pool: cmdOpts.pool as Address | undefined,
          dryRun: opts.dryRun,
        })
      );
      if (opts.json) outputJson(result);
      else if (opts.dryRun) outputSuccess('Dry run successful - liquidation would succeed');
      else outputTxResult(result.hash, result.explorerUrl);
    } catch (e) {
      handleError(e, opts.json);
    }
  });

program.addCommand(keeper);
