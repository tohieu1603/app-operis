# Google Workspace CLI (gws) — Full Agent Skill Guide

> Hướng dẫn chi tiết cho AI Agent sử dụng `gws` CLI thao tác với TẤT CẢ Google Workspace services.
> Mọi lệnh gọi qua Node.js: `execFileSync("gws.exe", [...args])` — không qua shell.

---

## Mục lục

1. [Tổng quan & Cài đặt](#1-tổng-quan--cài-đặt)
2. [Xác thực (Authentication)](#2-xác-thực)
3. [Cú pháp chung & Flag toàn cục](#3-cú-pháp-chung)
4. [Google Drive](#4-google-drive)
5. [Drive Permissions (Chi tiết)](#5-drive-permissions)
6. [Gmail](#6-gmail)
7. [Google Docs](#7-google-docs)
8. [Google Sheets](#8-google-sheets)
9. [Google Calendar](#9-google-calendar)
10. [Google Chat](#10-google-chat)
11. [Google Slides](#11-google-slides)
12. [Google Tasks](#12-google-tasks)
13. [Google People (Contacts)](#13-google-people)
14. [Google Forms](#14-google-forms)
15. [Google Keep](#15-google-keep)
16. [Google Meet](#16-google-meet)
17. [Google Classroom](#17-google-classroom)
18. [Admin Reports](#18-admin-reports)
19. [Workspace Events](#19-workspace-events)
20. [Workflow (Cross-service)](#20-workflow)
21. [Node.js execFileSync Pattern](#21-nodejs-pattern)
22. [Lưu ý & Tham khảo](#22-lưu-ý--tham-khảo)

---

## 1. Tổng quan & Cài đặt

**gws** — CLI duy nhất cho tất cả Google Workspace API. Xây dựng động từ Google Discovery Service.

```bash
npm install -g @googleworkspace/cli
```

Yêu cầu: Node.js 18+, Google Cloud Project, Google account.

---

## 2. Xác thực

### Setup nhanh (cần gcloud)

```bash
gws auth setup                              # Tạo project, enable APIs, login
gws auth login -s drive,gmail,sheets,docs    # Login với scope cụ thể
```

### Manual OAuth (không cần gcloud)

1. Tạo OAuth Desktop App tại Google Cloud Console
2. Download `client_secret.json` → `~/.config/gws/client_secret.json`
3. Thêm email vào **Test users** (OAuth consent screen)
4. `gws auth login`

### Environment Variables

| Biến | Mô tả | Ưu tiên |
|------|--------|---------|
| `GOOGLE_WORKSPACE_CLI_TOKEN` | Access token có sẵn | 1 (cao nhất) |
| `GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE` | Path tới credentials JSON | 2 |
| `GOOGLE_WORKSPACE_CLI_CLIENT_ID` | OAuth client ID | — |
| `GOOGLE_WORKSPACE_CLI_CLIENT_SECRET` | OAuth client secret | — |
| `GOOGLE_WORKSPACE_CLI_CONFIG_DIR` | Thư mục config (default: `~/.config/gws`) | — |

### Headless/CI

```bash
gws auth export --unmasked > credentials.json              # Máy có browser
export GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE=./creds.json  # Máy headless
```

---

## 3. Cú pháp chung

```
gws <service> <resource> [sub-resource] <method> [flags]
```

### Flag toàn cục

| Flag | Mô tả |
|------|--------|
| `--params '{"key":"val"}'` | URL/query parameters |
| `--json '{"key":"val"}'` | Request body |
| `--upload <PATH>` | Upload file (multipart) |
| `-o, --output <PATH>` | Lưu binary ra file |
| `--dry-run` | Preview, không thực thi |
| `--page-all` | Tự động phân trang (NDJSON) |
| `--page-limit <N>` | Giới hạn trang (default: 10) |
| `--page-delay <MS>` | Delay giữa trang (default: 100ms) |
| `--fields '<MASK>'` | Giới hạn response fields |
| `--format <FMT>` | `json` (default), `table`, `yaml`, `csv` |

### Schema & Help

```bash
gws schema drive.files.create       # Xem payload structure
gws drive --help                     # Xem resources
gws drive files create --help        # Xem flags
```

---

## 4. Google Drive

### Liệt kê files

```bash
gws drive files list --params '{"pageSize": 10}' --fields 'files(id,name,mimeType)'

# Tìm theo tên
gws drive files list --params '{"q": "name contains \"Report\"", "pageSize": 5}' --fields 'files(id,name)'

# Files trong thư mục
gws drive files list --params '{"q": "\"FOLDER_ID\" in parents", "pageSize": 50}' --fields 'files(id,name,mimeType)'

# Chỉ thư mục
gws drive files list --params '{"q": "mimeType = \"application/vnd.google-apps.folder\""}' --fields 'files(id,name)'

# Phân trang tự động
gws drive files list --params '{"pageSize": 100}' --page-all --fields 'files(id,name)'
```

### Lấy thông tin file

```bash
gws drive files get --params '{"fileId": "FILE_ID"}' --fields 'id,name,mimeType,parents,webViewLink'
```

### Tạo thư mục

```bash
# Thư mục gốc
gws drive files create --json '{"name": "Project Files", "mimeType": "application/vnd.google-apps.folder"}'

# Thư mục con
gws drive files create --json '{"name": "Documents", "mimeType": "application/vnd.google-apps.folder", "parents": ["PARENT_ID"]}'
```

### Upload file

```bash
gws drive +upload ./report.pdf                        # Đơn giản
gws drive +upload ./report.pdf --parent FOLDER_ID     # Vào thư mục
gws drive +upload ./data.csv --name 'Sales Data.csv'  # Tên tùy chỉnh

# Raw API
gws drive files create --json '{"name": "report.pdf", "parents": ["FOLDER_ID"]}' --upload ./report.pdf
```

### Download / Export

```bash
gws drive files get --params '{"fileId": "FILE_ID", "alt": "media"}' -o ./file.pdf
gws drive files export --params '{"fileId": "DOC_ID", "mimeType": "application/pdf"}' -o ./doc.pdf
gws drive files export --params '{"fileId": "SHEET_ID", "mimeType": "text/csv"}' -o ./data.csv
```

### Di chuyển / Copy / Đổi tên / Xóa

```bash
# Di chuyển
gws drive files update --params '{"fileId": "FILE_ID", "addParents": "NEW_FOLDER", "removeParents": "OLD_FOLDER"}'

# Copy
gws drive files copy --params '{"fileId": "FILE_ID"}' --json '{"name": "Copy of Report", "parents": ["FOLDER_ID"]}'

# Đổi tên
gws drive files update --params '{"fileId": "FILE_ID"}' --json '{"name": "New Name"}'

# Trash
gws drive files update --params '{"fileId": "FILE_ID"}' --json '{"trashed": true}'

# Xóa vĩnh viễn (--dry-run trước!)
gws drive files delete --params '{"fileId": "FILE_ID"}' --dry-run
```

### Drive Search (q parameter)

| Operator | Ví dụ |
|----------|-------|
| Tên chứa | `name contains "Report"` |
| Tên chính xác | `name = "Budget 2026"` |
| Trong thư mục | `"FOLDER_ID" in parents` |
| Loại file | `mimeType = "application/vnd.google-apps.folder"` |
| Không trash | `trashed = false` |
| Chủ sở hữu | `"user@co.com" in owners` |
| Shared with me | `sharedWithMe = true` |
| Kết hợp | `name contains "Q2" and mimeType = "application/vnd.google-apps.spreadsheet"` |

---

## 5. Drive Permissions

### Roles & Types

| Role | Mô tả |
|------|--------|
| `reader` | Chỉ xem |
| `commenter` | Xem + bình luận |
| `writer` | Chỉnh sửa |
| `fileOrganizer` | Quản lý file (Shared Drive) |
| `organizer` | Quản lý Shared Drive |
| `owner` | Chủ sở hữu (My Drive only) |

| Type | Field bắt buộc |
|------|----------------|
| `user` | `emailAddress` |
| `group` | `emailAddress` |
| `domain` | `domain` |
| `anyone` | — |

### Chia sẻ

```bash
# Writer cho user
gws drive permissions create --params '{"fileId": "ID"}' \
  --json '{"role": "writer", "type": "user", "emailAddress": "alice@co.com"}'

# Reader cho user
gws drive permissions create --params '{"fileId": "ID"}' \
  --json '{"role": "reader", "type": "user", "emailAddress": "viewer@co.com"}'

# Group
gws drive permissions create --params '{"fileId": "ID"}' \
  --json '{"role": "writer", "type": "group", "emailAddress": "team@co.com"}'

# Domain
gws drive permissions create --params '{"fileId": "ID"}' \
  --json '{"role": "reader", "type": "domain", "domain": "company.com"}'

# Anyone with link
gws drive permissions create --params '{"fileId": "ID"}' \
  --json '{"role": "reader", "type": "anyone"}'

# Không gửi email
gws drive permissions create --params '{"fileId": "ID", "sendNotificationEmail": false}' \
  --json '{"role": "writer", "type": "user", "emailAddress": "silent@co.com"}'

# Kèm tin nhắn
gws drive permissions create --params '{"fileId": "ID", "emailMessage": "Please review"}' \
  --json '{"role": "writer", "type": "user", "emailAddress": "reviewer@co.com"}'

# Chuyển ownership
gws drive permissions create --params '{"fileId": "ID", "transferOwnership": true}' \
  --json '{"role": "owner", "type": "user", "emailAddress": "newowner@co.com"}'
```

### Quản lý permissions

```bash
gws drive permissions list --params '{"fileId": "ID"}' --format table
gws drive permissions get --params '{"fileId": "ID", "permissionId": "PERM_ID"}'
gws drive permissions update --params '{"fileId": "ID", "permissionId": "PERM_ID"}' --json '{"role": "writer"}'
gws drive permissions delete --params '{"fileId": "ID", "permissionId": "PERM_ID"}'
```

### Shared Drive

```bash
gws drive drives create --params '{"requestId": "unique-123"}' --json '{"name": "Team Project"}'
gws drive drives list
gws drive permissions create --params '{"fileId": "DRIVE_ID", "supportsAllDrives": true}' \
  --json '{"role": "writer", "type": "user", "emailAddress": "member@co.com"}'
gws drive permissions list --params '{"fileId": "DRIVE_ID", "supportsAllDrives": true}'
```

### Recipe: Folder + Permissions

```bash
# 1. Tạo folder → lấy ROOT_ID
gws drive files create --json '{"name": "Q2 Project", "mimeType": "application/vnd.google-apps.folder"}'
# 2. Sub-folders
gws drive files create --json '{"name": "Docs", "mimeType": "application/vnd.google-apps.folder", "parents": ["ROOT_ID"]}'
# 3. Share (kế thừa xuống sub-folders)
gws drive permissions create --params '{"fileId": "ROOT_ID"}' \
  --json '{"role": "writer", "type": "user", "emailAddress": "dev@co.com"}'
# 4. Verify
gws drive files list --params '{"q": "\"ROOT_ID\" in parents"}' --format table
gws drive permissions list --params '{"fileId": "ROOT_ID"}' --format table
```

---

## 6. Gmail

### Helpers

```bash
# Gửi email
gws gmail +send --to alice@co.com --subject 'Hello' --body 'Hi Alice!'
gws gmail +send --to alice@co.com --subject 'Test' --body 'Test' --dry-run

# Inbox triage (chưa đọc)
gws gmail +triage                                    # 20 emails
gws gmail +triage --max 5 --query 'from:boss'        # Filter
gws gmail +triage --labels --format json              # Kèm labels, JSON

# Reply
gws gmail +reply --message-id MSG_ID --body 'Got it!'
gws gmail +reply --message-id MSG_ID --body 'CC Carol' --cc carol@co.com

# Reply All
gws gmail +reply-all --message-id MSG_ID --body 'Noted.'

# Forward
gws gmail +forward --message-id MSG_ID --to dave@co.com
gws gmail +forward --message-id MSG_ID --to dave@co.com --body 'FYI' --cc eve@co.com

# Watch (streaming)
gws gmail +watch --project my-gcp-project
```

### Raw API

```bash
# Profile
gws gmail users getProfile --params '{"userId": "me"}'

# List messages
gws gmail users messages list --params '{"userId": "me", "maxResults": 10}'
gws gmail users messages list --params '{"userId": "me", "q": "subject:invoice after:2026/01/01", "maxResults": 5}'

# Read message
gws gmail users messages get --params '{"userId": "me", "id": "MSG_ID"}'
gws gmail users messages get --params '{"userId": "me", "id": "MSG_ID", "format": "metadata"}'  # Tiết kiệm token

# Labels
gws gmail users labels list --params '{"userId": "me"}'
gws gmail users labels create --params '{"userId": "me"}' --json '{"name": "Projects"}'
gws gmail users messages modify --params '{"userId": "me", "id": "MSG_ID"}' --json '{"addLabelIds": ["LABEL_ID"]}'

# Threads
gws gmail users threads list --params '{"userId": "me", "maxResults": 10}'
gws gmail users threads get --params '{"userId": "me", "id": "THREAD_ID"}'

# Drafts
gws gmail users drafts list --params '{"userId": "me"}'
```

---

## 7. Google Docs

```bash
# Tạo
gws docs documents create --json '{"title": "Meeting Notes"}'

# Đọc
gws docs documents get --params '{"documentId": "DOC_ID"}'

# Append text (helper)
gws docs +write --document DOC_ID --text 'Appended text here.'

# Batch Update — chèn text tại vị trí
gws docs documents batchUpdate --params '{"documentId": "DOC_ID"}' --json '{
  "requests": [{"insertText": {"location": {"index": 1}, "text": "Heading\n\nBody.\n"}}]
}'

# Chèn text + bold
gws docs documents batchUpdate --params '{"documentId": "DOC_ID"}' --json '{
  "requests": [
    {"insertText": {"location": {"index": 1}, "text": "Title\n"}},
    {"updateTextStyle": {"range": {"startIndex": 1, "endIndex": 6}, "textStyle": {"bold": true}, "fields": "bold"}}
  ]
}'
```

### BatchUpdate request types

| Request | Mô tả |
|---------|--------|
| `insertText` | Chèn text tại index |
| `deleteContentRange` | Xóa nội dung |
| `updateTextStyle` | Bold, italic, fontSize |
| `updateParagraphStyle` | Heading, alignment |
| `replaceAllText` | Find & replace |
| `insertTable` | Chèn bảng |
| `insertInlineImage` | Chèn ảnh |

### Recipe: Doc từ template

```bash
gws drive files copy --params '{"fileId": "TEMPLATE_ID"}' --json '{"name": "Report W10"}'  # → NEW_ID
gws docs +write --document NEW_ID --text 'Summary: Done.'
gws drive permissions create --params '{"fileId": "NEW_ID"}' --json '{"role": "writer", "type": "user", "emailAddress": "mgr@co.com"}'
```

---

## 8. Google Sheets

```bash
# Tạo
gws sheets spreadsheets create --json '{"properties": {"title": "Q1 Budget"}}'

# Đọc (helper)
gws sheets +read --spreadsheet ID --range 'Sheet1!A1:D10'
gws sheets +read --spreadsheet ID --range Sheet1                # Toàn bộ sheet

# Đọc (raw)
gws sheets spreadsheets values get --params '{"spreadsheetId": "ID", "range": "Sheet1!A1:C10"}'

# Append (helper)
gws sheets +append --spreadsheet ID --values 'Alice,100,true'                           # 1 dòng
gws sheets +append --spreadsheet ID --json-values '[["Name","Score"],["Alice",95]]'     # Nhiều dòng

# Append (raw)
gws sheets spreadsheets values append \
  --params '{"spreadsheetId": "ID", "range": "Sheet1!A1", "valueInputOption": "USER_ENTERED"}' \
  --json '{"values": [["Name", "Score"], ["Alice", 95]]}'

# Update
gws sheets spreadsheets values update \
  --params '{"spreadsheetId": "ID", "range": "Sheet1!A1:B2", "valueInputOption": "USER_ENTERED"}' \
  --json '{"values": [["New Name", "New Score"]]}'

# Metadata
gws sheets spreadsheets get --params '{"spreadsheetId": "ID"}' --fields 'properties.title,sheets.properties'

# Thêm sheet tab
gws sheets spreadsheets batchUpdate --params '{"spreadsheetId": "ID"}' \
  --json '{"requests": [{"addSheet": {"properties": {"title": "March 2026"}}}]}'

# Copy sheet tab
gws sheets spreadsheets batchUpdate --params '{"spreadsheetId": "ID"}' \
  --json '{"requests": [{"duplicateSheet": {"sourceSheetId": 0, "newSheetName": "April 2026"}}]}'

# Export CSV
gws drive files export --params '{"fileId": "SHEET_ID", "mimeType": "text/csv"}' -o ./backup.csv
```

### valueInputOption

| Option | Mô tả |
|--------|--------|
| `RAW` | Giữ nguyên string |
| `USER_ENTERED` | Parse number/date/formula tự động |

---

## 9. Google Calendar

### Helpers

```bash
# Agenda
gws calendar +agenda                              # Upcoming
gws calendar +agenda --today                       # Hôm nay
gws calendar +agenda --tomorrow                    # Ngày mai
gws calendar +agenda --week --format table         # Tuần này
gws calendar +agenda --days 3 --calendar 'Work'    # 3 ngày, filter calendar

# Tạo event
gws calendar +insert --summary 'Standup' --start '2026-03-11T09:00:00+07:00' --end '2026-03-11T09:30:00+07:00'
gws calendar +insert --summary 'Review' --start '2026-03-12T14:00:00+07:00' --end '2026-03-12T15:00:00+07:00' \
  --location 'Room A' --description 'Q2 Review' --attendee alice@co.com --attendee bob@co.com
```

### Raw API

```bash
# List events
gws calendar events list --params '{"calendarId": "primary", "maxResults": 10, "orderBy": "startTime", "singleEvents": true, "timeMin": "2026-03-10T00:00:00Z"}'

# Recurring event
gws calendar events insert --params '{"calendarId": "primary"}' --json '{
  "summary": "Weekly Sync", "start": {"dateTime": "2026-03-11T09:00:00+07:00"},
  "end": {"dateTime": "2026-03-11T09:30:00+07:00"},
  "recurrence": ["RRULE:FREQ=WEEKLY;COUNT=10"],
  "attendees": [{"email": "team@co.com"}]
}'

# All-day event
gws calendar events insert --params '{"calendarId": "primary"}' --json '{
  "summary": "Holiday", "start": {"date": "2026-04-30"}, "end": {"date": "2026-05-01"}
}'

# Quick Add (natural text)
gws calendar events quickAdd --params '{"calendarId": "primary", "text": "Meeting with Alice tomorrow 2pm"}'

# Update / Delete / Move
gws calendar events patch --params '{"calendarId": "primary", "eventId": "EVT_ID"}' --json '{"summary": "New Title"}'
gws calendar events delete --params '{"calendarId": "primary", "eventId": "EVT_ID"}' --dry-run
gws calendar events move --params '{"calendarId": "primary", "eventId": "EVT_ID", "destination": "OTHER_CAL_ID"}'

# Free/Busy
gws calendar freebusy query --json '{
  "timeMin": "2026-03-11T08:00:00+07:00", "timeMax": "2026-03-11T18:00:00+07:00",
  "items": [{"id": "alice@co.com"}, {"id": "bob@co.com"}]
}'

# Calendar management
gws calendar calendarList list
gws calendar calendars insert --json '{"summary": "Project X"}'

# ACL (share calendar)
gws calendar acl insert --params '{"calendarId": "CAL_ID"}' --json '{"role": "reader", "scope": {"type": "user", "value": "viewer@co.com"}}'
```

**Lưu ý:** Thời gian RFC 3339: `2026-03-11T09:00:00+07:00`. All-day dùng `date` không có `dateTime`.

---

## 10. Google Chat

### Helper

```bash
gws chat +send --space spaces/AAAAxxxx --text 'Hello team!'
```

### Raw API

```bash
# Spaces
gws chat spaces list
gws chat spaces create --json '{"displayName": "Project Alpha", "spaceType": "SPACE"}'
gws chat spaces setup --json '{"displayName": "Quick Sync", "spaceType": "SPACE", "memberships": [{"member": {"name": "users/alice@co.com", "type": "HUMAN"}}]}'
gws chat spaces get --params '{"name": "spaces/AAAAxxxx"}'
gws chat spaces findDirectMessage --params '{"name": "users/alice@co.com"}'

# Messages
gws chat spaces messages create --params '{"parent": "spaces/AAAAxxxx"}' --json '{"text": "Hello!"}'
gws chat spaces messages create --params '{"parent": "spaces/AAAAxxxx"}' \
  --json '{"text": "Reply", "thread": {"name": "spaces/AAAAxxxx/threads/THREAD_ID"}}'   # Threaded
gws chat spaces messages list --params '{"parent": "spaces/AAAAxxxx"}'
gws chat spaces messages delete --params '{"name": "spaces/AAAAxxxx/messages/MSG_ID"}'

# Members
gws chat spaces members list --params '{"parent": "spaces/AAAAxxxx"}'
gws chat spaces members create --params '{"parent": "spaces/AAAAxxxx"}' \
  --json '{"member": {"name": "users/new@co.com", "type": "HUMAN"}}'

# Upload media
gws chat media upload --params '{"parent": "spaces/AAAAxxxx"}' --upload ./screenshot.png
```

**Lưu ý:** Google Chat API yêu cầu Google Workspace account (không phải Gmail cá nhân).

---

## 11. Google Slides

```bash
# Tạo
gws slides presentations create --json '{"title": "Q2 Review"}'

# Đọc
gws slides presentations get --params '{"presentationId": "PRES_ID"}'

# Thêm slide
gws slides presentations batchUpdate --params '{"presentationId": "PRES_ID"}' --json '{
  "requests": [{"createSlide": {"slideLayoutReference": {"predefinedLayout": "TITLE_AND_BODY"},
    "placeholderIdMappings": [
      {"layoutPlaceholder": {"type": "TITLE"}, "objectId": "t1"},
      {"layoutPlaceholder": {"type": "BODY"}, "objectId": "b1"}
    ]
  }}]
}'

# Chèn text
gws slides presentations batchUpdate --params '{"presentationId": "PRES_ID"}' --json '{
  "requests": [
    {"insertText": {"objectId": "t1", "text": "Quarterly Review"}},
    {"insertText": {"objectId": "b1", "text": "Key metrics"}}
  ]
}'

# Export PDF
gws drive files export --params '{"fileId": "PRES_ID", "mimeType": "application/pdf"}' -o ./slides.pdf

# Copy template
gws drive files copy --params '{"fileId": "TEMPLATE_ID"}' --json '{"name": "Report Slides"}'
```

### Predefined Layouts

| Layout | Mô tả |
|--------|--------|
| `BLANK` | Trống |
| `TITLE` | Chỉ title |
| `TITLE_AND_BODY` | Title + body |
| `TITLE_AND_TWO_COLUMNS` | Title + 2 cột |
| `SECTION_HEADER` | Section divider |
| `ONE_COLUMN_TEXT` | 1 cột |
| `BIG_NUMBER` | Số lớn |

---

## 12. Google Tasks

```bash
# Task Lists
gws tasks tasklists list
gws tasks tasklists insert --json '{"title": "Sprint 10"}'
gws tasks tasklists patch --params '{"tasklist": "LIST_ID"}' --json '{"title": "Sprint 11"}'
gws tasks tasklists delete --params '{"tasklist": "LIST_ID"}' --dry-run

# Tasks
gws tasks tasks list --params '{"tasklist": "LIST_ID"}'
gws tasks tasks list --params '{"tasklist": "LIST_ID", "showCompleted": true}'

gws tasks tasks insert --params '{"tasklist": "LIST_ID"}' --json '{
  "title": "Review PR #123", "notes": "Check edge cases", "due": "2026-03-12T00:00:00.000Z"
}'

# Subtask
gws tasks tasks insert --params '{"tasklist": "LIST_ID"}' --json '{"title": "Write tests"}'
gws tasks tasks move --params '{"tasklist": "LIST_ID", "task": "CHILD_ID", "parent": "PARENT_ID"}'

# Complete
gws tasks tasks patch --params '{"tasklist": "LIST_ID", "task": "TASK_ID"}' --json '{"status": "completed"}'

# Delete / Clear
gws tasks tasks delete --params '{"tasklist": "LIST_ID", "task": "TASK_ID"}'
gws tasks tasks clear --params '{"tasklist": "LIST_ID"}'    # Clear completed
```

**Lưu ý:** Max 2000 lists, 20000 tasks/list. Status: `needsAction` | `completed`. Due format: ISO 8601 UTC.

---

## 13. Google People

```bash
# Profile
gws people people get --params '{"resourceName": "people/me", "personFields": "names,emailAddresses,phoneNumbers"}'

# Tạo contact
gws people people createContact --json '{
  "names": [{"givenName": "Alice", "familyName": "Nguyen"}],
  "emailAddresses": [{"value": "alice@co.com"}],
  "phoneNumbers": [{"value": "+84901234567"}],
  "organizations": [{"name": "Acme", "title": "Developer"}]
}'

# Tìm contacts
gws people people searchContacts --params '{"query": "Alice", "readMask": "names,emailAddresses"}'

# Liệt kê contacts
gws people people connections list --params '{"resourceName": "people/me", "personFields": "names,emailAddresses", "pageSize": 50}'

# Update
gws people people updateContact --params '{"resourceName": "people/PERSON_ID", "updatePersonFields": "phoneNumbers"}' \
  --json '{"phoneNumbers": [{"value": "+84909876543"}]}'

# Batch create
gws people people batchCreateContacts --json '{
  "contacts": [
    {"contactPerson": {"names": [{"givenName": "Bob"}], "emailAddresses": [{"value": "bob@co.com"}]}},
    {"contactPerson": {"names": [{"givenName": "Carol"}], "emailAddresses": [{"value": "carol@co.com"}]}}
  ], "readMask": "names,emailAddresses"
}'

# Contact Groups
gws people contactGroups list
gws people contactGroups create --json '{"contactGroup": {"name": "Dev Team"}}'
gws people contactGroups members modify --params '{"resourceName": "contactGroups/GRP_ID"}' \
  --json '{"resourceNamesToAdd": ["people/PERSON_ID"]}'

# Directory (domain)
gws people people searchDirectoryPeople --params '{"query": "alice", "readMask": "names,emailAddresses", "sources": ["DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE"]}'
```

**Lưu ý:** `personFields`/`readMask` **bắt buộc**. Warmup request cần trước searchContacts.

---

## 14. Google Forms

```bash
# Tạo
gws forms forms create --json '{"info": {"title": "Feedback", "documentTitle": "Feedback Form"}}'

# Đọc
gws forms forms get --params '{"formId": "FORM_ID"}'

# Thêm câu hỏi
gws forms forms batchUpdate --params '{"formId": "FORM_ID"}' --json '{
  "requests": [{"createItem": {"item": {
    "title": "How satisfied?",
    "questionItem": {"question": {"required": true, "scaleQuestion": {"low": 1, "high": 5}}}
  }, "location": {"index": 0}}}]
}'

# Multiple choice
gws forms forms batchUpdate --params '{"formId": "FORM_ID"}' --json '{
  "requests": [{"createItem": {"item": {
    "title": "Which product?",
    "questionItem": {"question": {"required": true,
      "choiceQuestion": {"type": "RADIO", "options": [{"value": "A"}, {"value": "B"}, {"value": "Other"}]}
    }}
  }, "location": {"index": 1}}}]
}'

# Đọc responses
gws forms forms responses list --params '{"formId": "FORM_ID"}'
```

### Question Types

| Type | Field |
|------|-------|
| Short text | `textQuestion: {}` |
| Long text | `textQuestion: {paragraph: true}` |
| Radio | `choiceQuestion: {type: "RADIO", options: [...]}` |
| Checkbox | `choiceQuestion: {type: "CHECKBOX", options: [...]}` |
| Dropdown | `choiceQuestion: {type: "DROP_DOWN", options: [...]}` |
| Scale | `scaleQuestion: {low: 1, high: 5}` |
| Date | `dateQuestion: {}` |
| Time | `timeQuestion: {}` |

---

## 15. Google Keep

```bash
gws keep notes create --json '{"body": {"text": {"text": "Remember PR #123"}}}'
gws keep notes list
gws keep notes get --params '{"name": "notes/NOTE_ID"}'
gws keep notes delete --params '{"name": "notes/NOTE_ID"}' --dry-run
```

**Lưu ý:** API hạn chế — chủ yếu CRUD notes. Không hỗ trợ labels/reminders/images qua API.

---

## 16. Google Meet

```bash
# Tạo meeting space
gws meet spaces create --json '{}'    # Response chứa meetingUri

# Xem / Update space
gws meet spaces get --params '{"name": "spaces/SPACE_ID"}'
gws meet spaces patch --params '{"name": "spaces/SPACE_ID", "updateMask": "config"}' \
  --json '{"config": {"accessType": "OPEN"}}'

# Kết thúc meeting
gws meet spaces endActiveConference --params '{"name": "spaces/SPACE_ID"}'

# Conference records
gws meet conferenceRecords list
gws meet conferenceRecords participants list --params '{"parent": "conferenceRecords/CONF_ID"}'
gws meet conferenceRecords recordings list --params '{"parent": "conferenceRecords/CONF_ID"}'
gws meet conferenceRecords transcripts list --params '{"parent": "conferenceRecords/CONF_ID"}'
```

### Access Types

| Type | Mô tả |
|------|--------|
| `OPEN` | Ai có link đều join |
| `TRUSTED` | Chỉ domain users |
| `RESTRICTED` | Chỉ invited |

---

## 17. Google Classroom

> Yêu cầu: Google Workspace for Education.

```bash
# Courses
gws classroom courses list
gws classroom courses create --json '{"name": "Web Dev 101", "section": "Spring 2026", "ownerId": "me"}'
gws classroom courses get --params '{"id": "COURSE_ID"}'
gws classroom courses patch --params '{"id": "COURSE_ID", "updateMask": "name"}' --json '{"name": "Advanced Web"}'

# Students & Teachers
gws classroom courses students list --params '{"courseId": "COURSE_ID"}'
gws classroom courses students create --params '{"courseId": "COURSE_ID"}' --json '{"userId": "student@school.edu"}'
gws classroom courses teachers create --params '{"courseId": "COURSE_ID"}' --json '{"userId": "teacher@school.edu"}'

# Invitations
gws classroom invitations create --json '{"courseId": "COURSE_ID", "userId": "student@school.edu", "role": "STUDENT"}'

# Coursework
gws classroom courses courseWork list --params '{"courseId": "COURSE_ID"}'
gws classroom courses courseWork create --params '{"courseId": "COURSE_ID"}' --json '{
  "title": "HW1", "description": "Exercises 1-5", "workType": "ASSIGNMENT",
  "maxPoints": 100, "dueDate": {"year": 2026, "month": 3, "day": 20}
}'

# Announcements
gws classroom courses announcements create --params '{"courseId": "COURSE_ID"}' --json '{"text": "Class cancelled tomorrow"}'
```

---

## 18. Admin Reports

> Yêu cầu: Google Workspace admin account.

```bash
# Activity logs
gws admin-reports activities list --params '{"userKey": "all", "applicationName": "admin"}'
gws admin-reports activities list --params '{"userKey": "all", "applicationName": "drive"}'
gws admin-reports activities list --params '{"userKey": "all", "applicationName": "gmail"}'
gws admin-reports activities list --params '{"userKey": "all", "applicationName": "login"}'
gws admin-reports activities list --params '{"userKey": "user@co.com", "applicationName": "drive"}'

# Usage reports
gws admin-reports customerUsageReports get --params '{"date": "2026-03-09"}'
gws admin-reports userUsageReport get --params '{"userKey": "all", "date": "2026-03-09"}'
```

### Application names

| App | Mô tả |
|-----|--------|
| `admin` | Admin console changes |
| `drive` | Drive file operations |
| `gmail` | Gmail settings |
| `login` | Login/logout |
| `calendar` | Calendar changes |
| `token` | OAuth grants |
| `groups` | Groups modifications |
| `chat` | Chat activities |

**Lưu ý:** Date format `YYYY-MM-DD`, max 180 ngày trước.

---

## 19. Workspace Events

```bash
# Subscribe (stream NDJSON)
gws events +subscribe --target 'spaces/SPACE_ID' --event-types 'google.workspace.chat.message.v1.created'

# Renew subscription
gws events +renew --subscription-id SUB_ID

# Raw API
gws events subscriptions create --json '{
  "targetResource": "//chat.googleapis.com/spaces/SPACE_ID",
  "eventTypes": ["google.workspace.chat.message.v1.created"],
  "notificationEndpoint": {"pubsubTopic": "projects/PROJECT/topics/TOPIC"}
}'
gws events subscriptions list
gws events subscriptions delete --params '{"name": "subscriptions/SUB_ID"}'
gws events subscriptions reactivate --params '{"name": "subscriptions/SUB_ID"}'
```

### Event Types

| Event | Mô tả |
|-------|--------|
| `google.workspace.chat.message.v1.created` | Chat message mới |
| `google.workspace.chat.membership.v1.created` | Member mới |
| `google.workspace.meet.conference.v2.started` | Meeting bắt đầu |
| `google.workspace.meet.conference.v2.ended` | Meeting kết thúc |

---

## 20. Workflow

> Cross-service helpers kết hợp Calendar + Tasks + Gmail + Drive + Chat.

```bash
gws workflow +standup-report       # Meetings hôm nay + open tasks → standup summary
gws workflow +meeting-prep         # Chuẩn bị meeting tiếp theo: agenda, attendees, docs
gws workflow +email-to-task --message-id MSG_ID    # Gmail → Tasks
gws workflow +weekly-digest        # Tổng kết tuần: meetings + unread email count
gws workflow +file-announce --file-id FILE_ID --space spaces/AAAAxxxx   # Announce Drive file → Chat
```

---

## 21. Node.js Pattern

### Wrapper functions

```typescript
import { execFileSync } from "child_process";

function gws(...args: string[]): string {
  return execFileSync("gws.exe", args, { encoding: "utf-8", timeout: 30000 });
}

function gwsJson<T = any>(...args: string[]): T {
  return JSON.parse(gws(...args));
}
```

### Ví dụ tổng hợp

```typescript
// Drive: tạo folder + share
const folder = gwsJson("drive", "files", "create",
  "--json", JSON.stringify({ name: "Project", mimeType: "application/vnd.google-apps.folder" })
);
gwsJson("drive", "permissions", "create",
  "--params", JSON.stringify({ fileId: folder.id, sendNotificationEmail: false }),
  "--json", JSON.stringify({ role: "writer", type: "user", emailAddress: "dev@co.com" })
);

// Gmail: send
gws("gmail", "+send", "--to", "alice@co.com", "--subject", "New folder", "--body", `Link: https://drive.google.com/drive/folders/${folder.id}`);

// Sheets: read + append
const data = gwsJson("sheets", "+read", "--spreadsheet", "ID", "--range", "Sheet1!A1:D10");
gws("sheets", "+append", "--spreadsheet", "ID", "--values", "Alice,100,true");

// Calendar: agenda + insert
const agenda = gwsJson("calendar", "+agenda", "--today", "--format", "json");
gws("calendar", "+insert", "--summary", "Review", "--start", "2026-03-11T15:00:00+07:00", "--end", "2026-03-11T15:30:00+07:00");

// Docs: create + write
const doc = gwsJson("docs", "documents", "create", "--json", JSON.stringify({ title: "Notes" }));
gws("docs", "+write", "--document", doc.documentId, "--text", "Action items:\n1. Deploy\n2. Test");

// Chat: send
gws("chat", "+send", "--space", "spaces/AAAAxxxx", "--text", "Deploy complete!");

// Tasks: create
gwsJson("tasks", "tasks", "insert",
  "--params", JSON.stringify({ tasklist: listId }),
  "--json", JSON.stringify({ title: "Deploy v2.0", due: "2026-03-15T00:00:00.000Z" })
);

// Meet: create
const meet = gwsJson("meet", "spaces", "create", "--json", "{}");

// Workflow: standup
const standup = gwsJson("workflow", "+standup-report");
```

### Error handling

```typescript
try {
  const result = gwsJson("drive", "files", "list", "--params", JSON.stringify({ pageSize: 5 }));
} catch (error: any) {
  console.error("GWS Error:", error.stderr);
}
```

### Lưu ý execFileSync

- Dùng `JSON.stringify()` cho `--params`/`--json`
- Không cần escape JSON — args truyền trực tiếp
- Timeout: 30s (read), 60s (upload lớn)
- `error.stderr` chứa error message

---

## 22. Lưu ý & Tham khảo

### Rules cho Agent

- **LUÔN** dùng `--fields` khi list/get → giới hạn response (tiết kiệm token)
- **LUÔN** dùng `--dry-run` trước mutating operations
- **LUÔN** chạy `gws schema <method>` khi không biết payload structure
- Confirm với user trước write/delete operations

### MimeTypes

| Type | MimeType |
|------|----------|
| Folder | `application/vnd.google-apps.folder` |
| Docs | `application/vnd.google-apps.document` |
| Sheets | `application/vnd.google-apps.spreadsheet` |
| Slides | `application/vnd.google-apps.presentation` |
| PDF | `application/pdf` |
| CSV | `text/csv` |

### Quick Reference Card

| Thao tác | Lệnh |
|----------|-------|
| Tạo thư mục | `gws drive files create --json '{"name":"X","mimeType":"application/vnd.google-apps.folder"}'` |
| Upload file | `gws drive +upload ./file.pdf --parent FOLDER_ID` |
| Share | `gws drive permissions create --params '{"fileId":"ID"}' --json '{"role":"writer","type":"user","emailAddress":"x@y.com"}'` |
| Gửi email | `gws gmail +send --to x@y.com --subject 'S' --body 'B'` |
| Inbox | `gws gmail +triage --max 10` |
| Reply | `gws gmail +reply --message-id ID --body 'Text'` |
| Tạo doc | `gws docs documents create --json '{"title":"T"}'` |
| Ghi doc | `gws docs +write --document ID --text 'Text'` |
| Tạo sheet | `gws sheets spreadsheets create --json '{"properties":{"title":"T"}}'` |
| Đọc sheet | `gws sheets +read --spreadsheet ID --range 'Sheet1!A1:D10'` |
| Append sheet | `gws sheets +append --spreadsheet ID --values 'a,b,c'` |
| Agenda | `gws calendar +agenda --today` |
| Tạo event | `gws calendar +insert --summary 'X' --start T --end T` |
| Chat send | `gws chat +send --space spaces/X --text 'msg'` |
| Create slides | `gws slides presentations create --json '{"title":"T"}'` |
| Create task | `gws tasks tasks insert --params '{"tasklist":"ID"}' --json '{"title":"T"}'` |
| Tạo form | `gws forms forms create --json '{"info":{"title":"T"}}'` |
| Tạo meeting | `gws meet spaces create --json '{}'` |
| Standup | `gws workflow +standup-report` |
| Schema | `gws schema drive.files.create` |

### Tham khảo

- **Repository**: https://github.com/googleworkspace/cli
- **Skills Index**: `skills/` directory trong repo
- **MCP Server**: `gws mcp` — expose commands như MCP tools

---

*Full Guide v2 | 2026-03-10 | Source: github.com/googleworkspace/cli | For Operis Agent*
