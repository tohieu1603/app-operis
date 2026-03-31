# gws Docs — Google Documents Operations

> Prerequisite: đọc `gws-guide-shared.md` cho auth & syntax.

## Tạo document

```bash
gws docs documents create --json '{"title": "Meeting Notes 2026-03-10"}'
# Response chứa documentId
```

## Đọc document

```bash
gws docs documents get --params '{"documentId": "DOC_ID"}'
```

## Ghi text (Helper)

```bash
# Append text vào cuối document
gws docs +write --document DOC_ID --text 'Hello, this is appended text.'
```

| Flag | Required | Mô tả |
|------|----------|--------|
| `--document` | Yes | Document ID |
| `--text` | Yes | Text cần append |

> Text chèn cuối document body. Cho rich formatting → dùng batchUpdate.

## Batch Update (Rich formatting)

### Chèn text tại vị trí

```bash
gws docs documents batchUpdate --params '{"documentId": "DOC_ID"}' --json '{
  "requests": [
    {
      "insertText": {
        "location": {"index": 1},
        "text": "Heading\n\nBody paragraph.\n"
      }
    }
  ]
}'
```

### Chèn text + bold

```bash
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

### BatchUpdate request types thường dùng

| Request | Mô tả |
|---------|--------|
| `insertText` | Chèn text tại index |
| `deleteContentRange` | Xóa nội dung trong range |
| `updateTextStyle` | Bold, italic, fontSize, foregroundColor |
| `updateParagraphStyle` | Heading, alignment, spacing |
| `insertTable` | Chèn bảng |
| `insertInlineImage` | Chèn ảnh |
| `replaceAllText` | Find & replace |

## Recipe: Tạo doc từ template + share

```bash
# 1. Copy template
gws drive files copy --params '{"fileId": "TEMPLATE_ID"}' --json '{"name": "Weekly Report W10"}'
# → NEW_DOC_ID

# 2. Ghi nội dung
gws docs +write --document NEW_DOC_ID --text 'Summary: All tasks done.'

# 3. Share
gws drive permissions create \
  --params '{"fileId": "NEW_DOC_ID"}' \
  --json '{"role": "writer", "type": "user", "emailAddress": "manager@co.com"}'
```

## Node.js Examples

```typescript
// Tạo document
const doc = gwsJson("docs", "documents", "create",
  "--json", JSON.stringify({ title: "Meeting Notes" })
);

// Ghi text
gws("docs", "+write", "--document", doc.documentId, "--text", "Action items:\n1. Review PR\n2. Deploy");

// Batch update
gwsJson("docs", "documents", "batchUpdate",
  "--params", JSON.stringify({ documentId: doc.documentId }),
  "--json", JSON.stringify({
    requests: [{
      insertText: { location: { index: 1 }, text: "Meeting Notes\n" }
    }]
  })
);
```
