# gws Forms — Google Forms

> Prerequisite: đọc `gws-guide-shared.md` cho auth & syntax.

## Tạo form

```bash
gws forms forms create --json '{"info": {"title": "Feedback", "documentTitle": "Feedback Form"}}'
```

## Đọc form

```bash
gws forms forms get --params '{"formId": "FORM_ID"}'
```

## Thêm câu hỏi (batchUpdate)

### Scale question

```bash
gws forms forms batchUpdate --params '{"formId": "FORM_ID"}' --json '{
  "requests": [{"createItem": {"item": {
    "title": "How satisfied are you?",
    "questionItem": {"question": {"required": true, "scaleQuestion": {"low": 1, "high": 5, "lowLabel": "Not at all", "highLabel": "Very satisfied"}}}
  }, "location": {"index": 0}}}]
}'
```

### Multiple choice (Radio)

```bash
gws forms forms batchUpdate --params '{"formId": "FORM_ID"}' --json '{
  "requests": [{"createItem": {"item": {
    "title": "Which product?",
    "questionItem": {"question": {"required": true,
      "choiceQuestion": {"type": "RADIO", "options": [{"value": "Product A"}, {"value": "Product B"}, {"value": "Other"}]}
    }}
  }, "location": {"index": 1}}}]
}'
```

## Đọc responses

```bash
gws forms forms responses list --params '{"formId": "FORM_ID"}'
```

## Question Types

| Type | Field |
|------|-------|
| Short text | `textQuestion: {}` |
| Long text | `textQuestion: {paragraph: true}` |
| Radio | `choiceQuestion: {type: "RADIO", options: [...]}` |
| Checkbox | `choiceQuestion: {type: "CHECKBOX", options: [...]}` |
| Dropdown | `choiceQuestion: {type: "DROP_DOWN", options: [...]}` |
| Scale | `scaleQuestion: {low: 1, high: 5}` |
| Date | `dateQuestion: {}` |
| Time | `timeQuestion: {}` |

## Node.js Example

```typescript
const form = gwsJson("forms", "forms", "create",
  "--json", JSON.stringify({ info: { title: "Survey" } })
);
```
