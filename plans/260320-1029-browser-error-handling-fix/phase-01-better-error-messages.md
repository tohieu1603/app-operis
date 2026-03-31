# Phase 1: Better Error Messages

## Context Links
- Parent plan: [plan.md](./plan.md)
- Dependencies: None

## Overview
- **Priority:** Medium
- **Effort:** 45min
- **Implementation Status:** pending
- **Review Status:** pending

Improve error messages in browser routes so agents understand what went wrong and how to fix their request. Follow the pattern already established by `SELECTOR_UNSUPPORTED_MESSAGE` in `agent.shared.ts`.

## Key Insights
- Current errors like "kind is required" or "ref is required" give no guidance on valid values or request format
- `toAIFriendlyError` already transforms Playwright errors into helpful messages — extend this pattern
- ACT_KINDS is already exported from `agent.act.shared.ts` — reuse in error messages

## Requirements
- Invalid/missing `kind` → list valid kinds + example request body
- Missing `ref` for ref-requiring kinds → show example with current kind
- Missing `text` for type kind → show example
- Missing `fields` for fill kind → show example
- Extend `toAIFriendlyError` for detached element errors

## Architecture
No structural changes. Only modify error message strings in existing code.

## Related Code Files
- **Modify:** `src/browser/routes/agent.act.ts` (lines 25-35, 49-51, 86-88, 126-128, 140-142, 158-160, 174-176, 197-199)
- **Modify:** `src/browser/routes/agent.act.shared.ts` (add error message builder)
- **Modify:** `src/browser/pw-tools-core.shared.ts` (extend `toAIFriendlyError`)
- **Reference:** `src/browser/routes/agent.shared.ts` (SELECTOR_UNSUPPORTED_MESSAGE pattern)

## Implementation Steps

### Step 1: Add error message helpers in `agent.act.shared.ts`
Add after existing exports:
```typescript
export function invalidKindMessage(received: string): string {
  return [
    `Invalid action kind: "${received}". Valid kinds: ${ACT_KINDS.join(", ")}.`,
    "",
    "Example: POST /act",
    '  { "kind": "click", "ref": "e5" }',
  ].join("\n");
}

export function missingRefMessage(kind: string): string {
  return [
    `"ref" is required for kind "${kind}".`,
    "",
    `Example: { "kind": "${kind}", "ref": "e5" }`,
    "",
    "Get refs by calling GET /snapshot first.",
  ].join("\n");
}
```

### Step 2: Update error responses in `agent.act.ts`
Replace `jsonError(res, 400, "kind is required")` at line 29 with:
```typescript
const msg = kindRaw
  ? invalidKindMessage(kindRaw)
  : invalidKindMessage("");
return jsonError(res, 400, msg);
```

Replace each `jsonError(res, 400, "ref is required")` (lines ~50, 87, 127, 141) with:
```typescript
return jsonError(res, 400, missingRefMessage(kind));
```

### Step 3: Extend `toAIFriendlyError` in `pw-tools-core.shared.ts`
Add case for detached/stale element after the existing checks:
```typescript
if (
  message.includes("Element is not attached") ||
  message.includes("frame was detached") ||
  message.includes("execution context was destroyed")
) {
  return new Error(
    `Element "${selector}" was detached (page navigated or updated). ` +
    `Run a new snapshot to get fresh refs.`,
  );
}
```

## Todo List
- [ ] Add `invalidKindMessage()` and `missingRefMessage()` to `agent.act.shared.ts`
- [ ] Update kind validation error in `agent.act.ts` line 29
- [ ] Update ref validation errors in `agent.act.ts` (click, type, hover, scrollIntoView, drag, select)
- [ ] Add detached element handling in `toAIFriendlyError`
- [ ] Run `pnpm test` — verify existing tests pass

## Success Criteria
- Agent receives valid kinds list when sending wrong kind
- Agent receives example request body when missing ref
- Detached element errors suggest re-snapshotting
- All existing tests pass

## Risk Assessment
- **Low risk:** Only changing error message strings, no logic changes
- **Mitigation:** Existing tests will catch any regressions

## Security Considerations
- No security impact — only error message content changes

## Next Steps
- Phase 2: Retry & Recovery
