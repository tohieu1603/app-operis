# gws Sheets — Spreadsheet Operations

> Prerequisite: đọc `gws-guide-shared.md` cho auth & syntax.

## Tạo spreadsheet

```bash
gws sheets spreadsheets create --json '{"properties": {"title": "Q1 Budget"}}'
# Response chứa spreadsheetId
```

## Đọc dữ liệu (Helper)

```bash
gws sheets +read --spreadsheet ID --range 'Sheet1!A1:D10'
gws sheets +read --spreadsheet ID --range Sheet1     # Toàn bộ sheet
```

| Flag | Required | Mô tả |
|------|----------|--------|
| `--spreadsheet` | Yes | Spreadsheet ID |
| `--range` | Yes | Range (vd: `Sheet1!A1:B2`) |

## Đọc dữ liệu (Raw API)

```bash
gws sheets spreadsheets values get \
  --params '{"spreadsheetId": "ID", "range": "Sheet1!A1:C10"}'
```

## Append dữ liệu (Helper)

```bash
# 1 dòng
gws sheets +append --spreadsheet ID --values 'Alice,100,true'

# Nhiều dòng
gws sheets +append --spreadsheet ID --json-values '[["Name","Score"],["Alice",95],["Bob",87]]'
```

| Flag | Mô tả |
|------|--------|
| `--spreadsheet` | Spreadsheet ID (required) |
| `--values` | Comma-separated (1 dòng) |
| `--json-values` | JSON array of rows (nhiều dòng) |

## Append (Raw API)

```bash
gws sheets spreadsheets values append \
  --params '{"spreadsheetId": "ID", "range": "Sheet1!A1", "valueInputOption": "USER_ENTERED"}' \
  --json '{"values": [["Name", "Score"], ["Alice", 95]]}'
```

### valueInputOption

| Option | Mô tả |
|--------|--------|
| `RAW` | Giữ nguyên input (string) |
| `USER_ENTERED` | Parse như nhập trên UI (nhận diện number, date, formula) |

## Cập nhật dữ liệu

```bash
gws sheets spreadsheets values update \
  --params '{"spreadsheetId": "ID", "range": "Sheet1!A1:B2", "valueInputOption": "USER_ENTERED"}' \
  --json '{"values": [["Updated Name", "Updated Score"]]}'
```

## Metadata spreadsheet

```bash
gws sheets spreadsheets get --params '{"spreadsheetId": "ID"}' \
  --fields 'spreadsheetId,properties.title,sheets.properties'
```

## Batch Update

### Thêm sheet mới

```bash
gws sheets spreadsheets batchUpdate --params '{"spreadsheetId": "ID"}' --json '{
  "requests": [{"addSheet": {"properties": {"title": "March 2026"}}}]
}'
```

### Copy sheet

```bash
gws sheets spreadsheets batchUpdate --params '{"spreadsheetId": "ID"}' --json '{
  "requests": [{"duplicateSheet": {"sourceSheetId": 0, "newSheetName": "April 2026"}}]
}'
```

### BatchUpdate request types thường dùng

| Request | Mô tả |
|---------|--------|
| `addSheet` | Thêm sheet mới |
| `duplicateSheet` | Copy sheet |
| `deleteSheet` | Xóa sheet |
| `updateSheetProperties` | Đổi tên, ẩn sheet |
| `autoResizeDimensions` | Tự resize cột/hàng |
| `repeatCell` | Áp dụng format cho range |
| `mergeCells` | Merge cells |

## Export CSV

```bash
gws drive files export --params '{"fileId": "SPREADSHEET_ID", "mimeType": "text/csv"}' -o ./backup.csv
```

## Node.js Examples

```typescript
// Tạo spreadsheet
const sheet = gwsJson("sheets", "spreadsheets", "create",
  "--json", JSON.stringify({ properties: { title: "Budget Tracker" } })
);

// Đọc
const data = gwsJson("sheets", "+read",
  "--spreadsheet", sheet.spreadsheetId,
  "--range", "Sheet1!A1:D10"
);

// Append 1 dòng
gws("sheets", "+append", "--spreadsheet", sheet.spreadsheetId, "--values", "Alice,100,true");

// Append nhiều dòng
gws("sheets", "+append",
  "--spreadsheet", sheet.spreadsheetId,
  "--json-values", JSON.stringify([["Name","Score"],["Bob",87]])
);
```

## Lưu ý

- Range dùng `!` (Sheet1!A1) — khi gọi qua shell cần single quotes, qua execFileSync không cần escape
- `valueInputOption: "USER_ENTERED"` parse number/date/formula tự động
- `sourceSheetId: 0` = sheet đầu tiên (index-based)
