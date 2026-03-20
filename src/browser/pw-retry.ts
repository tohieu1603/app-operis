/**
 * Transient retry wrapper for Playwright interaction errors.
 * Retries element-level failures (detached, not visible, stale) up to maxRetries times.
 * Non-transient errors (bad ref, SSRF, navigation policy) throw immediately.
 */

const TRANSIENT_PATTERNS = [
  "not visible",
  "not found",
  "not attached",
  "Element is not attached",
  "frame was detached",
  "execution context was destroyed",
  "Target closed",
  "Session closed",
];

const TRANSIENT_TIMEOUT_PATTERN = /Timeout.*waiting for/i;

export function isTransientPlaywrightError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (TRANSIENT_PATTERNS.some((p) => msg.includes(p))) {
    return true;
  }
  if (TRANSIENT_TIMEOUT_PATTERN.test(msg)) {
    return true;
  }
  return false;
}

export async function withTransientRetry<T>(
  fn: () => Promise<T>,
  opts?: { maxRetries?: number; delayMs?: number },
): Promise<T> {
  const maxRetries = opts?.maxRetries ?? 2;
  const delayMs = opts?.delayMs ?? 500;
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt >= maxRetries || !isTransientPlaywrightError(err)) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastError;
}
