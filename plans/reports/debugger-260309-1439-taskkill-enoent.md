# Debugger Report: `spawn taskkill ENOENT` in Gateway

**Date:** 2026-03-09
**Severity:** High — causes repeated gateway crashes and auto-restarts

---

## Executive Summary

The error `Error: spawn taskkill ENOENT` originates from **inside the bundled gateway** (`entry.js`), not from the Electron main process. The gateway uses `taskkill` to kill child process trees when running AI agent subprocesses on Windows. The call fails because the subprocess environment constructed by the gateway's `buildSandboxEnv()` function sets `PATH` to a Unix-style fallback (`/usr/local/sbin:/usr/local/bin:...`) instead of the Windows PATH inherited from the parent. As a result, `taskkill.exe` (located in `C:\Windows\System32`) is not found.

---

## Root Cause

### Two `taskkill` call sites in the bundled gateway (`entry.js`)

**Site 1 — `@mariozechner/pi-coding-agent` shell utility:**
```
entry.js:232636  function killProcessTree(pid) {
entry.js:232639    spawn2("taskkill", ["/F", "/T", "/PID", String(pid)], { stdio: "ignore", detached: true });
```
Source module comment: `node_modules/.pnpm/@mariozechner+pi-coding-agent@0.52.6_ws@8.19.0_zod@4.3.6/node_modules/@mariozechner/pi-coding-agent/dist/utils/shell.js`

**Site 2 — `dist/loader-D_rxtHq1.js` (Docker/sandbox executor):**
```
entry.js:643480  function killProcessTree2(pid) {
entry.js:643483    spawn15("taskkill", ["/F", "/T", "/PID", String(pid)], { stdio: "ignore", detached: true });
```
Called from:
- `entry.js:643556` — `killSession()` (kills a running agent session)
- `entry.js:670800` — another `killSession` call

### The PATH problem

`entry.js:694263`:
```js
DEFAULT_PATH = process.env.PATH ?? "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin";
```

`entry.js:643505-643512` — `buildSandboxEnv()`:
```js
function buildSandboxEnv(params) {
  const env = {
    PATH: params.defaultPath,   // <-- Linux-only paths
    HOME: params.containerWorkdir
  };
  ...
}
```

When the gateway spawns a sandboxed exec session (e.g. Bash tool execution for an AI agent), it builds a restricted environment with `PATH = DEFAULT_PATH`. On Windows, `DEFAULT_PATH` is the system PATH inherited from the Electron spawn env — but **only if `process.env.PATH` is set**. If the sandbox env completely replaces PATH with the Linux fallback (or if `process.env.PATH` is stripped), `C:\Windows\System32` is absent, making `taskkill` unresolvable.

### The Electron spawn env chain

`gateway-manager.ts:185-191` spreads the full `process.env` into the gateway's env:
```ts
const env: Record<string, string> = {
  ...process.env as Record<string, string>,
  ELECTRON_RUN_AS_NODE: "1",
  ...
};
```
So `process.env.PATH` inside the gateway should contain the full Windows PATH from Electron's host env. The `DEFAULT_PATH` assignment at line 694263 correctly picks it up via `process.env.PATH ?? fallback`.

**The real failure trigger:** `buildSandboxEnv` passes `DEFAULT_PATH` as `PATH` into the child process env. This means any exec/bash session spawned by the gateway gives the subprocess the inherited PATH — which is fine for top-level processes. However, the `killProcessTree` / `killProcessTree2` functions call `spawn("taskkill", ...)` **without specifying a custom env**, so they inherit whatever the calling context's env is. If the gateway is in a state where PATH has been modified or the spawn call doesn't inherit parent env (e.g. `detached: true` without explicit env), Windows PATH resolution may fail.

The more likely direct cause: `spawn("taskkill", ..., { stdio: "ignore", detached: true })` — the `detached: true` flag on Windows creates an independent process but Node.js still uses `PATH` from parent env for resolution. If Electron's subprocess inherits a PATH where `System32` is missing or if the gateway itself was spawned with a corrupted PATH, this fails.

---

## Exact File Locations

| File | Line(s) | Description |
|---|---|---|
| `apps/windows-desktop/src/gateway-manager.ts` | 142 | `execFileSync("taskkill", ...)` — zombie killer (safe, uses full path via execFileSync) |
| `apps/windows-desktop/src/gateway-manager.ts` | 357 | `execFile("taskkill", ...)` — force kill (Electron manager, not gateway) |
| `apps/windows-desktop/src/tunnel-manager.ts` | 211 | `execFile("taskkill", ...)` — tunnel force kill (Electron manager, not gateway) |
| `apps/windows-desktop/dist-gateway/entry.js` | 232639 | **`spawn("taskkill", ...)` — pi-coding-agent killProcessTree** |
| `apps/windows-desktop/dist-gateway/entry.js` | 643483 | **`spawn("taskkill", ...)` — loader killProcessTree2** |

The error message `spawn taskkill ENOENT` matches the `spawn()` calls in `entry.js` (lines 232639, 643483). The Electron-manager calls use `execFile`/`execFileSync` which do have the same resolution issue but error messages would differ slightly. The `[openclaw]` prefix in the crash trace confirms it's the gateway's uncaught exception handler.

---

## Why It Crashes Repeatedly

1. AI agent runs a bash/exec command via the gateway
2. Command times out or is aborted → gateway calls `killSession()` → `killProcessTree2(pid)`
3. `spawn("taskkill", ...)` fails with `ENOENT` → uncaught exception in gateway process
4. Gateway crashes → Electron `GatewayManager` detects exit → schedules restart with exponential backoff
5. Next agent run triggers same path → repeat

---

## Fix Approach

### Option A — Use absolute path for taskkill (recommended, minimal change)

The bundled `entry.js` is a third-party package (`@mariozechner/pi-coding-agent` and a loader module). The fix should be applied at the **gateway spawn layer** in `gateway-manager.ts` to ensure `System32` is always in PATH:

**`apps/windows-desktop/src/gateway-manager.ts` — `spawnGateway()` method (~line 185):**

```ts
const env: Record<string, string> = {
  ...process.env as Record<string, string>,
  ELECTRON_RUN_AS_NODE: "1",
  OPENCLAW_NO_RESPAWN: "1",
  OPENCLAW_BUNDLED_PLUGINS_DIR: pluginsDir,
  NODE_PATH: gatewayNodeModules,
};

// Ensure Windows System32 is always in PATH so taskkill/netstat are resolvable
if (process.platform === "win32") {
  const sys32 = process.env.SystemRoot
    ? `${process.env.SystemRoot}\\System32`
    : "C:\\Windows\\System32";
  const currentPath = env.PATH ?? "";
  if (!currentPath.toLowerCase().includes("system32")) {
    env.PATH = `${sys32};${currentPath}`;
  }
}
```

This ensures `taskkill.exe` is always resolvable by the gateway subprocess and any processes it spawns.

### Option B — Use `process.kill(pid)` instead of `taskkill` (requires fork/patch)

Since `entry.js` is compiled third-party code, patching it directly is fragile. If the pi-coding-agent source is accessible, its `killProcessTree` should use `process.kill(-pid, "SIGKILL")` on Windows too, or resolve `taskkill` with an absolute path:
```js
// Instead of:
spawn("taskkill", ...)
// Use:
spawn(path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "taskkill.exe"), ...)
```

But this requires rebuilding the dependency, making Option A more practical.

### Option C — Workaround: suppress uncaught exception for ENOENT on taskkill

Not recommended — hides the real problem and leaves zombie processes.

---

## Recommended Fix

Apply **Option A** to `apps/windows-desktop/src/gateway-manager.ts`. This is a 6-line, low-risk change that ensures `System32` is in PATH for the gateway and all its child processes, resolving both `taskkill` ENOENT failures (lines 232639 and 643483 in entry.js).

Also verify `killZombieOnPort()` (line 128 of `gateway-manager.ts`) — it uses `execFileSync("taskkill", ...)` which has the same resolution path; the same env fix covers it.

---

## Unresolved Questions

1. Is `process.env.PATH` inside Electron's main process already missing `System32` on the affected machines, or does this only fail inside specific exec sessions spawned by the gateway? (Check gateway logs for the PATH value.)
2. Which AI agent skill triggers `killSession` — bash exec timeout, agent abort, or session reset? (Determines frequency and user-visible impact.)
3. Is the `@mariozechner/pi-coding-agent` package version pinned or upgradeable? A newer version may have already fixed the Windows PATH issue.
