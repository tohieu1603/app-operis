# Phase 2: Retry & Recovery

## Context Links
- Parent plan: [plan.md](./plan.md)
- Dependencies: Phase 1 (non-blocking — can be done in parallel)

## Overview
- **Priority:** High
- **Effort:** 1.5h
- **Implementation Status:** pending
- **Review Status:** pending

Add transient retry wrapper for Playwright interactions, smarter retry messaging in client-fetch, and verify Chrome crash auto-restart flow.

## Key Insights
- `pw-tools-core.interactions.ts` is 650 lines — retry wrapper must go in new file `pw-retry.ts`
- All interaction functions already wrap errors via `toAIFriendlyError` — retry wraps BEFORE that transform
- `ensureBrowserAvailable()` already handles `!httpReachable && !attachOnly && !remoteCdp` → launches Chrome. After crash, `running` is set to `null` by exit handler, so next call WILL relaunch. **This flow already works** — just needs verification.
- `client-fetch.ts` `enhanceBrowserFetchError` adds "Do NOT retry" to ALL errors including transient timeouts

## Requirements
### Functional
- Interaction actions retry up to 2 times on transient Playwright errors
- Transient errors: element not visible, element detached, frame detached, timeout waiting for element
- Non-retryable errors: missing ref, evaluate errors, navigation policy blocks, SSRF blocks
- Client-fetch distinguishes transient vs permanent errors in messaging
- Chrome auto-restart verified via existing flow (no code change needed if flow works)

### Non-functional
- Max retry delay: 500ms between attempts
- No infinite loops — strict maxRetries=2 cap
- Retry is transparent to caller — same error thrown if all attempts fail

## Architecture

### New file: `src/browser/pw-retry.ts` (~50 lines)
```
withTransientRetry(fn, opts)
  └── isTransientPlaywrightError(err)
      ├── "not visible" / "not found"
      ├── "not attached" / "frame was detached"
      ├── "execution context was destroyed"
      └── "Timeout" + "waiting for"
```

### Modified: `src/browser/pw-tools-core.interactions.ts`
Wrap `clickViaPlaywright`, `hoverViaPlaywright`, `typeViaPlaywright`, `selectOptionViaPlaywright`, `dragViaPlaywright` with `withTransientRetry`.

### Modified: `src/browser/client-fetch.ts`
Split `enhanceBrowserFetchError` into transient vs permanent paths.

## Related Code Files
- **Create:** `src/browser/pw-retry.ts`
- **Modify:** `src/browser/pw-tools-core.interactions.ts` (wrap 5 functions)
- **Modify:** `src/browser/client-fetch.ts` (lines 101-128)
- **Verify:** `src/browser/server-context.availability.ts` (lines 69-81, 104-156)

## Implementation Steps

### Step 1: Create `src/browser/pw-retry.ts`

```typescript
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

// Only retry timeouts that are about waiting for elements, not navigation timeouts
const TRANSIENT_TIMEOUT_PATTERN = /Timeout.*waiting for/i;

export function isTransientPlaywrightError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (TRANSIENT_PATTERNS.some((p) => msg.includes(p))) return true;
  if (TRANSIENT_TIMEOUT_PATTERN.test(msg)) return true;
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
```

### Step 2: Wrap interaction functions in `pw-tools-core.interactions.ts`

For each of the 5 functions (click, hover, type, select, drag), wrap the try/catch block:

**Example for `clickViaPlaywright`:**
```typescript
// Before:
try {
  await locator.click({ timeout, ... });
} catch (err) {
  throw toAIFriendlyError(err, ref);
}

// After:
import { withTransientRetry } from "./pw-retry.js";

try {
  await withTransientRetry(async () => {
    if (opts.doubleClick) {
      await locator.dblclick({ timeout, ... });
    } else {
      await locator.click({ timeout, ... });
    }
  });
} catch (err) {
  throw toAIFriendlyError(err, ref);
}
```

Apply same pattern to: `hoverViaPlaywright`, `typeViaPlaywright`, `selectOptionViaPlaywright`, `dragViaPlaywright`.

**Do NOT wrap:** `pressKeyViaPlaywright` (keyboard, not element-based), `fillFormViaPlaywright` (already calls individual fill/type which will be wrapped).

### Step 3: Smarter retry messaging in `client-fetch.ts`

Replace `enhanceBrowserFetchError` (lines 101-128):

```typescript
function isTransientFetchError(err: unknown): boolean {
  const msg = String(err).toLowerCase();
  return (
    msg.includes("timed out") ||
    msg.includes("timeout") ||
    msg.includes("aborted") ||
    msg.includes("aborterror") ||
    msg.includes("econnrefused") ||
    msg.includes("econnreset") ||
    msg.includes("fetch failed")
  );
}

function enhanceBrowserFetchError(url: string, err: unknown, timeoutMs: number): Error {
  const isLocal = !isAbsoluteHttp(url);
  const operatorHint = isLocal
    ? `Restart the OpenClaw gateway.`
    : "Ensure the sandbox browser is running.";

  if (isTransientFetchError(err)) {
    const transientHint =
      "Browser temporarily unavailable. You may retry once after a short delay.";
    return new Error(
      `Can't reach the OpenClaw browser control service (timed out after ${timeoutMs}ms). ${operatorHint} ${transientHint}`,
    );
  }

  // Permanent failures — do not retry
  const permanentHint =
    "Do NOT retry the browser tool — it will keep failing. " +
    "Use an alternative approach or inform the user that the browser is currently unavailable.";
  return new Error(
    `Can't reach the OpenClaw browser control service. ${operatorHint} ${permanentHint} (${String(err)})`,
  );
}
```

### Step 4: Verify Chrome auto-restart flow

Review `server-context.availability.ts` to confirm:
1. `proc.on("exit")` sets `running = null` (line 77) ✓
2. `ensureBrowserAvailable()` checks `!httpReachable` (line 132) ✓
3. When `!httpReachable && !attachOnly && !remoteCdp` → `launchOpenClawChrome()` (line 146) ✓

**Expected flow after Chrome crash:**
```
Chrome crash → proc "exit" event → running = null
Next browser tool call → ensureBrowserAvailable()
  → httpReachable = false (Chrome dead)
  → !attachOnly && !remoteCdp → launchOpenClawChrome()
  → waitForCdpReadyAfterLaunch()
  → Chrome alive again
```

This flow already works correctly. **No code change needed** — just add a test to verify.

### Step 5: Add test for `pw-retry.ts`

Create `src/browser/pw-retry.test.ts`:
- Test `isTransientPlaywrightError` with various error messages
- Test `withTransientRetry` succeeds on retry
- Test `withTransientRetry` throws non-transient errors immediately
- Test `withTransientRetry` throws after max retries exhausted

## Todo List
- [ ] Create `src/browser/pw-retry.ts` with `withTransientRetry` and `isTransientPlaywrightError`
- [ ] Wrap `clickViaPlaywright` with retry
- [ ] Wrap `hoverViaPlaywright` with retry
- [ ] Wrap `typeViaPlaywright` with retry
- [ ] Wrap `selectOptionViaPlaywright` with retry
- [ ] Wrap `dragViaPlaywright` with retry
- [ ] Update `enhanceBrowserFetchError` in `client-fetch.ts` with transient/permanent split
- [ ] Verify Chrome auto-restart flow in `server-context.availability.ts`
- [ ] Create `pw-retry.test.ts`
- [ ] Run `pnpm test` — all tests pass

## Success Criteria
- Transient Playwright errors trigger up to 2 retries with 500ms delay
- Non-transient errors throw immediately (no retry)
- Timeout errors in client-fetch say "may retry once" instead of "Do NOT retry"
- Permanent errors still say "Do NOT retry"
- Chrome crash + next tool call = Chrome auto-relaunched
- New tests for `pw-retry.ts` pass
- All existing tests pass

## Risk Assessment
- **Medium risk:** Retry logic could mask real bugs if transient patterns are too broad
- **Mitigation:** Conservative pattern list, max 2 retries, only element-interaction errors
- **Risk:** Retry delay (2 × 500ms = 1s max) could feel slow
- **Mitigation:** 500ms is acceptable for browser interactions; user already waits for page loads

## Security Considerations
- No security impact — retry is internal, no auth/SSRF bypass
- Navigation policy blocks are NOT retried (by design)

## Next Steps
- Phase 3: Data Handling (screenshot fallback)
