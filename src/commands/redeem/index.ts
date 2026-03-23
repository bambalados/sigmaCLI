import { Command } from 'commander';
import { program, handleError } from '../../cli.js';
import { createBscPublicClient } from '../../config.js';
import { getPrivateKey, createAccount, createBscWalletClient } from '../../wallet.js';
import { redeemBnbUsd } from '../../sdk/redemption.js';
import { outputJson, outputTxResult, outputSuccess } from '../../output.js';
import type { GlobalOptions } from '../../types.js';

const redeem = new Command('redeem')
  .description('Redeem bnbUSD for underlying collateral (0.5% fee)')
  .requiredOption('--amount <n>', 'bnbUSD amount to redeem')
  .option('--min-collateral <n>', 'Minimum collateral to receive (slippage protection)')
  .action(async (cmdOpts) => {
    const opts = program.opts<GlobalOptions>();
    try {
      const key = getPrivateKey(opts.privateKey);
      const account = createAccount(key);
      const publicClient = createBscPublicClient();
      const walletClient = createBscWalletClient(account);

      const result = await redeemBnbUsd({
        publicClient,
        walletClient,
        amount: cmdOpts.amount,
        minCollateral: cmdOpts.minCollateral,
        dryRun: opts.dryRun,
      });

      if (opts.json) outputJson(result);
      else if (opts.dryRun) outputSuccess('Dry run successful - redemption would succeed');
      else outputTxResult(result.hash, result.explorerUrl);
    } catch (e) {
      handleError(e, opts.json);
    }
  });

program.addCommand(redeem);
