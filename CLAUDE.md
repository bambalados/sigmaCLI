# sigmaCLI — Project Context

## Repository
- **GitHub:** https://github.com/bambalados/sigmaCLI
- **License:** MIT
- **Stack:** TypeScript, ESM, viem, commander.js, picocolors, cli-table3
- **Build:** tsup → dist/
- **Lint:** tsc --noEmit (zero errors)

## Architecture

Three-layer pattern: `contracts/ → sdk/ → commands/`

- **contracts/**: ABIs (verified against live BSC contracts), addresses, typed client factories (viem getContract wrappers)
- **sdk/**: Business logic — pure functions, no CLI deps. Accept PublicClient/WalletClient, return typed results
- **commands/**: Thin CLI shell — parse args (commander), call SDK, format output

Key contract details:
- **Voter** contract handles voting: vote(), reset(), poke(), claimIncentives()
- **VoteModule** handles staking: deposit(), withdraw(), getReward()
- **Voter.vote()** takes POOL addresses, not gauge addresses. CLI resolves gauges → pools via Voter.poolForGauge()
- **PoolManager.operate(pool, posId, collDelta, debtDelta)** is the core mint v2 function — positive deltas = open/add, negative = close/repay

## V1.0 Status (COMPLETE)

- 64 commands across 11 groups, all tested on BSC mainnet
- 89 test steps, 82 pass, 0 bugs, 7 expected protocol reverts
- Full test results in TEST_RESULTS.md
- Documentation: README.md, USAGE.md, CONTRIBUTING.md, SECURITY.md
- `mint direct` was removed (SigmaController.mint cap reached/paused)

## V1.1 Status (COMPLETE)

### Feature 1: CLI Polish & First-Run Wizard
- ASCII art sigma banner with yellow→red gradient on startup
- First-run detection: checks Keychain + env for private key
- Interactive setup wizard: wallet (Keychain/env/.env), RPC (default/NodeReal), connectivity test
- Spinners on all 33 write commands via `maybeWithSpinner()` (hidden in `--json` mode)
- Version bumped to 1.1.0

### Feature 2: TP/SL (Take Profit / Stop Loss)
- `set-tp`, `set-sl`: set take-profit/stop-loss on any tracked position
- `monitor`: polls BNBPriceOracle every N seconds, auto-closes when triggered
- `monitor --background`: runs as detached process, frees terminal
- `monitor-status`: shows PID, active orders, recent log
- `monitor-stop`: kills background monitor
- `list-orders`, `cancel-order`: manage active orders
- PnL display on close: entry/exit price, received amount, PnL in USD and %
- PID lock file (`~/.sigma-money/monitor.pid`) prevents false "unmonitored" warnings
- In-flight tracking prevents double-trigger on same position
- Orders at `~/.sigma-money/orders.json`, positions at `~/.sigma-money/positions.json`
- Both long and short positions supported
- 71 commands across 11 groups (up from 64 in V1.0)

## Key Files

| File | Purpose |
|------|---------|
| bin/sigma.ts | CLI entrypoint, registers all command groups |
| src/config.ts | RPC and chain configuration |
| src/wallet.ts | Private key management (Keychain/env/.env) |
| src/keychain.ts | macOS Keychain integration |
| src/output.ts | Formatted console output helpers |
| src/contracts/addresses.ts | All protocol contract addresses |
| src/contracts/clients.ts | Typed contract client factories |
| src/sdk/trading.ts | Leveraged trading (open/close/adjust/add) |
| src/sdk/mint.ts | Mint v2 position management |
| src/sdk/governance.ts | Voting and incentives |
| src/sdk/xsigma.ts | xSIGMA operations |
| src/sdk/stability-pool.ts | Stability pool deposit/withdraw |
| src/sdk/curve-lp.ts | Curve LP provisioning |
| src/sdk/monitor.ts | TP/SL price polling, trigger logic, PID lock |
| src/order-store.ts | TP/SL order persistence (~/.sigma-money/orders.json) |
| src/position-store.ts | Position entry tracking (~/.sigma-money/positions.json) |
| src/banner.ts | ASCII art sigma logo |
| src/spinner.ts | ora spinner wrappers (withSpinner, maybeWithSpinner) |
| src/wizard.ts | First-run setup wizard |

## Known Issues (V1.0)

1. LP token order: bnbUSD-USDT pool expects [USDT, bnbUSD] not [bnbUSD, USDT]
2. xsigma rebase: reverts when no rebase available — could add pre-check
3. redeem/keeper: revert when protocol conditions not met — could add pre-checks
4. SP3 exchange rate: ~21:1 share/token ratio confuses users
