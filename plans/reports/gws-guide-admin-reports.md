# gws Admin Reports — Audit & Usage

> Prerequisite: đọc `gws-guide-shared.md` cho auth & syntax.
> Yêu cầu: Google Workspace admin account.

## Activity Logs

```bash
# Admin console activities
gws admin-reports activities list --params '{"userKey": "all", "applicationName": "admin"}'

# Drive audit logs
gws admin-reports activities list --params '{"userKey": "all", "applicationName": "drive"}'

# Gmail audit
gws admin-reports activities list --params '{"userKey": "all", "applicationName": "gmail"}'

# Login audit
gws admin-reports activities list --params '{"userKey": "all", "applicationName": "login"}'

# Filter by user
gws admin-reports activities list --params '{"userKey": "user@company.com", "applicationName": "drive"}'
```

## Application Names

| App | Mô tả |
|-----|--------|
| `admin` | Admin console changes |
| `drive` | Drive file operations |
| `gmail` | Gmail settings changes |
| `login` | Login/logout events |
| `calendar` | Calendar changes |
| `token` | OAuth token grants |
| `groups` | Groups modifications |
| `chat` | Chat activities |

## Usage Reports

```bash
# Org-wide usage
gws admin-reports customerUsageReports get --params '{"date": "2026-03-09"}'

# User usage
gws admin-reports userUsageReport get --params '{"userKey": "all", "date": "2026-03-09"}'

# Entity usage
gws admin-reports entityUsageReports get --params '{"entityType": "gplus_communities", "date": "2026-03-09"}'
```

## Node.js Example

```typescript
const logs = gwsJson("admin-reports", "activities", "list",
  "--params", JSON.stringify({ userKey: "all", applicationName: "drive" })
);
```

## Lưu ý

- Date format: `YYYY-MM-DD`
- Max 180 ngày trước
- Chỉ admin accounts mới truy cập được
