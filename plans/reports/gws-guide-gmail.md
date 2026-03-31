# gws Gmail — Email Operations

> Prerequisite: đọc `gws-guide-shared.md` cho auth & syntax.

## Helper Commands (Đơn giản)

### Gửi email

```bash
gws gmail +send --to alice@example.com --subject 'Meeting Tomorrow' --body 'Hi Alice, reminder.'

# Dry-run
gws gmail +send --to alice@example.com --subject 'Test' --body 'Test' --dry-run
```

| Flag | Required | Mô tả |
|------|----------|--------|
| `--to` | Yes | Email người nhận |
| `--subject` | Yes | Tiêu đề |
| `--body` | Yes | Nội dung (plain text) |
| `--dry-run` | — | Preview |

> Tự xử lý RFC 2822 + base64. Cho HTML/attachments/CC/BCC → dùng raw API.

### Inbox triage (xem chưa đọc)

```bash
gws gmail +triage                                    # 20 email chưa đọc
gws gmail +triage --max 5 --query 'from:boss'        # Filter
gws gmail +triage --labels                           # Kèm labels
gws gmail +triage --format json                      # Output JSON
```

| Flag | Default | Mô tả |
|------|---------|--------|
| `--max` | 20 | Số messages tối đa |
| `--query` | `is:unread` | Gmail search query |
| `--labels` | — | Hiển thị label names |

> Read-only, không modify mailbox.

### Reply

```bash
gws gmail +reply --message-id 18f1a2b3c4d --body 'Thanks, got it!'
gws gmail +reply --message-id 18f1a2b3c4d --body 'Looping in Carol' --cc carol@example.com
```

| Flag | Required | Mô tả |
|------|----------|--------|
| `--message-id` | Yes | Message ID cần reply |
| `--body` | Yes | Nội dung reply |
| `--from` | — | Sender alias |
| `--cc` | — | CC (comma-separated) |

> Tự set In-Reply-To, References, threadId. Quote original message.

### Reply All

```bash
gws gmail +reply-all --message-id 18f1a2b3c4d --body 'Noted.'
```

### Forward

```bash
gws gmail +forward --message-id 18f1a2b3c4d --to dave@example.com
gws gmail +forward --message-id 18f1a2b3c4d --to dave@example.com --body 'FYI'
gws gmail +forward --message-id 18f1a2b3c4d --to dave@example.com --cc eve@example.com
```

| Flag | Required | Mô tả |
|------|----------|--------|
| `--message-id` | Yes | Message ID cần forward |
| `--to` | Yes | Người nhận (comma-separated) |
| `--body` | — | Note kèm trên forwarded message |
| `--cc` | — | CC |

### Watch (streaming)

```bash
gws gmail +watch --project my-gcp-project   # Stream via Pub/Sub, expires 7d
```

## Raw API Commands

### Profile

```bash
gws gmail users getProfile --params '{"userId": "me"}'
```

### List messages

```bash
gws gmail users messages list --params '{"userId": "me", "maxResults": 10}'

# Tìm kiếm
gws gmail users messages list --params '{"userId": "me", "q": "subject:invoice after:2026/01/01", "maxResults": 5}'
```

### Đọc email

```bash
# Full content
gws gmail users messages get --params '{"userId": "me", "id": "MSG_ID"}'

# Chỉ metadata (tiết kiệm token)
gws gmail users messages get --params '{"userId": "me", "id": "MSG_ID", "format": "metadata"}'
```

### Labels

```bash
# List
gws gmail users labels list --params '{"userId": "me"}'

# Tạo
gws gmail users labels create --params '{"userId": "me"}' --json '{"name": "Important/Projects"}'

# Gán label
gws gmail users messages modify --params '{"userId": "me", "id": "MSG_ID"}' --json '{"addLabelIds": ["LABEL_ID"]}'
```

### Threads

```bash
gws gmail users threads list --params '{"userId": "me", "maxResults": 10}'
gws gmail users threads get --params '{"userId": "me", "id": "THREAD_ID"}'
```

### Drafts

```bash
gws gmail users drafts list --params '{"userId": "me"}'
```

## Node.js Examples

```typescript
// Gửi email
gws("gmail", "+send", "--to", "alice@co.com", "--subject", "Hello", "--body", "Hi Alice!");

// Triage
const inbox = gwsJson("gmail", "+triage", "--max", "10", "--format", "json");

// Reply
gws("gmail", "+reply", "--message-id", msgId, "--body", "Got it, thanks!");
```
