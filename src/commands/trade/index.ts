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
import { discoverPools, getPoolRiskParams, getPoolInfo, getBnbPrice, getPositionData } from '../../sdk/read.js';
import { outputJson, outputTxResult, outputSuccess, outputKeyValue, outputTable, outputWarn, outputError } from '../../output.js';
import type { GlobalOptions, CollateralType } from '../../types.js';
import type { OutputToken } from '../../sdk/swap.js';
import { convertProceeds } from '../../sdk/swap.js';
import { maybeWithSpinner } from '../../spinner.js';
import { saveOrder, getOrdersForWallet, removeOrder } from '../../order-store.js';
import { getEntry } from '../../position-store.js';
import { startMonitor, isMonitorRunning, type CloseResult } from '../../sdk/monitor.js';
import { spawn } from 'child_process';
import { readFileSync, existsSync, openSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import pc from 'picocolors';

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
  .requiredOption('--collateral <type>', 'Collateral type: BNB, WBNB, USDT, or bnbUSD')
  .requiredOption('--amount <n>', 'Collateral amount')
  .requiredOption('--leverage <n>', 'Leverage multiplier (1.2-7)')
  .action(async (cmdOpts) => {
    const opts = program.opts<GlobalOptions>();
    try {
      const { publicClient, walletClient } = getWallet(opts);
      const result = await maybeWithSpinner('Opening long position...', opts.json, () =>
        openLongPosition({
          publicClient,
          walletClient,
          collateral: cmdOpts.collateral as CollateralType,
          amount: cmdOpts.amount,
          leverage: parseFloat(cmdOpts.leverage),
          dryRun: opts.dryRun,
        })
      );

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
  .requiredOption('--collateral <type>', 'Collateral type: BNB, WBNB, USDT, or bnbUSD')
  .requiredOption('--amount <n>', 'Collateral amount in bnbUSD')
  .requiredOption('--leverage <n>', 'Leverage multiplier (1.2-7)')
  .action(async (cmdOpts) => {
    const opts = program.opts<GlobalOptions>();
    try {
      const { publicClient, walletClient } = getWallet(opts);
      const result = await maybeWithSpinner('Opening short position...', opts.json, () =>
        openShortPosition({
          publicClient,
          walletClient,
          collateral: cmdOpts.collateral as CollateralType,
          amount: cmdOpts.amount,
          leverage: parseFloat(cmdOpts.leverage),
          dryRun: opts.dryRun,
        })
      );

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
      const result = await maybeWithSpinner('Closing position...', opts.json, () =>
        closePosition({
          publicClient,
          walletClient,
          positionId: parseInt(cmdOpts.positionId),
          percent: parseInt(cmdOpts.percent),
          outputToken: cmdOpts.output as OutputToken | undefined,
          dryRun: opts.dryRun,
        })
      );

      if (opts.json) {
        outputJson(result);
      } else if (opts.dryRun) {
        outputSuccess('Dry run successful - close would succeed');
      } else {
        outputTxResult(result.hash, result.explorerUrl);
        if (result.outputAmount && result.outputTokenName) {
          if (result.outputTokenName.includes('(unconverted)')) {
            outputWarn(`${result.outputAmount} ${result.outputTokenName} — conversion failed`);
            outputWarn('Run `sigma trade recover` to swap stranded tokens to BNB');
          } else {
            outputSuccess(`Output: ${result.outputAmount} ${result.outputTokenName}`);
          }
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
      const result = await maybeWithSpinner('Adjusting leverage...', opts.json, () =>
        adjustLeverage({
          publicClient,
          walletClient,
          positionId: parseInt(cmdOpts.positionId),
          newLeverage: parseFloat(cmdOpts.leverage),
          dryRun: opts.dryRun,
        })
      );

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
  .requiredOption('--collateral <type>', 'Collateral type: BNB, WBNB, USDT, or bnbUSD')
  .requiredOption('--amount <n>', 'Amount to add')
  .action(async (cmdOpts) => {
    const opts = program.opts<GlobalOptions>();
    try {
      const { publicClient, walletClient } = getWallet(opts);
      const result = await maybeWithSpinner('Adding collateral...', opts.json, () =>
        addToPosition({
          publicClient,
          walletClient,
          positionId: parseInt(cmdOpts.positionId),
          collateral: cmdOpts.collateral as CollateralType,
          amount: cmdOpts.amount,
          dryRun: opts.dryRun,
        })
      );

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

// ── TP/SL Commands ──

trade
  .command('set-tp')
  .description('Set take-profit price for a position')
  .requiredOption('--position-id <id>', 'Position NFT ID')
  .requiredOption('--price <price>', 'Trigger price in USD')
  .option('--percent <n>', 'Percent to close when triggered (1-100)', '100')
  .option('--output <token>', 'Output token on trigger: BNB, WBNB, USDT, bnbUSD (default: BNB for longs, bnbUSD for shorts)')
  .action(async (cmdOpts) => {
    const opts = program.opts<GlobalOptions>();
    try {
      const walletAddr = getWalletAddress(opts.privateKey);
      const entry = getEntry(walletAddr, parseInt(cmdOpts.positionId));
      if (!entry) {
        outputError(`Position #${cmdOpts.positionId} not found in local store. Open positions are tracked automatically.`);
        process.exit(1);
      }

      const publicClient = createBscPublicClient();
      const { formatted } = await getBnbPrice(publicClient);
      const currentPrice = parseFloat(formatted);
      const triggerPrice = parseFloat(cmdOpts.price);

      // Warn if price seems wrong direction
      if (entry.side === 'long' && triggerPrice < currentPrice) {
        outputWarn(`Take-profit price ($${cmdOpts.price}) is below current BNB price ($${currentPrice.toFixed(2)}). Are you sure?`);
      } else if (entry.side === 'short' && triggerPrice > currentPrice) {
        outputWarn(`Take-profit price ($${cmdOpts.price}) is above current BNB price ($${currentPrice.toFixed(2)}). Are you sure?`);
      }

      // Warn if position is at high debt ratio (vulnerable to redemption/rebalance)
      const posData = await getPositionData(publicClient, entry.poolAddress as `0x${string}`, BigInt(cmdOpts.positionId), walletAddr);
      if (posData) {
        const debtRatioPct = parseFloat(posData.debtRatio);
        if (debtRatioPct >= 85) {
          outputWarn(`Debt ratio is ${posData.debtRatio} (max: 86.67%, rebalance: 88%).`);
          outputWarn(`High-leverage positions near the top tick are vulnerable to protocol redemptions — your position may be closed before TP/SL can fire.`);
        }
      }

      saveOrder({
        positionId: parseInt(cmdOpts.positionId),
        walletAddress: walletAddr,
        side: entry.side,
        type: 'take-profit',
        triggerPrice: cmdOpts.price,
        percent: parseInt(cmdOpts.percent),
        outputToken: cmdOpts.output,
        createdAt: new Date().toISOString(),
      });

      if (opts.json) {
        outputJson({ positionId: cmdOpts.positionId, type: 'take-profit', price: cmdOpts.price, percent: cmdOpts.percent, outputToken: cmdOpts.output });
      } else {
        const outputInfo = cmdOpts.output ? `, output: ${cmdOpts.output}` : '';
        outputSuccess(`Take-profit set for position #${cmdOpts.positionId} at $${cmdOpts.price} (${cmdOpts.percent}% close${outputInfo})`);
        console.log(pc.dim('  Run `sigma trade monitor` to activate price monitoring.'));
      }
    } catch (e) {
      handleError(e, opts.json);
    }
  });

trade
  .command('set-sl')
  .description('Set stop-loss price for a position')
  .requiredOption('--position-id <id>', 'Position NFT ID')
  .requiredOption('--price <price>', 'Trigger price in USD')
  .option('--percent <n>', 'Percent to close when triggered (1-100)', '100')
  .option('--output <token>', 'Output token on trigger: BNB, WBNB, USDT, bnbUSD (default: BNB for longs, bnbUSD for shorts)')
  .action(async (cmdOpts) => {
    const opts = program.opts<GlobalOptions>();
    try {
      const walletAddr = getWalletAddress(opts.privateKey);
      const entry = getEntry(walletAddr, parseInt(cmdOpts.positionId));
      if (!entry) {
        outputError(`Position #${cmdOpts.positionId} not found in local store. Open positions are tracked automatically.`);
        process.exit(1);
      }

      const publicClient = createBscPublicClient();
      const { formatted } = await getBnbPrice(publicClient);
      const currentPrice = parseFloat(formatted);
      const triggerPrice = parseFloat(cmdOpts.price);

      if (entry.side === 'long' && triggerPrice > currentPrice) {
        outputWarn(`Stop-loss price ($${cmdOpts.price}) is above current BNB price ($${currentPrice.toFixed(2)}). Are you sure?`);
      } else if (entry.side === 'short' && triggerPrice < currentPrice) {
        outputWarn(`Stop-loss price ($${cmdOpts.price}) is below current BNB price ($${currentPrice.toFixed(2)}). Are you sure?`);
      }

      // Warn if position is at high debt ratio (vulnerable to redemption/rebalance)
      const posData = await getPositionData(publicClient, entry.poolAddress as `0x${string}`, BigInt(cmdOpts.positionId), walletAddr);
      if (posData) {
        const debtRatioPct = parseFloat(posData.debtRatio);
        if (debtRatioPct >= 85) {
          outputWarn(`Debt ratio is ${posData.debtRatio} (max: 86.67%, rebalance: 88%).`);
          outputWarn(`High-leverage positions near the top tick are vulnerable to protocol redemptions — your position may be closed before TP/SL can fire.`);
        }
      }

      saveOrder({
        positionId: parseInt(cmdOpts.positionId),
        walletAddress: walletAddr,
        side: entry.side,
        type: 'stop-loss',
        triggerPrice: cmdOpts.price,
        percent: parseInt(cmdOpts.percent),
        outputToken: cmdOpts.output,
        createdAt: new Date().toISOString(),
      });

      if (opts.json) {
        outputJson({ positionId: cmdOpts.positionId, type: 'stop-loss', price: cmdOpts.price, percent: cmdOpts.percent, outputToken: cmdOpts.output });
      } else {
        const outputInfo = cmdOpts.output ? `, output: ${cmdOpts.output}` : '';
        outputSuccess(`Stop-loss set for position #${cmdOpts.positionId} at $${cmdOpts.price} (${cmdOpts.percent}% close${outputInfo})`);
        console.log(pc.dim('  Run `sigma trade monitor` to activate price monitoring.'));
      }
    } catch (e) {
      handleError(e, opts.json);
    }
  });

trade
  .command('list-orders')
  .description('Show all active TP/SL orders')
  .action(async () => {
    const opts = program.opts<GlobalOptions>();
    try {
      const walletAddr = getWalletAddress(opts.privateKey);
      const orders = getOrdersForWallet(walletAddr);

      if (opts.json) {
        outputJson(orders);
      } else if (orders.length === 0) {
        outputWarn('No active TP/SL orders');
      } else {
        outputTable(
          ['Position', 'Side', 'Type', 'Trigger Price', 'Close %', 'Created'],
          orders.map((o) => [
            o.positionId.toString(),
            o.side.toUpperCase(),
            o.type === 'take-profit' ? 'TP' : 'SL',
            '$' + o.triggerPrice,
            o.percent + '%',
            new Date(o.createdAt).toLocaleDateString(),
          ]),
        );
      }
    } catch (e) {
      handleError(e, opts.json);
    }
  });

trade
  .command('cancel-order')
  .description('Cancel a TP/SL order')
  .requiredOption('--position-id <id>', 'Position NFT ID')
  .requiredOption('--type <type>', 'Order type: tp or sl')
  .action(async (cmdOpts) => {
    const opts = program.opts<GlobalOptions>();
    try {
      const walletAddr = getWalletAddress(opts.privateKey);
      const orderType = cmdOpts.type === 'tp' ? 'take-profit' : 'stop-loss';
      const removed = removeOrder(walletAddr, parseInt(cmdOpts.positionId), orderType);

      if (opts.json) {
        outputJson({ cancelled: removed, positionId: cmdOpts.positionId, type: orderType });
      } else if (removed) {
        outputSuccess(`Cancelled ${orderType} order for position #${cmdOpts.positionId}`);
      } else {
        outputWarn(`No ${orderType} order found for position #${cmdOpts.positionId}`);
      }
    } catch (e) {
      handleError(e, opts.json);
    }
  });

trade
  .command('monitor')
  .description(
    'Poll BNB price and auto-close positions when TP/SL targets are hit.\n' +
    'Set targets first with `sigma trade set-tp` and `sigma trade set-sl`.\n' +
    'Orders only execute while this process is running. Press Ctrl+C to stop.'
  )
  .option('--interval <seconds>', 'Poll interval in seconds', '30')
  .option('--background', 'Run monitor as a background process')
  .action(async (cmdOpts) => {
    const opts = program.opts<GlobalOptions>();
    try {
      // Background mode: spawn a detached child process
      if (cmdOpts.background) {
        if (isMonitorRunning()) {
          outputWarn('Monitor is already running. Use `sigma trade monitor-status` to check.');
          return;
        }

        const storeDir = join(homedir(), '.sigma-money');
        if (!existsSync(storeDir)) mkdirSync(storeDir, { recursive: true });
        const logPath = join(storeDir, 'monitor.log');
        const args = [process.argv[1], 'trade', 'monitor', '--interval', cmdOpts.interval];
        if (opts.privateKey) args.push('--private-key', opts.privateKey);
        if (opts.rpc) args.push('--rpc', opts.rpc);

        // Open log file as fd so child writes directly — no pipes keeping parent alive
        const logFd = openSync(logPath, 'a');
        const child = spawn(process.execPath, args, {
          detached: true,
          stdio: ['ignore', logFd, logFd],
        });
        child.unref();

        outputSuccess(`Monitor started in background (PID: ${child.pid})`);
        console.log(pc.dim(`  Log: ${logPath}`));
        console.log(pc.dim(`  Status: sigma trade monitor-status`));
        console.log(pc.dim(`  Stop:   sigma trade monitor-stop`));
        return;
      }

      const { publicClient, walletClient } = getWallet(opts);
      const walletAddr = walletClient.account!.address;
      const orders = getOrdersForWallet(walletAddr);

      if (orders.length === 0) {
        outputWarn('No active TP/SL orders. Set orders first with `sigma trade set-tp` or `sigma trade set-sl`.');
        return;
      }

      // Show active orders
      console.log(pc.bold('\n  Active Orders:\n'));
      outputTable(
        ['Position', 'Side', 'Type', 'Trigger Price', 'Close %'],
        orders.map((o) => [
          o.positionId.toString(),
          o.side.toUpperCase(),
          o.type === 'take-profit' ? 'TP' : 'SL',
          '$' + o.triggerPrice,
          o.percent + '%',
        ]),
      );

      const intervalMs = parseInt(cmdOpts.interval) * 1000;
      console.log(pc.yellow(`\n  ⚠ Orders only execute while this process is running.`));
      console.log(pc.dim(`  Polling every ${cmdOpts.interval}s. Press Ctrl+C to stop.\n`));

      const ac = new AbortController();
      process.on('SIGINT', () => {
        ac.abort();
        console.log(pc.dim('\n\n  Monitor stopped. Orders are saved and will resume on next `sigma trade monitor`.'));
        process.exit(0);
      });

      startMonitor({
        publicClient,
        walletClient,
        intervalMs,
        signal: ac.signal,
        callbacks: {
          onTick: (price, count) => {
            process.stdout.write(`\r  ${pc.dim('BNB:')} ${pc.bold('$' + parseFloat(price).toFixed(2))} ${pc.dim('|')} ${pc.bold(String(count))} ${pc.dim('orders')} ${pc.dim('|')} ${pc.dim(new Date().toLocaleTimeString())}  `);
          },
          onTrigger: (order, price) => {
            const label = order.type === 'take-profit' ? pc.green('TP TRIGGERED') : pc.red('SL TRIGGERED');
            console.log(`\n  ${label} Position #${order.positionId} at $${parseFloat(price).toFixed(2)} — closing ${order.percent}%`);
          },
          onClose: (result) => {
            const side = result.order.side.toUpperCase();
            let pnlLine = '';
            if (result.pnlUsd && result.pnlPercent) {
              const pnlColor = result.pnlUsd.startsWith('+') ? pc.green : pc.red;
              pnlLine = `  ${pc.dim('PnL:')} ${pnlColor(result.pnlUsd)} ${pnlColor(`(${result.pnlPercent})`)}`;
            }
            const isUnconverted = result.outputTokenName?.includes('(unconverted)');
            const outputLine = result.outputAmount && result.outputTokenName
              ? isUnconverted
                ? `  ${pc.yellow('⚠')} ${pc.bold(result.outputAmount + ' ' + result.outputTokenName)} — run \`sigma trade recover\``
                : `  ${pc.dim('Received:')} ${pc.bold(result.outputAmount + ' ' + result.outputTokenName)}`
              : '';
            const entryLine = result.entryPrice
              ? `  ${pc.dim('Entry:')} $${parseFloat(result.entryPrice.replace('$', '')).toFixed(2)} ${pc.dim('→ Exit:')} $${parseFloat(result.exitPrice).toFixed(2)}`
              : '';
            console.log(`  ${pc.green('✓')} Position #${result.order.positionId} (${side}) closed successfully`);
            if (entryLine) console.log(entryLine);
            if (outputLine) console.log(outputLine);
            if (pnlLine) console.log(pnlLine);
            console.log();
          },
          onError: (order, error) => {
            console.log(`\n  ${pc.red('✗')} Failed to close position #${order.positionId}: ${error}`);
          },
          onAutoCancel: (order, reason) => {
            console.log(`\n  ${pc.yellow('⚠')} Auto-cancelled TP/SL orders for position #${order.positionId}`);
            console.log(`  ${pc.dim(reason)}`);
          },
          onPriceError: (error) => {
            console.log(`\n  ${pc.yellow('⚠')} Price feed error: ${error}`);
          },
        },
      });
    } catch (e) {
      handleError(e, opts.json);
    }
  });

trade
  .command('monitor-status')
  .description('Check if the background monitor is running')
  .action(async () => {
    const opts = program.opts<GlobalOptions>();
    try {
      const pidPath = join(homedir(), '.sigma-money', 'monitor.pid');
      const logPath = join(homedir(), '.sigma-money', 'monitor.log');
      const running = isMonitorRunning();

      if (opts.json) {
        const pid = running && existsSync(pidPath) ? parseInt(readFileSync(pidPath, 'utf-8').trim(), 10) : null;
        const walletAddr = (() => { try { return getWalletAddress(opts.privateKey); } catch { return null; } })();
        const orders = walletAddr ? getOrdersForWallet(walletAddr) : [];
        outputJson({ running, pid, orders: orders.length });
        return;
      }

      if (running) {
        const pid = readFileSync(pidPath, 'utf-8').trim();
        outputSuccess(`Monitor is running (PID: ${pid})`);
        console.log(pc.dim(`  Log: ${logPath}`));
        console.log(pc.dim(`  Stop: sigma trade monitor-stop`));
      } else {
        outputWarn('Monitor is not running.');
        console.log(pc.dim('  Start: sigma trade monitor --background'));
      }

      // Show orders if wallet available
      try {
        const walletAddr = getWalletAddress(opts.privateKey);
        const orders = getOrdersForWallet(walletAddr);
        if (orders.length > 0) {
          console.log(pc.bold(`\n  Active Orders: ${orders.length}`));
          outputTable(
            ['Position', 'Side', 'Type', 'Trigger Price', 'Close %'],
            orders.map((o) => [
              o.positionId.toString(),
              o.side.toUpperCase(),
              o.type === 'take-profit' ? 'TP' : 'SL',
              '$' + o.triggerPrice,
              o.percent + '%',
            ]),
          );
        }
      } catch {}

      // Show last few log lines
      if (existsSync(logPath)) {
        try {
          const log = readFileSync(logPath, 'utf-8');
          const lines = log.trim().split('\n').filter(l => l.trim());
          const last = lines.slice(-3).join('\n');
          if (last) {
            console.log(pc.dim('\n  Recent log:'));
            console.log(pc.dim('  ' + last.replace(/\r/g, '').split('\n').join('\n  ')));
          }
        } catch {}
      }
    } catch (e) {
      handleError(e, opts.json);
    }
  });

trade
  .command('monitor-stop')
  .description('Stop the background monitor')
  .action(async () => {
    const opts = program.opts<GlobalOptions>();
    try {
      const pidPath = join(homedir(), '.sigma-money', 'monitor.pid');

      if (!isMonitorRunning()) {
        if (opts.json) {
          outputJson({ stopped: false, reason: 'not running' });
        } else {
          outputWarn('Monitor is not running.');
        }
        return;
      }

      const pid = parseInt(readFileSync(pidPath, 'utf-8').trim(), 10);
      process.kill(pid, 'SIGTERM');

      if (opts.json) {
        outputJson({ stopped: true, pid });
      } else {
        outputSuccess(`Monitor stopped (PID: ${pid})`);
      }
    } catch (e) {
      handleError(e, opts.json);
    }
  });

trade
  .command('recover')
  .description('Recover stranded slisBNB by swapping to BNB')
  .option('--output <token>', 'Output token: BNB, WBNB, USDT (default: BNB)')
  .action(async (cmdOpts) => {
    const opts = program.opts<GlobalOptions>();
    try {
      const key = getPrivateKey(opts.privateKey);
      const account = createAccount(key);
      const publicClient = createBscPublicClient();
      const walletClient = createBscWalletClient(account);
      const { formatUnits } = await import('viem');
      const { ADDRESSES } = await import('../../contracts/addresses.js');

      const balanceOfAbi = [{ type: 'function', name: 'balanceOf', inputs: [{ name: '', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' }] as const;

      const slisBalance = await publicClient.readContract({
        address: ADDRESSES.SLISBNB, abi: balanceOfAbi,
        functionName: 'balanceOf', args: [account.address],
      });

      if (slisBalance === 0n) {
        outputSuccess('No stranded slisBNB found in wallet');
        return;
      }

      const outputToken = (cmdOpts.output as OutputToken) || 'BNB';
      console.log(`\n  Found ${formatUnits(slisBalance, 18)} slisBNB — swapping to ${outputToken}...\n`);

      if (opts.dryRun) {
        outputSuccess(`Dry run: would swap ${formatUnits(slisBalance, 18)} slisBNB → ${outputToken}`);
        return;
      }

      const result = await maybeWithSpinner('Recovering slisBNB...', opts.json, () =>
        convertProceeds({
          publicClient, walletClient,
          fromToken: 'slisBNB',
          toToken: outputToken,
          amount: slisBalance,
        })
      );

      if (opts.json) {
        outputJson({ outputAmount: formatUnits(result.outputAmount, 18), outputToken: result.outputToken });
      } else {
        outputSuccess(`Recovered: ${formatUnits(result.outputAmount, 18)} ${result.outputToken}`);
      }
    } catch (e) {
      handleError(e, opts.json);
    }
  });

program.addCommand(trade);
