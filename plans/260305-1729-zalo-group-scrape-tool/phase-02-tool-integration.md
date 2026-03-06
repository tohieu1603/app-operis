# Phase 2 - Tool Integration

## Priority: High | Status: Pending

## Overview
Wire `scrapeGroupMembers()` into the existing `zalozcajs` tool as a new `scrape-group` action. Update schema, execute handler, and plugin description.

## Key Insights
- Existing tool pattern: `ACTIONS` array → `stringEnum` → `switch/case` in `executeZalozcajsTool`
- Need 2 new optional params: `groupLink` (string), `maxPages` (number)
- Tool description in `index.ts` lists all actions — add `scrape-group`

## Implementation Steps

### 1. Update `extensions/zalozcajs/src/tool.ts`

**Add import:**
```typescript
import { scrapeGroupMembers } from "./zcajs-client.js";
```

**Update ACTIONS:**
```typescript
const ACTIONS = ["send", "friends", "groups", "me", "status", "scrape-group"] as const;
```

**Add params to schema:**
```typescript
groupLink: Type.Optional(Type.String({ description: "Zalo group link (e.g. https://zalo.me/g/...)" })),
maxPages: Type.Optional(Type.Number({ description: "Max pages to scrape (default: all)" })),
```

**Add params to ToolParams type:**
```typescript
groupLink?: string;
maxPages?: number;
```

**Add case to switch:**
```typescript
case "scrape-group": {
  if (!params.groupLink) {
    throw new Error("groupLink required for scrape-group action");
  }
  const result = await scrapeGroupMembers(instance, params.groupLink, params.maxPages);
  if (!result.success) {
    throw new Error(result.error || "Failed to scrape group");
  }
  return json(result.data);
}
```

### 2. Update `extensions/zalozcajs/index.ts`

Update tool description:
```typescript
description:
  "Send messages and access data via Zalo personal account (zca-js). " +
  "Actions: send (text message), friends (list/search friends), " +
  "groups (list groups), me (profile info), status (auth check), " +
  "scrape-group (scrape group members from a Zalo group link).",
```

## Todo List
- [ ] Add `scrape-group` to ACTIONS array
- [ ] Add `groupLink`, `maxPages` to schema + ToolParams
- [ ] Add `scrape-group` case in executeZalozcajsTool
- [ ] Update tool description in index.ts
- [ ] Compile check

## Success Criteria
- Tool schema accepts `scrape-group` action with `groupLink` param
- Agent can call: `zalozcajs { action: "scrape-group", groupLink: "https://zalo.me/g/..." }`
- Returns JSON with `groupId`, `groupName`, `members[]`, `total`
- `pnpm build` passes (or tsdown for gateway)

## Security Considerations
- Rate limiting (500ms) prevents Zalo API abuse
- No credentials/tokens exposed in tool output
- Group link is user-provided, no injection risk (passed directly to zca-js API)
