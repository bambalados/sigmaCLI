# Sigma.Money CLI — Complete Usage Guide

This document covers every command in the Sigma.Money CLI with examples. It is intended for both human users and AI agents integrating with the CLI.

For installation and quick start, see [README.md](README.md).

---

## Global Options

These flags work on all commands:

| Flag | Description |
|------|-------------|
| `--json` | Output structured JSON instead of formatted text |
| `--dry-run` | Simulate a write transaction without sending it |
| `--private-key <key>` | Private key for signing (alternative to env var or Keychain) |
| `--rpc <url>` | Custom BSC RPC URL |

**JSON mode** is useful for scripting and AI agent integration — every command supports it.

**Dry-run** is available on all write commands. It simulates the transaction on-chain and reports whether it would succeed, without spending gas.

---

## 1. Configuration

Set up your wallet and RPC before using write commands.

### `sigma config set-key [key]`

Store your private key in the macOS Keychain. If you omit the key, you'll be prompted to enter it securely (hidden input).

```bash
# Interactive (recommended — key won't appear in shell history)
sigma config set-key

# Direct (less secure — visible in shell history)
sigma config set-key abc123def456...
```

### `sigma config set-rpc-key <apiKey>`

Store a NodeReal API key in the macOS Keychain for reliable BSC RPC access.

```bash
sigma config set-rpc-key your-nodereal-api-key
```

### `sigma config show`

Display current configuration. Keys are masked for security.

```bash
sigma config show
```

### `sigma config clear-key`

Remove your private key from the Keychain.

```bash
sigma config clear-key
```

### `sigma config clear-rpc-key`

Remove your NodeReal API key from the Keychain.

```bash
sigma config clear-rpc-key
```

---

## 2. Dashboard (Read-Only)

View protocol stats, prices, balances, and positions. No private key needed for `stats`, `price`, and `health`. The `balances`, `positions`, and `deposits` commands require a key to identify your wallet.

### `sigma dashboard stats`

Protocol-wide overview: BNB price, bnbUSD supply, total collateral, total debt, stability pool TVL.

```bash
sigma dashboard stats
sigma dashboard stats --json
```

### `sigma dashboard price`

Current BNB and bnbUSD prices from the protocol oracle.

```bash
sigma dashboard price
```

### `sigma dashboard balances`

Your token balances (BNB, WBNB, bnbUSD, SIGMA, xSIGMA, etc.).

```bash
sigma dashboard balances
```

### `sigma dashboard positions`

All your open trading positions with collateral, debt, leverage, health factor, and PnL.

```bash
sigma dashboard positions
sigma dashboard positions --json
```

### `sigma dashboard deposits`

Your stability pool deposits across all pools.

```bash
sigma dashboard deposits
```

### `sigma dashboard health`

System-wide health indicators.

```bash
sigma dashboard health
```

---

## 3. Mint — bnbUSD Minting Positions

The core of the Sigma.Money protocol. Deposit BNB as collateral and borrow bnbUSD against it. Manage your position's collateral and debt independently.

### `sigma mint simulate` (Read-Only)

Preview the available mint range for a given collateral amount. Shows min/max borrow, LTV limits, and risk thresholds. No wallet needed.

```bash
# How much bnbUSD can I mint with 1 BNB?
sigma mint simulate --collateral BNB --amount 1

# JSON output for scripting
sigma mint simulate --collateral BNB --amount 0.5 --json
```

### `sigma mint position` (Read-Only)

View details of any minting position by ID. Shows collateral, debt, LTV, health factor, leverage, and PnL.

```bash
# View position #4
sigma mint position --position-id 4

# JSON output
sigma mint position --position-id 4 --json
```

### `sigma mint open`

Open a new minting position or add collateral/debt to an existing one.

**New position:**

```bash
# Deposit 0.1 BNB and borrow 30 bnbUSD
sigma mint open --collateral BNB --amount 0.1 --borrow 30

# Same thing, but specify LTV instead of borrow amount
sigma mint open --collateral BNB --amount 0.1 --ltv 50

# Dry-run to check if it would succeed
sigma mint open --collateral BNB --amount 0.1 --borrow 30 --dry-run

# See the available range (omit --borrow and --ltv)
sigma mint open --collateral BNB --amount 0.1
```

**Add to existing position:**

```bash
# Add 0.05 BNB collateral and borrow 10 more bnbUSD on position #42
sigma mint open --collateral BNB --amount 0.05 --borrow 10 --position-id 42

# Add collateral only (borrow 0 extra)
sigma mint open --collateral BNB --amount 0.05 --borrow 0 --position-id 42
```

### `sigma mint close`

Withdraw collateral and/or repay debt on an existing position. At least one of `--collateral` or `--repay` is required.

```bash
# Repay 10 bnbUSD of debt (no collateral withdrawal)
sigma mint close --position-id 42 --repay 10

# Withdraw 0.01 collateral (no debt repayment)
sigma mint close --position-id 42 --collateral 0.01

# Both: repay 10 bnbUSD AND withdraw 0.01 collateral
sigma mint close --position-id 42 --repay 10 --collateral 0.01

# Dry-run first
sigma mint close --position-id 42 --repay 10 --dry-run
```

**Partial close example:** Repay 30% of your debt to lower LTV, then withdraw 10% of collateral:

```bash
# Check current position first
sigma mint position --position-id 42

# Repay 30% of debt
sigma mint close --position-id 42 --repay 15

# Then withdraw some collateral
sigma mint close --position-id 42 --collateral 0.005
```

### `sigma mint earn`

Swap BNB for bnbUSD and auto-deposit into the earning pool for yield.

```bash
sigma mint earn --collateral BNB --amount 0.1
sigma mint earn --collateral BNB --amount 0.1 --min-out 60
```

---

## 4. Trade — Leveraged Positions

Open leveraged long or short BNB positions. Separate from minting — these are leveraged trading positions via the ShortPoolManager/PoolManager.

### `sigma trade pools` (Read-Only)

List available trading pools with risk parameters (min/max LTV, rebalance/liquidation thresholds).

```bash
sigma trade pools
sigma trade pools --json
```

### `sigma trade info` (Read-Only)

View details of a specific trading position.

```bash
sigma trade info --position-id 7
```

### `sigma trade positions` (Read-Only)

List all your open trading positions across pools.

```bash
sigma trade positions
sigma trade positions --json
```

### `sigma trade open-long`

Open a leveraged long BNB position. You profit when BNB price goes up.

```bash
# 2x leverage with 0.1 BNB
sigma trade open-long --collateral BNB --amount 0.1 --leverage 2

# Maximum leverage (7x) with WBNB
sigma trade open-long --collateral WBNB --amount 0.5 --leverage 7

# Dry-run
sigma trade open-long --collateral BNB --amount 0.1 --leverage 3 --dry-run
```

### `sigma trade open-short`

Open a leveraged short BNB position. You profit when BNB price goes down. Requires bnbUSD as collateral.

```bash
sigma trade open-short --collateral bnbUSD --amount 100 --leverage 2
sigma trade open-short --collateral bnbUSD --amount 50 --leverage 3 --dry-run
```

### `sigma trade close`

Close a position fully or partially. Choose the output token.

```bash
# Close 100% of position (default)
sigma trade close --position-id 7

# Close 50% of position
sigma trade close --position-id 7 --percent 50

# Close and receive USDT instead of BNB
sigma trade close --position-id 7 --output USDT

# Dry-run
sigma trade close --position-id 7 --percent 25 --dry-run
```

Output token options: `BNB` (default for longs), `WBNB`, `USDT`, `bnbUSD` (default for shorts), `slisBNB`.

### `sigma trade adjust`

Change the leverage on an existing position without closing it.

```bash
# Increase leverage to 5x
sigma trade adjust --position-id 7 --leverage 5

# Decrease leverage to 1.5x
sigma trade adjust --position-id 7 --leverage 1.5
```

### `sigma trade add`

Add more collateral to an existing position (lowers LTV / increases health).

```bash
# Add 0.05 BNB to a long position
sigma trade add --position-id 7 --collateral BNB --amount 0.05

# Add 20 bnbUSD to a short position
sigma trade add --position-id 12 --collateral bnbUSD --amount 20
```

---

## 5. Stability Pool

Deposit bnbUSD or USDT into stability pools to earn yield. Pools absorb liquidations and earn collateral in return.

### `sigma pool stats` (Read-Only)

View stability pool statistics.

```bash
# All pools
sigma pool stats

# Specific pool
sigma pool stats --pool SP1

# JSON
sigma pool stats --json
```

Pool names: `SP`, `SP1`, `SP2`, `SP3`.

### `sigma pool deposit`

Deposit tokens into a stability pool.

```bash
# Deposit 100 bnbUSD into SP1
sigma pool deposit --pool SP1 --token bnbUSD --amount 100

# Deposit USDT
sigma pool deposit --pool SP --token USDT --amount 50
```

### `sigma pool withdraw`

Withdraw from a stability pool. Default: request withdrawal with 60-minute cooldown. Use `--instant` for immediate withdrawal with 1% fee.

```bash
# Request withdrawal (60min cooldown)
sigma pool withdraw --pool SP1 --amount 50

# Instant withdrawal (1% fee)
sigma pool withdraw --pool SP1 --amount 50 --instant
```

### `sigma pool claim`

Claim a pending withdrawal after the cooldown period.

```bash
sigma pool claim --pool SP1 --shares 50
```

### `sigma pool stake`

Stake stability pool shares into a gauge to earn xSIGMA rewards.

```bash
sigma pool stake --pool SP1 --amount 100
```

### `sigma pool unstake`

Unstake stability pool shares from the gauge.

```bash
sigma pool unstake --pool SP1 --amount 100
```

### `sigma pool claim-rewards`

Claim xSIGMA rewards from staked stability pool shares.

```bash
sigma pool claim-rewards --pool SP1
```

---

## 6. xSIGMA — Governance Token

xSIGMA is the governance token. Convert SIGMA to xSIGMA, stake for voting power, or vest for a penalty-free exit over time.

### `sigma xsigma info` (Read-Only)

Protocol-wide xSIGMA stats and your personal balance/staking info.

```bash
sigma xsigma info
sigma xsigma info --json
```

### `sigma xsigma vests` (Read-Only)

List your active vesting positions with amounts, start dates, and end dates.

```bash
sigma xsigma vests
```

### `sigma xsigma convert`

Convert SIGMA tokens to xSIGMA (1:1 ratio).

```bash
sigma xsigma convert --amount 100
sigma xsigma convert --amount 100 --dry-run
```

### `sigma xsigma stake`

Stake xSIGMA into VoteModule to gain voting power for governance.

```bash
sigma xsigma stake --amount 50
```

### `sigma xsigma unstake`

Unstake xSIGMA from VoteModule.

```bash
sigma xsigma unstake --amount 50
```

### `sigma xsigma exit`

Instant exit: convert xSIGMA back to SIGMA immediately with a 50% slashing penalty.

```bash
# WARNING: 50% of your xSIGMA is burned
sigma xsigma exit --amount 10
sigma xsigma exit --amount 10 --dry-run
```

### `sigma xsigma vest`

Create a vesting position. Lock xSIGMA and receive SIGMA gradually over 14-180 days with no penalty.

```bash
sigma xsigma vest --amount 100
```

### `sigma xsigma exit-vest`

Exit (cancel) a specific vesting position early. Returns remaining xSIGMA.

```bash
sigma xsigma exit-vest --vest-id 0
sigma xsigma exit-vest --vest-id 1
```

### `sigma xsigma rebase`

Trigger the rebase distribution. Distributes accumulated protocol fees to xSIGMA stakers.

```bash
sigma xsigma rebase
```

---

## 7. Governance — Voting and Incentives

Direct SIGMA emissions to liquidity pools by voting with your staked xSIGMA.

### `sigma gov gauges` (Read-Only)

List all gauges with their associated pools and alive/dead status.

```bash
sigma gov gauges
sigma gov gauges --json
```

### `sigma gov my-votes` (Read-Only)

Show your current vote allocation for the next period.

```bash
sigma gov my-votes
```

### `sigma gov vote`

Vote on gauge emission allocation. Provide one or more gauge/weight pairs. Weights are relative — they don't need to sum to 100.

```bash
# Vote for a single gauge
sigma gov vote --gauge 0x1F04a2AC... --weight 100

# Split votes across multiple gauges (20/50/30 split)
sigma gov vote --gauge 0x1F04a2AC... --weight 20 \
              --gauge 0x6a25b41C... --weight 50 \
              --gauge 0x7e1f2EB2... --weight 30

# Dry-run
sigma gov vote --gauge 0x1F04a2AC... --weight 100 --dry-run
```

**How voting works:** Votes apply to the next weekly period. The protocol normalizes weights automatically, so `20/50/30` is the same as `2/5/3`. You must have staked xSIGMA to vote.

### `sigma gov reset`

Reset all your votes. Required before changing your vote allocation.

```bash
sigma gov reset
```

### `sigma gov poke`

Refresh your vote weights. Call this after staking/unstaking xSIGMA to update your voting power.

```bash
sigma gov poke
```

### `sigma gov claim-rebase`

Claim staking rewards accumulated from the VoteModule.

```bash
sigma gov claim-rebase
```

### `sigma gov claim-incentives`

Claim vote incentives (bribes) from fee distributors.

```bash
# Claim from all gauges you voted for
sigma gov claim-incentives

# Claim from specific gauges only
sigma gov claim-incentives --gauge 0x1F04a2AC... --gauge 0x6a25b41C...
```

### `sigma gov incentivize`

Deposit incentive tokens (bribes) for voters of a specific gauge.

```bash
sigma gov incentivize --gauge 0x1F04a2AC... --token 0xTokenAddr... --amount 1000
sigma gov incentivize --gauge 0x1F04a2AC... --token 0xTokenAddr... --amount 1000 --decimals 6
```

---

## 8. LP — Curve Liquidity Provisioning

Add/remove liquidity and stake LP tokens for rewards.

Pool names: `bnbUSD-USDT`, `SIGMA-bnbUSD`, `bnbUSD-U`.

### `sigma lp add`

Add liquidity to a Curve pool.

```bash
# Add liquidity to bnbUSD-USDT pool (amounts are comma-separated per token)
sigma lp add --pool bnbUSD-USDT --amounts 100,100
```

### `sigma lp remove`

Remove liquidity from a Curve pool.

```bash
sigma lp remove --pool bnbUSD-USDT --amount 50
```

### `sigma lp stake`

Stake LP tokens into a gauge to earn xSIGMA rewards.

```bash
sigma lp stake --pool bnbUSD-USDT --amount 50
```

### `sigma lp unstake`

Unstake LP tokens from a gauge.

```bash
sigma lp unstake --pool bnbUSD-USDT --amount 50
```

---

## 9. Redeem

### `sigma redeem`

Redeem bnbUSD for underlying BNB collateral through the PoolManager at a 0.5% fee. This is a protocol-level redemption (Liquity-style), not tied to any specific minting position.

```bash
sigma redeem --amount 100
sigma redeem --amount 100 --min-collateral 0.15
sigma redeem --amount 50 --dry-run
```

---

## 10. Keeper — Earn Bounties

Permissionless operations that maintain protocol health. Anyone can call these and earn bounties.

### `sigma keeper rebalance`

Execute a rebalancing operation on a pool. Earns a 2.5% bounty if the pool is eligible for rebalancing.

```bash
sigma keeper rebalance
sigma keeper rebalance --pool 0xe8a16F80...
sigma keeper rebalance --dry-run
```

### `sigma keeper liquidate`

Execute a liquidation on a pool. Earns a 4% bounty if the pool has liquidatable positions.

```bash
sigma keeper liquidate
sigma keeper liquidate --pool 0xe8a16F80...
```

---

## 11. Unwrap

### `sigma unwrap`

Unwrap SIGMASY tokens back to underlying assets (BNB).

```bash
sigma unwrap --amount 0.5
```

---

## Tips for AI Agents

- Use `--json` on every command to get structured, parseable output
- Use `--dry-run` before any write operation to verify it will succeed
- Use `sigma mint position --position-id <id> --json` to read position state before modifying it
- Use `sigma dashboard stats --json` to get protocol state
- Use `sigma gov gauges --json` to enumerate available gauges before voting
- Gauge weights are relative — `20/50/30` is equivalent to `2/5/3`
- Position IDs are returned when opening positions via `--json` output
- The `sigma mint close` command accepts both `--collateral` and `--repay` independently — you can repay debt without withdrawing collateral, or vice versa
