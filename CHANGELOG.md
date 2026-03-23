# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-03-23

### Added

- **Dashboard**: View balances, positions, prices, deposits, protocol stats, and system health
- **Mint v2**: Open/close minting positions with independent collateral and debt management, partial repay/withdraw, simulate mint range, direct 1:1 swap, mint-and-earn
- **Trade**: Open leveraged long/short BNB positions (1.2-7x), close fully or partially, adjust leverage, add collateral, view position details
- **Stability Pools**: Deposit bnbUSD/USDT, withdraw (instant or cooldown), stake shares for xSIGMA rewards, claim rewards
- **xSIGMA**: Convert SIGMA to xSIGMA, instant exit (50% penalty), create/exit vesting positions (14-180 days), stake/unstake for voting power, trigger rebase
- **Governance**: Vote on gauge emission allocation, reset/poke votes, claim rebase and vote incentives, deposit incentive tokens
- **LP**: Add/remove Curve pool liquidity, stake/unstake LP tokens in gauges
- **Redeem**: Protocol-level bnbUSD redemption for underlying collateral
- **Keeper**: Permissionless rebalancing (2.5% bounty) and liquidation (4% bounty)
- **Config**: macOS Keychain storage for private keys and NodeReal API keys
- **Swap routing**: slisBNB→WBNB (PCS V3), WBNB→USDT (PCS V3), bnbUSD→USDT (Curve)
- JSON output mode (`--json`) for all commands
- Dry-run mode (`--dry-run`) for all write operations
- NodeReal RPC support for reliable BSC access
