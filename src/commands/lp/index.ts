import { Command } from 'commander';
import { program, handleError } from '../../cli.js';
import { createBscPublicClient } from '../../config.js';
import { getPrivateKey, createAccount, createBscWalletClient } from '../../wallet.js';
import { addLiquidity, removeLiquidity, stakeLp, unstakeLp } from '../../sdk/curve-lp.js';
import { outputJson, outputTxResult, outputSuccess } from '../../output.js';
import type { GlobalOptions, LpPoolName } from '../../types.js';
import { maybeWithSpinner } from '../../spinner.js';

const lp = new Command('lp').description('Curve LP provisioning and gauge staking');

function getWallet(opts: GlobalOptions) {
  const key = getPrivateKey(opts.privateKey);
  const account = createAccount(key);
  return {
    publicClient: createBscPublicClient(),
    walletClient: createBscWalletClient(account),
  };
}

lp
  .command('add')
  .description('Add liquidity to a Curve pool')
  .requiredOption('--pool <name>', 'Pool: bnbUSD-USDT, SIGMA-bnbUSD, or bnbUSD-U')
  .requiredOption('--amounts <a,b>', 'Comma-separated amounts for each token')
  .action(async (cmdOpts) => {
    const opts = program.opts<GlobalOptions>();
    try {
      const { publicClient, walletClient } = getWallet(opts);
      const amounts = cmdOpts.amounts.split(',') as [string, string];
      if (amounts.length !== 2) throw new Error('Provide exactly 2 comma-separated amounts');

      const result = await maybeWithSpinner('Adding liquidity...', opts.json, () =>
        addLiquidity({
          publicClient,
          walletClient,
          pool: cmdOpts.pool as LpPoolName,
          amounts,
          dryRun: opts.dryRun,
        })
      );
      if (opts.json) outputJson(result);
      else if (opts.dryRun) outputSuccess('Dry run successful');
      else outputTxResult(result.hash, result.explorerUrl);
    } catch (e) {
      handleError(e, opts.json);
    }
  });

lp
  .command('remove')
  .description('Remove liquidity from a Curve pool')
  .requiredOption('--pool <name>', 'Pool: bnbUSD-USDT, SIGMA-bnbUSD, or bnbUSD-U')
  .requiredOption('--amount <n>', 'LP token amount to remove')
  .action(async (cmdOpts) => {
    const opts = program.opts<GlobalOptions>();
    try {
      const { publicClient, walletClient } = getWallet(opts);
      const result = await maybeWithSpinner('Removing liquidity...', opts.json, () =>
        removeLiquidity({
          publicClient,
          walletClient,
          pool: cmdOpts.pool as LpPoolName,
          amount: cmdOpts.amount,
          dryRun: opts.dryRun,
        })
      );
      if (opts.json) outputJson(result);
      else if (opts.dryRun) outputSuccess('Dry run successful');
      else outputTxResult(result.hash, result.explorerUrl);
    } catch (e) {
      handleError(e, opts.json);
    }
  });

lp
  .command('stake')
  .description('Stake LP tokens into gauge for rewards')
  .requiredOption('--pool <name>', 'Pool: bnbUSD-USDT, SIGMA-bnbUSD, or bnbUSD-U')
  .requiredOption('--amount <n>', 'LP token amount to stake')
  .action(async (cmdOpts) => {
    const opts = program.opts<GlobalOptions>();
    try {
      const { publicClient, walletClient } = getWallet(opts);
      const result = await maybeWithSpinner('Staking LP tokens...', opts.json, () =>
        stakeLp({
          publicClient,
          walletClient,
          pool: cmdOpts.pool as LpPoolName,
          amount: cmdOpts.amount,
          dryRun: opts.dryRun,
        })
      );
      if (opts.json) outputJson(result);
      else if (opts.dryRun) outputSuccess('Dry run successful');
      else outputTxResult(result.hash, result.explorerUrl);
    } catch (e) {
      handleError(e, opts.json);
    }
  });

lp
  .command('unstake')
  .description('Unstake LP tokens from gauge')
  .requiredOption('--pool <name>', 'Pool: bnbUSD-USDT, SIGMA-bnbUSD, or bnbUSD-U')
  .requiredOption('--amount <n>', 'LP token amount to unstake')
  .action(async (cmdOpts) => {
    const opts = program.opts<GlobalOptions>();
    try {
      const { publicClient, walletClient } = getWallet(opts);
      const result = await maybeWithSpinner('Unstaking LP tokens...', opts.json, () =>
        unstakeLp({
          publicClient,
          walletClient,
          pool: cmdOpts.pool as LpPoolName,
          amount: cmdOpts.amount,
          dryRun: opts.dryRun,
        })
      );
      if (opts.json) outputJson(result);
      else if (opts.dryRun) outputSuccess('Dry run successful');
      else outputTxResult(result.hash, result.explorerUrl);
    } catch (e) {
      handleError(e, opts.json);
    }
  });

program.addCommand(lp);
