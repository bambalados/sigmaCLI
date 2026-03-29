import { Command } from 'commander';
import { program, handleError } from '../../cli.js';
import { createBscPublicClient } from '../../config.js';
import { getPrivateKey, createAccount, createBscWalletClient } from '../../wallet.js';
import {
  convertToXSigma,
  instantExit,
  createVest,
  exitVest,
  triggerRebase,
  getXSigmaInfo,
  getUserVests,
  stakeXSigma,
  unstakeXSigma,
  compound,
} from '../../sdk/xsigma.js';
import { outputJson, outputTxResult, outputSuccess, outputKeyValue, outputTable, outputWarn } from '../../output.js';
import type { GlobalOptions } from '../../types.js';
import { maybeWithSpinner } from '../../spinner.js';

const xsigma = new Command('xsigma').description('xSIGMA vesting, exit, and rebase');

function getWallet(opts: GlobalOptions) {
  const key = getPrivateKey(opts.privateKey);
  const account = createAccount(key);
  return {
    publicClient: createBscPublicClient(),
    walletClient: createBscWalletClient(account),
  };
}

// ── Info / Read commands ──

xsigma
  .command('info')
  .description('Show xSIGMA contract state and your balance')
  .action(async () => {
    const opts = program.opts<GlobalOptions>();
    try {
      const publicClient = createBscPublicClient();
      // Try to get user address if private key is available
      let userAddress: `0x${string}` | undefined;
      try {
        const key = getPrivateKey(opts.privateKey);
        const account = createAccount(key);
        userAddress = account.address;
      } catch { /* no wallet, show global info only */ }

      const info = await getXSigmaInfo(publicClient, userAddress);

      if (opts.json) {
        outputJson(info);
      } else {
        console.log('\nxSIGMA Contract Info\n');
        outputKeyValue({
          'Total Supply': info.totalSupply as string,
          'Total Staked': info.totalStaked as string,
          'Pending Rebase': info.pendingRebase as string,
          'Balance Residing': info.balanceResiding as string,
          'Slashing Penalty': info.slashingPenalty as string,
          'Vest Duration': `${info.minVestDays}–${info.maxVestDays} days`,
          'Rebase Started': String(info.rebaseStarted),
          'Paused': String(info.paused),
        });
        if (info.balance !== undefined) {
          console.log();
          outputKeyValue({
            'Your Balance': info.balance as string + ' xSIGMA',
            'Your Staked': info.stakedBalance as string + ' xSIGMA',
            'Voting Power': info.votingPower as string,
            'Your Vests': info.vestCount as string,
          });
        }
      }
    } catch (e) {
      handleError(e, opts.json);
    }
  });

xsigma
  .command('vests')
  .description('List your active vesting positions')
  .action(async () => {
    const opts = program.opts<GlobalOptions>();
    try {
      const { publicClient, walletClient } = getWallet(opts);
      const vests = await getUserVests(publicClient, walletClient.account!.address);

      if (opts.json) {
        outputJson(vests);
      } else if (vests.length === 0) {
        outputWarn('No active vesting positions');
      } else {
        console.log('\nYour xSIGMA Vests\n');
        outputTable(
          ['Vest ID', 'Amount', 'Start', 'End'],
          vests.map((v) => [v.vestID, v.amount + ' xSIGMA', v.start, v.maxEnd]),
        );
      }
    } catch (e) {
      handleError(e, opts.json);
    }
  });

// ── Write commands ──

xsigma
  .command('convert')
  .description('Convert SIGMA to xSIGMA (1:1)')
  .requiredOption('--amount <n>', 'SIGMA amount to convert')
  .action(async (cmdOpts) => {
    const opts = program.opts<GlobalOptions>();
    try {
      const { publicClient, walletClient } = getWallet(opts);
      const result = await maybeWithSpinner('Converting SIGMA to xSIGMA...', opts.json, () =>
        convertToXSigma({
          publicClient,
          walletClient,
          amount: cmdOpts.amount,
          dryRun: opts.dryRun,
        })
      );
      if (opts.json) outputJson(result);
      else if (opts.dryRun) outputSuccess('Dry run successful — convert would succeed');
      else outputTxResult(result.hash, result.explorerUrl);
    } catch (e) {
      handleError(e, opts.json);
    }
  });

xsigma
  .command('exit')
  .description('Instant exit xSIGMA → SIGMA (with slashing penalty)')
  .requiredOption('--amount <n>', 'xSIGMA amount to exit')
  .action(async (cmdOpts) => {
    const opts = program.opts<GlobalOptions>();
    try {
      const { publicClient, walletClient } = getWallet(opts);
      const result = await maybeWithSpinner('Exiting xSIGMA...', opts.json, () =>
        instantExit({
          publicClient,
          walletClient,
          amount: cmdOpts.amount,
          dryRun: opts.dryRun,
        })
      );
      if (opts.json) outputJson(result);
      else if (opts.dryRun) {
        outputSuccess(`Dry run successful — would receive ${result.exitedAmount} SIGMA after penalty`);
      } else {
        outputTxResult(result.hash, result.explorerUrl);
      }
    } catch (e) {
      handleError(e, opts.json);
    }
  });

xsigma
  .command('vest')
  .description('Create a vesting position (lock xSIGMA, receive SIGMA over time)')
  .requiredOption('--amount <n>', 'xSIGMA amount to vest')
  .action(async (cmdOpts) => {
    const opts = program.opts<GlobalOptions>();
    try {
      const { publicClient, walletClient } = getWallet(opts);
      const result = await maybeWithSpinner('Creating vest...', opts.json, () =>
        createVest({
          publicClient,
          walletClient,
          amount: cmdOpts.amount,
          dryRun: opts.dryRun,
        })
      );
      if (opts.json) outputJson(result);
      else if (opts.dryRun) outputSuccess('Dry run successful — vest would be created');
      else outputTxResult(result.hash, result.explorerUrl);
    } catch (e) {
      handleError(e, opts.json);
    }
  });

xsigma
  .command('exit-vest')
  .description('Exit (cancel) a specific vest by ID')
  .requiredOption('--vest-id <id>', 'Vest ID to exit')
  .action(async (cmdOpts) => {
    const opts = program.opts<GlobalOptions>();
    try {
      const { publicClient, walletClient } = getWallet(opts);
      const result = await maybeWithSpinner('Exiting vest...', opts.json, () =>
        exitVest({
          publicClient,
          walletClient,
          vestId: parseInt(cmdOpts.vestId),
          dryRun: opts.dryRun,
        })
      );
      if (opts.json) outputJson(result);
      else if (opts.dryRun) outputSuccess('Dry run successful — vest would be exited');
      else outputTxResult(result.hash, result.explorerUrl);
    } catch (e) {
      handleError(e, opts.json);
    }
  });

xsigma
  .command('rebase')
  .description('Trigger rebase distribution')
  .action(async () => {
    const opts = program.opts<GlobalOptions>();
    try {
      const { publicClient, walletClient } = getWallet(opts);
      const result = await maybeWithSpinner('Triggering rebase...', opts.json, () =>
        triggerRebase({
          publicClient,
          walletClient,
          dryRun: opts.dryRun,
        })
      );
      if (opts.json) outputJson(result);
      else if (opts.dryRun) outputSuccess('Dry run successful — rebase would trigger');
      else outputTxResult(result.hash, result.explorerUrl);
    } catch (e) {
      handleError(e, opts.json);
    }
  });

xsigma
  .command('stake')
  .description('Stake xSIGMA into VoteModule for voting power')
  .requiredOption('--amount <n>', 'xSIGMA amount to stake')
  .action(async (cmdOpts) => {
    const opts = program.opts<GlobalOptions>();
    try {
      const { publicClient, walletClient } = getWallet(opts);
      const result = await maybeWithSpinner('Staking xSIGMA...', opts.json, () =>
        stakeXSigma({
          publicClient,
          walletClient,
          amount: cmdOpts.amount,
          dryRun: opts.dryRun,
        })
      );
      if (opts.json) outputJson(result);
      else if (opts.dryRun) outputSuccess('Dry run successful — stake would succeed');
      else outputTxResult(result.hash, result.explorerUrl);
    } catch (e) {
      handleError(e, opts.json);
    }
  });

xsigma
  .command('unstake')
  .description('Unstake xSIGMA from VoteModule')
  .requiredOption('--amount <n>', 'xSIGMA amount to unstake')
  .action(async (cmdOpts) => {
    const opts = program.opts<GlobalOptions>();
    try {
      const { publicClient, walletClient } = getWallet(opts);
      const result = await maybeWithSpinner('Unstaking xSIGMA...', opts.json, () =>
        unstakeXSigma({
          publicClient,
          walletClient,
          amount: cmdOpts.amount,
          dryRun: opts.dryRun,
        })
      );
      if (opts.json) outputJson(result);
      else if (opts.dryRun) outputSuccess('Dry run successful — unstake would succeed');
      else outputTxResult(result.hash, result.explorerUrl);
    } catch (e) {
      handleError(e, opts.json);
    }
  });

xsigma
  .command('compound')
  .description('Auto-compound: claim rewards → convert SIGMA → stake xSIGMA')
  .option('--vote', 'Refresh vote weights after staking')
  .action(async (cmdOpts) => {
    const opts = program.opts<GlobalOptions>();
    try {
      const key = getPrivateKey(opts.privateKey);
      const account = createAccount(key);
      const publicClient = createBscPublicClient();
      const walletClient = createBscWalletClient(account);

      const result = await maybeWithSpinner('Compounding rewards...', opts.json, () =>
        compound({
          publicClient,
          walletClient,
          vote: cmdOpts.vote,
          dryRun: opts.dryRun,
        })
      );

      if (opts.json) {
        outputJson(result);
      } else if (opts.dryRun) {
        outputSuccess('Dry run successful');
      } else {
        if (result.rebaseClaimed) outputSuccess('Claimed staking rebase from VoteModule');
        if (result.gaugesClaimed.length > 0) outputSuccess(`Claimed rewards from gauges: ${result.gaugesClaimed.join(', ')}`);
        if (result.sigmaConverted !== '0') outputSuccess(`Converted ${result.sigmaConverted} SIGMA → xSIGMA`);
        if (result.xsigmaStaked !== '0') outputSuccess(`Staked ${result.xsigmaStaked} xSIGMA in VoteModule`);
        if (result.voteRefreshed) outputSuccess('Vote weights refreshed');
        if (!result.rebaseClaimed && result.gaugesClaimed.length === 0 && result.sigmaConverted === '0' && result.xsigmaStaked === '0') {
          outputWarn('Nothing to compound — no pending rewards or unstaked xSIGMA');
        }
      }
    } catch (e) {
      handleError(e, opts.json);
    }
  });

program.addCommand(xsigma);
