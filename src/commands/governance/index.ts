import { Command } from 'commander';
import { program, handleError } from '../../cli.js';
import { createBscPublicClient } from '../../config.js';
import { getPrivateKey, createAccount, createBscWalletClient } from '../../wallet.js';
import {
  getGauges,
  getUserVote,
  castVote,
  resetVote,
  pokeVote,
  claimRebase,
  claimIncentives,
  depositIncentive,
  gaugeToPool,
} from '../../sdk/governance.js';
import { outputJson, outputTxResult, outputSuccess, outputTable, outputWarn, outputKeyValue } from '../../output.js';
import type { GlobalOptions } from '../../types.js';
import { maybeWithSpinner } from '../../spinner.js';

const governance = new Command('governance')
  .alias('gov')
  .description('Governance: vote on gauge emissions, claim incentives');

function getWallet(opts: GlobalOptions) {
  const key = getPrivateKey(opts.privateKey);
  const account = createAccount(key);
  return {
    publicClient: createBscPublicClient(),
    walletClient: createBscWalletClient(account),
  };
}

// ── Read commands ──

governance
  .command('gauges')
  .description('List all gauges with pools and status')
  .action(async () => {
    const opts = program.opts<GlobalOptions>();
    try {
      const publicClient = createBscPublicClient();
      const gauges = await getGauges(publicClient);

      if (opts.json) {
        outputJson(gauges);
      } else {
        console.log('\nGauges\n');
        outputTable(
          ['Gauge', 'Pool', 'Status'],
          gauges.map((g) => [
            g.gauge.slice(0, 10) + '...',
            g.name,
            g.alive ? 'ALIVE' : 'DEAD',
          ]),
        );
      }
    } catch (e) {
      handleError(e, opts.json);
    }
  });

governance
  .command('my-votes')
  .description('Show your current vote allocation')
  .action(async () => {
    const opts = program.opts<GlobalOptions>();
    try {
      const { publicClient, walletClient } = getWallet(opts);
      const votes = await getUserVote(publicClient, walletClient.account!.address);

      if (opts.json) {
        outputJson(votes);
      } else if (votes.length === 0) {
        outputWarn('No active votes');
      } else {
        console.log('\nYour Votes\n');
        outputTable(
          ['Pool', 'Name', 'Weight'],
          votes.map((v) => [v.pool.slice(0, 10) + '...', v.name, v.weight]),
        );
      }
    } catch (e) {
      handleError(e, opts.json);
    }
  });

// ── Write commands ──

governance
  .command('vote')
  .description('Vote on gauge emission allocation (multiple --gauge/--weight pairs)')
  .requiredOption('--gauge <addresses...>', 'Gauge address(es) to vote for')
  .requiredOption('--weight <weights...>', 'Weight(s) for each gauge')
  .action(async (cmdOpts) => {
    const opts = program.opts<GlobalOptions>();
    try {
      const gaugeAddrs = (cmdOpts.gauge as string[]).map((g) => g as `0x${string}`);
      const weights = (cmdOpts.weight as string[]).map((w) => BigInt(w));

      if (gaugeAddrs.length !== weights.length) {
        throw new Error(`Mismatch: ${gaugeAddrs.length} gauges but ${weights.length} weights`);
      }

      const { publicClient, walletClient } = getWallet(opts);

      // Voter.vote takes POOL addresses, not gauge addresses
      // Resolve each gauge to its pool
      const poolAddrs: `0x${string}`[] = [];
      for (const gauge of gaugeAddrs) {
        const pool = await gaugeToPool(publicClient, gauge);
        poolAddrs.push(pool);
      }

      const result = await maybeWithSpinner('Casting vote...', opts.json, () =>
        castVote({
          publicClient,
          walletClient,
          pools: poolAddrs,
          weights,
          dryRun: opts.dryRun,
        })
      );
      if (opts.json) outputJson(result);
      else if (opts.dryRun) outputSuccess(`Dry run successful — would vote on ${gaugeAddrs.length} gauge(s)`);
      else outputTxResult(result.hash, result.explorerUrl);
    } catch (e) {
      handleError(e, opts.json);
    }
  });

governance
  .command('reset')
  .description('Reset all your votes')
  .action(async () => {
    const opts = program.opts<GlobalOptions>();
    try {
      const { publicClient, walletClient } = getWallet(opts);
      const result = await maybeWithSpinner('Resetting votes...', opts.json, () =>
        resetVote({ publicClient, walletClient, dryRun: opts.dryRun })
      );
      if (opts.json) outputJson(result);
      else if (opts.dryRun) outputSuccess('Dry run successful — votes would be reset');
      else outputTxResult(result.hash, result.explorerUrl);
    } catch (e) {
      handleError(e, opts.json);
    }
  });

governance
  .command('poke')
  .description('Refresh/update your vote weights')
  .action(async () => {
    const opts = program.opts<GlobalOptions>();
    try {
      const { publicClient, walletClient } = getWallet(opts);
      const result = await maybeWithSpinner('Refreshing votes...', opts.json, () =>
        pokeVote({ publicClient, walletClient, dryRun: opts.dryRun })
      );
      if (opts.json) outputJson(result);
      else if (opts.dryRun) outputSuccess('Dry run successful — votes would be poked');
      else outputTxResult(result.hash, result.explorerUrl);
    } catch (e) {
      handleError(e, opts.json);
    }
  });

governance
  .command('claim-rebase')
  .description('Claim pending rebase distribution to staked xSIGMA')
  .action(async () => {
    const opts = program.opts<GlobalOptions>();
    try {
      const { publicClient, walletClient } = getWallet(opts);
      const result = await maybeWithSpinner('Claiming rebase...', opts.json, () =>
        claimRebase({ publicClient, walletClient, dryRun: opts.dryRun })
      );
      if (opts.json) outputJson(result);
      else if (opts.dryRun) outputSuccess('Dry run successful — rebase would be claimed');
      else outputTxResult(result.hash, result.explorerUrl);
    } catch (e) {
      handleError(e, opts.json);
    }
  });

governance
  .command('claim-incentives')
  .description('Claim vote incentives from fee distributors')
  .option('--gauge <addresses...>', 'Specific gauge(s) to claim from (default: all)')
  .action(async (cmdOpts) => {
    const opts = program.opts<GlobalOptions>();
    try {
      const { publicClient, walletClient } = getWallet(opts);
      const gaugeAddrs = cmdOpts.gauge
        ? (cmdOpts.gauge as string[]).map((g) => g as `0x${string}`)
        : undefined;

      const result = await maybeWithSpinner('Claiming incentives...', opts.json, () =>
        claimIncentives({
          publicClient,
          walletClient,
          gaugeAddresses: gaugeAddrs,
          dryRun: opts.dryRun,
        })
      );
      if (opts.json) outputJson(result);
      else if (result.explorerUrl === 'No incentives to claim') outputWarn('No incentives to claim');
      else if (opts.dryRun) outputSuccess('Dry run successful — incentives would be claimed');
      else outputTxResult(result.hash, result.explorerUrl);
    } catch (e) {
      handleError(e, opts.json);
    }
  });

governance
  .command('incentivize')
  .description('Deposit incentive tokens for gauge voters')
  .requiredOption('--gauge <address>', 'Gauge address to incentivize')
  .requiredOption('--token <address>', 'Token address to deposit as incentive')
  .requiredOption('--amount <n>', 'Amount of tokens to deposit')
  .option('--decimals <n>', 'Token decimals (default: 18)', '18')
  .action(async (cmdOpts) => {
    const opts = program.opts<GlobalOptions>();
    try {
      const { publicClient, walletClient } = getWallet(opts);
      const result = await maybeWithSpinner('Depositing incentive...', opts.json, () =>
        depositIncentive({
          publicClient,
          walletClient,
          gaugeAddress: cmdOpts.gauge as `0x${string}`,
          tokenAddress: cmdOpts.token as `0x${string}`,
          amount: cmdOpts.amount,
          decimals: parseInt(cmdOpts.decimals),
          dryRun: opts.dryRun,
        })
      );
      if (opts.json) outputJson(result);
      else if (opts.dryRun) outputSuccess('Dry run successful — incentive would be deposited');
      else outputTxResult(result.hash, result.explorerUrl);
    } catch (e) {
      handleError(e, opts.json);
    }
  });

program.addCommand(governance);
