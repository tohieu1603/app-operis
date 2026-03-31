# Google Workspace CLI (`gws`) — Deep Dive Research Report

**Date:** 2026-03-10
**Repo:** https://github.com/googleworkspace/cli
**Status:** Experimental / pre-v1.0 (expect breaking changes)
**License:** Apache-2.0
**Note:** Not officially Google-supported ("developer sample")

---

## 1. Overview

`gws` is a unified CLI for all Google Workspace APIs, **dynamically built at runtime** from Google's Discovery Service. No static command list — when Google adds an API endpoint, `gws` picks it up automatically. Every response is structured JSON, making it ideal for scripting and AI agents.

Current version: ~0.9.x. Built in **Rust**, distributed as npm package + pre-built binaries.

---

## 2. Installation

### Via npm (recommended)
```bash
npm install -g @googleworkspace/cli
```

### Binary (from GitHub Releases)
Download pre-built binary for your platform from https://github.com/googleworkspace/cli/releases

### From source (Rust)
```bash
cargo install --git https://github.com/googleworkspace/cli
```

### Gemini CLI Extension
```bash
gws auth setup
gemini extensions install https://github.com/googleworkspace/cli
```

---

## 3. Authentication

### Method A: Interactive Setup (one-time, requires gcloud CLI)
```bash
gws auth setup     # creates Cloud project, enables APIs, handles login
gws auth login     # subsequent OAuth login; use --scopes to limit
```
- Prompts scope selection; restrict to what you need:
  `gws auth login --scopes drive,gmail`
- Credentials stored encrypted (AES-256-GCM) using OS keyring (v0.9.1+)

### Method B: Manual OAuth (Google Cloud Console)
1. Create a GCP project → OAuth consent screen → add yourself as test user
2. Create **Desktop app** OAuth client → download JSON
3. Place at `~/.config/gws/client_secret.json`
4. Run `gws auth login`

### Method C: Application Default Credentials (v0.6.0+)
```bash
gcloud auth application-default login
# gws picks it up automatically — no separate gws auth login needed
```

### Method D: Environment Variables
```bash
export GOOGLE_WORKSPACE_CLI_TOKEN=$(gcloud auth print-access-token)
# OR
export GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE=/path/to/credentials.json
```

### Auth Priority Order
`GOOGLE_WORKSPACE_CLI_TOKEN` → `GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE` → encrypted creds → plaintext creds

### Common Auth Issues
| Problem | Fix |
|---------|-----|
| "Access blocked" | Add account as test user in OAuth consent screen |
| Too many scopes error | `gws auth login --scopes drive,gmail` |
| API not enabled | Follow GCP Console link in error message |
| `redirect_uri_mismatch` | Recreate OAuth client as **Desktop app** type |

---

## 4. Command Structure

```
gws <service> <resource> [sub-resource] <method> [flags]
```

- **Discovery:** `gws <service> --help` to browse resources and methods
- **Schema inspection:** `gws schema <service>.<resource>.<method>` — shows required params, types, defaults

### Global Flags

| Flag | Purpose |
|------|---------|
| `--params '{...}'` | URL/query parameters (JSON) |
| `--json '{...}'` | Request body payload (JSON) |
| `--format json\|table\|yaml\|csv` | Output format |
| `--dry-run` | Preview request without executing |
| `--page-all` | Auto-paginate, output NDJSON |
| `--page-limit <N>` | Max pages (default: 10) |
| `--page-delay <MS>` | Delay between pages (default: 100ms) |
| `--sanitize` | Scan responses with Model Armor |
| `-o / --output <PATH>` | Write binary response to file |
| `--upload <PATH>` | Multipart file upload |

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `GOOGLE_WORKSPACE_CLI_TOKEN` | Pre-obtained access token |
| `GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE` | Path to credentials JSON |
| `GOOGLE_WORKSPACE_CLI_CONFIG_DIR` | Config directory override |
| `GOOGLE_WORKSPACE_CLI_SANITIZE_TEMPLATE` | Model Armor template |

---

## 5. Drive Operations (Deep Dive)

### 5.1 Listing Files

```bash
# List 10 files
gws drive files list --params '{"pageSize": 10}'

# Search by name
gws drive files list --params '{"q": "name contains \"Report\"", "pageSize": 10, "fields": "files(id,name,mimeType)"}'

# List spreadsheets only
gws drive files list --params '{"q": "mimeType = '\''application/vnd.google-apps.spreadsheet'\''"}'

# List files in a specific folder
gws drive files list --params '{"q": "'\''FOLDER_ID'\'' in parents", "pageSize": 20}'

# Paginate all results
gws drive files list --params '{"pageSize": 100}' --page-all
```

### 5.2 Creating Folders

```bash
# Create folder in My Drive root
gws drive files create --json '{"name": "Project Files", "mimeType": "application/vnd.google-apps.folder"}'

# Create folder inside a parent folder
gws drive files create --json '{"name": "Subfolder", "mimeType": "application/vnd.google-apps.folder", "parents": ["PARENT_FOLDER_ID"]}'

# Dry-run first (always recommended for mutations)
gws drive files create --json '{"name": "Test Folder", "mimeType": "application/vnd.google-apps.folder"}' --dry-run
```

**Key:** `mimeType: "application/vnd.google-apps.folder"` — this is the magic value for folders.

### 5.3 Uploading Files

```bash
# Simple upload (helper skill)
gws drive +upload ./report.pdf
gws drive +upload ./report.pdf --parent FOLDER_ID
gws drive +upload ./data.csv --name 'Sales Data.csv' --parent FOLDER_ID

# Via raw API
gws drive files create \
  --json '{"name": "report.pdf", "parents": ["FOLDER_ID"]}' \
  --upload ./report.pdf
```

### 5.4 Downloading / Exporting

```bash
# Download file
gws drive files get --params '{"fileId": "FILE_ID", "alt": "media"}' --output ./download.pdf

# Export Google Doc as PDF
gws drive files export --params '{"fileId": "DOC_ID", "mimeType": "application/pdf"}' --output ./doc.pdf

# Export Google Sheets as CSV
gws drive files export --params '{"fileId": "SHEET_ID", "mimeType": "text/csv"}' --output ./sheet.csv
```

### 5.5 Permissions / Sharing

**Permission types:** `user` | `group` | `domain` | `anyone`
**Permission roles:** `reader` | `commenter` | `writer` | `fileOrganizer` | `organizer` | `owner`

```bash
# Share with a specific user (writer)
gws drive permissions create \
  --params '{"fileId": "FILE_OR_FOLDER_ID"}' \
  --json '{"role": "writer", "type": "user", "emailAddress": "alice@example.com"}'

# Share with a user (reader)
gws drive permissions create \
  --params '{"fileId": "FILE_OR_FOLDER_ID"}' \
  --json '{"role": "reader", "type": "user", "emailAddress": "bob@example.com"}'

# Share with a Google Group
gws drive permissions create \
  --params '{"fileId": "FILE_OR_FOLDER_ID"}' \
  --json '{"role": "writer", "type": "group", "emailAddress": "team@example.com"}'

# Share with anyone in a domain
gws drive permissions create \
  --params '{"fileId": "FILE_OR_FOLDER_ID"}' \
  --json '{"role": "reader", "type": "domain", "domain": "example.com"}'

# Make public (anyone with link)
gws drive permissions create \
  --params '{"fileId": "FILE_OR_FOLDER_ID"}' \
  --json '{"role": "reader", "type": "anyone"}'

# Share with expiry
gws drive permissions create \
  --params '{"fileId": "FILE_OR_FOLDER_ID"}' \
  --json '{"role": "reader", "type": "user", "emailAddress": "temp@example.com", "expirationTime": "2026-12-31T23:59:59Z"}'

# List existing permissions
gws drive permissions list --params '{"fileId": "FILE_OR_FOLDER_ID"}'

# Update a permission
gws drive permissions update \
  --params '{"fileId": "FILE_OR_FOLDER_ID", "permissionId": "PERM_ID"}' \
  --json '{"role": "commenter"}'

# Remove a permission
gws drive permissions delete \
  --params '{"fileId": "FILE_OR_FOLDER_ID", "permissionId": "PERM_ID"}'
```

**Schema introspection:**
```bash
gws schema drive.permissions.create
gws schema drive.files.create
```

### 5.6 Shared Drives

```bash
# List shared drives
gws drive drives list

# Create shared drive
gws drive drives create --json '{"name": "Team Drive"}'

# Get drive info
gws drive drives get --params '{"driveId": "DRIVE_ID"}'
```

### 5.7 File Metadata

```bash
# Get file metadata
gws drive files get --params '{"fileId": "FILE_ID", "fields": "id,name,mimeType,parents,permissions"}'

# Move file (update parents)
gws drive files update \
  --params '{"fileId": "FILE_ID", "addParents": "NEW_PARENT_ID", "removeParents": "OLD_PARENT_ID"}'

# Copy a file
gws drive files copy --params '{"fileId": "FILE_ID"}' --json '{"name": "Copy of File"}'

# Delete a file (trash)
gws drive files delete --params '{"fileId": "FILE_ID"}'

# Get user info and storage quota
gws drive about get --params '{"fields": "user,storageQuota"}'
```

---

## 6. Gmail Operations

### Core API commands
```bash
# List messages (with query)
gws gmail users messages list --params '{"userId": "me", "q": "from:boss@company.com is:unread"}'

# Get a specific message
gws gmail users messages get --params '{"userId": "me", "id": "MSG_ID", "fields": "id,snippet,payload.headers"}'

# List labels
gws gmail users labels list --params '{"userId": "me"}'
```

### Helper Skills (simplified interface)

```bash
# Send email
gws gmail +send --to alice@example.com --subject 'Hello' --body 'Hi Alice!'

# Inbox triage (unread summary)
gws gmail +triage
gws gmail +triage --max 5 --query 'from:boss'
gws gmail +triage --labels

# Reply (auto-handles threading)
gws gmail +reply --message-id 18f1a2b3c4d --body 'Thanks, got it!'
gws gmail +reply --message-id 18f1a2b3c4d --body 'Looping in Carol' --cc carol@example.com

# Reply-all
gws gmail +reply-all --message-id 18f1a2b3c4d --body 'Reply to everyone'

# Forward
gws gmail +forward --message-id 18f1a2b3c4d --to dave@example.com
gws gmail +forward --message-id 18f1a2b3c4d --to dave@example.com --body 'FYI' --cc eve@example.com

# Watch (stream new emails as NDJSON via Pub/Sub)
gws gmail +watch --project my-gcp-project
gws gmail +watch --project my-gcp-project --label-ids INBOX --once
gws gmail +watch --subscription projects/p/subscriptions/my-sub
```

**Note:** `+send` does NOT support HTML, attachments, or CC/BCC. Use raw `gws gmail users messages send` for those.

---

## 7. Google Docs Operations

```bash
# Create blank doc
gws docs documents create --json '{"title": "My Document"}'

# Get doc content
gws docs documents get --params '{"documentId": "DOC_ID"}'

# Append text (helper skill)
gws docs +write --document DOC_ID --text 'Hello, world!'

# Batch update (advanced formatting)
gws docs documents batchUpdate \
  --params '{"documentId": "DOC_ID"}' \
  --json '{"requests": [{"insertText": {"location": {"index": 1}, "text": "Hello"}}]}'

# Discover schema
gws schema docs.documents.batchUpdate
```

---

## 8. Google Sheets Operations

```bash
# Create spreadsheet
gws sheets spreadsheets create --json '{"properties": {"title": "Q1 Budget"}}'

# Read cells (helper skill)
gws sheets +read --spreadsheet SHEET_ID --range 'Sheet1!A1:D10'
gws sheets +read --spreadsheet SHEET_ID --range Sheet1

# Append rows (helper skill)
gws sheets +append --spreadsheet SHEET_ID --values 'Alice,100,true'
gws sheets +append --spreadsheet SHEET_ID --json-values '[["a","b"],["c","d"]]'

# Raw values API
gws sheets spreadsheets values get \
  --params '{"spreadsheetId": "ID", "range": "Sheet1!A1:C10"}'

gws sheets spreadsheets values update \
  --params '{"spreadsheetId": "ID", "range": "Sheet1!A1", "valueInputOption": "RAW"}' \
  --json '{"values": [["Name", "Score"], ["Alice", 95]]}'

# Batch update
gws sheets spreadsheets batchUpdate \
  --params '{"spreadsheetId": "ID"}' \
  --json '{"requests": [...]}'
```

**Important:** Wrap ranges in single quotes to prevent bash `!` history expansion issues.

---

## 9. Other Services

### Calendar
```bash
gws calendar +agenda [--today|--tomorrow|--week|--days N]
gws calendar +insert --summary 'Meeting' --start '2026-03-15T10:00:00Z' --end '2026-03-15T11:00:00Z' --attendee alice@example.com
gws calendar events list --params '{"calendarId": "primary", "timeMin": "2026-03-10T00:00:00Z", "maxResults": 10}'
gws calendar events quickAdd --params '{"calendarId": "primary", "text": "Lunch with Alice tomorrow at noon"}'
```

### Chat
```bash
gws chat +send --space spaces/ABC --text 'Deploy complete.'
gws chat spaces messages create \
  --params '{"parent": "spaces/xyz"}' \
  --json '{"text": "Hello from CLI"}'
```

### Admin
```bash
gws admin users list --params '{"customer": "my_customer"}'
gws admin users list --params '{"customer": "my_customer", "query": "orgUnitPath='\''/'\''"}'
```

---

## 10. MCP Server Mode

```bash
gws mcp
```

Transforms CLI into a fully-functional MCP server exposing 100+ agent skills to MCP clients (Claude Desktop, VS Code, Gemini CLI, etc.).

---

## 11. Repo Structure

```
/
├── src/              — Rust source (two-phase CLI parsing + Discovery Service integration)
├── skills/           — SKILL.md files for each helper skill
│   ├── gws-shared/   — Auth + global flags (MUST READ before using other skills)
│   ├── gws-drive/
│   ├── gws-drive-upload/
│   ├── gws-gmail/
│   ├── gws-gmail-send/
│   ├── gws-gmail-triage/
│   ├── gws-gmail-reply/
│   ├── gws-gmail-reply-all/
│   ├── gws-gmail-forward/
│   ├── gws-gmail-watch/
│   ├── gws-docs/
│   ├── gws-docs-write/
│   ├── gws-sheets/
│   ├── gws-sheets-append/
│   └── gws-sheets-read/
├── docs/             — skills.md, recipes, additional guides
├── registry/         — cached Discovery Documents
├── templates/        — Model Armor security templates
├── scripts/          — build automation
├── README.md
├── CLAUDE.md         — Claude AI agent integration guide
├── AGENTS.md         — architecture/dev guide
├── CHANGELOG.md
└── gemini-extension.json
```

---

## 12. Key Design Principles

- **Dynamic discovery:** No hardcoded commands — fetched from Google Discovery Service, cached 24h
- **Two-phase parsing:** Service identified first → Discovery Doc fetched → command tree built → args re-parsed → request executed
- **AI-first output:** All responses are JSON; designed for LLM consumption
- **Security:** Never output secrets; always confirm write/delete; use `--dry-run` before mutations; `--sanitize` for regulated data
- **Corporate TLS:** v0.9.0 uses native OS cert store (works behind corporate CAs)
- **Pagination:** `--page-all` auto-paginates as NDJSON; `--page-limit` caps pages

---

## 13. Limitations & Gotchas

- Pre-v1.0: breaking changes expected
- Not official Google product — no SLA
- `+send` helper doesn't support HTML, attachments, or CC/BCC — use raw API
- File `parents` only accepts one parent (no multi-parent)
- `gws auth setup` requires `gcloud` CLI to be installed
- Gmail watch expires after 7 days (requires renewal)
- Bash `!` in ranges causes history expansion — always single-quote ranges in Sheets
- Multi-account support was simplified in v0.7.0 — currently single-account focus

---

## Unresolved Questions

1. Does `gws drive permissions create` support `sendNotificationEmail: false` via `--params`? (likely yes — schema inspection needed: `gws schema drive.permissions.create`)
2. What is the exact SKILL.md path convention for loading skills into OpenClaw/Operis vs native gws invocation?
3. Can the MCP server mode (`gws mcp`) be embedded as a long-running process within the Operis gateway, or does it require a separate process?
4. Are there rate limits enforced client-side, or does it rely entirely on Google's 429 responses?
5. v0.9.x changelog mentions multi-account was removed in v0.7.0 — is there a workaround via `GOOGLE_WORKSPACE_CLI_CONFIG_DIR` for different account contexts?

---

## Sources

- [GitHub: googleworkspace/cli](https://github.com/googleworkspace/cli)
- [npm: @googleworkspace/cli](https://www.npmjs.com/package/@googleworkspace/cli)
- [Google Drive API: Manage Sharing](https://developers.google.com/workspace/drive/api/guides/manage-sharing)
- [Google Drive API: Create Folders](https://developers.google.com/workspace/drive/api/guides/folder)
- [Google Drive API: Roles & Permissions](https://developers.google.com/workspace/drive/api/guides/ref-roles)
- [Heise: Google launches CLI tool](https://www.heise.de/en/news/Control-Gmail-Docs-and-Calendar-via-Terminal-Google-launches-CLI-tool-11204302.html)
- [OnMSFT: OpenClaw + gws integration](https://onmsft.com/news/openclaw-can-now-connect-with-gmail-drive-and-docs-using-googles-new-cli/)
- [Geeky Gadgets: Drive, Gmail & Slides for AI Agents](https://www.geeky-gadgets.com/google-workspace-cli/)
- [Techzine: CLI for AI agents](https://www.techzine.eu/news/applications/139374/google-cli-simplifies-workspace-for-ai-agents/)
- [Hacker News discussion](https://news.ycombinator.com/item?id=47255881)
- [SufZen Skills: SKILL.md](https://github.com/SufZen/Skills/blob/main/googleworkspace-cli/SKILL.md)
- [shartech.cloud: automation guide](https://blog.shartech.cloud/google-workspace-cli-automation-guide/)
