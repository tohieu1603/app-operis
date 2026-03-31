# gws Workflow — Cross-Service Productivity

> Prerequisite: đọc `gws-guide-shared.md` cho auth & syntax.
> Workflow helpers kết hợp nhiều services (Calendar + Tasks + Gmail + Drive + Chat).

## Helper Commands

### Standup Report

```bash
gws workflow +standup-report
```

> Tổng hợp: meetings hôm nay + open tasks → standup summary.

### Meeting Prep

```bash
gws workflow +meeting-prep
```

> Chuẩn bị cho meeting tiếp theo: agenda, attendees, linked docs.

### Email to Task

```bash
gws workflow +email-to-task --message-id MSG_ID
```

> Chuyển Gmail message thành Google Tasks entry.

### Weekly Digest

```bash
gws workflow +weekly-digest
```

> Tổng kết tuần: meetings tuần này + số email chưa đọc.

### File Announce

```bash
gws workflow +file-announce --file-id FILE_ID --space spaces/AAAAxxxx
```

> Announce Drive file trong Chat space (share link + thông báo).

## Node.js Examples

```typescript
// Morning standup
const standup = gwsJson("workflow", "+standup-report");

// Convert email to task
gws("workflow", "+email-to-task", "--message-id", msgId);

// Announce file in chat
gws("workflow", "+file-announce", "--file-id", fileId, "--space", spaceId);
```

## Use Cases

| Workflow | Khi nào dùng |
|----------|-------------|
| `+standup-report` | Đầu ngày, tạo daily standup |
| `+meeting-prep` | Trước meeting, xem agenda + docs liên quan |
| `+email-to-task` | Nhận email cần follow-up → tạo task tracking |
| `+weekly-digest` | Cuối tuần, review activities |
| `+file-announce` | Share file mới lên team Chat space |
