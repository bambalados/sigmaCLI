# Project Governance

Rules and best practices that everyone — maintainers and contributors — must follow.

## Versioning

We use [Semantic Versioning](https://semver.org/):

- **PATCH** (1.0.x): Bug fixes, typo corrections, dependency updates
- **MINOR** (1.x.0): New commands, new features, non-breaking enhancements
- **MAJOR** (x.0.0): Breaking changes to CLI flags, output format, or behavior

Every release is tagged in git (`v1.0.0`, `v1.1.0`, etc.) and documented in [CHANGELOG.md](CHANGELOG.md).

## Branching

- **Never commit directly to `main`.** All changes go through pull requests.
- Use descriptive branch names: `feature/tp-sl`, `fix/mint-close-slippage`, `docs/update-usage`
- Keep branches short-lived — merge or close within a week

## Pull Request Requirements

Every PR must:

1. **Pass CI** — `npm run lint` (zero TypeScript errors) and `npm run build` must succeed
2. **Include a clear description** — what changed and why
3. **Confirm live testing** — for write operations, confirm they were tested on BSC mainnet (with `--dry-run` at minimum)
4. **Follow existing patterns** — use the three-layer architecture (contracts → sdk → commands)
5. **Not introduce new lint errors** — we maintain zero TypeScript errors

## Security Reviews

PRs that touch any of these files **require maintainer review**:

- `src/wallet.ts` — private key loading
- `src/keychain.ts` — macOS Keychain integration
- `src/config.ts` — RPC configuration
- `src/contracts/addresses.ts` — contract addresses
- Any file handling `privateKey`, `account`, or signing

These files are the security-critical path. A bug here can result in loss of funds.

## Code Standards

- **TypeScript strict mode** — zero errors from `tsc --noEmit`
- **ESM modules** — use `.js` extensions in imports
- **viem only** — no ethers.js or web3.js
- **No `any` types** — use proper typing or `unknown` with type guards
- **`as const` for ABIs** — ensures full type safety with viem
- Follow existing patterns in the codebase — consistency over cleverness

## Release Process

1. Create a release branch: `release/v1.1.0`
2. Update version in `package.json`
3. Update `CHANGELOG.md` with all changes since last release
4. Update `USAGE.md` and `README.md` if commands changed
5. Open PR to `main`, get approval
6. Merge, tag the release: `git tag v1.1.0`
7. Publish to npm (if applicable): `npm publish`

## Dependency Management

- **Minimal dependencies** — we currently have 5 runtime deps. Think twice before adding another.
- Run `npm audit` before every release
- Pin major versions in `package.json` (use `^` for minor/patch updates)
- Review dependency updates for breaking changes before merging

## Issue-First Development

For non-trivial features:

1. **Create a GitHub issue** describing the feature or bug
2. **Discuss the approach** in the issue before writing code
3. **Reference the issue** in your PR (`Fixes #42`)

This creates a paper trail and lets others weigh in before work begins.

## Good First Issues

Maintainers should keep a steady supply of issues tagged `good first issue`. Examples:

- Add `--json` output to a command missing it
- Improve an error message
- Add a new read-only command
- Fix a typo in documentation
- Add input validation to a command flag

These tasks help new contributors get familiar with the codebase without risk.

## Documentation

Every user-facing change must update documentation:

- **New command** → update `USAGE.md` (examples required) + `README.md` command table
- **Changed flag** → update `USAGE.md`
- **Breaking change** → update `README.md` migration notes + `CHANGELOG.md`
- Keep `USAGE.md` and `README.md` in sync — they are the primary references
