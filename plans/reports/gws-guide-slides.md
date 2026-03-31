# gws Slides — Presentations

> Prerequisite: đọc `gws-guide-shared.md` cho auth & syntax.

## Tạo presentation

```bash
gws slides presentations create --json '{"title": "Q2 Review"}'
# Response chứa presentationId
```

## Đọc presentation

```bash
gws slides presentations get --params '{"presentationId": "PRES_ID"}'
```

## Lấy thông tin page/slide

```bash
gws slides presentations pages get --params '{"presentationId": "PRES_ID", "pageObjectId": "PAGE_ID"}'
```

## Batch Update (thêm slides, nội dung)

### Thêm blank slide

```bash
gws slides presentations batchUpdate --params '{"presentationId": "PRES_ID"}' --json '{
  "requests": [
    {
      "createSlide": {
        "slideLayoutReference": {"predefinedLayout": "BLANK"}
      }
    }
  ]
}'
```

### Thêm slide với layout

```bash
gws slides presentations batchUpdate --params '{"presentationId": "PRES_ID"}' --json '{
  "requests": [
    {
      "createSlide": {
        "slideLayoutReference": {"predefinedLayout": "TITLE_AND_BODY"},
        "placeholderIdMappings": [
          {"layoutPlaceholder": {"type": "TITLE"}, "objectId": "title_1"},
          {"layoutPlaceholder": {"type": "BODY"}, "objectId": "body_1"}
        ]
      }
    }
  ]
}'
```

### Chèn text vào slide

```bash
gws slides presentations batchUpdate --params '{"presentationId": "PRES_ID"}' --json '{
  "requests": [
    {
      "insertText": {
        "objectId": "title_1",
        "text": "Quarterly Review"
      }
    },
    {
      "insertText": {
        "objectId": "body_1",
        "text": "Key metrics and achievements"
      }
    }
  ]
}'
```

### Predefined Layouts thường dùng

| Layout | Mô tả |
|--------|--------|
| `BLANK` | Slide trống |
| `TITLE` | Chỉ title |
| `TITLE_AND_BODY` | Title + body text |
| `TITLE_AND_TWO_COLUMNS` | Title + 2 cột |
| `TITLE_ONLY` | Title phía trên |
| `SECTION_HEADER` | Section divider |
| `ONE_COLUMN_TEXT` | 1 cột text |
| `BIG_NUMBER` | Số lớn |

### BatchUpdate request types thường dùng

| Request | Mô tả |
|---------|--------|
| `createSlide` | Thêm slide mới |
| `deleteObject` | Xóa slide/element |
| `insertText` | Chèn text |
| `deleteText` | Xóa text |
| `createImage` | Chèn ảnh |
| `createTable` | Tạo bảng |
| `replaceAllText` | Find & replace |
| `updateTextStyle` | Format text |
| `updatePageProperties` | Background, size |

## Export sang PDF

```bash
gws drive files export --params '{"fileId": "PRES_ID", "mimeType": "application/pdf"}' -o ./presentation.pdf
```

## Copy từ template

```bash
gws drive files copy --params '{"fileId": "TEMPLATE_ID"}' --json '{"name": "Q2 Report Slides"}'
```

## Node.js Examples

```typescript
// Tạo presentation
const pres = gwsJson("slides", "presentations", "create",
  "--json", JSON.stringify({ title: "Sprint Review" })
);

// Thêm slide + content
gwsJson("slides", "presentations", "batchUpdate",
  "--params", JSON.stringify({ presentationId: pres.presentationId }),
  "--json", JSON.stringify({
    requests: [
      { createSlide: { slideLayoutReference: { predefinedLayout: "TITLE_AND_BODY" },
        placeholderIdMappings: [
          { layoutPlaceholder: { type: "TITLE" }, objectId: "t1" },
          { layoutPlaceholder: { type: "BODY" }, objectId: "b1" }
        ]
      }},
      { insertText: { objectId: "t1", text: "Sprint 10 Review" } },
      { insertText: { objectId: "b1", text: "Completed 15/18 tasks" } }
    ]
  })
);
```
