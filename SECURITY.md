# Security Policy

## ⚠️ This Project Handles Private Keys

The Sigma.Money CLI signs blockchain transactions locally using your private key. Security is critical — a compromised key means **permanent loss of funds** with no recovery.

## Reporting Vulnerabilities

If you discover a security vulnerability, **do not open a public issue**.

Instead, please report it via one of these methods:

1. **GitHub Security Advisory**: Use the "Report a vulnerability" button on the Security tab of this repository
2. **Email**: Send details to the repository maintainers (see the repository's contact information)

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will acknowledge receipt within 48 hours and aim to release a fix within 7 days for critical issues.

## Key Management Architecture

### How the CLI handles private keys

The CLI uses [viem](https://viem.sh) for all cryptographic operations. Here's what happens with your key:

1. **Key loading**: The key is read from one of three sources (in priority order):
   - `--private-key` CLI flag
   - `SIGMA_PRIVATE_KEY` environment variable
   - macOS Keychain (via `security` command)

2. **Local signing**: All transaction signing happens **in-process** on your machine. The key is held in memory only for the duration of the command.

3. **No transmission**: The private key is **never** sent over the network. Only signed transactions are broadcast to the BSC RPC endpoint.

### What the CLI does NOT do

- ❌ Never transmits your private key to any server
- ❌ Never stores your key in plaintext on disk (unless you create a `.env` file yourself)
- ❌ Never logs your key to console output or log files
- ❌ Never includes your key in error reports
- ❌ Never sends your key to analytics or telemetry services (there are none)

### Recommended key management

| Method | Security | Convenience |
|--------|----------|-------------|
| macOS Keychain | ★★★★★ | ★★★★ |
| Environment variable | ★★★ | ★★★★ |
| `.env` file | ★★★ | ★★★★★ |
| CLI flag | ★★ | ★★ |

**Best practices:**
- Use a **dedicated wallet** with only the funds you need for CLI operations
- Never use your primary wallet or a wallet holding significant assets
- Use macOS Keychain storage when possible (`sigma config set-key`)
- If using `.env` files, ensure they are in `.gitignore` and never committed
- The `--private-key` flag is the least secure option — it may appear in shell history

## RPC Security

- The CLI connects to BSC RPC endpoints to read blockchain data and broadcast transactions
- Default RPC: `https://bsc-dataseed.binance.org/` (public, operated by Binance)
- NodeReal RPC: Uses your API key for authenticated access (key stored in macOS Keychain or environment variable)
- Custom RPC: You can specify any BSC RPC endpoint — ensure you trust the provider
- RPC providers can see your wallet address and transaction data, but **not** your private key

## Dependencies

This project uses a minimal set of well-maintained dependencies:
- **viem** — Ethereum/BSC interaction library
- **commander** — CLI argument parsing
- **chalk** — Terminal formatting
- **dotenv** — Environment variable loading

We regularly review dependencies for known vulnerabilities. Run `npm audit` to check for yourself.

## Scope

This security policy covers the CLI tool itself. It does **not** cover:
- The underlying Sigma.Money smart contracts (see [sigma.money](https://sigma.money) for protocol security)
- Third-party RPC providers
- Your operating system or key management practices
