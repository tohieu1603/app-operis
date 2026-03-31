# gws People — Contacts & Profiles

> Prerequisite: đọc `gws-guide-shared.md` cho auth & syntax.

## Contacts

### Tạo contact

```bash
gws people people createContact --json '{
  "names": [{"givenName": "Alice", "familyName": "Nguyen"}],
  "emailAddresses": [{"value": "alice@company.com"}],
  "phoneNumbers": [{"value": "+84901234567"}],
  "organizations": [{"name": "Acme Corp", "title": "Developer"}]
}'
```

### Lấy profile (me)

```bash
gws people people get --params '{"resourceName": "people/me", "personFields": "names,emailAddresses,phoneNumbers"}'
```

### Lấy profile người khác

```bash
gws people people get --params '{"resourceName": "people/PERSON_ID", "personFields": "names,emailAddresses"}'
```

### Tìm contacts

```bash
gws people people searchContacts --params '{"query": "Alice", "readMask": "names,emailAddresses"}'
```

### Cập nhật contact

```bash
gws people people updateContact --params '{"resourceName": "people/PERSON_ID", "updatePersonFields": "phoneNumbers"}' \
  --json '{"phoneNumbers": [{"value": "+84909876543"}]}'
```

### Liệt kê contacts

```bash
gws people people connections list --params '{"resourceName": "people/me", "personFields": "names,emailAddresses", "pageSize": 50}'
```

### Batch tạo contacts

```bash
gws people people batchCreateContacts --json '{
  "contacts": [
    {"contactPerson": {"names": [{"givenName": "Bob"}], "emailAddresses": [{"value": "bob@co.com"}]}},
    {"contactPerson": {"names": [{"givenName": "Carol"}], "emailAddresses": [{"value": "carol@co.com"}]}}
  ],
  "readMask": "names,emailAddresses"
}'
```

## Contact Groups

```bash
# Liệt kê groups
gws people contactGroups list

# Tạo group
gws people contactGroups create --json '{"contactGroup": {"name": "Dev Team"}}'

# Thêm member vào group
gws people contactGroups members modify \
  --params '{"resourceName": "contactGroups/GROUP_ID"}' \
  --json '{"resourceNamesToAdd": ["people/PERSON_ID"]}'
```

## Directory (Domain users)

```bash
# Tìm trong domain directory
gws people people searchDirectoryPeople --params '{"query": "alice", "readMask": "names,emailAddresses", "sources": ["DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE"]}'

# Liệt kê domain profiles
gws people people listDirectoryPeople --params '{"readMask": "names,emailAddresses", "sources": ["DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE"]}'
```

## Node.js Examples

```typescript
// Tìm contact
const results = gwsJson("people", "people", "searchContacts",
  "--params", JSON.stringify({ query: "Alice", readMask: "names,emailAddresses" })
);

// Tạo contact
gwsJson("people", "people", "createContact",
  "--json", JSON.stringify({
    names: [{ givenName: "Dave", familyName: "Tran" }],
    emailAddresses: [{ value: "dave@company.com" }]
  })
);
```

## Lưu ý

- `personFields` / `readMask` **bắt buộc** — luôn chỉ định fields cần lấy
- Warmup request cần trước `searchContacts`: gọi 1 lần với query rỗng
- Mutate requests cho cùng user nên gửi tuần tự (tránh race condition)
