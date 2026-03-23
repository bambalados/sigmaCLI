// Shared constants used across SDK modules

/** 1e18 — standard EVM precision for 18-decimal tokens */
export const PRECISION = 10n ** 18n;

/** Basis points denominator (100%) */
export const BPS = 10000n;

/** Minimum allowed leverage multiplier */
export const MIN_LEVERAGE = 1.2;

/** Maximum allowed leverage multiplier */
export const MAX_LEVERAGE = 7;

/** Default slippage tolerance in percent */
export const DEFAULT_SLIPPAGE = 0.5;
