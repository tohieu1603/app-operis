# gws Events — Workspace Event Subscriptions

> Prerequisite: đọc `gws-guide-shared.md` cho auth & syntax.

## Helpers

```bash
# Subscribe (stream NDJSON)
gws events +subscribe --target 'spaces/SPACE_ID' --event-types 'google.workspace.chat.message.v1.created'

# Renew subscription
gws events +renew --subscription-id SUB_ID
```

## Raw API

```bash
# Tạo subscription
gws events subscriptions create --json '{
  "targetResource": "//chat.googleapis.com/spaces/SPACE_ID",
  "eventTypes": ["google.workspace.chat.message.v1.created"],
  "notificationEndpoint": {"pubsubTopic": "projects/PROJECT/topics/TOPIC"},
  "payloadOptions": {"includeResource": true}
}'

# Liệt kê
gws events subscriptions list

# Xem chi tiết
gws events subscriptions get --params '{"name": "subscriptions/SUB_ID"}'

# Xóa
gws events subscriptions delete --params '{"name": "subscriptions/SUB_ID"}'

# Reactivate (khi bị suspended)
gws events subscriptions reactivate --params '{"name": "subscriptions/SUB_ID"}'

# Renew (raw)
gws events subscriptions patch --params '{"name": "subscriptions/SUB_ID", "updateMask": "ttl"}' \
  --json '{"ttl": "604800s"}'
```

## Event Types thường dùng

| Event Type | Mô tả |
|------------|--------|
| `google.workspace.chat.message.v1.created` | Chat message mới |
| `google.workspace.chat.message.v1.updated` | Chat message cập nhật |
| `google.workspace.chat.membership.v1.created` | Member mới trong space |
| `google.workspace.chat.membership.v1.deleted` | Member rời space |
| `google.workspace.meet.conference.v2.started` | Meeting bắt đầu |
| `google.workspace.meet.conference.v2.ended` | Meeting kết thúc |

## Node.js Example

```typescript
gws("events", "+subscribe",
  "--target", "spaces/AAAAxxxx",
  "--event-types", "google.workspace.chat.message.v1.created"
);
```

## Lưu ý

- Cần Pub/Sub topic cho push notifications
- Subscriptions expire → cần renew định kỳ
- Reactivate dùng khi subscription bị suspended do lỗi
