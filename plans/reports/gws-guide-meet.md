# gws Meet — Google Meet Conferences

> Prerequisite: đọc `gws-guide-shared.md` cho auth & syntax.

## Tạo meeting space

```bash
gws meet spaces create --json '{}'
# Response chứa meetingUri (link join)
```

## Xem chi tiết space

```bash
gws meet spaces get --params '{"name": "spaces/SPACE_ID"}'
```

## Cập nhật settings

```bash
gws meet spaces patch --params '{"name": "spaces/SPACE_ID", "updateMask": "config"}' \
  --json '{"config": {"accessType": "OPEN"}}'
```

## Kết thúc active conference

```bash
gws meet spaces endActiveConference --params '{"name": "spaces/SPACE_ID"}'
```

## Conference Records

```bash
# Liệt kê conferences
gws meet conferenceRecords list

# Participants
gws meet conferenceRecords participants list --params '{"parent": "conferenceRecords/CONF_ID"}'

# Recordings
gws meet conferenceRecords recordings list --params '{"parent": "conferenceRecords/CONF_ID"}'

# Transcripts
gws meet conferenceRecords transcripts list --params '{"parent": "conferenceRecords/CONF_ID"}'
```

## Access Types

| Type | Mô tả |
|------|--------|
| `OPEN` | Ai có link đều join |
| `TRUSTED` | Chỉ domain users |
| `RESTRICTED` | Chỉ invited users |

## Node.js Example

```typescript
const meet = gwsJson("meet", "spaces", "create", "--json", "{}");
console.log(meet.meetingUri); // Link join meeting
```
