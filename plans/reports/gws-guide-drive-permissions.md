# gws Drive — Permissions & Sharing

> Prerequisite: đọc `gws-guide-shared.md` cho auth & syntax.

## Roles (vai trò)

| Role | Mô tả |
|------|--------|
| `reader` | Chỉ xem |
| `commenter` | Xem + bình luận |
| `writer` | Chỉnh sửa |
| `fileOrganizer` | Quản lý file trong Shared Drive |
| `organizer` | Quản lý Shared Drive |
| `owner` | Chủ sở hữu (chỉ My Drive) |

## Types (loại đối tượng)

| Type | Field bắt buộc | Mô tả |
|------|----------------|--------|
| `user` | `emailAddress` | Người dùng cụ thể |
| `group` | `emailAddress` | Nhóm Google |
| `domain` | `domain` | Toàn bộ domain |
| `anyone` | — | Bất kỳ ai có link |

## Chia sẻ cho user

```bash
# Writer (chỉnh sửa)
gws drive permissions create \
  --params '{"fileId": "ID"}' \
  --json '{"role": "writer", "type": "user", "emailAddress": "alice@company.com"}'

# Reader (chỉ xem)
gws drive permissions create \
  --params '{"fileId": "ID"}' \
  --json '{"role": "reader", "type": "user", "emailAddress": "viewer@company.com"}'

# Commenter (bình luận)
gws drive permissions create \
  --params '{"fileId": "ID"}' \
  --json '{"role": "commenter", "type": "user", "emailAddress": "reviewer@company.com"}'
```

## Chia sẻ cho group

```bash
gws drive permissions create \
  --params '{"fileId": "ID"}' \
  --json '{"role": "writer", "type": "group", "emailAddress": "team@company.com"}'
```

## Chia sẻ cho domain

```bash
gws drive permissions create \
  --params '{"fileId": "ID"}' \
  --json '{"role": "reader", "type": "domain", "domain": "company.com"}'
```

## Chia sẻ công khai (anyone with link)

```bash
gws drive permissions create \
  --params '{"fileId": "ID"}' \
  --json '{"role": "reader", "type": "anyone"}'
```

## Tùy chọn bổ sung (trong --params)

| Param | Mô tả |
|-------|--------|
| `sendNotificationEmail: false` | Không gửi email thông báo |
| `emailMessage: "text"` | Tin nhắn kèm email thông báo |
| `transferOwnership: true` | Chuyển quyền sở hữu (role phải là `owner`) |
| `supportsAllDrives: true` | Bắt buộc khi thao tác Shared Drive |

### Chia sẻ im lặng (không email)

```bash
gws drive permissions create \
  --params '{"fileId": "ID", "sendNotificationEmail": false}' \
  --json '{"role": "writer", "type": "user", "emailAddress": "silent@company.com"}'
```

### Chia sẻ kèm tin nhắn

```bash
gws drive permissions create \
  --params '{"fileId": "ID", "emailMessage": "Please review this folder"}' \
  --json '{"role": "writer", "type": "user", "emailAddress": "reviewer@company.com"}'
```

### Chuyển ownership

```bash
gws drive permissions create \
  --params '{"fileId": "ID", "transferOwnership": true}' \
  --json '{"role": "owner", "type": "user", "emailAddress": "newowner@company.com"}'
```

## Liệt kê quyền

```bash
gws drive permissions list --params '{"fileId": "ID"}'
gws drive permissions list --params '{"fileId": "ID"}' --format table
```

## Xem chi tiết permission

```bash
gws drive permissions get --params '{"fileId": "ID", "permissionId": "PERM_ID"}'
```

## Cập nhật quyền

```bash
gws drive permissions update \
  --params '{"fileId": "ID", "permissionId": "PERM_ID"}' \
  --json '{"role": "writer"}'
```

## Xóa quyền

```bash
gws drive permissions delete --params '{"fileId": "ID", "permissionId": "PERM_ID"}'
```

## Shared Drive

```bash
# Tạo
gws drive drives create --params '{"requestId": "unique-123"}' --json '{"name": "Team Project"}'

# Thêm thành viên
gws drive permissions create \
  --params '{"fileId": "DRIVE_ID", "supportsAllDrives": true}' \
  --json '{"role": "writer", "type": "user", "emailAddress": "member@company.com"}'

# Liệt kê thành viên
gws drive permissions list --params '{"fileId": "DRIVE_ID", "supportsAllDrives": true}'

# Liệt kê Shared Drives
gws drive drives list
```

## Recipe: Tạo folder + phân quyền team

```bash
# 1. Tạo thư mục
gws drive files create --json '{"name": "Q2 Project", "mimeType": "application/vnd.google-apps.folder"}'
# → ROOT_ID

# 2. Phân quyền (tự áp dụng xuống sub-folders)
gws drive permissions create \
  --params '{"fileId": "ROOT_ID"}' \
  --json '{"role": "writer", "type": "user", "emailAddress": "dev@company.com"}'
gws drive permissions create \
  --params '{"fileId": "ROOT_ID"}' \
  --json '{"role": "reader", "type": "user", "emailAddress": "stakeholder@company.com"}'

# 3. Xác minh
gws drive permissions list --params '{"fileId": "ROOT_ID"}' --format table
```

## Node.js Example

```typescript
// Phân quyền
gwsJson("drive", "permissions", "create",
  "--params", JSON.stringify({ fileId: folderId, sendNotificationEmail: false }),
  "--json", JSON.stringify({ role: "writer", type: "user", emailAddress: "user@co.com" })
);

// Liệt kê quyền
const perms = gwsJson("drive", "permissions", "list",
  "--params", JSON.stringify({ fileId: folderId })
);
```

## Lưu ý

- Permission trên folder tự kế thừa xuống sub-folders/files
- Concurrent permission operations trên cùng 1 file KHÔNG được hỗ trợ — chỉ update cuối cùng được áp dụng
- Dùng `--dry-run` trước khi tạo/xóa permissions
