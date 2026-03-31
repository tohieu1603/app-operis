# Phase 1 - Core Scrape Function

## Priority: High | Status: Pending

## Overview
Add `scrapeGroupMembers()` to `zcajs-client.ts` + types to `types.ts`. Port logic from `clone_akaBiz/desktop-app/worker/zalo-client.ts:1071-1274`.

## Key Insights
- `zca-js@2.1.1` has `api.getGroupLinkInfo({ link, memberPage })` for paginated scrape from public link
- `api.getGroupInfo(groupId)` gives accurate `creatorId` + `adminIds` for role assignment
- Desktop app uses 500ms delay between pages for rate limiting
- No retry logic needed for MVP — fail-fast, return partial results

## Requirements
- Scrape group members from public Zalo group link (no need to be member)
- Paginate through all members via `getGroupLinkInfo`
- Assign roles (OWNER/ADMIN/MEMBER) using `getGroupInfo`
- Support optional `maxPages` limit
- Return structured result with `groupId`, `groupName`, `members[]`, `total`

## Implementation Steps

### 1. Add types to `extensions/zalozcajs/src/types.ts`

```typescript
export type ZcaJsGroupMember = {
  userId: string;
  displayName: string;
  avatar?: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
};

export type ZcaJsScrapeResult = {
  success: boolean;
  data?: {
    groupId: string;
    groupName: string;
    members: ZcaJsGroupMember[];
    total: number;
  };
  error?: string;
};
```

### 2. Add `scrapeGroupMembers()` to `extensions/zalozcajs/src/zcajs-client.ts`

```typescript
export async function scrapeGroupMembers(
  instance: ZcaJsApiInstance,
  groupLink: string,
  maxPages?: number,
): Promise<ZcaJsScrapeResult> {
  // Step 1: Fetch page 1 via getGroupLinkInfo
  // Step 2: Pagination loop (500ms delay, break conditions)
  // Step 3: getGroupInfo for accurate roles
  // Step 4: Transform members array
  // Step 5: Return result
}
```

**Algorithm** (from research report):
1. `api.getGroupLinkInfo({ link: groupLink, memberPage: 1 })` → groupId, name, totalMember, currentMems[], hasMoreMember
2. Loop pages while: `hasMoreMember && pageMembers.length > 0 && allMembers.length < totalMembers && (no maxPages or page <= maxPages)`
3. 500ms delay between pages
4. `api.getGroupInfo(groupId)` for creatorId + adminIds
5. Map members: `memberId === creatorId → OWNER`, `adminIds.includes → ADMIN`, else `MEMBER`

## Todo List
- [ ] Add `ZcaJsGroupMember` and `ZcaJsScrapeResult` types
- [ ] Implement `scrapeGroupMembers()` in zcajs-client.ts
- [ ] Export from zcajs-client.ts

## Success Criteria
- Function compiles without errors
- Returns correct `ZcaJsScrapeResult` structure
- Handles: invalid link, empty group, pagination, rate limiting

## Risk Assessment
- Rate limit: 500ms may not be enough for large groups → keep as default, can increase later
- `getGroupLinkInfo` may fail for private groups → return `{ success: false, error }` gracefully
