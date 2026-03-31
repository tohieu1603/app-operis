# gws Tasks — Task Lists & Tasks

> Prerequisite: đọc `gws-guide-shared.md` cho auth & syntax.

## Task Lists

### Liệt kê task lists

```bash
gws tasks tasklists list
```

### Tạo task list

```bash
gws tasks tasklists insert --json '{"title": "Sprint 10"}'
# Response chứa id
```

### Đổi tên task list

```bash
gws tasks tasklists patch --params '{"tasklist": "TASKLIST_ID"}' --json '{"title": "Sprint 11"}'
```

### Xóa task list

```bash
gws tasks tasklists delete --params '{"tasklist": "TASKLIST_ID"}' --dry-run
```

## Tasks

### Liệt kê tasks

```bash
gws tasks tasks list --params '{"tasklist": "TASKLIST_ID"}'

# Bao gồm completed tasks
gws tasks tasks list --params '{"tasklist": "TASKLIST_ID", "showCompleted": true}'
```

### Tạo task

```bash
gws tasks tasks insert --params '{"tasklist": "TASKLIST_ID"}' --json '{
  "title": "Review PR #123",
  "notes": "Check edge cases and test coverage",
  "due": "2026-03-12T00:00:00.000Z"
}'
```

### Tạo subtask

```bash
# Tạo task trước, sau đó move thành subtask
gws tasks tasks insert --params '{"tasklist": "TASKLIST_ID"}' --json '{"title": "Write unit tests"}'
# Move under parent
gws tasks tasks move --params '{"tasklist": "TASKLIST_ID", "task": "CHILD_TASK_ID", "parent": "PARENT_TASK_ID"}'
```

### Cập nhật task

```bash
gws tasks tasks patch --params '{"tasklist": "TASKLIST_ID", "task": "TASK_ID"}' \
  --json '{"title": "Updated title", "status": "completed"}'
```

### Đánh dấu hoàn thành

```bash
gws tasks tasks patch --params '{"tasklist": "TASKLIST_ID", "task": "TASK_ID"}' \
  --json '{"status": "completed"}'
```

### Xóa task

```bash
gws tasks tasks delete --params '{"tasklist": "TASKLIST_ID", "task": "TASK_ID"}'
```

### Clear completed tasks

```bash
gws tasks tasks clear --params '{"tasklist": "TASKLIST_ID"}'
```

### Di chuyển thứ tự task

```bash
# Move after specific task
gws tasks tasks move --params '{"tasklist": "TASKLIST_ID", "task": "TASK_ID", "previous": "PREV_TASK_ID"}'
```

## Node.js Examples

```typescript
// Liệt kê task lists
const lists = gwsJson("tasks", "tasklists", "list");

// Tạo task
const task = gwsJson("tasks", "tasks", "insert",
  "--params", JSON.stringify({ tasklist: listId }),
  "--json", JSON.stringify({
    title: "Deploy v2.0",
    due: "2026-03-15T00:00:00.000Z"
  })
);

// Complete task
gwsJson("tasks", "tasks", "patch",
  "--params", JSON.stringify({ tasklist: listId, task: task.id }),
  "--json", JSON.stringify({ status: "completed" })
);
```

## Lưu ý

- Max 2000 task lists per user
- Max 20,000 non-hidden tasks per list
- `due` field dùng ISO 8601 UTC: `2026-03-12T00:00:00.000Z`
- `status`: `needsAction` | `completed`
