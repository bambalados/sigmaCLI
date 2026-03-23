import pc from 'picocolors';
import Table from 'cli-table3';

// BigInt-safe JSON serializer
function bigintReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  return value;
}

export function outputJson(data: unknown): void {
  console.log(JSON.stringify(data, bigintReplacer, 2));
}

export function outputTable(headers: string[], rows: string[][]): void {
  const table = new Table({
    head: headers.map((h) => pc.bold(pc.cyan(h))),
    style: { head: [], border: [] },
  });
  rows.forEach((row) => table.push(row));
  console.log(table.toString());
}

export function outputKeyValue(pairs: Record<string, string>): void {
  const maxKeyLen = Math.max(...Object.keys(pairs).map((k) => k.length));
  for (const [key, value] of Object.entries(pairs)) {
    console.log(`  ${pc.bold(key.padEnd(maxKeyLen))}  ${value}`);
  }
}

export function outputSuccess(msg: string): void {
  console.log(pc.green(`✓ ${msg}`));
}

export function outputError(msg: string): void {
  console.error(pc.red(`✗ ${msg}`));
}

export function outputWarn(msg: string): void {
  console.log(pc.yellow(`⚠ ${msg}`));
}

export function outputTxResult(hash: string, explorerUrl: string): void {
  outputSuccess('Transaction confirmed');
  console.log(`  ${pc.dim('Hash:')} ${hash}`);
  console.log(`  ${pc.dim('View:')} ${pc.underline(explorerUrl)}`);
}

export function formatBigInt(value: bigint, decimals: number, displayDecimals = 4): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = value / divisor;
  const fraction = value % divisor;
  const fractionStr = fraction.toString().padStart(decimals, '0').slice(0, displayDecimals);
  return `${whole}.${fractionStr}`;
}

export function parseBigInt(value: string, decimals: number): bigint {
  const parts = value.split('.');
  const whole = BigInt(parts[0] || '0') * 10n ** BigInt(decimals);
  if (!parts[1]) return whole;
  const fractionStr = parts[1].slice(0, decimals).padEnd(decimals, '0');
  return whole + BigInt(fractionStr);
}
