# gws Calendar — Events & Scheduling

> Prerequisite: đọc `gws-guide-shared.md` cho auth & syntax.

## Helper Commands

### Xem lịch (Agenda)

```bash
gws calendar +agenda                                    # Upcoming events
gws calendar +agenda --today                             # Hôm nay
gws calendar +agenda --tomorrow                          # Ngày mai
gws calendar +agenda --week                              # Tuần này
gws calendar +agenda --days 3                            # 3 ngày tới
gws calendar +agenda --calendar 'Work' --format table    # Filter calendar cụ thể
```

| Flag | Default | Mô tả |
|------|---------|--------|
| `--today` | — | Sự kiện hôm nay |
| `--tomorrow` | — | Ngày mai |
| `--week` | — | Tuần này |
| `--days` | — | Số ngày ahead |
| `--calendar` | all | Filter theo tên/ID calendar |

> Read-only, không modify events.

### Tạo sự kiện (Insert)

```bash
gws calendar +insert \
  --summary 'Team Standup' \
  --start '2026-03-11T09:00:00+07:00' \
  --end '2026-03-11T09:30:00+07:00'

# Với location + description
gws calendar +insert \
  --summary 'Client Meeting' \
  --start '2026-03-12T14:00:00+07:00' \
  --end '2026-03-12T15:00:00+07:00' \
  --location 'Meeting Room A' \
  --description 'Q2 Review with client'

# Thêm attendees
gws calendar +insert \
  --summary 'Sprint Planning' \
  --start '2026-03-13T10:00:00+07:00' \
  --end '2026-03-13T11:00:00+07:00' \
  --attendee alice@company.com \
  --attendee bob@company.com
```

| Flag | Required | Mô tả |
|------|----------|--------|
| `--summary` | Yes | Tên event |
| `--start` | Yes | Giờ bắt đầu (ISO 8601 / RFC 3339) |
| `--end` | Yes | Giờ kết thúc |
| `--calendar` | — | Calendar ID (default: primary) |
| `--location` | — | Địa điểm |
| `--description` | — | Mô tả |
| `--attendee` | — | Email (dùng nhiều lần) |

## Raw API Commands

### Liệt kê events

```bash
gws calendar events list --params '{"calendarId": "primary", "maxResults": 10, "orderBy": "startTime", "singleEvents": true, "timeMin": "2026-03-10T00:00:00Z"}'
```

### Lấy chi tiết event

```bash
gws calendar events get --params '{"calendarId": "primary", "eventId": "EVENT_ID"}'
```

### Tạo event (raw — nhiều options hơn)

```bash
# Event với recurring (hằng tuần)
gws calendar events insert --params '{"calendarId": "primary"}' --json '{
  "summary": "Weekly Sync",
  "start": {"dateTime": "2026-03-11T09:00:00+07:00"},
  "end": {"dateTime": "2026-03-11T09:30:00+07:00"},
  "recurrence": ["RRULE:FREQ=WEEKLY;COUNT=10"],
  "attendees": [{"email": "team@company.com"}]
}'

# All-day event
gws calendar events insert --params '{"calendarId": "primary"}' --json '{
  "summary": "Company Holiday",
  "start": {"date": "2026-04-30"},
  "end": {"date": "2026-05-01"}
}'
```

### Quick Add (tạo từ text tự nhiên)

```bash
gws calendar events quickAdd --params '{"calendarId": "primary", "text": "Meeting with Alice tomorrow at 2pm"}'
```

### Cập nhật event

```bash
gws calendar events patch --params '{"calendarId": "primary", "eventId": "EVENT_ID"}' \
  --json '{"summary": "Updated Meeting Title"}'
```

### Xóa event

```bash
gws calendar events delete --params '{"calendarId": "primary", "eventId": "EVENT_ID"}' --dry-run
```

### Di chuyển event sang calendar khác

```bash
gws calendar events move --params '{"calendarId": "primary", "eventId": "EVENT_ID", "destination": "OTHER_CALENDAR_ID"}'
```

### Free/Busy query

```bash
gws calendar freebusy query --json '{
  "timeMin": "2026-03-11T08:00:00+07:00",
  "timeMax": "2026-03-11T18:00:00+07:00",
  "items": [{"id": "alice@company.com"}, {"id": "bob@company.com"}]
}'
```

### Quản lý calendars

```bash
# Liệt kê calendars
gws calendar calendarList list

# Tạo secondary calendar
gws calendar calendars insert --json '{"summary": "Project X"}'

# Xóa secondary calendar
gws calendar calendars delete --params '{"calendarId": "CALENDAR_ID"}'
```

### ACL (Access Control)

```bash
# Chia sẻ calendar
gws calendar acl insert --params '{"calendarId": "CALENDAR_ID"}' \
  --json '{"role": "reader", "scope": {"type": "user", "value": "viewer@company.com"}}'

# Liệt kê ACL
gws calendar acl list --params '{"calendarId": "CALENDAR_ID"}'
```

## Node.js Examples

```typescript
// Xem agenda hôm nay
const agenda = gwsJson("calendar", "+agenda", "--today", "--format", "json");

// Tạo event
gws("calendar", "+insert",
  "--summary", "Deploy Review",
  "--start", "2026-03-11T15:00:00+07:00",
  "--end", "2026-03-11T15:30:00+07:00",
  "--attendee", "dev@company.com"
);

// Free/busy check
const busy = gwsJson("calendar", "freebusy", "query",
  "--json", JSON.stringify({
    timeMin: "2026-03-11T08:00:00+07:00",
    timeMax: "2026-03-11T18:00:00+07:00",
    items: [{ id: "alice@company.com" }]
  })
);
```

## Lưu ý

- Thời gian dùng **RFC 3339**: `2026-03-11T09:00:00+07:00` (có timezone offset)
- All-day events dùng `date` (không có `dateTime`): `{"date": "2026-03-11"}`
- `singleEvents: true` cần khi list recurring events (tách thành instances)
- Recurring events: dùng `recurrence` array với RRULE syntax
