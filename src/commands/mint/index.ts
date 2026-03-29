import { Command } from 'commander';
import { program, handleError } from '../../cli.js';
import { createBscPublicClient } from '../../config.js';
import { getPrivateKey, createAccount, createBscWalletClient, getWalletAddress } from '../../wallet.js';
import {
  mintWithPosition,
  closeMintPosition,
  mintAndEarnBnbUsd,
  getMintRange,
  computeRebalancePrice,
} from '../../sdk/mint.js';
import { getPoolRiskParams, discoverPools, getPositionData } from '../../sdk/read.js';
import { outputJson, outputTxResult, outputSuccess, outputKeyValue, outputWarn } from '../../output.js';
import type { GlobalOptions } from '../../types.js';
import { ADDRESSES } from '../../contracts/addresses.js';
import { maybeWithSpinner } from '../../spinner.js';

const mint = new Command('mint').description('Mint v2: open and manage bnbUSD minting positions');

function getWallet(opts: GlobalOptions) {
  const key = getPrivateKey(opts.privateKey);
  const account = createAccount(key);
  return {
    publicClient: createBscPublicClient(),
    walletClient: createBscWalletClient(account),
  };
}

mint
  .command('open')
  .description('Open a new minting position or add to an existing one')
  .requiredOption('--collateral <type>', 'Collateral: BNB or WBNB')
  .requiredOption('--amount <n>', 'Amount of collateral to deposit')
  .option('--borrow <n>', 'Amount of bnbUSD to borrow/mint')
  .option('--ltv <percent>', 'Target LTV percentage (e.g., 50 for 50%)')
  .option('--position-id <id>', 'Existing position ID to add to (omit for new position)')
  .action(async (cmdOpts) => {
    const opts = program.opts<GlobalOptions>();
    try {
      const { publicClient, walletClient } = getWallet(opts);

      // Get mint range to compute borrow amount
      const range = await getMintRange(publicClient, cmdOpts.amount);
      const collValue = parseFloat(range.collateralValueUsd.replace('$', ''));

      let borrowAmount: string;
      if (cmdOpts.borrow) {
        borrowAmount = cmdOpts.borrow;
      } else if (cmdOpts.ltv) {
        const ltv = parseFloat(cmdOpts.ltv) / 100;
        borrowAmount = (collValue * ltv).toFixed(6);
      } else {
        // Show range and error out
        console.log('\nMint Range for', cmdOpts.amount, cmdOpts.collateral, '\n');
        outputKeyValue({
          'Collateral Value': range.collateralValueUsd,
          'BNB Price': range.bnbPrice,
          'Min Borrow': range.minBorrow + ' bnbUSD (LTV ' + range.minLtv + ')',
          'Max Borrow': range.maxBorrow + ' bnbUSD (LTV ' + range.maxLtv + ')',
          'Rebalance LTV': range.rebalanceLtv,
          'Liquidation LTV': range.liquidateLtv,
        });
        outputWarn('Specify --borrow <amount> or --ltv <percent> to proceed.');
        return;
      }

      const borrowNum = parseFloat(borrowAmount);
      const actualLtv = collValue > 0 ? (borrowNum / collValue * 100).toFixed(2) : '0';

      // Compute rebalancing price
      const pools = await discoverPools(publicClient);
      const riskParams = await getPoolRiskParams(publicClient, pools[0]);
      const rebalPrice = computeRebalancePrice(
        cmdOpts.amount,
        borrowAmount,
        parseFloat(riskParams.rebalanceDebtRatio),
      );

      if (!opts.dryRun) {
        console.log('\nMint Preview:');
        outputKeyValue({
          'Collateral': cmdOpts.amount + ' ' + cmdOpts.collateral,
          'Collateral Value': range.collateralValueUsd,
          'Borrow Amount': borrowAmount + ' bnbUSD',
          'Estimated LTV': actualLtv + '%',
          'Execution Price (BNB)': range.bnbPrice,
          'Rebalancing Price (BNB)': rebalPrice,
        });
        console.log();
      }

      const positionId = cmdOpts.positionId ? parseInt(cmdOpts.positionId) : undefined;

      const result = await maybeWithSpinner('Minting bnbUSD...', opts.json, () =>
        mintWithPosition({
          publicClient,
          walletClient,
          collateral: cmdOpts.collateral as 'BNB' | 'WBNB',
          amount: cmdOpts.amount,
          borrow: borrowAmount,
          positionId,
          dryRun: opts.dryRun,
        })
      );

      if (opts.json) {
        outputJson({ ...result, ltv: actualLtv + '%', rebalancingPrice: rebalPrice });
      } else if (opts.dryRun) {
        outputSuccess(`Dry run successful — would mint ${borrowAmount} bnbUSD at ${actualLtv}% LTV`);
        if (result.positionId) outputSuccess(`Position ID: ${result.positionId}`);
      } else {
        outputTxResult(result.hash, result.explorerUrl);
        if (result.positionId) outputSuccess(`Position ID: ${result.positionId}`);
      }
    } catch (e) {
      handleError(e, opts.json);
    }
  });

mint
  .command('close')
  .description('Withdraw collateral and/or repay debt on a minting position')
  .requiredOption('--position-id <id>', 'Position ID to modify')
  .option('--collateral <n>', 'Amount of collateral (SY) to withdraw')
  .option('--repay <n>', 'Amount of bnbUSD debt to repay')
  .action(async (cmdOpts) => {
    const opts = program.opts<GlobalOptions>();
    try {
      if (!cmdOpts.collateral && !cmdOpts.repay) {
        outputWarn('Specify at least one of --collateral <amount> or --repay <amount>');
        return;
      }

      const { publicClient, walletClient } = getWallet(opts);

      const parts: string[] = [];
      if (cmdOpts.repay) parts.push(`repay ${cmdOpts.repay} bnbUSD`);
      if (cmdOpts.collateral) parts.push(`withdraw ${cmdOpts.collateral} collateral`);

      if (!opts.dryRun) {
        console.log(`\nClose position #${cmdOpts.positionId}: ${parts.join(' + ')}\n`);
      }

      const result = await maybeWithSpinner('Closing mint position...', opts.json, () =>
        closeMintPosition({
          publicClient,
          walletClient,
          positionId: parseInt(cmdOpts.positionId),
          withdrawCollateral: cmdOpts.collateral,
          repayDebt: cmdOpts.repay,
          dryRun: opts.dryRun,
        })
      );

      if (opts.json) {
        outputJson(result);
      } else if (opts.dryRun) {
        outputSuccess(`Dry run successful — would ${parts.join(' + ')} on position #${cmdOpts.positionId}`);
      } else {
        outputTxResult(result.hash, result.explorerUrl);
        if (result.outputAmount && result.outputTokenName) {
          if (result.outputTokenName.includes('(unconverted)')) {
            outputWarn(`${result.outputAmount} ${result.outputTokenName} — conversion failed`);
            outputWarn('Run `sigma trade recover` to swap stranded tokens to BNB');
          } else {
            outputSuccess(`Received: ${result.outputAmount} ${result.outputTokenName}`);
          }
        }
      }
    } catch (e) {
      handleError(e, opts.json);
    }
  });

mint
  .command('position')
  .description('View minting position details (read-only)')
  .requiredOption('--position-id <id>', 'Position ID to view')
  .action(async (cmdOpts) => {
    const opts = program.opts<GlobalOptions>();
    try {
      const publicClient = createBscPublicClient();
      const pools = await discoverPools(publicClient);
      const pool = pools[0];

      const walletAddr = (() => {
        try { return getWalletAddress(opts.privateKey); } catch { return undefined; }
      })();

      const data = await getPositionData(publicClient, pool as `0x${string}`, BigInt(cmdOpts.positionId), walletAddr);

      if (!data) {
        outputWarn(`Position #${cmdOpts.positionId} not found or has no collateral/debt`);
        return;
      }

      if (opts.json) {
        outputJson(data);
      } else {
        console.log(`\nMinting Position #${data.positionId}\n`);
        outputKeyValue({
          'Collateral (raw)': data.rawColls,
          'Debt (bnbUSD)': data.rawDebts,
          'Collateral Value': data.collateralValue,
          'Debt Value': data.debtValue,
          'LTV': data.debtRatio,
          'Health Factor': data.healthFactor,
          'Leverage': data.leverage + 'x',
          'Equity': data.equity,
          ...(data.entryPrice ? { 'Entry Price': data.entryPrice } : {}),
          ...(data.pnl ? { 'PnL': data.pnl } : {}),
          ...(data.pnlPercent ? { 'PnL %': data.pnlPercent } : {}),
        });
      }
    } catch (e) {
      handleError(e, opts.json);
    }
  });

mint
  .command('earn')
  .description('Swap BNB for bnbUSD and auto-deposit to earn yield')
  .requiredOption('--collateral <type>', 'Collateral: BNB or WBNB')
  .requiredOption('--amount <n>', 'Amount of collateral')
  .option('--min-out <n>', 'Minimum bnbUSD output')
  .action(async (cmdOpts) => {
    const opts = program.opts<GlobalOptions>();
    try {
      const { publicClient, walletClient } = getWallet(opts);
      const result = await maybeWithSpinner('Minting and depositing...', opts.json, () =>
        mintAndEarnBnbUsd({
          publicClient,
          walletClient,
          collateral: cmdOpts.collateral as 'BNB' | 'WBNB',
          amount: cmdOpts.amount,
          minOut: cmdOpts.minOut,
          dryRun: opts.dryRun,
        })
      );

      if (opts.json) {
        outputJson(result);
      } else if (opts.dryRun) {
        outputSuccess('Dry run successful - mint & earn would succeed');
      } else {
        outputTxResult(result.hash, result.explorerUrl);
      }
    } catch (e) {
      handleError(e, opts.json);
    }
  });

mint
  .command('simulate')
  .description('Show mint range and LTV options (no wallet needed)')
  .requiredOption('--collateral <type>', 'Collateral: BNB or WBNB')
  .requiredOption('--amount <n>', 'Amount of collateral')
  .action(async (cmdOpts) => {
    const opts = program.opts<GlobalOptions>();
    try {
      const publicClient = createBscPublicClient();
      const range = await getMintRange(publicClient, cmdOpts.amount);

      if (opts.json) {
        outputJson(range);
      } else {
        console.log('\nMint Range for', cmdOpts.amount, cmdOpts.collateral, '\n');
        outputKeyValue({
          'Collateral Value': range.collateralValueUsd,
          'BNB Price': range.bnbPrice,
          'Min Borrow': range.minBorrow + ' bnbUSD',
          'Max Borrow': range.maxBorrow + ' bnbUSD',
          'Min LTV': range.minLtv,
          'Max LTV': range.maxLtv,
          'Rebalance LTV': range.rebalanceLtv,
          'Liquidation LTV': range.liquidateLtv,
        });
      }
    } catch (e) {
      handleError(e, opts.json);
    }
  });

program.addCommand(mint);
