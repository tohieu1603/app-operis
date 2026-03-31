# gws Keep — Google Keep Notes

> Prerequisite: đọc `gws-guide-shared.md` cho auth & syntax.

## Tạo note

```bash
gws keep notes create --json '{"body": {"text": {"text": "Remember to review PR #123"}}}'
```

## Liệt kê notes

```bash
gws keep notes list
```

## Đọc note

```bash
gws keep notes get --params '{"name": "notes/NOTE_ID"}'
```

## Xóa note

```bash
gws keep notes delete --params '{"name": "notes/NOTE_ID"}' --dry-run
gws keep notes delete --params '{"name": "notes/NOTE_ID"}'
```

## Node.js Example

```typescript
gwsJson("keep", "notes", "create",
  "--json", JSON.stringify({ body: { text: { text: "Important note" } } })
);
```

## Lưu ý

- API hạn chế — chủ yếu CRUD notes
- Không hỗ trợ labels, reminders, images qua API
- Caller cần `OWNER` role để delete
