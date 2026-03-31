# Google Workspace CLI (gws) — Agent Skill Guide

> Hướng dẫn chi tiết cho AI Agent sử dụng `gws` CLI thao tác với Google Drive, Gmail, Docs, Sheets.
> Mọi lệnh gọi qua Node.js: `execFileSync("gws.exe", [...args])` — không qua shell.

---

## Mục lục

1. [Tổng quan & Cài đặt](#1-tổng-quan--cài-đặt)
2. [Xác thực (Authentication)](#2-xác-thực-authentication)
3. [Cú pháp chung & Flag toàn cục](#3-cú-pháp-chung--flag-toàn-cục)
4. [Google Drive (Chi tiết)](#4-google-drive-chi-tiết)
5. [Gmail](#5-gmail)
6. [Google Docs](#6-google-docs)
7. [Google Sheets](#7-google-sheets)
8. [Gọi từ Node.js (execFileSync)](#8-gọi-từ-nodejs-execfilesync)
9. [Lưu ý quan trọng](#9-lưu-ý-quan-trọng)
10. [Tham khảo thêm](#10-tham-khảo-thêm)

---

## 1. Tổng quan & Cài đặt

**gws** — CLI duy nhất cho tất cả Google Workspace API. Xây dựng động từ Google Discovery Service, tự động cập nhật khi Google thêm API mới.

```bash
npm install -g @googleworkspace/cli
```

Hoặc tải binary từ [GitHub Releases](https://github.com/googleworkspace/cli/releases).

**Yêu cầu:**
- Node.js 18+
- Google Cloud Project (có OAuth credentials)
- Google account với quyền Workspace

---

## 2. Xác thực (Authentication)

### 2.1. Setup lần đầu (cần gcloud)

```bash
gws auth setup    # Tạo GCP project, enable APIs, đăng nhập
gws auth login    # Đăng nhập bổ sung / thay đổi scope
```

**Chọn scope cụ thể** (quan trọng cho unverified apps — giới hạn ~25 scopes):

```bash
gws auth login -s drive,gmail,sheets,docs
```

### 2.2. Manual OAuth (không cần gcloud)

1. Tạo OAuth Desktop App tại Google Cloud Console
2. Download `client_secret.json` → `~/.config/gws/client_secret.json`
3. Thêm email vào **Test users** trong OAuth consent screen
4. Chạy `gws auth login`

### 2.3. Environment Variables

| Biến | Mô tả | Ưu tiên |
|------|--------|---------|
| `GOOGLE_WORKSPACE_CLI_TOKEN` | Access token có sẵn (cao nhất) | 1 |
| `GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE` | Path tới credentials JSON | 2 |
| `GOOGLE_WORKSPACE_CLI_CLIENT_ID` | OAuth client ID | — |
| `GOOGLE_WORKSPACE_CLI_CLIENT_SECRET` | OAuth client secret | — |
| `GOOGLE_WORKSPACE_CLI_CONFIG_DIR` | Thư mục config (default: `~/.config/gws`) | — |

### 2.4. Export cho Headless/CI

```bash
# Máy có browser
gws auth export --unmasked > credentials.json

# Máy headless
export GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE=/path/to/credentials.json
```

---

## 3. Cú pháp chung & Flag toàn cục

### Cú pháp

```
gws <service> <resource> [sub-resource] <method> [flags]
```

### Flag toàn cục

| Flag | Mô tả |
|------|--------|
| `--params '{"key":"val"}'` | URL/query parameters |
| `--json '{"key":"val"}'` | Request body (POST/PUT/PATCH) |
| `--upload <PATH>` | Upload file (multipart) |
| `-o, --output <PATH>` | Lưu binary response ra file |
| `--dry-run` | Preview request, không thực thi |
| `--page-all` | Tự động phân trang, output NDJSON |
| `--page-limit <N>` | Giới hạn số trang (default: 10) |
| `--page-delay <MS>` | Delay giữa các trang (default: 100ms) |
| `--fields '<MASK>'` | Giới hạn response fields (tiết kiệm token) |
| `--format <FORMAT>` | Output: `json` (default), `table`, `yaml`, `csv` |
| `--sanitize <TEMPLATE>` | Lọc response qua Model Armor |

### Schema Introspection

Khi không biết cấu trúc JSON payload, kiểm tra schema trước:

```bash
gws schema drive.files.create
gws schema drive.permissions.create
gws schema gmail.users.messages.send
gws schema sheets.spreadsheets.create
gws schema docs.documents.create
```

### Help

```bash
gws --help
gws drive --help
gws drive files --help
gws drive files create --help
```

---

## 4. Google Drive (Chi tiết)

### 4.1. Liệt kê files

```bash
# 10 files gần nhất
gws drive files list --params '{"pageSize": 10}'

# Chỉ lấy id, name, mimeType (tiết kiệm token)
gws drive files list --params '{"pageSize": 10}' --fields 'files(id,name,mimeType)'

# Tìm theo tên
gws drive files list --params '{"q": "name contains \"Report\"", "pageSize": 5}' --fields 'files(id,name)'

# Tìm files trong thư mục cụ thể
gws drive files list --params '{"q": "\"FOLDER_ID\" in parents", "pageSize": 50}' --fields 'files(id,name,mimeType)'

# Chỉ tìm thư mục
gws drive files list --params '{"q": "mimeType = \"application/vnd.google-apps.folder\"", "pageSize": 20}' --fields 'files(id,name)'

# Không bao gồm file đã xóa
gws drive files list --params '{"q": "trashed = false", "pageSize": 10}'

# Phân trang tự động (tất cả kết quả)
gws drive files list --params '{"pageSize": 100}' --page-all --fields 'files(id,name)'
```

### 4.2. Lấy thông tin file

```bash
gws drive files get --params '{"fileId": "FILE_ID"}' --fields 'id,name,mimeType,parents,webViewLink'
```

### 4.3. Tạo thư mục

```bash
# Tạo thư mục gốc
gws drive files create --json '{"name": "Project Files", "mimeType": "application/vnd.google-apps.folder"}'

# Tạo thư mục con (trong thư mục cha)
gws drive files create --json '{"name": "Documents", "mimeType": "application/vnd.google-apps.folder", "parents": ["PARENT_FOLDER_ID"]}'

# Tạo cấu trúc thư mục lồng nhau
# Bước 1: Tạo thư mục gốc → lấy ID
gws drive files create --json '{"name": "Q2 Project", "mimeType": "application/vnd.google-apps.folder"}'
# Bước 2: Tạo sub-folders dùng parent ID từ bước 1
gws drive files create --json '{"name": "Documents", "mimeType": "application/vnd.google-apps.folder", "parents": ["ROOT_ID"]}'
gws drive files create --json '{"name": "Reports", "mimeType": "application/vnd.google-apps.folder", "parents": ["ROOT_ID"]}'
gws drive files create --json '{"name": "Assets", "mimeType": "application/vnd.google-apps.folder", "parents": ["ROOT_ID"]}'
```

**MimeType cho thư mục:** `application/vnd.google-apps.folder` (bắt buộc)

### 4.4. Upload file

```bash
# Upload đơn giản (tên file tự lấy từ path)
gws drive +upload ./report.pdf

# Upload vào thư mục cụ thể
gws drive +upload ./report.pdf --parent FOLDER_ID

# Upload với tên tùy chỉnh
gws drive +upload ./data.csv --name 'Sales Data Q2.csv'

# Upload qua raw API (nhiều control hơn)
gws drive files create --json '{"name": "report.pdf", "parents": ["FOLDER_ID"]}' --upload ./report.pdf
```

### 4.5. Download / Export file

```bash
# Download file binary
gws drive files get --params '{"fileId": "FILE_ID", "alt": "media"}' -o ./downloaded-file.pdf

# Export Google Docs sang PDF
gws drive files export --params '{"fileId": "DOC_ID", "mimeType": "application/pdf"}' -o ./document.pdf

# Export Google Sheets sang CSV
gws drive files export --params '{"fileId": "SHEET_ID", "mimeType": "text/csv"}' -o ./data.csv

# Export Google Slides sang PDF
gws drive files export --params '{"fileId": "SLIDE_ID", "mimeType": "application/pdf"}' -o ./presentation.pdf
```

### 4.6. Di chuyển file

```bash
# Di chuyển file vào thư mục mới
gws drive files update --params '{"fileId": "FILE_ID", "addParents": "NEW_FOLDER_ID", "removeParents": "OLD_FOLDER_ID"}'
```

### 4.7. Sao chép file

```bash
gws drive files copy --params '{"fileId": "FILE_ID"}' --json '{"name": "Copy of Report", "parents": ["FOLDER_ID"]}'
```

### 4.8. Xóa file

```bash
# Đưa vào thùng rác
gws drive files update --params '{"fileId": "FILE_ID"}' --json '{"trashed": true}'

# Xóa vĩnh viễn (NGUY HIỂM - luôn dùng --dry-run trước)
gws drive files delete --params '{"fileId": "FILE_ID"}' --dry-run
gws drive files delete --params '{"fileId": "FILE_ID"}'
```

### 4.9. Đổi tên file/thư mục

```bash
gws drive files update --params '{"fileId": "FILE_ID"}' --json '{"name": "New Name"}'
```

---

### 4.10. PHÂN QUYỀN (Permissions) — Chi tiết

#### Các role (vai trò)

| Role | Mô tả |
|------|--------|
| `reader` | Chỉ xem |
| `commenter` | Xem + bình luận |
| `writer` | Chỉnh sửa |
| `fileOrganizer` | Quản lý file trong Shared Drive |
| `organizer` | Quản lý Shared Drive |
| `owner` | Chủ sở hữu (chỉ My Drive) |

#### Các type (loại đối tượng)

| Type | Mô tả |
|------|--------|
| `user` | Người dùng cụ thể (emailAddress) |
| `group` | Nhóm Google (emailAddress) |
| `domain` | Toàn bộ domain (domain) |
| `anyone` | Bất kỳ ai có link |

#### Chia sẻ cho user cụ thể

```bash
# Chia sẻ quyền chỉnh sửa (writer)
gws drive permissions create \
  --params '{"fileId": "FOLDER_OR_FILE_ID"}' \
  --json '{"role": "writer", "type": "user", "emailAddress": "alice@company.com"}'

# Chia sẻ quyền xem (reader)
gws drive permissions create \
  --params '{"fileId": "FOLDER_ID"}' \
  --json '{"role": "reader", "type": "user", "emailAddress": "viewer@company.com"}'

# Chia sẻ quyền bình luận (commenter)
gws drive permissions create \
  --params '{"fileId": "FILE_ID"}' \
  --json '{"role": "commenter", "type": "user", "emailAddress": "reviewer@company.com"}'
```

#### Chia sẻ cho nhóm (group)

```bash
gws drive permissions create \
  --params '{"fileId": "FOLDER_ID"}' \
  --json '{"role": "writer", "type": "group", "emailAddress": "team@company.com"}'
```

#### Chia sẻ cho toàn domain

```bash
gws drive permissions create \
  --params '{"fileId": "FOLDER_ID"}' \
  --json '{"role": "reader", "type": "domain", "domain": "company.com"}'
```

#### Chia sẻ công khai (anyone with link)

```bash
gws drive permissions create \
  --params '{"fileId": "FILE_ID"}' \
  --json '{"role": "reader", "type": "anyone"}'
```

#### Chia sẻ KHÔNG gửi email thông báo

```bash
gws drive permissions create \
  --params '{"fileId": "FOLDER_ID", "sendNotificationEmail": false}' \
  --json '{"role": "writer", "type": "user", "emailAddress": "silent@company.com"}'
```

#### Chia sẻ với tin nhắn tùy chỉnh

```bash
gws drive permissions create \
  --params '{"fileId": "FOLDER_ID", "emailMessage": "Please review this folder"}' \
  --json '{"role": "writer", "type": "user", "emailAddress": "reviewer@company.com"}'
```

#### Cho phép chuyển quyền sở hữu

```bash
gws drive permissions create \
  --params '{"fileId": "FILE_ID", "transferOwnership": true}' \
  --json '{"role": "owner", "type": "user", "emailAddress": "newowner@company.com"}'
```

#### Liệt kê quyền hiện tại

```bash
gws drive permissions list --params '{"fileId": "FOLDER_OR_FILE_ID"}'

# Format table dễ đọc
gws drive permissions list --params '{"fileId": "FOLDER_ID"}' --format table
```

#### Xem chi tiết 1 permission

```bash
gws drive permissions get --params '{"fileId": "FILE_ID", "permissionId": "PERMISSION_ID"}'
```

#### Cập nhật quyền

```bash
# Nâng cấp từ reader lên writer
gws drive permissions update \
  --params '{"fileId": "FILE_ID", "permissionId": "PERMISSION_ID"}' \
  --json '{"role": "writer"}'
```

#### Xóa quyền

```bash
gws drive permissions delete --params '{"fileId": "FILE_ID", "permissionId": "PERMISSION_ID"}'
```

#### Shared Drive — tạo và quản lý

```bash
# Tạo Shared Drive
gws drive drives create --params '{"requestId": "unique-request-123"}' --json '{"name": "Team Project"}'

# Thêm thành viên vào Shared Drive
gws drive permissions create \
  --params '{"fileId": "DRIVE_ID", "supportsAllDrives": true}' \
  --json '{"role": "writer", "type": "user", "emailAddress": "member@company.com"}'

# Liệt kê thành viên Shared Drive
gws drive permissions list --params '{"fileId": "DRIVE_ID", "supportsAllDrives": true}'

# Liệt kê Shared Drives
gws drive drives list

# Xem chi tiết Shared Drive
gws drive drives get --params '{"driveId": "DRIVE_ID"}'
```

#### Recipe: Tạo cấu trúc thư mục + phân quyền

```bash
# 1. Tạo thư mục gốc
gws drive files create --json '{"name": "Q2 Project", "mimeType": "application/vnd.google-apps.folder"}'
# → Lấy ID: ROOT_ID

# 2. Tạo sub-folders
gws drive files create --json '{"name": "Documents", "mimeType": "application/vnd.google-apps.folder", "parents": ["ROOT_ID"]}'
gws drive files create --json '{"name": "Reports", "mimeType": "application/vnd.google-apps.folder", "parents": ["ROOT_ID"]}'

# 3. Phân quyền cho toàn bộ thư mục gốc (tự áp dụng xuống sub-folders)
gws drive permissions create \
  --params '{"fileId": "ROOT_ID"}' \
  --json '{"role": "writer", "type": "user", "emailAddress": "team-member@company.com"}'

# 4. Xác minh cấu trúc
gws drive files list --params '{"q": "\"ROOT_ID\" in parents"}' --format table

# 5. Xác minh quyền
gws drive permissions list --params '{"fileId": "ROOT_ID"}' --format table
```

---

## 5. Gmail

### 5.1. Helper Commands (Đơn giản)

#### Gửi email

```bash
gws gmail +send --to alice@example.com --subject 'Meeting Tomorrow' --body 'Hi Alice, reminder about our meeting.'

# Dry-run (xem preview)
gws gmail +send --to alice@example.com --subject 'Test' --body 'Test body' --dry-run
```

#### Xem inbox chưa đọc

```bash
# Mặc định 20 email chưa đọc
gws gmail +triage

# Giới hạn 5, chỉ email từ boss
gws gmail +triage --max 5 --query 'from:boss@company.com'

# Bao gồm labels
gws gmail +triage --labels

# Output JSON
gws gmail +triage --format json
```

#### Trả lời email

```bash
# Reply (tự xử lý threading)
gws gmail +reply --message-id 18f1a2b3c4d --body 'Thanks, got it!'

# Reply + CC
gws gmail +reply --message-id 18f1a2b3c4d --body 'Looping in Carol' --cc carol@example.com
```

#### Reply All

```bash
gws gmail +reply-all --message-id 18f1a2b3c4d --body 'Noted, will proceed.'
```

#### Forward email

```bash
gws gmail +forward --message-id 18f1a2b3c4d --to dave@example.com
gws gmail +forward --message-id 18f1a2b3c4d --to dave@example.com --body 'FYI see below'
gws gmail +forward --message-id 18f1a2b3c4d --to dave@example.com --cc eve@example.com
```

#### Watch email mới (streaming)

```bash
gws gmail +watch --project my-gcp-project
```

### 5.2. Raw API Commands

#### Profile

```bash
gws gmail users getProfile --params '{"userId": "me"}'
```

#### Liệt kê messages

```bash
# 10 messages gần nhất
gws gmail users messages list --params '{"userId": "me", "maxResults": 10}'

# Tìm kiếm
gws gmail users messages list --params '{"userId": "me", "q": "subject:invoice after:2026/01/01", "maxResults": 5}'
```

#### Đọc nội dung email

```bash
gws gmail users messages get --params '{"userId": "me", "id": "MESSAGE_ID"}'

# Chỉ lấy metadata (tiết kiệm token)
gws gmail users messages get --params '{"userId": "me", "id": "MESSAGE_ID", "format": "metadata"}'
```

#### Gửi email raw (HTML, CC, BCC, attachment)

```bash
# Gửi email với raw base64-encoded RFC 2822
gws gmail users messages send --params '{"userId": "me"}' --json '{"raw": "BASE64_ENCODED_MESSAGE"}'
```

#### Labels

```bash
# Liệt kê labels
gws gmail users labels list --params '{"userId": "me"}'

# Tạo label
gws gmail users labels create --params '{"userId": "me"}' --json '{"name": "Important/Projects"}'

# Gán label cho message
gws gmail users messages modify --params '{"userId": "me", "id": "MSG_ID"}' --json '{"addLabelIds": ["LABEL_ID"]}'
```

#### Drafts

```bash
# Liệt kê drafts
gws gmail users drafts list --params '{"userId": "me"}'
```

#### Threads

```bash
# Liệt kê threads
gws gmail users threads list --params '{"userId": "me", "maxResults": 10}'

# Xem thread
gws gmail users threads get --params '{"userId": "me", "id": "THREAD_ID"}'
```

---

## 6. Google Docs

### 6.1. Tạo document

```bash
gws docs documents create --json '{"title": "Meeting Notes 2026-03-10"}'
# Response chứa documentId
```

### 6.2. Đọc document

```bash
gws docs documents get --params '{"documentId": "DOC_ID"}'
```

### 6.3. Ghi text vào document (Helper)

```bash
# Append text vào cuối document
gws docs +write --document DOC_ID --text 'Hello, this is appended text.'
```

### 6.4. Batch Update (Rich formatting)

```bash
# Chèn text tại vị trí cụ thể
gws docs documents batchUpdate --params '{"documentId": "DOC_ID"}' --json '{
  "requests": [
    {
      "insertText": {
        "location": {"index": 1},
        "text": "Heading Text\n\nBody paragraph here.\n"
      }
    }
  ]
}'

# Chèn text + bold formatting
gws docs documents batchUpdate --params '{"documentId": "DOC_ID"}' --json '{
  "requests": [
    {
      "insertText": {
        "location": {"index": 1},
        "text": "Important Title\n"
      }
    },
    {
      "updateTextStyle": {
        "range": {"startIndex": 1, "endIndex": 16},
        "textStyle": {"bold": true},
        "fields": "bold"
      }
    }
  ]
}'
```

### 6.5. Recipe: Tạo doc từ template + share

```bash
# 1. Copy template
gws drive files copy --params '{"fileId": "TEMPLATE_DOC_ID"}' --json '{"name": "Weekly Report - Week 10"}'
# → Lấy id: NEW_DOC_ID

# 2. Ghi nội dung
gws docs +write --document NEW_DOC_ID --text 'Summary: All tasks completed on schedule.'

# 3. Share
gws drive permissions create \
  --params '{"fileId": "NEW_DOC_ID"}' \
  --json '{"role": "writer", "type": "user", "emailAddress": "manager@company.com"}'
```

---

## 7. Google Sheets

### 7.1. Tạo spreadsheet

```bash
gws sheets spreadsheets create --json '{"properties": {"title": "Q1 Budget Tracking"}}'
# Response chứa spreadsheetId
```

### 7.2. Đọc dữ liệu (Helper)

```bash
# Đọc range cụ thể
gws sheets +read --spreadsheet SPREADSHEET_ID --range 'Sheet1!A1:D10'

# Đọc toàn bộ sheet
gws sheets +read --spreadsheet SPREADSHEET_ID --range Sheet1
```

### 7.3. Đọc dữ liệu (Raw API)

```bash
gws sheets spreadsheets values get \
  --params '{"spreadsheetId": "SPREADSHEET_ID", "range": "Sheet1!A1:C10"}'
```

### 7.4. Thêm dữ liệu (Helper)

```bash
# Append 1 dòng
gws sheets +append --spreadsheet SPREADSHEET_ID --values 'Alice,100,true'

# Append nhiều dòng
gws sheets +append --spreadsheet SPREADSHEET_ID --json-values '[["Name","Score"],["Alice",95],["Bob",87]]'
```

### 7.5. Thêm dữ liệu (Raw API)

```bash
gws sheets spreadsheets values append \
  --params '{"spreadsheetId": "ID", "range": "Sheet1!A1", "valueInputOption": "USER_ENTERED"}' \
  --json '{"values": [["Name", "Score"], ["Alice", 95], ["Bob", 87]]}'
```

### 7.6. Cập nhật dữ liệu

```bash
gws sheets spreadsheets values update \
  --params '{"spreadsheetId": "ID", "range": "Sheet1!A1:B2", "valueInputOption": "USER_ENTERED"}' \
  --json '{"values": [["Updated Name", "Updated Score"]]}'
```

### 7.7. Xem metadata spreadsheet

```bash
gws sheets spreadsheets get --params '{"spreadsheetId": "ID"}' --fields 'spreadsheetId,properties.title,sheets.properties'
```

### 7.8. Batch Update (Formatting, thêm sheet)

```bash
# Thêm sheet mới
gws sheets spreadsheets batchUpdate --params '{"spreadsheetId": "ID"}' --json '{
  "requests": [
    {
      "addSheet": {
        "properties": {"title": "March 2026"}
      }
    }
  ]
}'

# Copy sheet
gws sheets spreadsheets batchUpdate --params '{"spreadsheetId": "ID"}' --json '{
  "requests": [
    {
      "duplicateSheet": {
        "sourceSheetId": 0,
        "newSheetName": "April 2026"
      }
    }
  ]
}'
```

### 7.9. Export sang CSV

```bash
gws drive files export --params '{"fileId": "SPREADSHEET_ID", "mimeType": "text/csv"}' -o ./backup.csv
```

---

## 8. Gọi từ Node.js (execFileSync)

### Pattern cơ bản

```typescript
import { execFileSync } from "child_process";

function gws(...args: string[]): string {
  const result = execFileSync("gws.exe", args, {
    encoding: "utf-8",
    timeout: 30000,
  });
  return result;
}

// Parse JSON response
function gwsJson<T = any>(...args: string[]): T {
  const raw = gws(...args);
  return JSON.parse(raw);
}
```

### Ví dụ sử dụng

```typescript
// Liệt kê files
const files = gwsJson("drive", "files", "list",
  "--params", JSON.stringify({ pageSize: 10 }),
  "--fields", "files(id,name,mimeType)"
);

// Tạo thư mục
const folder = gwsJson("drive", "files", "create",
  "--json", JSON.stringify({
    name: "New Folder",
    mimeType: "application/vnd.google-apps.folder",
    parents: ["PARENT_ID"]
  })
);

// Phân quyền
const perm = gwsJson("drive", "permissions", "create",
  "--params", JSON.stringify({ fileId: folder.id }),
  "--json", JSON.stringify({
    role: "writer",
    type: "user",
    emailAddress: "user@company.com"
  })
);

// Gửi email
gws("gmail", "+send",
  "--to", "alice@example.com",
  "--subject", "Shared folder",
  "--body", `Check out the new folder: https://drive.google.com/drive/folders/${folder.id}`
);

// Đọc spreadsheet
const data = gwsJson("sheets", "+read",
  "--spreadsheet", "SPREADSHEET_ID",
  "--range", "Sheet1!A1:D10"
);

// Tạo document
const doc = gwsJson("docs", "documents", "create",
  "--json", JSON.stringify({ title: "Meeting Notes" })
);
```

### Lưu ý khi dùng execFileSync

- **Không cần escape JSON** — truyền trực tiếp string qua args, không qua shell
- **Dùng `JSON.stringify()`** cho `--params` và `--json` — đảm bảo JSON hợp lệ
- **Timeout**: set `timeout` phù hợp (30s cho read, 60s cho upload lớn)
- **Error handling**: wrap trong try-catch, stderr chứa error message
- **Encoding**: luôn dùng `encoding: "utf-8"`

```typescript
try {
  const result = gwsJson("drive", "files", "list",
    "--params", JSON.stringify({ pageSize: 5 })
  );
  console.log(result.files);
} catch (error: any) {
  // error.stderr chứa error message từ gws
  console.error("GWS Error:", error.stderr);
}
```

---

## 9. Lưu ý quan trọng

### Bảo vệ context window
- **LUÔN** dùng `--fields` khi list/get để giới hạn response fields
- Drive và Gmail trả về JSON rất lớn → chỉ lấy fields cần thiết

### An toàn
- **LUÔN** dùng `--dry-run` trước khi thực thi write/delete operations
- Confirm với user trước khi thực thi mutating operations
- Không output secrets, tokens ra ngoài

### Schema Discovery
- Khi không biết JSON payload structure → chạy `gws schema <resource>.<method>` trước
- Ví dụ: `gws schema drive.permissions.create` → xem required fields

### Sheets — Shell Escaping
- Range dùng `!` (Sheet1!A1:B2) — khi gọi qua shell cần single quotes
- Khi gọi qua `execFileSync` KHÔNG CẦN escape vì args truyền trực tiếp

### Pagination
- Dùng `--page-all` cho list operations cần toàn bộ kết quả
- Output là NDJSON (1 JSON object per line)
- `--page-limit` giới hạn số trang (tránh quá tải)

### Rate Limiting
- Google API có rate limits — space out requests nếu cần
- `--page-delay <MS>` giữa các trang phân trang

### MimeTypes thường dùng

| Google Type | MimeType |
|-------------|----------|
| Folder | `application/vnd.google-apps.folder` |
| Google Docs | `application/vnd.google-apps.document` |
| Google Sheets | `application/vnd.google-apps.spreadsheet` |
| Google Slides | `application/vnd.google-apps.presentation` |
| PDF | `application/pdf` |
| CSV | `text/csv` |

### Tìm kiếm Drive (q parameter)

| Operator | Ví dụ |
|----------|-------|
| Tên chứa | `name contains "Report"` |
| Tên chính xác | `name = "Budget 2026"` |
| Trong thư mục | `"FOLDER_ID" in parents` |
| Loại file | `mimeType = "application/vnd.google-apps.folder"` |
| Không thùng rác | `trashed = false` |
| Chủ sở hữu | `"user@company.com" in owners` |
| Chia sẻ với tôi | `sharedWithMe = true` |
| Kết hợp | `name contains "Q2" and mimeType = "application/vnd.google-apps.spreadsheet"` |

---

## 10. Tham khảo thêm

- **Repository**: https://github.com/googleworkspace/cli
- **Skills Index**: `skills/` directory trong repo
- **CONTEXT.md**: Rules cho agent khi dùng gws
- **MCP Server mode**: `gws mcp` — expose tất cả commands như MCP tools

### Quick Reference Card

| Thao tác | Lệnh |
|----------|-------|
| Tạo thư mục | `gws drive files create --json '{"name":"X","mimeType":"application/vnd.google-apps.folder"}'` |
| Upload file | `gws drive +upload ./file.pdf --parent FOLDER_ID` |
| Share user | `gws drive permissions create --params '{"fileId":"ID"}' --json '{"role":"writer","type":"user","emailAddress":"x@y.com"}'` |
| Share public | `gws drive permissions create --params '{"fileId":"ID"}' --json '{"role":"reader","type":"anyone"}'` |
| List permissions | `gws drive permissions list --params '{"fileId":"ID"}'` |
| Gửi email | `gws gmail +send --to x@y.com --subject 'S' --body 'B'` |
| Inbox triage | `gws gmail +triage --max 10` |
| Reply | `gws gmail +reply --message-id ID --body 'Text'` |
| Forward | `gws gmail +forward --message-id ID --to x@y.com` |
| Tạo doc | `gws docs documents create --json '{"title":"T"}'` |
| Ghi doc | `gws docs +write --document ID --text 'Text'` |
| Tạo sheet | `gws sheets spreadsheets create --json '{"properties":{"title":"T"}}'` |
| Đọc sheet | `gws sheets +read --spreadsheet ID --range 'Sheet1!A1:D10'` |
| Append sheet | `gws sheets +append --spreadsheet ID --values 'a,b,c'` |
| Schema check | `gws schema drive.files.create` |

---

*Guide version: 2026-03-10 | Source: github.com/googleworkspace/cli | For Operis Agent skill*
