# gws Classroom — Google Classroom

> Prerequisite: đọc `gws-guide-shared.md` cho auth & syntax.
> Yêu cầu: Google Workspace for Education account.

## Courses

```bash
# Liệt kê
gws classroom courses list

# Tạo
gws classroom courses create --json '{"name": "Web Dev 101", "section": "Spring 2026", "ownerId": "me"}'

# Xem chi tiết
gws classroom courses get --params '{"id": "COURSE_ID"}'

# Cập nhật
gws classroom courses patch --params '{"id": "COURSE_ID", "updateMask": "name"}' --json '{"name": "Advanced Web Dev"}'

# Xóa
gws classroom courses delete --params '{"id": "COURSE_ID"}' --dry-run
```

## Students & Teachers

```bash
# Liệt kê students
gws classroom courses students list --params '{"courseId": "COURSE_ID"}'

# Thêm student
gws classroom courses students create --params '{"courseId": "COURSE_ID"}' --json '{"userId": "student@school.edu"}'

# Thêm teacher
gws classroom courses teachers create --params '{"courseId": "COURSE_ID"}' --json '{"userId": "teacher@school.edu"}'
```

## Invitations

```bash
gws classroom invitations create --json '{"courseId": "COURSE_ID", "userId": "student@school.edu", "role": "STUDENT"}'
gws classroom invitations create --json '{"courseId": "COURSE_ID", "userId": "teacher@school.edu", "role": "TEACHER"}'
gws classroom invitations list --params '{"courseId": "COURSE_ID"}'
```

## Coursework

```bash
# Liệt kê
gws classroom courses courseWork list --params '{"courseId": "COURSE_ID"}'

# Tạo assignment
gws classroom courses courseWork create --params '{"courseId": "COURSE_ID"}' --json '{
  "title": "Homework 1", "description": "Exercises 1-5", "workType": "ASSIGNMENT",
  "maxPoints": 100, "dueDate": {"year": 2026, "month": 3, "day": 20},
  "dueTime": {"hours": 23, "minutes": 59}
}'
```

## Announcements

```bash
gws classroom courses announcements create --params '{"courseId": "COURSE_ID"}' \
  --json '{"text": "Class cancelled tomorrow due to holiday"}'
```

## Node.js Example

```typescript
const course = gwsJson("classroom", "courses", "create",
  "--json", JSON.stringify({ name: "Node.js Basics", ownerId: "me" })
);
```
