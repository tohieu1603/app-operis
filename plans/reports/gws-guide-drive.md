# gws Drive — File & Folder Operations

> Prerequisite: đọc `gws-guide-shared.md` cho auth & syntax.

## Liệt kê files

```bash
# 10 files gần nhất, chỉ lấy id/name/mimeType
gws drive files list --params '{"pageSize": 10}' --fields 'files(id,name,mimeType)'

# Tìm theo tên
gws drive files list --params '{"q": "name contains \"Report\"", "pageSize": 5}' --fields 'files(id,name)'

# Files trong thư mục cụ thể
gws drive files list --params '{"q": "\"FOLDER_ID\" in parents", "pageSize": 50}' --fields 'files(id,name,mimeType)'

# Chỉ thư mục
gws drive files list --params '{"q": "mimeType = \"application/vnd.google-apps.folder\"", "pageSize": 20}' --fields 'files(id,name)'

# Không bao gồm đã xóa
gws drive files list --params '{"q": "trashed = false", "pageSize": 10}'

# Phân trang tự động
gws drive files list --params '{"pageSize": 100}' --page-all --fields 'files(id,name)'
```

## Lấy thông tin file

```bash
gws drive files get --params '{"fileId": "FILE_ID"}' --fields 'id,name,mimeType,parents,webViewLink'
```

## Tạo thư mục

```bash
# Thư mục gốc
gws drive files create --json '{"name": "Project Files", "mimeType": "application/vnd.google-apps.folder"}'

# Thư mục con
gws drive files create --json '{"name": "Documents", "mimeType": "application/vnd.google-apps.folder", "parents": ["PARENT_FOLDER_ID"]}'
```

**MimeType bắt buộc:** `application/vnd.google-apps.folder`

### Recipe: Cấu trúc thư mục lồng nhau

```bash
# 1. Tạo root → lấy ID
gws drive files create --json '{"name": "Q2 Project", "mimeType": "application/vnd.google-apps.folder"}'
# 2. Tạo sub-folders dùng root ID
gws drive files create --json '{"name": "Documents", "mimeType": "application/vnd.google-apps.folder", "parents": ["ROOT_ID"]}'
gws drive files create --json '{"name": "Reports", "mimeType": "application/vnd.google-apps.folder", "parents": ["ROOT_ID"]}'
# 3. Xác minh
gws drive files list --params '{"q": "\"ROOT_ID\" in parents"}' --format table
```

## Upload file

```bash
# Helper (đơn giản)
gws drive +upload ./report.pdf
gws drive +upload ./report.pdf --parent FOLDER_ID
gws drive +upload ./data.csv --name 'Sales Data.csv'

# Raw API (nhiều control)
gws drive files create --json '{"name": "report.pdf", "parents": ["FOLDER_ID"]}' --upload ./report.pdf
```

## Download / Export

```bash
# Download binary
gws drive files get --params '{"fileId": "FILE_ID", "alt": "media"}' -o ./file.pdf

# Export Docs → PDF
gws drive files export --params '{"fileId": "DOC_ID", "mimeType": "application/pdf"}' -o ./doc.pdf

# Export Sheets → CSV
gws drive files export --params '{"fileId": "SHEET_ID", "mimeType": "text/csv"}' -o ./data.csv
```

## Di chuyển file

```bash
gws drive files update --params '{"fileId": "FILE_ID", "addParents": "NEW_FOLDER_ID", "removeParents": "OLD_FOLDER_ID"}'
```

## Sao chép file

```bash
gws drive files copy --params '{"fileId": "FILE_ID"}' --json '{"name": "Copy of Report", "parents": ["FOLDER_ID"]}'
```

## Đổi tên

```bash
gws drive files update --params '{"fileId": "FILE_ID"}' --json '{"name": "New Name"}'
```

## Xóa file

```bash
# Vào thùng rác
gws drive files update --params '{"fileId": "FILE_ID"}' --json '{"trashed": true}'

# Xóa vĩnh viễn (dùng --dry-run trước!)
gws drive files delete --params '{"fileId": "FILE_ID"}' --dry-run
gws drive files delete --params '{"fileId": "FILE_ID"}'
```

## Node.js Examples

```typescript
// Tạo thư mục
const folder = gwsJson("drive", "files", "create",
  "--json", JSON.stringify({
    name: "New Folder",
    mimeType: "application/vnd.google-apps.folder",
    parents: ["PARENT_ID"]
  })
);

// List files in folder
const files = gwsJson("drive", "files", "list",
  "--params", JSON.stringify({ q: `"${folder.id}" in parents`, pageSize: 50 }),
  "--fields", "files(id,name,mimeType)"
);
```

## Drive Search (q parameter)

| Operator | Ví dụ |
|----------|-------|
| Tên chứa | `name contains "Report"` |
| Tên chính xác | `name = "Budget 2026"` |
| Trong thư mục | `"FOLDER_ID" in parents` |
| Loại file | `mimeType = "application/vnd.google-apps.folder"` |
| Không thùng rác | `trashed = false` |
| Chủ sở hữu | `"user@co.com" in owners` |
| Shared with me | `sharedWithMe = true` |
| Kết hợp | `name contains "Q2" and mimeType = "application/vnd.google-apps.spreadsheet"` |
