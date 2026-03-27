import ora, { type Ora } from 'ora';

export function createSpinner(text: string): Ora {
  return ora({ text, color: 'yellow' });
}

/**
 * Run an async operation with a spinner.
 * Shows the spinner while the promise is pending, then succeeds or fails.
 */
export async function withSpinner<T>(text: string, fn: () => Promise<T>): Promise<T> {
  const spinner = createSpinner(text);
  spinner.start();
  try {
    const result = await fn();
    spinner.succeed();
    return result;
  } catch (error) {
    spinner.fail();
    throw error;
  }
}

/**
 * Conditional spinner — skips in --json mode so JSON consumers get clean output.
 */
export async function maybeWithSpinner<T>(
  text: string,
  json: boolean | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  if (json) return fn();
  return withSpinner(text, fn);
}
