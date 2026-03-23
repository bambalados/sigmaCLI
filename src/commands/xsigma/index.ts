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
} from '../../sdk/xsigma.js';
import { outputJson, outputTxResult, outputSuccess, outputKeyValue, outputTable, outputWarn } from '../../output.js';
import type { GlobalOptions } from '../../types.js';

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
      const result = await convertToXSigma({
        publicClient,
        walletClient,
        amount: cmdOpts.amount,
        dryRun: opts.dryRun,
      });
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
      const result = await instantExit({
        publicClient,
        walletClient,
        amount: cmdOpts.amount,
        dryRun: opts.dryRun,
      });
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
      const result = await createVest({
        publicClient,
        walletClient,
        amount: cmdOpts.amount,
        dryRun: opts.dryRun,
      });
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
      const result = await exitVest({
        publicClient,
        walletClient,
        vestId: parseInt(cmdOpts.vestId),
        dryRun: opts.dryRun,
      });
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
      const result = await triggerRebase({
        publicClient,
        walletClient,
        dryRun: opts.dryRun,
      });
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
      const result = await stakeXSigma({
        publicClient,
        walletClient,
        amount: cmdOpts.amount,
        dryRun: opts.dryRun,
      });
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
      const result = await unstakeXSigma({
        publicClient,
        walletClient,
        amount: cmdOpts.amount,
        dryRun: opts.dryRun,
      });
      if (opts.json) outputJson(result);
      else if (opts.dryRun) outputSuccess('Dry run successful — unstake would succeed');
      else outputTxResult(result.hash, result.explorerUrl);
    } catch (e) {
      handleError(e, opts.json);
    }
  });

program.addCommand(xsigma);
