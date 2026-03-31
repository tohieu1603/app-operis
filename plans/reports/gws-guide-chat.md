# gws Chat — Spaces & Messaging

> Prerequisite: đọc `gws-guide-shared.md` cho auth & syntax.

## Helper Command

### Gửi tin nhắn

```bash
gws chat +send --space spaces/AAAAxxxx --text 'Hello team!'
gws chat +send --space spaces/AAAAxxxx --text 'Deploy complete ✅'
```

| Flag | Required | Mô tả |
|------|----------|--------|
| `--space` | Yes | Space name (vd: `spaces/AAAAxxxx`) |
| `--text` | Yes | Nội dung tin nhắn (plain text) |

> Cho cards/threaded replies → dùng raw API.

## Raw API Commands

### Spaces

```bash
# Liệt kê spaces
gws chat spaces list

# Tạo space (named)
gws chat spaces create --json '{"displayName": "Project Alpha", "spaceType": "SPACE"}'

# Setup space với members
gws chat spaces setup --json '{
  "displayName": "Quick Sync",
  "spaceType": "SPACE",
  "memberships": [{"member": {"name": "users/alice@company.com", "type": "HUMAN"}}]
}'

# Xem chi tiết space
gws chat spaces get --params '{"name": "spaces/AAAAxxxx"}'

# Tìm DM với user
gws chat spaces findDirectMessage --params '{"name": "users/alice@company.com"}'
```

### Messages

```bash
# Gửi tin nhắn (raw)
gws chat spaces messages create \
  --params '{"parent": "spaces/AAAAxxxx"}' \
  --json '{"text": "Hello from API!"}'

# Gửi threaded reply
gws chat spaces messages create \
  --params '{"parent": "spaces/AAAAxxxx"}' \
  --json '{"text": "Reply here", "thread": {"name": "spaces/AAAAxxxx/threads/THREAD_ID"}}'

# Liệt kê messages
gws chat spaces messages list --params '{"parent": "spaces/AAAAxxxx"}'

# Xóa message
gws chat spaces messages delete --params '{"name": "spaces/AAAAxxxx/messages/MSG_ID"}'
```

### Members

```bash
# Liệt kê members
gws chat spaces members list --params '{"parent": "spaces/AAAAxxxx"}'

# Thêm member
gws chat spaces members create \
  --params '{"parent": "spaces/AAAAxxxx"}' \
  --json '{"member": {"name": "users/newmember@company.com", "type": "HUMAN"}}'
```

### Upload media

```bash
gws chat media upload \
  --params '{"parent": "spaces/AAAAxxxx"}' \
  --upload ./screenshot.png
```

## Node.js Examples

```typescript
// Gửi tin nhắn
gws("chat", "+send", "--space", "spaces/AAAAxxxx", "--text", "Build passed!");

// Liệt kê spaces
const spaces = gwsJson("chat", "spaces", "list");

// Gửi threaded reply
gwsJson("chat", "spaces", "messages", "create",
  "--params", JSON.stringify({ parent: "spaces/AAAAxxxx" }),
  "--json", JSON.stringify({
    text: "Acknowledged",
    thread: { name: "spaces/AAAAxxxx/threads/THREAD_ID" }
  })
);
```

## Lưu ý

- Space name format: `spaces/AAAAxxxx` — lấy từ `spaces list`
- Google Chat API yêu cầu **Google Workspace account** (không hoạt động với Gmail cá nhân)
- Message cards dùng `cardsV2` field trong `--json`
