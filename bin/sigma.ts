import { program } from '../src/cli.js';
import { printBanner } from '../src/banner.js';
import { isFirstRun, runSetupWizard } from '../src/wizard.js';
import { getAllOrders } from '../src/order-store.js';
import { isMonitorRunning } from '../src/sdk/monitor.js';
import pc from 'picocolors';

// Import command registrations
import '../src/commands/dashboard/index.js';
import '../src/commands/trade/index.js';
import '../src/commands/pool/index.js';
import '../src/commands/xsigma/index.js';
import '../src/commands/lp/index.js';
import '../src/commands/redeem/index.js';
import '../src/commands/keeper/index.js';
import '../src/commands/config/index.js';
import '../src/commands/mint/index.js';
import '../src/commands/unwrap.js';
import '../src/commands/governance/index.js';

async function main() {
  // First run: show wizard and exit
  if (isFirstRun() && process.argv.length <= 2 && process.stdin.isTTY) {
    await runSetupWizard();
    return;
  }

  // Show banner on --help or no args (non-first-run)
  if (process.argv.length <= 2 || process.argv.includes('--help') || process.argv.includes('-h')) {
    printBanner();
  }

  // Warn if there are active TP/SL orders but monitor isn't running
  const isMonitorCmd = process.argv.includes('monitor');
  if (!isMonitorCmd) {
    try {
      const orders = getAllOrders();
      if (orders.length > 0 && !isMonitorRunning()) {
        console.log(pc.yellow(pc.bold('  ⚠  You have ' + orders.length + ' active TP/SL order(s) that are NOT being monitored.')));
        console.log(pc.yellow('     Run: ') + pc.bold('sigma trade monitor') + pc.yellow(' to activate price monitoring.\n'));
      }
    } catch {}
  }

  program.parse();
}

main();
