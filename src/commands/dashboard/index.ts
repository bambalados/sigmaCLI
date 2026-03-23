import { Command } from 'commander';
import { program, handleError } from '../../cli.js';
import { createBscPublicClient } from '../../config.js';
import { getWalletAddress } from '../../wallet.js';
import {
  getBalances,
  getBnbPrice,
  getBnbUsdPrice,
  getStabilityPoolDeposits,
  getPoolStats,
  getProtocolStats,
  getSystemHealth,
} from '../../sdk/read.js';
import { listUserPositions } from '../../sdk/trading.js';
import { outputJson, outputKeyValue, outputTable, outputWarn } from '../../output.js';
import type { GlobalOptions } from '../../types.js';

const dashboard = new Command('dashboard').description('View balances, positions, and protocol stats');

dashboard
  .command('balances')
  .description('Show token balances')
  .action(async () => {
    const opts = program.opts<GlobalOptions>();
    try {
      const publicClient = createBscPublicClient();
      const address = getWalletAddress(opts.privateKey);
      const balances = await getBalances(publicClient, address);

      if (opts.json) {
        outputJson({ address, balances });
      } else {
        console.log(`\nWallet: ${address}\n`);
        outputKeyValue({
          'BNB': balances.bnb,
          'WBNB': balances.wbnb,
          'bnbUSD': balances.bnbusd,
          'USDT': balances.usdt,
          'U': balances.u,
          'SIGMA': balances.sigma,
          'xSIGMA': balances.xsigma,
        });
      }
    } catch (e) {
      handleError(e, opts.json);
    }
  });

dashboard
  .command('price')
  .description('Show current BNB and bnbUSD price')
  .action(async () => {
    const opts = program.opts<GlobalOptions>();
    try {
      const publicClient = createBscPublicClient();
      const [bnbPrice, bnbusdPrice] = await Promise.all([
        getBnbPrice(publicClient),
        getBnbUsdPrice(publicClient),
      ]);

      if (opts.json) {
        outputJson({ bnbPrice: bnbPrice.formatted, bnbusdPrice: bnbusdPrice.price });
      } else {
        outputKeyValue({
          'BNB Price': `$${bnbPrice.formatted}`,
          'bnbUSD Price': `$${bnbusdPrice.price}`,
          'bnbUSD Valid': bnbusdPrice.isValid ? 'Yes' : 'No',
        });
      }
    } catch (e) {
      handleError(e, opts.json);
    }
  });

dashboard
  .command('deposits')
  .description('Show stability pool deposits')
  .action(async () => {
    const opts = program.opts<GlobalOptions>();
    try {
      const publicClient = createBscPublicClient();
      const address = getWalletAddress(opts.privateKey);
      const deposits = await getStabilityPoolDeposits(publicClient, address);

      if (opts.json) {
        outputJson({ address, deposits });
      } else if (deposits.length === 0) {
        outputWarn('No stability pool deposits found.');
      } else {
        outputTable(
          ['Pool', 'Shares', 'Value (est.)'],
          deposits.map((d) => [d.pool, d.shares, `$${d.value}`]),
        );
      }
    } catch (e) {
      handleError(e, opts.json);
    }
  });

dashboard
  .command('stats')
  .description('Show protocol overview stats')
  .action(async () => {
    const opts = program.opts<GlobalOptions>();
    try {
      const publicClient = createBscPublicClient();
      const stats = await getProtocolStats(publicClient);

      if (opts.json) {
        outputJson(stats);
      } else {
        console.log('\nSigma.Money Protocol Stats\n');
        outputKeyValue({
          'BNB Price': stats.bnbPrice,
          'bnbUSD Supply': stats.bnbusdSupply,
          'bnbUSD Price': stats.bnbusdPrice,
          'Total Collateral': stats.totalCollateral,
          'Total Debt': stats.totalDebt,
          'Stability Pool TVL': stats.stabilityPoolTvl,
        });
      }
    } catch (e) {
      handleError(e, opts.json);
    }
  });

dashboard
  .command('positions')
  .description('Show open trading positions with health and PnL')
  .action(async () => {
    const opts = program.opts<GlobalOptions>();
    try {
      const publicClient = createBscPublicClient();
      const address = getWalletAddress(opts.privateKey);
      const positions = await listUserPositions(publicClient, address);

      if (opts.json) {
        outputJson({ address, positions });
      } else if (positions.length === 0) {
        outputWarn('No open positions found');
      } else {
        outputTable(
          ['ID', 'Collateral', 'Debt', 'Leverage', 'Debt Ratio', 'Health', 'Equity'],
          positions.map((p) => [
            p.positionId.toString(),
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

dashboard
  .command('health')
  .description('Show system health status')
  .action(async () => {
    const opts = program.opts<GlobalOptions>();
    try {
      const publicClient = createBscPublicClient();
      const health = await getSystemHealth(publicClient);

      if (opts.json) {
        outputJson(health);
      } else {
        outputKeyValue({
          'Total Collateral Value': '$' + health.totalCollateral,
          'Total Debt': '$' + health.totalDebt,
          'Collateralization Ratio': health.collateralizationRatio,
        });
      }
    } catch (e) {
      handleError(e, opts.json);
    }
  });

program.addCommand(dashboard);
