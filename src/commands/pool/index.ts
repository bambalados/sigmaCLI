import { Command } from 'commander';
import { program, handleError } from '../../cli.js';
import { createBscPublicClient } from '../../config.js';
import { getPrivateKey, createAccount, createBscWalletClient } from '../../wallet.js';
import {
  deposit,
  depositAndStake,
  requestWithdraw,
  instantWithdraw,
  claimWithdrawal,
  stakeSpShares,
  unstakeSpShares,
  claimSpRewards,
} from '../../sdk/stability-pool.js';
import { getPoolStats } from '../../sdk/read.js';
import { outputJson, outputTxResult, outputSuccess, outputTable, outputWarn } from '../../output.js';
import type { GlobalOptions, PoolName } from '../../types.js';
import { maybeWithSpinner } from '../../spinner.js';

const pool = new Command('pool').description('Stability pool deposit, withdraw, and stats');

function getWallet(opts: GlobalOptions) {
  const key = getPrivateKey(opts.privateKey);
  const account = createAccount(key);
  return {
    publicClient: createBscPublicClient(),
    walletClient: createBscWalletClient(account),
  };
}

pool
  .command('deposit')
  .description('Deposit into a stability pool (auto-stakes shares into gauge)')
  .requiredOption('--pool <name>', 'Pool: SP, SP1, SP2, SP3')
  .requiredOption('--token <type>', 'Token: bnbUSD or USDT')
  .requiredOption('--amount <n>', 'Amount to deposit')
  .option('--no-stake', 'Skip automatic share staking into gauge')
  .action(async (cmdOpts) => {
    const opts = program.opts<GlobalOptions>();
    try {
      const { publicClient, walletClient } = getWallet(opts);

      if (cmdOpts.stake === false) {
        const result = await maybeWithSpinner('Depositing into stability pool...', opts.json, () =>
          deposit({
            publicClient,
            walletClient,
            pool: cmdOpts.pool as PoolName,
            token: cmdOpts.token as 'bnbUSD' | 'USDT',
            amount: cmdOpts.amount,
            dryRun: opts.dryRun,
          })
        );
        if (opts.json) {
          outputJson(result);
        } else if (opts.dryRun) {
          outputSuccess('Dry run successful - deposit would succeed');
        } else {
          outputTxResult(result.hash, result.explorerUrl);
        }
      } else {
        const result = await maybeWithSpinner('Depositing and staking...', opts.json, () =>
          depositAndStake({
            publicClient,
            walletClient,
            pool: cmdOpts.pool as PoolName,
            token: cmdOpts.token as 'bnbUSD' | 'USDT',
            amount: cmdOpts.amount,
            dryRun: opts.dryRun,
          })
        );
        if (opts.json) {
          outputJson(result);
        } else if (opts.dryRun) {
          outputSuccess('Dry run successful - deposit would succeed');
        } else {
          outputTxResult(result.hash, result.explorerUrl);
          if (result.staked) {
            outputSuccess(`Shares staked in gauge: ${result.shareAmount}`);
          } else if (result.stakeError) {
            outputWarn(`Shares not staked: ${result.stakeError}`);
          }
        }
      }
    } catch (e) {
      handleError(e, opts.json);
    }
  });

pool
  .command('withdraw')
  .description('Withdraw from a stability pool')
  .requiredOption('--pool <name>', 'Pool: SP, SP1, SP2, SP3')
  .requiredOption('--amount <n>', 'Shares to withdraw')
  .option('--instant', 'Instant withdraw with 1% fee (default: request with 60min cooldown)')
  .action(async (cmdOpts) => {
    const opts = program.opts<GlobalOptions>();
    try {
      const { publicClient, walletClient } = getWallet(opts);
      const poolName = cmdOpts.pool as PoolName;

      const result = await maybeWithSpinner('Processing withdrawal...', opts.json, () =>
        cmdOpts.instant
          ? instantWithdraw({
              publicClient,
              walletClient,
              pool: poolName,
              amount: cmdOpts.amount,
              dryRun: opts.dryRun,
            })
          : requestWithdraw({
              publicClient,
              walletClient,
              pool: poolName,
              amount: cmdOpts.amount,
              dryRun: opts.dryRun,
            })
      );

      if (opts.json) {
        outputJson(result);
      } else if (opts.dryRun) {
        outputSuccess('Dry run successful - withdrawal would succeed');
      } else {
        outputTxResult(result.hash, result.explorerUrl);
        if (!cmdOpts.instant) {
          outputSuccess('Withdrawal requested. Claimable after 60 minute cooldown.');
        }
      }
    } catch (e) {
      handleError(e, opts.json);
    }
  });

pool
  .command('claim')
  .description('Claim a pending withdrawal after cooldown')
  .requiredOption('--pool <name>', 'Pool: SP, SP1, SP2, SP3')
  .requiredOption('--shares <n>', 'Shares to redeem')
  .action(async (cmdOpts) => {
    const opts = program.opts<GlobalOptions>();
    try {
      const { publicClient, walletClient } = getWallet(opts);
      const result = await maybeWithSpinner('Claiming withdrawal...', opts.json, () =>
        claimWithdrawal({
          publicClient,
          walletClient,
          pool: cmdOpts.pool as PoolName,
          shares: cmdOpts.shares,
          dryRun: opts.dryRun,
        })
      );

      if (opts.json) {
        outputJson(result);
      } else if (opts.dryRun) {
        outputSuccess('Dry run successful - claim would succeed');
      } else {
        outputTxResult(result.hash, result.explorerUrl);
      }
    } catch (e) {
      handleError(e, opts.json);
    }
  });

pool
  .command('stats')
  .description('Show stability pool statistics')
  .option('--pool <name>', 'Specific pool (default: all)')
  .action(async (cmdOpts) => {
    const opts = program.opts<GlobalOptions>();
    try {
      const publicClient = createBscPublicClient();
      const stats = await getPoolStats(publicClient, cmdOpts.pool);

      if (opts.json) {
        outputJson(stats);
      } else {
        outputTable(
          ['Pool', 'TVL', 'bnbUSD', 'USDT', 'bnbUSD %', 'APR'],
          stats.map((s) => [s.pool, s.tvl, s.bnbusdAmount, s.usdtAmount, s.bnbusdPercent, s.apr]),
        );
      }
    } catch (e) {
      handleError(e, opts.json);
    }
  });

pool
  .command('stake')
  .description('Stake SP shares into gauge to earn xSIGMA rewards')
  .requiredOption('--pool <name>', 'Pool: SP, SP1, or SP2')
  .requiredOption('--amount <n>', 'Amount of SP shares to stake')
  .action(async (cmdOpts) => {
    const opts = program.opts<GlobalOptions>();
    try {
      const { publicClient, walletClient } = getWallet(opts);
      const result = await maybeWithSpinner('Staking SP shares...', opts.json, () =>
        stakeSpShares({
          publicClient,
          walletClient,
          pool: cmdOpts.pool as PoolName,
          amount: cmdOpts.amount,
          dryRun: opts.dryRun,
        })
      );

      if (opts.json) {
        outputJson(result);
      } else if (opts.dryRun) {
        outputSuccess('Dry run successful - staking would succeed');
      } else {
        outputTxResult(result.hash, result.explorerUrl);
      }
    } catch (e) {
      handleError(e, opts.json);
    }
  });

pool
  .command('unstake')
  .description('Unstake SP shares from gauge')
  .requiredOption('--pool <name>', 'Pool: SP, SP1, or SP2')
  .requiredOption('--amount <n>', 'Amount of SP shares to unstake')
  .action(async (cmdOpts) => {
    const opts = program.opts<GlobalOptions>();
    try {
      const { publicClient, walletClient } = getWallet(opts);
      const result = await maybeWithSpinner('Unstaking SP shares...', opts.json, () =>
        unstakeSpShares({
          publicClient,
          walletClient,
          pool: cmdOpts.pool as PoolName,
          amount: cmdOpts.amount,
          dryRun: opts.dryRun,
        })
      );

      if (opts.json) {
        outputJson(result);
      } else if (opts.dryRun) {
        outputSuccess('Dry run successful - unstaking would succeed');
      } else {
        outputTxResult(result.hash, result.explorerUrl);
      }
    } catch (e) {
      handleError(e, opts.json);
    }
  });

pool
  .command('claim-rewards')
  .description('Claim xSIGMA rewards from staked SP shares')
  .requiredOption('--pool <name>', 'Pool: SP, SP1, or SP2')
  .action(async (cmdOpts) => {
    const opts = program.opts<GlobalOptions>();
    try {
      const { publicClient, walletClient } = getWallet(opts);
      const result = await maybeWithSpinner('Claiming rewards...', opts.json, () =>
        claimSpRewards({
          publicClient,
          walletClient,
          pool: cmdOpts.pool as PoolName,
          dryRun: opts.dryRun,
        })
      );

      if (opts.json) {
        outputJson(result);
      } else if (opts.dryRun) {
        outputSuccess('Dry run successful - claim rewards would succeed');
      } else {
        outputTxResult(result.hash, result.explorerUrl);
      }
    } catch (e) {
      handleError(e, opts.json);
    }
  });

program.addCommand(pool);
