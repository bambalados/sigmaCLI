# Sigma.Money CLI

Command-line interface for the [Sigma.Money](https://sigma.money) DeFi protocol on BNB Chain.

> **WARNING: EXPERIMENTAL SOFTWARE**
>
> This CLI interacts with **real smart contracts** on BNB Chain mainnet. Transactions are **irreversible** and involve **real financial assets**. Use at your own risk. Always verify transactions before confirming. Start with small amounts to familiarize yourself with the commands. The authors are not liable for any loss of funds.

## Features

- **Dashboard** -- View balances, positions, and protocol stats
- **Trade** -- Open, close, and manage leveraged positions
- **Pool** -- Stability pool deposits, withdrawals, and rewards
- **xSIGMA** -- Convert, stake, vest, instant exit, and rebase
- **Governance** -- Vote on gauge emissions, claim incentives
- **Mint** -- Mint and redeem bnbUSD stablecoin
- **LP** -- Curve LP provisioning and gauge staking
- **Redeem** -- Redeem bnbUSD for underlying collateral
- **Keeper** -- Permissionless rebalancing and liquidation (earn bounties)

## Installation

```bash
npm install -g sigma-money
```

Or run without installing:

```bash
npx sigma-money dashboard
```

## Quick Start

```bash
# View protocol stats (read-only, no key needed)
sigma dashboard stats

# View your xSIGMA balance and vesting info
sigma xsigma info

# List all governance gauges
sigma gov gauges

# Mint bnbUSD with BNB collateral (requires private key)
sigma mint open --collateral BNB --amount 0.1 --borrow 50

# Vote on gauge emissions (requires staked xSIGMA)
sigma gov vote --gauge 0x1F04...  --weight 60 \
               --gauge 0x6a25...  --weight 40
```

All write commands support `--dry-run` to simulate without executing:

```bash
sigma mint open --collateral BNB --amount 0.1 --borrow 50 --dry-run
```

## Private Key Management

The CLI needs a private key to sign transactions (write operations). Keys are **never transmitted** -- all signing happens locally via [viem](https://viem.sh).

### Method 1: macOS Keychain (Recommended)

Stored encrypted in the OS keychain. Never touches disk as plaintext.

```bash
sigma config set-key
# Prompts for your private key and stores it securely

sigma config show
# Shows masked key info
```

### Method 2: Environment Variable

```bash
export SIGMA_PRIVATE_KEY=0x...
```

Or create a `.env` file in the project directory:

```env
SIGMA_PRIVATE_KEY=0xYourPrivateKeyHere
```

**Important:** Add `.env` to your `.gitignore` -- never commit private keys.

### Method 3: CLI Flag

```bash
sigma mint open --collateral BNB --amount 0.1 --borrow 50 --private-key 0x...
```

This is the least secure option -- the key may be visible in shell history.

### Security Tips

- **Use a dedicated wallet** with only the funds you need. Never use your main wallet.
- The CLI signs transactions **locally** -- your key never leaves your machine.
- Read-only commands (dashboard, info, gauges) don't require a private key.
- Always use `--dry-run` first to verify what a transaction will do.

## RPC Configuration

### Default

The CLI uses the public BSC RPC (`bsc-dataseed.binance.org`) by default. This works for basic usage but may be rate-limited under heavy use.

### NodeReal (Recommended)

[NodeReal](https://nodereal.io/) offers a **free tier** with generous rate limits for BSC. This is the recommended setup for reliable usage:

1. Sign up at [nodereal.io](https://nodereal.io/) (free)
2. Create a BSC mainnet API key
3. Configure the CLI:

```bash
# Store in macOS Keychain
sigma config set-rpc-key

# Or via environment variable
export SIGMA_NODEREAL_KEY=your-api-key-here
```

### Custom RPC

You can use any BSC RPC endpoint:

```bash
export SIGMA_RPC_URL=https://your-rpc-endpoint/
```

Or pass it per-command:

```bash
sigma dashboard --rpc https://your-rpc-endpoint/
```

## Command Reference

### Read-Only Commands

| Command | Description |
|---------|-------------|
| `sigma dashboard stats` | Protocol overview: prices, TVL, supply |
| `sigma dashboard balances` | Your token balances |
| `sigma dashboard positions` | Your open positions with health and PnL |
| `sigma dashboard deposits` | Your stability pool deposits |
| `sigma dashboard price` | Current BNB and bnbUSD prices |
| `sigma xsigma info` | xSIGMA balance, staked amount, vest count |
| `sigma xsigma vests` | List your active vesting positions |
| `sigma gov gauges` | List all governance gauges with status |
| `sigma gov my-votes` | Show your current vote allocation |
| `sigma mint position --position-id <id>` | View minting position details |
| `sigma mint simulate --collateral BNB --amount <n>` | Preview mint range and LTV options |
| `sigma pool stats --pool <addr>` | Stability pool statistics |
| `sigma trade pools` | Available trading pools and risk parameters |

### Write Commands (require private key)

| Command | Description |
|---------|-------------|
| `sigma trade open-long --collateral BNB --amount <n> --leverage <x>` | Open leveraged long BNB position |
| `sigma trade open-short --collateral bnbUSD --amount <n> --leverage <x>` | Open leveraged short BNB position |
| `sigma trade close --position-id <id>` | Close a leveraged position |
| `sigma trade add --position-id <id> --collateral <type> --amount <n>` | Add collateral to position |
| `sigma mint open --collateral BNB --amount <n> --borrow <n>` | Open a new minting position |
| `sigma mint open --position-id <id> --collateral BNB --amount <n> --borrow <n>` | Add to existing position |
| `sigma mint close --position-id <id> --repay <n>` | Repay bnbUSD debt |
| `sigma mint close --position-id <id> --collateral <n>` | Withdraw collateral |
| `sigma mint close --position-id <id> --repay <n> --collateral <n>` | Repay + withdraw |
| `sigma mint earn --amount <n>` | Swap BNB for bnbUSD and auto-deposit to earn yield |
| `sigma pool deposit --pool <addr> --amount <n>` | Deposit into stability pool |
| `sigma pool withdraw --pool <addr> --amount <n>` | Withdraw from stability pool |
| `sigma pool claim-rewards --pool <addr>` | Claim stability pool rewards |
| `sigma xsigma convert --amount <n>` | Convert SIGMA to xSIGMA |
| `sigma xsigma stake --amount <n>` | Stake xSIGMA for voting power |
| `sigma xsigma unstake --amount <n>` | Unstake xSIGMA |
| `sigma xsigma exit --amount <n>` | Instant exit (50% penalty) |
| `sigma xsigma vest --amount <n>` | Create vesting position (14-180 days) |
| `sigma xsigma exit-vest --vest-id <id>` | Exit a vesting position |
| `sigma xsigma rebase` | Trigger xSIGMA rebase |
| `sigma gov vote --gauge <addr> --weight <n>` | Vote on gauge emissions |
| `sigma gov reset` | Reset all votes |
| `sigma gov poke` | Refresh vote weights |
| `sigma gov claim-rebase` | Claim staking rewards |
| `sigma gov claim-incentives` | Claim vote incentives |
| `sigma lp add --amount <n>` | Add liquidity to Curve pool |
| `sigma lp remove --amount <n>` | Remove liquidity from Curve pool |
| `sigma lp stake --amount <n>` | Stake LP tokens into gauge for rewards |
| `sigma lp unstake --amount <n>` | Unstake LP tokens from gauge |
| `sigma keeper rebalance --pool <addr>` | Rebalance a pool (earn 2.5% bounty) |
| `sigma keeper liquidate --pool <addr>` | Liquidate a pool (earn 4% bounty) |

### Global Options

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON (useful for scripts and agents) |
| `--dry-run` | Simulate transaction without executing |
| `--private-key <key>` | Private key for signing |
| `--rpc <url>` | Custom BSC RPC URL |

Use `sigma --help` or `sigma <command> --help` for detailed usage.

For a complete guide with examples for every command, see **[USAGE.md](USAGE.md)**.

## Development

```bash
git clone https://github.com/bambalados/sigmaCLI.git
cd SigmaMoneyCLI
npm install
npm run build       # Build the CLI
npm run dev         # Watch mode (rebuild on changes)
npm run lint        # TypeScript type-check
npm test            # Run tests
```

### Architecture

```
src/
  contracts/        # ABIs and contract addresses
    abis/           # TypeScript ABI definitions
    addresses.ts    # All protocol contract addresses
    clients.ts      # Typed contract client factories
  sdk/              # Business logic (pure functions)
    trading.ts      # Position management
    governance.ts   # Voting and incentives
    xsigma.ts       # xSIGMA operations
    ...
  commands/         # CLI command definitions (commander.js)
    dashboard/
    trade/
    governance/
    ...
  config.ts         # RPC and chain configuration
  wallet.ts         # Private key management
  keychain.ts       # macOS Keychain integration
```

The codebase follows a strict layered architecture:
1. **Contracts** -- ABI definitions, addresses, typed client factories
2. **SDK** -- Business logic using viem, no CLI dependencies
3. **Commands** -- CLI layer using commander.js, calls SDK functions

### Adding a New Command

1. Create `src/commands/yourcommand/index.ts`
2. Create SDK functions in `src/sdk/yourmodule.ts`
3. Add ABI if needed in `src/contracts/abis/`
4. Register in `bin/sigma.ts`
5. Test on BSC mainnet

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## Protocol Information

Sigma.Money is the first Volatility Tranching Protocol on BNB Chain that enables:
- **bnbUSD**: A decentralized stablecoin backed by BNB
- **Leveraged positions**: Long BNB with variable leverage
- **Stability pools**: Earn yield by providing stability
- **xSIGMA**: Governance token with vesting model (Shadow/Solidly-style)
- **Gauge voting**: Direct SIGMA emissions to liquidity pools

Learn more at [sigma.money](https://sigma.money).

## Disclaimer

This software is provided "as is", without warranty of any kind. This is **experimental software** that interacts with decentralized smart contracts on BNB Chain mainnet.

- **Not financial advice.** Do your own research before using this tool.
- **Real assets at risk.** Transactions are irreversible and interact with real funds.
- **Smart contract risk.** The underlying protocol contracts may have bugs or vulnerabilities.
- **No guarantee of correctness.** While tested on mainnet, the CLI may contain bugs.
- **Use at your own risk.** The authors are not responsible for any financial losses.

Always start with small amounts and use `--dry-run` to verify transactions.

## License

[MIT](LICENSE)
