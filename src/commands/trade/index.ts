import { Command } from 'commander';
import { program, handleError } from '../../cli.js';
import { createBscPublicClient } from '../../config.js';
import { getPrivateKey, createAccount, createBscWalletClient, getWalletAddress } from '../../wallet.js';
import {
  openLongPosition,
  openShortPosition,
  closePosition,
  adjustLeverage,
  addToPosition,
  getPositionSummary,
  listUserPositions,
} from '../../sdk/trading.js';
import { discoverPools, getPoolRiskParams, getPoolInfo } from '../../sdk/read.js';
import { outputJson, outputTxResult, outputSuccess, outputKeyValue, outputTable, outputWarn } from '../../output.js';
import type { GlobalOptions, CollateralType } from '../../types.js';
import type { OutputToken } from '../../sdk/swap.js';

const trade = new Command('trade').description('Open, close, and manage leveraged positions');

function getWallet(opts: GlobalOptions) {
  const key = getPrivateKey(opts.privateKey);
  const account = createAccount(key);
  return {
    publicClient: createBscPublicClient(),
    walletClient: createBscWalletClient(account),
  };
}

trade
  .command('open-long')
  .description('Open a leveraged long BNB position (xPOSITION)')
  .requiredOption('--collateral <type>', 'Collateral type: BNB or WBNB')
  .requiredOption('--amount <n>', 'Collateral amount')
  .requiredOption('--leverage <n>', 'Leverage multiplier (1.2-7)')
  .action(async (cmdOpts) => {
    const opts = program.opts<GlobalOptions>();
    try {
      const { publicClient, walletClient } = getWallet(opts);
      const result = await openLongPosition({
        publicClient,
        walletClient,
        collateral: cmdOpts.collateral as CollateralType,
        amount: cmdOpts.amount,
        leverage: parseFloat(cmdOpts.leverage),
        dryRun: opts.dryRun,
      });

      if (opts.json) {
        outputJson(result);
      } else if (opts.dryRun) {
        outputSuccess('Dry run successful - transaction would succeed');
        if (result.positionId) outputSuccess(`Position ID: ${result.positionId}`);
      } else {
        outputTxResult(result.hash, result.explorerUrl);
        if (result.positionId) outputSuccess(`Position ID: ${result.positionId}`);
      }
    } catch (e) {
      handleError(e, opts.json);
    }
  });

trade
  .command('open-short')
  .description('Open a leveraged short BNB position via ShortPoolManager')
  .requiredOption('--collateral <type>', 'Collateral: bnbUSD (required for shorts)')
  .requiredOption('--amount <n>', 'Collateral amount in bnbUSD')
  .requiredOption('--leverage <n>', 'Leverage multiplier (1.2-7)')
  .action(async (cmdOpts) => {
    const opts = program.opts<GlobalOptions>();
    try {
      const { publicClient, walletClient } = getWallet(opts);
      const result = await openShortPosition({
        publicClient,
        walletClient,
        collateral: cmdOpts.collateral as CollateralType,
        amount: cmdOpts.amount,
        leverage: parseFloat(cmdOpts.leverage),
        dryRun: opts.dryRun,
      });

      if (opts.json) {
        outputJson(result);
      } else if (opts.dryRun) {
        outputSuccess('Dry run successful - transaction would succeed');
        if (result.positionId) outputSuccess(`Position ID: ${result.positionId}`);
      } else {
        outputTxResult(result.hash, result.explorerUrl);
        if (result.positionId) outputSuccess(`Position ID: ${result.positionId}`);
      }
    } catch (e) {
      handleError(e, opts.json);
    }
  });

trade
  .command('close')
  .description('Close a position (fully or partially)')
  .requiredOption('--position-id <id>', 'Position NFT ID')
  .option('--percent <n>', 'Percent to close (1-100)', '100')
  .option('--output <token>', 'Output token: BNB, WBNB, USDT, bnbUSD, slisBNB (default: BNB for longs, bnbUSD for shorts)')
  .action(async (cmdOpts) => {
    const opts = program.opts<GlobalOptions>();
    try {
      const { publicClient, walletClient } = getWallet(opts);
      const result = await closePosition({
        publicClient,
        walletClient,
        positionId: parseInt(cmdOpts.positionId),
        percent: parseInt(cmdOpts.percent),
        outputToken: cmdOpts.output as OutputToken | undefined,
        dryRun: opts.dryRun,
      });

      if (opts.json) {
        outputJson(result);
      } else if (opts.dryRun) {
        outputSuccess('Dry run successful - close would succeed');
      } else {
        outputTxResult(result.hash, result.explorerUrl);
        if (result.outputAmount && result.outputTokenName) {
          outputSuccess(`Output: ${result.outputAmount} ${result.outputTokenName}`);
        }
      }
    } catch (e) {
      handleError(e, opts.json);
    }
  });

trade
  .command('adjust')
  .description('Adjust position leverage')
  .requiredOption('--position-id <id>', 'Position NFT ID')
  .requiredOption('--leverage <n>', 'New leverage multiplier (1.2-7)')
  .action(async (cmdOpts) => {
    const opts = program.opts<GlobalOptions>();
    try {
      const { publicClient, walletClient } = getWallet(opts);
      const result = await adjustLeverage({
        publicClient,
        walletClient,
        positionId: parseInt(cmdOpts.positionId),
        newLeverage: parseFloat(cmdOpts.leverage),
        dryRun: opts.dryRun,
      });

      if (opts.json) {
        outputJson(result);
      } else if (opts.dryRun) {
        outputSuccess('Dry run successful - leverage adjustment would succeed');
      } else {
        outputTxResult(result.hash, result.explorerUrl);
      }
    } catch (e) {
      handleError(e, opts.json);
    }
  });

trade
  .command('add')
  .description('Add collateral to existing position')
  .requiredOption('--position-id <id>', 'Position NFT ID')
  .requiredOption('--collateral <type>', 'Collateral: BNB/WBNB for longs, bnbUSD for shorts')
  .requiredOption('--amount <n>', 'Amount to add')
  .action(async (cmdOpts) => {
    const opts = program.opts<GlobalOptions>();
    try {
      const { publicClient, walletClient } = getWallet(opts);
      const result = await addToPosition({
        publicClient,
        walletClient,
        positionId: parseInt(cmdOpts.positionId),
        collateral: cmdOpts.collateral as CollateralType,
        amount: cmdOpts.amount,
        dryRun: opts.dryRun,
      });

      if (opts.json) {
        outputJson(result);
      } else if (opts.dryRun) {
        outputSuccess('Dry run successful - add collateral would succeed');
      } else {
        outputTxResult(result.hash, result.explorerUrl);
      }
    } catch (e) {
      handleError(e, opts.json);
    }
  });

trade
  .command('info')
  .description('Show position details, health, and PnL')
  .requiredOption('--position-id <id>', 'Position NFT ID')
  .action(async (cmdOpts) => {
    const opts = program.opts<GlobalOptions>();
    try {
      const publicClient = createBscPublicClient();
      const walletAddr = getWalletAddress(opts.privateKey);
      const posData = await getPositionSummary(publicClient, parseInt(cmdOpts.positionId), walletAddr);

      if (!posData) {
        outputWarn(`Position ${cmdOpts.positionId} not found or empty`);
        return;
      }

      if (opts.json) {
        outputJson(posData);
      } else {
        const info: Record<string, string> = {
          'Position ID': posData.positionId.toString(),
          'Side': (posData.side ?? 'long').toUpperCase(),
          'Pool': posData.poolAddress,
          'Collateral': posData.rawColls,
          'Debt': posData.rawDebts,
          'Debt Ratio': posData.debtRatio,
          'Leverage': posData.leverage,
          'Health Factor': posData.healthFactor,
          'Collateral Value': posData.collateralValue,
          'Debt Value': posData.debtValue,
          'Equity': posData.equity,
        };
        if (posData.entryPrice) info['Entry Price'] = posData.entryPrice;
        if (posData.pnl) info['PnL'] = posData.pnl;
        if (posData.pnlPercent) info['PnL %'] = posData.pnlPercent;
        outputKeyValue(info);
      }
    } catch (e) {
      handleError(e, opts.json);
    }
  });

trade
  .command('positions')
  .description('List all user positions across pools')
  .action(async () => {
    const opts = program.opts<GlobalOptions>();
    try {
      const key = getPrivateKey(opts.privateKey);
      const account = createAccount(key);
      const publicClient = createBscPublicClient();
      const positions = await listUserPositions(publicClient, account.address);

      if (opts.json) {
        outputJson(positions);
      } else if (positions.length === 0) {
        outputWarn('No positions found');
      } else {
        outputTable(
          ['ID', 'Side', 'Collateral', 'Debt', 'Leverage', 'Debt Ratio', 'Health', 'Equity'],
          positions.map((p) => [
            p.positionId.toString(),
            (p.side ?? 'long').toUpperCase(),
            p.rawColls,
            p.rawDebts,
            p.leverage,
            p.debtRatio,
            p.healthFactor,
            p.equity,
          ]),
        );
      }
    } catch (e) {
      handleError(e, opts.json);
    }
  });

trade
  .command('pools')
  .description('Show available trading pools and risk parameters')
  .action(async () => {
    const opts = program.opts<GlobalOptions>();
    try {
      const publicClient = createBscPublicClient();
      const pools = await discoverPools(publicClient);

      if (opts.json) {
        const data = [];
        for (const poolAddr of pools) {
          const [info, risk] = await Promise.all([
            getPoolInfo(publicClient, poolAddr),
            getPoolRiskParams(publicClient, poolAddr),
          ]);
          data.push({ address: poolAddr, ...info, ...risk });
        }
        outputJson(data);
      } else {
        for (const poolAddr of pools) {
          const [info, risk] = await Promise.all([
            getPoolInfo(publicClient, poolAddr),
            getPoolRiskParams(publicClient, poolAddr),
          ]);
          outputSuccess(`Pool: ${poolAddr}`);
          outputKeyValue({
            'Collateral Token': info.collateralToken,
            'Total Collateral': info.totalCollateral,
            'Total Debt': info.totalDebt,
            'Borrow Paused': info.isBorrowPaused ? 'Yes' : 'No',
            'Min Debt Ratio': (parseFloat(risk.minDebtRatio) * 100).toFixed(2) + '%',
            'Max Debt Ratio': (parseFloat(risk.maxDebtRatio) * 100).toFixed(2) + '%',
            'Rebalance At': (parseFloat(risk.rebalanceDebtRatio) * 100).toFixed(2) + '%',
            'Liquidate At': (parseFloat(risk.liquidateDebtRatio) * 100).toFixed(2) + '%',
            'Positions': info.nextPositionId.toString(),
          });
        }
      }
    } catch (e) {
      handleError(e, opts.json);
    }
  });

program.addCommand(trade);
