# Phase 3: Data Handling

## Context Links
- Parent plan: [plan.md](./plan.md)
- Dependencies: None (independent of Phase 1 & 2)

## Overview
- **Priority:** Low
- **Effort:** 30min
- **Implementation Status:** pending
- **Review Status:** pending

Add fallback when screenshot/PDF save to disk fails — return base64 inline instead of crashing.

## Key Insights
- `saveBrowserMediaResponse` in `agent.snapshot.ts` calls `saveMediaBuffer` which can throw on disk full, permission denied, etc.
- Currently unhandled — throws 500 to agent with no useful data
- Response shape already has `ok: true` + `path` — fallback adds `data` (base64) + `contentType` instead of `path`
- This is a backwards-compatible addition (new field, existing fields still present when save succeeds)

## Requirements
- Screenshot/PDF save failure → return base64 data inline
- Log warning about save failure for operator visibility
- Do not change success path behavior

## Architecture
Wrap `saveMediaBuffer` call in `saveBrowserMediaResponse` with try/catch. On failure, return base64 inline.

## Related Code Files
- **Modify:** `src/browser/routes/agent.snapshot.ts` (function `saveBrowserMediaResponse`, lines 28-49)

## Implementation Steps

### Step 1: Add fallback in `saveBrowserMediaResponse`

Current code (lines 28-49):
```typescript
async function saveBrowserMediaResponse(params: { ... }) {
  await ensureMediaDir();
  const saved = await saveMediaBuffer(...);
  params.res.json({ ok: true, path: path.resolve(saved.path), targetId, url });
}
```

Replace with:
```typescript
import { createSubsystemLogger } from "../../logging/subsystem.js";

const log = createSubsystemLogger("browser").child("snapshot");

async function saveBrowserMediaResponse(params: {
  res: BrowserResponse;
  buffer: Buffer;
  contentType: string;
  maxBytes: number;
  targetId: string;
  url: string;
}) {
  try {
    await ensureMediaDir();
    const saved = await saveMediaBuffer(
      params.buffer,
      params.contentType,
      "browser",
      params.maxBytes,
    );
    params.res.json({
      ok: true,
      path: path.resolve(saved.path),
      targetId: params.targetId,
      url: params.url,
    });
  } catch (err) {
    log.warn(`Screenshot save failed, returning inline base64: ${String(err)}`);
    params.res.json({
      ok: true,
      data: params.buffer.toString("base64"),
      contentType: params.contentType,
      targetId: params.targetId,
      url: params.url,
    });
  }
}
```

### Step 2: Verify callers handle both response shapes

Check that consumers of `/screenshot` and `/pdf` responses handle both `path` and `data` fields. Key consumers:
- `src/browser/client-actions-observe.ts` — check `BrowserScreenshotResponse` type
- Any MCP tool definitions that reference screenshot results

If `BrowserScreenshotResponse` type exists, extend it:
```typescript
export type BrowserScreenshotResponse = {
  ok: true;
  targetId: string;
  url: string;
  path?: string;        // present when save succeeded
  data?: string;        // base64, present when save failed
  contentType?: string; // present when data is inline
};
```

## Todo List
- [ ] Add try/catch fallback in `saveBrowserMediaResponse`
- [ ] Add logger import for warning
- [ ] Check/update `BrowserScreenshotResponse` type if it exists
- [ ] Run `pnpm test` — all tests pass

## Success Criteria
- Screenshot save failure returns base64 inline (not 500 error)
- Warning logged for operator diagnosis
- Success path unchanged
- All existing tests pass

## Risk Assessment
- **Low risk:** Only adds fallback path, does not change success behavior
- **Risk:** Large screenshots as base64 could be big JSON responses
- **Mitigation:** Screenshot is already normalized to max 5MB before save; base64 adds ~33% overhead = max ~6.7MB inline, acceptable for single response

## Security Considerations
- Base64 response is same data that would have been saved to disk — no new exposure
- No auth bypass

## Next Steps
- Run full test suite, commit changes
