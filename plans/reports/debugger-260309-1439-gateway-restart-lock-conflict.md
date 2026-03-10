# Gateway Restart / Lock Conflict Investigation

**Date:** 2026-03-09
**Branch:** Hung

---

## Executive Summary

After a gateway crash (e.g. from external `taskkill`), the Electron app schedules a restart but the new gateway process fails immediately with:

```
gateway already running (pid 3772); lock timeout after 5000ms
```

Root cause: the lock file in `os.tmpdir()/operis/gateway.<hash>.lock` is NOT cleaned up on crash because the lock `release()` callback is only called on orderly shutdown — never on unclean process exit.
Secondary issue: `isAlive(pid)` on Windows uses `process.kill(pid, 0)`, which on Windows can return `true` for a PID that has been recycled to a completely different process, so the lock is incorrectly treated as "alive" even after the gateway has died.

---

## Key Files

| File | Role |
|------|------|
| `src/infra/gateway-lock.ts` | Lock acquisition / release logic |
| `src/config/paths.ts:214` | `resolveGatewayLockDir()` → `os.tmpdir()/operis[-uid]` |
| `apps/windows-desktop/src/gateway-manager.ts` | Electron-side: spawns, monitors, restarts gateway |
| `apps/windows-desktop/src/main.ts` | App lifecycle, calls `gateway.start()` / `gateway.stop()` |
| `src/cli/gateway-cli/run-loop.ts` | Gateway entry: calls `acquireGatewayLock()` before starting |

---

## Lock Lifecycle Analysis

### Acquisition
`acquireGatewayLock()` in `src/infra/gateway-lock.ts:176`:
1. Opens the lock file with `O_EXCL` (`fs.open(lockPath, "wx")`).
2. Writes `{ pid, createdAt, configPath }` JSON into it.
3. Returns a `GatewayLockHandle` with `release()` that closes the fd and `fs.rm`s the file.

### Release
The `release()` function is only called:
- In `run-loop.ts` on orderly exit (wrapped in try/finally).
- In `macos/gateway-daemon.ts` on clean shutdown.

On **crash / taskkill / SIGKILL** → `release()` is never called → lock file remains on disk.

### Stale-lock detection (the broken part on Windows)
When the new gateway tries to acquire and finds the file exists (`EEXIST`):

```
resolveGatewayOwnerStatus(ownerPid, payload, platform):
  if (!isAlive(pid)) → "dead"    ← cleans up immediately
  if (platform !== "linux") → "alive"   ← !! always alive on Windows if PID exists !!
```

`isAlive(pid)` calls `process.kill(pid, 0)`.
On **Windows**, `process.kill(pid, 0)` succeeds (returns `true`) as long as *any* process with that PID exists — it does not verify it is the same process.
After the gateway is killed, Windows can recycle PID 3772 to another process within milliseconds. When the new gateway tries the lock 1 second later, `process.kill(3772, 0)` succeeds (hits the new, unrelated process), so `ownerStatus === "alive"`, and the lock is never cleaned.

On Linux this is handled by comparing `/proc/pid/stat` start-time — no equivalent on Windows.

The fallback stale-check only triggers if `ownerStatus !== "alive"`:
```ts
if (ownerStatus !== "alive") {
  // check staleMs (default 30s) before removing
}
```
Since Windows always returns `"alive"` for a recycled PID, the stale check is never reached. The timeout is 5000 ms, but the stale threshold is 30000 ms — so even the stale path would not help in this window.

### Electron restart path
`gateway-manager.ts:scheduleRestart()`:
- Exponential backoff from 1s, capped at 30s.
- Calls `spawnGateway()` directly (not `start()`).
- `start()` calls `killZombieOnPort()` only on first start — **not called on restart**.
- Neither `start()` nor `scheduleRestart()` deletes the lock file before spawning.

### The 5 s timeout
`acquireGatewayLock` polls every 100 ms for up to `timeoutMs` (default 5000 ms).
Since the Windows `isAlive` check keeps returning "alive" for the recycled PID, every poll finds the lock "alive" and just sleeps 100 ms. After 5000 ms it throws `GatewayLockError`.

---

## Root Cause Chain

1. Gateway process killed externally (taskkill ENOENT or crash).
2. Lock file `os.tmpdir()/operis/gateway.<hash>.lock` NOT deleted (no orderly shutdown).
3. Electron detects `exit` event → schedules restart in ~1 s.
4. New gateway process spawns, calls `acquireGatewayLock()`.
5. Lock file exists → reads PID 3772 → calls `isAlive(3772)`.
6. On Windows, PID 3772 may have been recycled → `process.kill(3772, 0)` returns `true`.
7. `resolveGatewayOwnerStatus` returns `"alive"` (non-linux fast path).
8. Stale check never triggered (owner is "alive").
9. After 5000 ms timeout → throws `GatewayLockError("gateway already running (pid 3772); lock timeout after 5000ms")`.
10. Gateway exits with this error → Electron schedules another restart → loop repeats.

---

## Suggested Fixes

### Fix 1 (Recommended): Clean lock file before restart in `gateway-manager.ts`

In `GatewayManager`, before calling `spawnGateway()` on restart, proactively delete the lock file if the previous child is confirmed dead.

```ts
// In gateway-manager.ts, add helper:
private async cleanStaleLock(): Promise<void> {
  try {
    const lockDir = path.join(os.tmpdir(), "operis");
    const files = fs.readdirSync(lockDir);
    for (const f of files) {
      if (!f.startsWith("gateway.") || !f.endsWith(".lock")) continue;
      const lockPath = path.join(lockDir, f);
      try {
        const raw = fs.readFileSync(lockPath, "utf-8");
        const payload = JSON.parse(raw);
        if (typeof payload.pid === "number") {
          try { process.kill(payload.pid, 0); } catch { fs.rmSync(lockPath, { force: true }); }
        }
      } catch { /* corrupt lock */ }
    }
  } catch { /* lockDir may not exist */ }
}
```

Then in `scheduleRestart()` or `spawnGateway()`:
```ts
private scheduleRestart(): void {
  if (this.shuttingDown) return;
  const delay = Math.min(BASE_BACKOFF_MS * 2 ** this.restartCount, MAX_BACKOFF_MS);
  this.restartCount++;
  this.restartTimer = setTimeout(async () => {
    this.restartTimer = null;
    if (!this.shuttingDown) {
      await this.cleanStaleLock(); // <-- add this
      this.spawnGateway();
    }
  }, delay);
}
```

**Limitation**: on Windows, `process.kill(pid, 0)` is not reliable for recycled PIDs (as described). A safer check is to compare lock file mtime vs crash time, or simply always delete if no running child.

### Fix 2 (Better for Windows): Add Windows PID identity check in `gateway-lock.ts`

On Windows, `isAlive` should additionally verify the process name:

```ts
function isAliveOnWindows(pid: number): boolean {
  try {
    process.kill(pid, 0);
  } catch {
    return false;
  }
  // Verify the process is actually the gateway (not a recycled PID)
  try {
    const out = execFileSync("tasklist", ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"], {
      encoding: "utf-8", timeout: 2000, windowsHide: true,
    });
    // Check if node.exe or electron.exe is in the result
    return out.toLowerCase().includes("node") || out.toLowerCase().includes("electron");
  } catch {
    return true; // conservative: assume alive if check fails
  }
}
```

Alternatively, store the process creation time in the lock payload on Windows using `wmic` or `GetProcessTimes` and validate on re-acquisition.

### Fix 3 (Simplest): Reduce stale timeout

Change `DEFAULT_STALE_MS` from 30,000 to ~3,000 ms in `gateway-lock.ts`. This way, a lock from a crashed process (with a valid but recycled PID) is treated as stale within 3 s instead of 30 s, and the 5 s `acquireGatewayLock` timeout would succeed on most retries.

```ts
// gateway-lock.ts line 9
const DEFAULT_STALE_MS = 3_000; // was 30_000
```

**Caveat**: this changes behavior for all platforms, not just Windows.

### Fix 4: Increase lock timeout in Electron context

When the Electron-managed gateway starts, pass a longer `timeoutMs` to `acquireGatewayLock`. This does not fix the root cause but reduces visible failures. Not recommended as primary fix.

---

## Recommended Approach

Apply **Fix 1 + Fix 2** together:

1. `gateway-manager.ts`: before each `spawnGateway()` call (in `scheduleRestart`), scan and remove lock files whose owner PID is verifiably dead (using `tasklist` cross-check on Windows).
2. `gateway-lock.ts`: `resolveGatewayOwnerStatus` on Windows should validate the process is actually a node/gateway process before returning "alive", not just that a PID with that number exists.

This eliminates the race without reducing stale thresholds globally or requiring external tooling.

---

## Unresolved Questions

1. Is there a way to store process creation time in the lock payload on Windows (e.g., via `wmic process where ProcessId=X get CreationDate`)? That would make Fix 2 definitive.
2. Does `run-loop.ts` always call `release()` on crash, or only on `SIGTERM`? Need to verify the try/finally in gateway startup wraps all exit paths.
3. Could the Electron gateway-manager pass `OPENCLAW_LOCK_PATH` env var to the gateway so Electron can delete it directly before restart?
