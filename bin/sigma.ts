import { program } from '../src/cli.js';

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

program.parse();
