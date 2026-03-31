# Debugger Report: 'powershell' is not recognized — Electron Gateway

**Date:** 2026-03-09
**Slug:** powershell-not-recognized-electron

---

## Executive Summary

The error `'powershell' is not recognized as an internal or external command` occurs when the AI agent issues an exec tool call whose `command` string starts with `powershell` (e.g. `powershell -Command Get-Date`). The gateway on Windows correctly selects `powershell.exe` as the shell, but the AI-generated command itself also starts with `powershell`, so PowerShell tries to invoke a nested `powershell` process. When the child process's `PATH` does not include `System32\WindowsPowerShell\v1.0\`, that inner invocation fails with the cmd.exe-style error message (because PowerShell internally uses cmd.exe semantics for unrecognized executables).

**Root cause:** The AI model generates `powershell -Command ...` as the full command string, not knowing that the shell is already PowerShell. This is a prompt/behavioral issue compounded by the fact that the Electron-spawned gateway process may inherit a `PATH` that varies from a user's interactive terminal session.

---

## Technical Analysis

### Code Flow

1. **`gateway-manager.ts` (Electron side)**
   Path: `apps/windows-desktop/src/gateway-manager.ts` line 185-200
   The gateway process is spawned with `{ ...process.env, ELECTRON_RUN_AS_NODE: '1', ... }`.
   This passes Electron's `process.env` (including `PATH`, `SystemRoot`, `WINDIR`) into the gateway child.

2. **`shell-utils.ts` — `getShellConfig()`**
   Path: `src/agents/shell-utils.ts` lines 5-50
   On `win32`, calls `resolvePowerShellPath()`:
   - Reads `process.env.SystemRoot` or `process.env.WINDIR`
   - If found, constructs full path: `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`
   - Falls back to bare `"powershell.exe"` if neither env var is set
   - Returns `{ shell: <resolved_path>, args: ['-NoProfile', '-NonInteractive', '-Command'] }`

3. **`bash-tools.exec.ts` — `runExecProcess()`**
   Path: `src/agents/bash-tools.exec.ts` lines 477-568
   Spawns: `[shell, ...shellArgs, command]`
   When `command = "powershell -Command Get-Date"`, the actual argv becomes:
   ```
   ['C:\Windows\...\powershell.exe', '-NoProfile', '-NonInteractive', '-Command', 'powershell -Command Get-Date']
   ```
   PowerShell then evaluates `powershell -Command Get-Date` as a script, attempting to invoke `powershell` as a child.

### Why the Error Message is CMD.EXE Style

The error `'X' is not recognized as an internal or external command` is exclusively produced by **cmd.exe**. PowerShell would say: `The term 'X' is not recognized as the name of a cmdlet`.

This means one of two things is happening:
- The nested `powershell` invocation (inside the PowerShell session) is itself invoking `powershell.exe`, which in turn is being run via cmd.exe somewhere in its output handling, **OR**
- In some PATH configurations (especially inside a packaged Electron app), `powershell.exe` is not found on PATH, so Node.js falls back to using cmd.exe (Windows behavior when the target executable cannot be found in `PATH` in non-shell spawn mode), producing the cmd.exe-style error.

### Key Evidence

| Item | Detail |
|------|--------|
| Shell configured | `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe` (when `WINDIR` is set) |
| Shell fallback | `powershell.exe` (bare name, requires PATH lookup) when neither `SystemRoot` nor `WINDIR` is in env |
| AI command | `powershell -Command <something>` |
| Actual spawn argv | `[powershell.exe, -NoProfile, -NonInteractive, -Command, powershell -Command ...]` |
| Error producer | cmd.exe (error message format confirms this) |
| Electron env | Passes `process.env` to child; PATH depends on how Electron was launched |

### Secondary Trigger: PATH Stripping in Packaged Electron

When Electron is launched as a packaged `.exe` (double-click from desktop or Start Menu), `process.env.PATH` reflects the **system environment at launch time**, which may differ from a developer's terminal session. In particular:
- `C:\Windows\System32\WindowsPowerShell\v1.0` may or may not be present
- When it is absent and `powershell.exe` (bare name) is the shell, Node.js `spawn` without `shell: true` cannot resolve the executable, and the OS (via cmd.exe error formatting) reports the not-recognized error.

---

## Suggested Fixes

### Fix 1 (Primary — Recommended): Use full PowerShell path with `%SystemRoot%` at runtime

In `src/agents/shell-utils.ts`, `resolvePowerShellPath()` already falls back to bare `"powershell.exe"` when `SystemRoot` and `WINDIR` are both absent. Add a third fallback using a hardcoded Windows path:

```typescript
function resolvePowerShellPath(): string {
  const systemRoot = process.env.SystemRoot || process.env.WINDIR;
  if (systemRoot) {
    const candidate = path.join(
      systemRoot,
      "System32",
      "WindowsPowerShell",
      "v1.0",
      "powershell.exe",
    );
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  // Fallback: try standard hardcoded location
  const hardcoded = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
  if (fs.existsSync(hardcoded)) {
    return hardcoded;
  }
  return "powershell.exe";
}
```

File: `d:\Project\SourceCode\agent.operis\src\agents\shell-utils.ts`

### Fix 2 (Primary — Recommended): Strip leading `powershell` invocation from command

When the shell is already `powershell.exe`, AI-generated commands prefixed with `powershell -Command` are redundant and cause double-nesting. Strip or rewrite the command before passing to spawn.

In `bash-tools.exec.ts`, before building the argv, normalize the command on Windows:

```typescript
function normalizeWindowsCommand(command: string, shell: string): string {
  // If shell is powershell.exe and command redundantly starts with powershell,
  // strip the outer powershell invocation to avoid double-nesting.
  if (shell.toLowerCase().includes("powershell")) {
    const redundantPrefixes = [
      /^powershell(?:\.exe)?\s+-(?:NonInteractive\s+)?-Command\s+/i,
      /^powershell(?:\.exe)?\s+-Command\s+/i,
      /^powershell(?:\.exe)?\s+/i,
    ];
    for (const re of redundantPrefixes) {
      if (re.test(command)) {
        return command.replace(re, "").trim();
      }
    }
  }
  return command;
}
```

File: `d:\Project\SourceCode\agent.operis\src\agents\bash-tools.exec.ts`

### Fix 3 (Alternative): Switch to `cmd.exe` as default shell on Windows

Change `getShellConfig()` to use `cmd.exe` instead of `powershell.exe` as the default shell. This is simpler and avoids the double-nesting problem. The AI model commonly generates both cmd and PowerShell syntax; cmd.exe handles the former and can invoke powershell explicitly when needed.

```typescript
export function getShellConfig(): { shell: string; args: string[] } {
  if (process.platform === "win32") {
    return {
      shell: "cmd.exe",
      args: ["/d", "/s", "/c"],
    };
  }
  // ...
}
```

**Trade-off:** Loses PowerShell's better output capture for some system utilities (noted in current comment at shell-utils.ts line 23-28). Consider making this configurable via an env var (`OPENCLAW_WIN_SHELL=powershell|cmd`).

### Fix 4 (Supplementary): Ensure `SystemRoot`/`WINDIR` are always in Electron-spawned gateway env

In `gateway-manager.ts`, explicitly add Windows system env vars to the gateway env:

```typescript
const env: Record<string, string> = {
  ...process.env as Record<string, string>,
  ELECTRON_RUN_AS_NODE: "1",
  OPENCLAW_NO_RESPAWN: "1",
  OPENCLAW_BUNDLED_PLUGINS_DIR: pluginsDir,
  NODE_PATH: gatewayNodeModules,
  // Ensure Windows system env vars are always present
  ...(process.platform === "win32" && {
    SystemRoot: process.env.SystemRoot || process.env.WINDIR || "C:\\Windows",
    WINDIR: process.env.WINDIR || process.env.SystemRoot || "C:\\Windows",
  }),
};
```

File: `d:\Project\SourceCode\agent.operis\apps\windows-desktop\src\gateway-manager.ts`

---

## Priority Recommendation

1. **Immediate (ship with next build):** Apply Fix 4 (ensure SystemRoot/WINDIR in gateway env) — 2-line change, no risk.
2. **Short-term:** Apply Fix 1 (hardcoded fallback in `resolvePowerShellPath`) — defensive coding.
3. **Medium-term:** Apply Fix 2 (strip redundant `powershell` prefix) — eliminates the core behavioral issue regardless of PATH state.
4. **Consider:** Fix 3 (switch to cmd.exe) as a simpler long-term approach, with an env override for power users who want PowerShell.

---

## Key Files

| File | Role |
|------|------|
| `src/agents/shell-utils.ts` | `getShellConfig()` and `resolvePowerShellPath()` — where Windows shell is selected |
| `src/agents/bash-tools.exec.ts` | `runExecProcess()` — where the command is spawned with the selected shell |
| `apps/windows-desktop/src/gateway-manager.ts` | Electron process spawner — where env vars are set for the gateway child |

---

## Unresolved Questions

1. Does the packaged Electron app's `process.env.SystemRoot` ever come up `undefined` in production? Needs confirmation from a production build log.
2. Is the AI model generating `powershell -Command ...` because of a system prompt hint or emergent behavior? If there's a specific Windows skill/prompt injecting this, it should be updated to use PowerShell-native syntax without the `powershell` prefix.
3. Does `node-pty` (PTY path in `runExecProcess`) have the same issue on Windows? The PTY path also calls `getShellConfig()`.
