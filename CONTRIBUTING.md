# Contributing to Sigma.Money CLI

Thanks for your interest in contributing! This guide will help you get started.

## Development Setup

```bash
git clone https://github.com/bambalados/sigmaCLI.git
cd sigmaCLI
npm install
npm run build       # Build the CLI
npm run dev         # Watch mode (rebuild on changes)
npm run lint        # TypeScript type-check
npm test            # Run tests
```

### Prerequisites

- Node.js 18+
- npm 9+
- A BSC wallet with a small amount of BNB (for testing write operations)
- Optional: [NodeReal](https://nodereal.io/) API key for reliable RPC access

## Architecture

The codebase follows a strict three-layer architecture:

```
src/
  contracts/        ← Layer 1: ABIs, addresses, typed client factories
    abis/           TypeScript ABI definitions (verified against live contracts)
    addresses.ts    All protocol contract addresses
    clients.ts      Typed contract client factories (viem getContract wrappers)
  sdk/              ← Layer 2: Business logic (pure functions, no CLI deps)
    trading.ts      Position management
    governance.ts   Voting and incentives
    xsigma.ts       xSIGMA operations
    ...
  commands/         ← Layer 3: CLI command definitions (commander.js)
    dashboard/
    trade/
    governance/
    ...
  config.ts         RPC and chain configuration
  wallet.ts         Private key management
  keychain.ts       macOS Keychain integration
  output.ts         Formatted console output helpers
  types.ts          Shared TypeScript types
```

### Key principles

- **Contracts layer** defines ABIs and typed client factories. ABIs must match live BSC contracts exactly.
- **SDK layer** contains all business logic. Functions take `PublicClient`/`WalletClient` from viem and return typed results. No CLI dependencies (no `console.log`, no `commander`).
- **Commands layer** is the thin CLI shell. It parses arguments, calls SDK functions, and formats output.

### Important contract details

- **Voter** contract handles voting: `vote()`, `reset()`, `poke()`, `claimIncentives()`
- **VoteModule** handles staking: `deposit()`, `withdraw()`, `getReward()`
- **Voter.vote()** takes **pool addresses**, not gauge addresses. The CLI resolves gauges → pools via `Voter.poolForGauge()`.
- **xSIGMA** uses a Shadow/Solidly-style vesting model with `convertEmissionsToken()`, `createVest()`, `exitVest()`, `exit()` (instant with 50% penalty)

## Adding a New Command

1. **Create the SDK function** in `src/sdk/yourmodule.ts`:
   - Accept `PublicClient` and/or `WalletClient` as parameters
   - Return typed results (use `TxResult` for write operations)
   - Support `dryRun` parameter for write operations
   - Use `simulateContract` for dry runs, `waitForTransactionReceipt` for real transactions

2. **Create the command** in `src/commands/yourcommand/index.ts`:
   - Use `commander.js` for argument parsing
   - Support `--json` output via `outputJson()`
   - Support `--dry-run` for write operations
   - Wrap in try/catch with `handleError()`

3. **Add ABI** if needed in `src/contracts/abis/`:
   - Verify the ABI against the live BSC contract
   - Use `const yourAbi = [...] as const` for type safety

4. **Register** the command in `bin/sigma.ts`

5. **Test on BSC mainnet** — see Testing section below

### Example: Adding a read command

```typescript
// src/sdk/yourmodule.ts
export async function getInfo(publicClient: PublicClient): Promise<YourType> {
  const contract = readYourContract({ public: publicClient });
  const data = await contract.read.someFunction();
  return { /* formatted result */ };
}

// src/commands/yourcommand/index.ts
yourCommand
  .command('info')
  .description('Get info about something')
  .action(async () => {
    const opts = program.opts<GlobalOptions>();
    try {
      const publicClient = createBscPublicClient();
      const result = await getInfo(publicClient);
      if (opts.json) outputJson(result);
      else { /* formatted console output */ }
    } catch (e) {
      handleError(e, opts.json);
    }
  });
```

## Testing

### Read operations

Read operations can be tested freely — they don't require a private key or any BNB.

```bash
npm run build && node dist/bin/sigma.js dashboard
npm run build && node dist/bin/sigma.js gov gauges
```

### Write operations

All write operations **must be tested on BSC mainnet** before merging. There is no testnet deployment.

1. Use a **dedicated test wallet** with a small amount of BNB
2. Always test with `--dry-run` first to verify the transaction will succeed
3. Use small amounts for actual transactions
4. Verify the transaction on [BscScan](https://bscscan.com)

```bash
# Dry run first
npm run build && node dist/bin/sigma.js trade buy-bnbusd --amount 0.001 --dry-run

# Then execute
npm run build && node dist/bin/sigma.js trade buy-bnbusd --amount 0.001
```

## Pull Request Process

1. **Fork** the repository
2. **Create a branch** from `main`: `git checkout -b feature/your-feature`
3. **Implement** your changes following the architecture patterns above
4. **Test** on BSC mainnet (both dry-run and live for write operations)
5. **Run checks**: `npm run build && npm run lint`
6. **Submit a PR** with:
   - Clear description of what changed and why
   - Confirmation that write operations were tested live
   - Any new ABI definitions verified against live contracts

## Coding Standards

- **TypeScript strict mode** — no `any` types unless absolutely necessary
- **ESM modules** — use `.js` extensions in imports (TypeScript ESM convention)
- **viem** for all blockchain interactions — no ethers.js or web3.js
- **commander.js** for CLI argument parsing
- Follow existing patterns in the codebase
- Use `as const` for ABI definitions to get full type safety
- Use `0x${string}` type for addresses

## Reporting Issues

- Include the command you ran and the full error output
- Include `--json` output if possible (structured errors are easier to debug)
- Specify your Node.js version and OS
- Never include private keys or sensitive data in issues
