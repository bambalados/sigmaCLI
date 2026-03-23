import { execSync } from 'child_process';
import { platform } from 'os';

const SERVICE_NAME = 'sigma-money-cli';

function isMac(): boolean {
  return platform() === 'darwin';
}

function keychainGet(account: string): string | null {
  if (!isMac()) return null;
  try {
    const result = execSync(
      `security find-generic-password -s "${SERVICE_NAME}" -a "${account}" -w 2>/dev/null`,
      { encoding: 'utf-8' },
    );
    return result.trim();
  } catch {
    return null;
  }
}

function keychainSet(account: string, password: string): void {
  if (!isMac()) {
    throw new Error('Apple Keychain is only available on macOS. Use .env file instead.');
  }
  // Delete existing entry if present (ignore errors)
  try {
    execSync(
      `security delete-generic-password -s "${SERVICE_NAME}" -a "${account}" 2>/dev/null`,
    );
  } catch {
    // Entry may not exist — that's fine
  }
  execSync(
    `security add-generic-password -s "${SERVICE_NAME}" -a "${account}" -w "${password}"`,
  );
}

function keychainDelete(account: string): boolean {
  if (!isMac()) return false;
  try {
    execSync(
      `security delete-generic-password -s "${SERVICE_NAME}" -a "${account}" 2>/dev/null`,
    );
    return true;
  } catch {
    return false;
  }
}

// --- Public API ---

export function getPrivateKeyFromKeychain(): string | null {
  return keychainGet('private-key');
}

export function setPrivateKeyInKeychain(key: string): void {
  keychainSet('private-key', key);
}

export function deletePrivateKeyFromKeychain(): boolean {
  return keychainDelete('private-key');
}

export function getRpcKeyFromKeychain(): string | null {
  return keychainGet('rpc-api-key');
}

export function setRpcKeyInKeychain(key: string): void {
  keychainSet('rpc-api-key', key);
}

export function deleteRpcKeyFromKeychain(): boolean {
  return keychainDelete('rpc-api-key');
}

export function isKeychainAvailable(): boolean {
  return isMac();
}
