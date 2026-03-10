# Debugger Report: node-pty Missing + Read Tool Without Path

**Date:** 2026-03-09
**Branch:** Hung

---

## Issue 1: `@lydell/node-pty-win32-x64` Missing in Bundled App

### Root Cause

`bundle-gateway.js` copies `@lydell/node-pty` to `dist-gateway/node_modules/` but does **not** copy its platform-specific sub-package `@lydell/node-pty-win32-x64`.

`@lydell/node-pty/index.js` works by doing:
```js
const PACKAGE_NAME = `@lydell/node-pty-${process.platform}-${process.arch}`;
// → "@lydell/node-pty-win32-x64"
module.exports = require(PACKAGE_NAME);
```

So at runtime in the bundled app, `@lydell/node-pty` is present but `@lydell/node-pty-win32-x64` is missing → throws the error seen.

### Evidence

- `bundle-gateway.js` line 37-40: `NATIVE_EXTERNAL_PACKAGES = ['sharp', '@lydell/node-pty']` — only parent package listed
- `node_modules/.pnpm/@lydell+node-pty-win32-x64@1.2.0-beta.3/node_modules/@lydell/node-pty-win32-x64/prebuilds/win32-x64/` exists with `.node` binaries (pty.node, conpty.node, etc.)
- `electron-builder.yml` line 92 explicitly **excludes** `!node_modules/@lydell/node-pty/**` from the asar bundle — correct, but bundle-gateway.js copy must include the platform sub-package too

### Fix

In `apps/windows-desktop/bundle-gateway.js`, add the platform-specific sub-package to `NATIVE_EXTERNAL_PACKAGES`:

```js
// Before:
const NATIVE_EXTERNAL_PACKAGES = [
  'sharp',
  '@lydell/node-pty',
];

// After:
const NATIVE_EXTERNAL_PACKAGES = [
  'sharp',
  '@lydell/node-pty',
  `@lydell/node-pty-${process.platform}-${process.arch}`,  // e.g. @lydell/node-pty-win32-x64
];
```

This will:
1. Mark the platform package as external in esbuild (already handled by the existing external array logic)
2. Copy `@lydell/node-pty-win32-x64` (with its `prebuilds/win32-x64/*.node` binaries) to `dist-gateway/node_modules/`

The `copyDirSync` function already dereferences pnpm symlinks, so this works with pnpm store layout.

**Files to edit:**
- `d:/Project/SourceCode/agent.operis/apps/windows-desktop/bundle-gateway.js` — line 37-40

---

## Issue 2: Read Tool Called Without `path`

### Root Cause

The warning at `src/agents/pi-embedded-subscribe.handlers.tools.ts:60` fires when the `read` tool's args object does not contain a `path` key (or it is empty/non-string).

The `read` tool schema was patched via `patchToolSchemaForClaudeCompatibility` to accept **both** `path` and `file_path` as aliases (neither is `required` in the schema). When an LLM (e.g. Claude via embedded agent) calls the read tool with `file_path` instead of `path`, the args arrive at `handleToolExecutionStart` before `normalizeToolParams` runs — so `record.path` is undefined at the logging check, triggering the warning.

### Code Path

```
handleToolExecutionStart (handlers.tools.ts:54-63)
  → checks record.path directly (before normalization)
  → normalizeToolParams would map file_path → path, but that happens in createOpenClawReadTool.execute (pi-tools.read.ts:291)
```

So the warning is a **false positive** in cases where `file_path` is used. The actual tool execution handles `file_path` correctly via `normalizeToolParams`.

The warning could also be a **true positive** if the LLM emits a read call with neither `path` nor `file_path` (e.g. malformed tool call).

### Evidence

- `pi-embedded-subscribe.handlers.tools.ts:55-56`: checks only `record.path`, not `record.file_path`
- `pi-tools.read.ts:108-109`: `CLAUDE_PARAM_GROUPS.read = [{ keys: ["path", "file_path"] }]` — both accepted
- `pi-tools.read.ts:134-136`: `normalizeToolParams` maps `file_path → path` before tool execute
- The log message includes `argsType=object` confirming args is an object (not null/string)

### Fix

Update the path-check in `handleToolExecutionStart` to match the same normalization logic:

```ts
// In src/agents/pi-embedded-subscribe.handlers.tools.ts, lines 54-63:

if (toolName === "read") {
  const record = args && typeof args === "object" ? (args as Record<string, unknown>) : {};
  // Check both "path" and "file_path" (Claude Code uses file_path alias)
  const filePath =
    (typeof record.path === "string" ? record.path.trim() : "") ||
    (typeof record.file_path === "string" ? record.file_path.trim() : "");
  if (!filePath) {
    const argsPreview = typeof args === "string" ? args.slice(0, 200) : undefined;
    ctx.log.warn(
      `read tool called without path: toolCallId=${toolCallId} argsType=${typeof args}${argsPreview ? ` argsPreview=${argsPreview}` : ""}`,
    );
  }
}
```

**Files to edit:**
- `d:/Project/SourceCode/agent.operis/src/agents/pi-embedded-subscribe.handlers.tools.ts` — lines 54-63

---

## Summary

| Issue | Root Cause | Severity | Fix Complexity |
|-------|-----------|----------|----------------|
| PTY spawn failed | Platform sub-package `@lydell/node-pty-win32-x64` not copied to dist-gateway | High (PTY unusable) | Low (1 line in bundle-gateway.js) |
| Read tool without path | Warning check uses only `record.path`, misses `file_path` alias | Low (warning only, execution correct) | Low (extend path check) |

---

## Unresolved Questions

- Is the `read tool called without path` always from `file_path` alias usage, or are there genuine malformed calls? (Need to see the actual args in logs — `argsType=object` but no preview means args is an object, likely has `file_path`.)
- After fixing node-pty bundling: verify `pty.node` binary loads correctly in Electron's Node version (ABI mismatch is possible if prebuilds target a different Node ABI than Electron 35's Node 22).
