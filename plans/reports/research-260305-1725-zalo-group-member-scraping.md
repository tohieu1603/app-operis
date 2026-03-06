# Zalo Group Member Scraping - Desktop App (zca-js API)

## Overview

Desktop App su dung `zca-js` library de lay danh sach thanh vien nhom Zalo qua API, khong can browser automation. Day la cach chinh, nhanh va on dinh hon Playwright.

## Architecture Flow

```
ScrapeGroupPanel.tsx (UI)
    |  User nhap group link + chon account
    v
localApi.ts:142  -->  scrapeGroup(accountId, groupLink)
    |  POST /local/scrape-group
    v
api-server.ts:607  -->  Route handler
    |  Goi zaloClient.scrapeGroup()
    v
zalo-client.ts:1071  -->  scrapeGroup(accountId, groupLink, maxPages?)
    |  Core logic: goi zca-js API
    v
zca-js library  -->  api.getGroupLinkInfo() + api.getGroupInfo()
```

## File Locations

| Layer | File | Line |
|-------|------|------|
| UI Component | `desktop-app/renderer/src/components/ScrapeGroupPanel.tsx` | Full file |
| API Client | `desktop-app/renderer/src/api/localApi.ts` | L142-151 |
| API Server Route | `desktop-app/worker/api-server.ts` | L607-648 |
| Core Logic (scrape tu link) | `desktop-app/worker/zalo-client.ts` | L1071-1274 |
| Core Logic (load tu group da join) | `desktop-app/worker/zalo-client.ts` | L955-1065 |

## Core Method: `scrapeGroup()` (zalo-client.ts:1071)

### Input
- `accountId: number` - ID tai khoan Zalo da login
- `groupLink: string` - Link nhom Zalo (vd: `https://zalo.me/g/...`)
- `maxPages?: number` - Gioi han so page (undefined = lay tat ca)

### Output: `ScrapeResult`
```typescript
interface ScrapeResult {
  success: boolean;
  data?: {
    groupId: string;
    groupName: string;
    members: Array<{
      userId: string;
      displayName: string;
      avatar?: string;
      role?: string; // OWNER | ADMIN | MEMBER
    }>;
    total: number;
  };
  error?: string;
}
```

### Algorithm

**Step 1 - Lay API instance (L1080)**
```typescript
const api = await this.getAPI(accountId);
```
Lay instance zca-js da login tu Map cache hoac restore tu session file.

**Step 2 - Fetch page 1 (L1088-1102)**
```typescript
const groupLinkInfo = await api.getGroupLinkInfo({
  link: groupLink,
  memberPage: 1,
});
```
Tra ve: `groupId`, `name`, `totalMember`, `currentMems[]`, `hasMoreMember`, `creatorId`, `adminIds`.

**Step 3 - Pagination loop (L1112-1158)**
```typescript
while (true) {
  if (maxPages && page > maxPages) break;

  const pageInfo = await api.getGroupLinkInfo({
    link: groupLink,
    memberPage: page,
  });

  const pageMembers = pageInfo.currentMems || [];
  if (pageMembers.length === 0) break;

  allMembers.push(...pageMembers);

  if (!pageInfo.hasMoreMember) break;
  if (allMembers.length >= totalMembers) break;

  await delay(500); // Rate limiting
  page++;
}
```
Dieu kien dung:
- `pageMembers.length === 0` - het member
- `hasMoreMember === false` - API bao het
- `allMembers.length >= totalMembers` - du so luong
- `page > maxPages` - dat gioi han (neu co)

**Step 4 - Lay role chinh xac (L1162-1180)**
```typescript
const groupInfoResponse = await api.getGroupInfo(groupId);
const groupData = groupInfoResponse.gridInfoMap?.[groupId];
creatorId = groupData.creatorId;
adminIds = groupData.adminIds || [];
```
`getGroupInfo()` cho role chinh xac hon `getGroupLinkInfo()`.

**Step 5 - Transform members (L1195-1221)**
```typescript
const members = allMembers.map((member) => {
  const memberId = member.id || member.userId;
  let role = 'MEMBER';
  if (memberId === creatorId) role = 'OWNER';
  else if (adminIds.includes(memberId)) role = 'ADMIN';

  return {
    userId: memberId,
    displayName: member.dName || member.displayName || member.zaloName || 'Unknown',
    avatar: member.avatar,
    role: role,
  };
});
```

**Step 6 - Luu DB (L1224-1254)**
```typescript
// Luu group info
this.db.upsertGroup({ accountId, groupId, groupName, memberCount, scrapedAt, synced: 0 });

// Luu members (batch)
this.db.insertGroupMembers(memberRecords);
```

**Step 7 - API Server luu them contacts (api-server.ts:624-636)**
```typescript
result.data.members.forEach((member) => {
  db.upsertContact({ accountId, userId, displayName, avatar, synced: 0 });
});
```

## Secondary Method: `loadGroupMembersWithRoles()` (zalo-client.ts:955)

Dung cho group **da join**, khac voi `scrapeGroup()` (tu link, khong can join).

### zca-js APIs used
| Method | Muc dich |
|--------|----------|
| `api.getGroupInfo(groupId)` | Lay `creatorId`, `adminIds`, `memVerList` |
| `api.getGroupMembersInfo(memberIds)` | Lay profile chi tiet (displayName, avatar) |

### Algorithm
1. `getGroupInfo(groupId)` -> extract `memVerList` (format `"userId_version"`)
2. Parse member IDs: `memVerList.map(v => v.split('_')[0])`
3. `getGroupMembersInfo(memberIds)` -> lay profiles
4. Map roles dua tren `creatorId` va `adminIds`
5. Luu DB

## API Server Endpoints

| Method | Endpoint | Handler |
|--------|----------|---------|
| POST | `/local/scrape-group` | `zaloClient.scrapeGroup()` - Scrape tu link |
| POST | `/local/load-group-members` | `zaloClient.loadGroupMembersWithRoles()` - Load tu group da join |
| GET | `/local/group-members/:accountId/:groupId` | `db.getGroupMembers()` - Doc tu local DB |

## UI Component: ScrapeGroupPanel.tsx

### Features
- Dropdown chon tai khoan Zalo (chi hien active accounts)
- Input link nhom Zalo
- Hien thi danh sach members voi role (Truong nhom / Pho nhom / Thanh vien)
- Checkbox chon members (co option "Chon tat ca tru admin")
- Export ra Excel (`exportGroupMembersToExcel()`)
- Sort theo role: OWNER -> ADMIN -> MEMBER

### Key state
```typescript
const [groupLink, setGroupLink] = useState('');
const [members, setMembers] = useState<GroupMember[]>([]);
const [selectedMembers, setSelectedMembers] = useState<GroupMember[]>([]);
const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
```

## zca-js API Response Structure

### `getGroupLinkInfo` response
```json
{
  "groupId": "string",
  "name": "string",
  "totalMember": 500,
  "currentMems": [
    { "id": "userId", "dName": "Display Name", "avatar": "url" }
  ],
  "hasMoreMember": true,
  "creatorId": "ownerId",
  "adminIds": ["admin1", "admin2"]
}
```

### `getGroupInfo` response
```json
{
  "gridInfoMap": {
    "groupId": {
      "creatorId": "ownerId",
      "adminIds": ["admin1"],
      "memVerList": ["userId1_1", "userId2_1"],
      "name": "Group Name",
      "totalMember": 500
    }
  }
}
```

### `getGroupMembersInfo` response
```json
{
  "profiles": {
    "userId1": { "displayName": "Name", "avatar": "url", "zaloName": "Name" }
  },
  "unchangeds_profile": ["userId2"]
}
```

## Data Storage

### Local SQLite (desktop-app)
- Table `groups`: accountId, groupId, groupName, memberCount, scrapedAt, synced
- Table `group_members`: accountId, groupId, userId, displayName, avatar, role, synced
- Table `contacts`: accountId, userId, displayName, avatar, synced

### Sync
Sau khi scrape, `SyncService` tu dong sync len backend NestJS:
```typescript
syncService.syncGroups().catch(console.error);
syncService.syncContacts().catch(console.error);
```

## Rate Limiting
- 500ms delay giua moi page khi pagination (`zalo-client.ts:1151`)
- Khong co retry logic cho `getGroupLinkInfo` - neu 1 page loi thi dung luon

## Error Handling
- API instance khong ton tai -> return `{ success: false, error: 'No active session' }`
- Group link invalid/private -> return `{ success: false, error: 'Failed to get group info' }`
- Page fetch loi -> `break` (dung pagination, tra ve nhung gi da lay duoc)
- DB save loi -> log warning, van tra ve ket qua thanh cong (khong fail whole scrape)

## Unresolved Questions
- Khong co retry logic khi `getGroupLinkInfo` that bai o 1 page - nen co?
- `maxPages` default la undefined (fetch tat ca) - co nen dat gioi han mac dinh?
- Rate limit 500ms co du de tranh bi Zalo block khong?
