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

## V1.1 Roadmap

### Feature 1: CLI Polish & First-Run Wizard
- ASCII art banner/logo on startup (like Claude Code CLI or OpenClaw)
- First-run detection: check if private key exists in Keychain
- Interactive setup wizard on first run:
  1. Welcome screen with banner
  2. Wallet setup — user chooses: macOS Keychain (recommended) / env var / .env file
  3. RPC setup — "Use default free RPC" or "Add NodeReal API key (free, better rate limits)"
  4. Quick connectivity test: verify RPC connection, show current BNB price
- Colored output, spinners for pending transactions, progress indicators
- Reference: look at how Claude Code CLI and OpenClaw handle their startup UX

### Feature 2: TP/SL (Take Profit / Stop Loss)
- Users set take-profit and/or stop-loss price on a trading position
- When oracle price hits target, position auto-closes
- Design questions to resolve:
  1. Persistence: store TP/SL orders in ~/.sigma/orders.json or project-local?
  2. Monitoring: long-running `sigma trade monitor` process vs cron?
  3. Support both long and short positions
  4. What happens if CLI isn't running when price crosses threshold?
- Example commands:
  - `sigma trade set-tp --position-id 155 --price 700`
  - `sigma trade set-sl --position-id 155 --price 580`
  - `sigma trade monitor` (polls price, triggers closes)
- Close positions via existing trade close SDK function

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

## Known Issues (V1.0)

1. LP token order: bnbUSD-USDT pool expects [USDT, bnbUSD] not [bnbUSD, USDT]
2. xsigma rebase: reverts when no rebase available — could add pre-check
3. redeem/keeper: revert when protocol conditions not met — could add pre-checks
4. SP3 exchange rate: ~21:1 share/token ratio confuses users
