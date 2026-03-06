# Zalo Group Scrape Tool - Implementation Plan

## Overview
Add `scrape-group` action to existing `zalozcajs` agent tool. Allows agent to scrape group members from a Zalo group link using `zca-js` API (`getGroupLinkInfo` + `getGroupInfo`).

## Architecture

```
Agent calls tool: zalozcajs { action: "scrape-group", groupLink: "https://zalo.me/g/..." }
    ↓
tool.ts → executeZalozcajsTool() → case "scrape-group"
    ↓
zcajs-client.ts → scrapeGroupMembers(instance, groupLink, maxPages?)
    ↓
zca-js API: getGroupLinkInfo({ link, memberPage }) + getGroupInfo(groupId)
    ↓
Returns: { groupId, groupName, members[], total }
```

## Status

| Phase | Status |
|-------|--------|
| Phase 1 - Core scrape function | Pending |
| Phase 2 - Tool integration | Pending |

---

## Files to Modify

| File | Change |
|------|--------|
| `extensions/zalozcajs/src/types.ts` | Add `ZcaJsGroupMember`, `ZcaJsScrapeResult` types |
| `extensions/zalozcajs/src/zcajs-client.ts` | Add `scrapeGroupMembers()` function |
| `extensions/zalozcajs/src/tool.ts` | Add `scrape-group` action + `groupLink`/`maxPages` params |
| `extensions/zalozcajs/index.ts` | Update tool description to mention new action |

## Files to Create
None

## Files to Delete
None
