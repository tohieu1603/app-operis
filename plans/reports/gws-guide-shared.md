# gws CLI — Shared Reference (Auth, Syntax, Node.js)

## Cài đặt

```bash
npm install -g @googleworkspace/cli
```

Yêu cầu: Node.js 18+, Google Cloud Project, Google account.

## Xác thực

### Setup nhanh (cần gcloud)

```bash
gws auth setup          # Tạo project, enable APIs, login
gws auth login -s drive,gmail,sheets,docs   # Login với scope cụ thể
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
| `GOOGLE_WORKSPACE_CLI_CONFIG_DIR` | Thư mục config (default: `~/.config/gws`) | — |

### Headless/CI

```bash
gws auth export --unmasked > credentials.json              # Máy có browser
export GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE=./creds.json  # Máy headless
```

## Cú pháp

```
gws <service> <resource> [sub-resource] <method> [flags]
```

## Flags toàn cục

| Flag | Mô tả |
|------|--------|
| `--params '{"key":"val"}'` | URL/query parameters |
| `--json '{"key":"val"}'` | Request body |
| `--upload <PATH>` | Upload file (multipart) |
| `-o, --output <PATH>` | Lưu binary ra file |
| `--dry-run` | Preview, không thực thi |
| `--page-all` | Tự động phân trang (NDJSON) |
| `--page-limit <N>` | Giới hạn trang (default: 10) |
| `--fields '<MASK>'` | Giới hạn response fields (tiết kiệm token) |
| `--format <FMT>` | `json` (default), `table`, `yaml`, `csv` |

## Schema Introspection

```bash
gws schema drive.files.create
gws schema drive.permissions.create
gws schema gmail.users.messages.send
```

## Help

```bash
gws drive --help
gws drive files create --help
```

## Node.js execFileSync Pattern

```typescript
import { execFileSync } from "child_process";

function gws(...args: string[]): string {
  return execFileSync("gws.exe", args, { encoding: "utf-8", timeout: 30000 });
}

function gwsJson<T = any>(...args: string[]): T {
  return JSON.parse(gws(...args));
}
```

### Ví dụ

```typescript
const files = gwsJson("drive", "files", "list",
  "--params", JSON.stringify({ pageSize: 10 }),
  "--fields", "files(id,name,mimeType)"
);
```

### Lưu ý

- Dùng `JSON.stringify()` cho `--params`/`--json` — đảm bảo JSON hợp lệ
- Không cần escape JSON vì args truyền trực tiếp, không qua shell
- Wrap try-catch, `error.stderr` chứa error message
- **LUÔN** dùng `--fields` khi list/get → giới hạn response
- **LUÔN** dùng `--dry-run` trước mutating operations

## MimeTypes thường dùng

| Type | MimeType |
|------|----------|
| Folder | `application/vnd.google-apps.folder` |
| Docs | `application/vnd.google-apps.document` |
| Sheets | `application/vnd.google-apps.spreadsheet` |
| Slides | `application/vnd.google-apps.presentation` |
| PDF | `application/pdf` |
| CSV | `text/csv` |
