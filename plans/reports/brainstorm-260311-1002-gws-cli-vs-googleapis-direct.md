# Brainstorm: gws CLI vs googleapis Direct API — So sánh tích hợp Google Workspace

**Date:** 2026-03-11
**Context:** Agent Operis cần tích hợp Google Workspace (Drive, Gmail, Docs, Sheets, Calendar...) cho AI agents. So sánh 2 approach: gws CLI (spawn process) vs googleapis npm (direct API call).

---

## 1. Tổng quan 2 approach

### Approach A: gws CLI (spawn process)
- **gws** = Rust binary, community project (Justin Poehnelt, ko official Google)
- Gọi qua `execFileSync("gws.exe", [...args])` từ Node.js
- Dynamic command surface — tự build từ Google Discovery Service
- Auth: OAuth interactive, Service Account JSON, env var token

### Approach B: googleapis npm (direct API)
- **googleapis** = Official Google Node.js client, full TypeScript
- Import trực tiếp: `google.drive({ version: 'v3', auth })`
- Typed API methods, auto token refresh, streaming support
- Auth: Service Account JSON, JWT w/ DWD impersonation, ADC, OAuth

---

## 2. So sánh chi tiết

| Tiêu chí | gws CLI (spawn) | googleapis (direct) | Winner |
|----------|-----------------|---------------------|--------|
| **Setup** | `npm i -g @googleworkspace/cli` | `npm i googleapis` hoặc `@googleapis/drive` | Tie |
| **Auth: Service Account** | ✅ env var `CREDENTIALS_FILE` | ✅ `GoogleAuth` / `JWT` | Tie |
| **Auth: Domain-Wide Delegation** | ❌ **KHÔNG HỖ TRỢ** | ✅ `JWT({ subject: user })` | **googleapis** |
| **Auth: User impersonation** | ❌ workaround: mint token ngoài | ✅ native | **googleapis** |
| **Auth: Token refresh** | ✅ tự động (1h, cached AES) | ✅ tự động (transparent) | Tie |
| **TypeScript types** | ❌ parse JSON raw | ✅ full generated types | **googleapis** |
| **Latency per call** | 30–100ms overhead/call | ~0ms (reuse HTTP conn) | **googleapis** |
| **First cold call** | 500ms–2s (fetch Discovery) | ~200ms (first HTTP) | **googleapis** |
| **Memory** | OS process overhead mỗi call | ~50MB một lần cho process | **googleapis** |
| **Streaming (large files)** | ❌ file-based, buffer to stdout | ✅ native Node.js streams | **googleapis** |
| **Batch requests** | ❌ không hỗ trợ | ✅ raw batch API (100 ops/req) | **googleapis** |
| **Rate limit retry** | ❌ caller tự implement | ❌ caller tự implement (gaxios basic) | Tie |
| **Pagination** | ✅ `--page-all` (NDJSON) | Manual (loop nextPageToken) | **gws** |
| **Error reporting** | ✅ structured JSON stderr | ✅ exception w/ status code | Tie |
| **API coverage** | ✅ ALL Google APIs (Discovery) | ✅ ALL Google APIs | Tie |
| **Schema discovery** | ✅ `gws schema drive.files.create` | Nhìn TypeScript types | **gws** |
| **Dry-run** | ✅ `--dry-run` preview | ❌ không có | **gws** |
| **Developer Experience** | Dễ test CLI, dễ debug | IDE autocomplete, type-safe | Context-dependent |
| **Stability** | Community, v0.11.1, có bugs | Official Google, stable | **googleapis** |
| **Concurrent calls** | Mỗi call = process mới | Promise.all, connection pool | **googleapis** |
| **Long-running (watch)** | ❌ token expiry bug ~1h | ✅ auto refresh | **googleapis** |

---

## 3. Điểm yếu nghiêm trọng của gws CLI

### 3.1 Không có Domain-Wide Delegation (DWD)
- **Hệ quả:** SA không thể impersonate user → ko truy cập Gmail, Calendar, personal Drive của user
- **Workaround:** Mint token bằng `google-auth-library` → pass qua `GOOGLE_WORKSPACE_CLI_TOKEN`
- **Nhận xét:** Workaround phức tạp, token hết hạn sau 1h, phải tự manage lifecycle

### 3.2 Process spawn overhead
- Mỗi API call = spawn 1 process gws.exe → 30-100ms overhead
- 100 calls = 3-10 giây chỉ riêng overhead (chưa tính network)
- Không thể batch requests

### 3.3 Post-April 2025: SA mới ko access My Drive
- SA tạo sau 15/04/2025 chỉ access Shared Drives, ko My Drive
- Áp dụng cả gws CLI lẫn googleapis → cần DWD để bypass → gws ko có DWD

---

## 4. Điểm mạnh của gws CLI

### 4.1 Agent-friendly UX
- LLM dễ construct CLI commands hơn viết code
- Schema introspection: `gws schema` → agent tự discover API
- `--dry-run` → safe preview trước khi mutate
- `--fields` → tiết kiệm token output

### 4.2 Zero-code integration
- Không cần viết TypeScript wrapper cho mỗi API
- Thêm service mới = thêm args, ko cần code mới
- Helper commands (`+upload`, `+send`, `+triage`) giảm complexity

### 4.3 Skills ecosystem
- 100+ SKILL.md files → agent đọc skill file → biết cách dùng
- Recipes cho cross-service workflows

---

## 5. Điểm mạnh của googleapis direct

### 5.1 Performance
- Zero process overhead, HTTP connection reuse
- Streaming cho file lớn (upload/download)
- Batch API: 100 operations/request

### 5.2 Full auth control
- DWD impersonation native
- Per-user JWT clients
- Token auto-refresh transparent

### 5.3 Type safety & IDE support
- Full TypeScript generated types
- IDE autocomplete cho mọi method
- Compile-time error detection

### 5.4 Production-grade
- Official Google support
- Battle-tested, stable releases
- Better error handling patterns

---

## 6. Hybrid Approach (ĐỀ XUẤT)

> **Dùng cả hai, mỗi cái cho đúng use case.**

### Layer 1: googleapis direct — Server core
```
Agent Server (Node.js)
├── google-workspace-service.ts    ← googleapis + Service Account + DWD
│   ├── drive.ts                   ← typed Drive operations
│   ├── gmail.ts                   ← typed Gmail operations (DWD required)
│   ├── sheets.ts                  ← typed Sheets operations
│   ├── calendar.ts                ← typed Calendar operations (DWD required)
│   └── docs.ts                    ← typed Docs operations
└── auth/
    ├── service-account.ts         ← SA config, key management
    └── impersonation.ts           ← per-user JWT factory (DWD)
```

**Dùng googleapis khi:**
- Cần DWD / impersonation (Gmail, Calendar, user Drive)
- High-frequency operations (>10 calls/task)
- Streaming large files
- Batch operations
- Production API calls từ server

### Layer 2: gws CLI — Agent exploration & ad-hoc
```
AI Agent (skill execution)
├── gws-guide-*.md                 ← Agent reads skill docs
├── execFileSync("gws.exe", ...)   ← Quick one-off queries
└── --dry-run / --schema           ← Discovery & safety preview
```

**Dùng gws khi:**
- Agent cần explore API lạ (schema discovery)
- One-off queries, debugging, testing
- Dry-run preview trước mutating ops
- Agent skill execution (LLM-friendly CLI)
- Quick prototyping / ad-hoc tasks

### Mint Token Bridge (khi cần DWD qua gws)
```typescript
// Khi agent cần gws CLI nhưng cần DWD access:
import { JWT } from 'google-auth-library';

async function mintTokenForGws(userEmail: string, scopes: string[]): Promise<string> {
  const jwt = new JWT({
    email: process.env.SA_EMAIL,
    key: process.env.SA_KEY.replace(/\\n/g, '\n'),
    scopes,
    subject: userEmail,
  });
  const { token } = await jwt.getAccessToken();
  return token!;
}

// Pass to gws
const token = await mintTokenForGws('user@co.com', ['https://www.googleapis.com/auth/drive']);
execFileSync('gws.exe', ['drive', 'files', 'list', ...], {
  env: { ...process.env, GOOGLE_WORKSPACE_CLI_TOKEN: token },
});
```

---

## 7. Decision Matrix

| Scenario | Recommendation |
|----------|---------------|
| Server-side CRUD (Drive, Sheets, Docs) | **googleapis** — performance, types |
| Gmail send/read | **googleapis** — DWD required |
| Calendar management | **googleapis** — DWD required |
| Agent exploring new API | **gws CLI** — schema discovery |
| Agent quick one-off query | **gws CLI** — simple, fast to construct |
| Dry-run safety check | **gws CLI** — `--dry-run` built-in |
| File upload >100MB | **googleapis** — streaming |
| Batch operations (>10 calls) | **googleapis** — batch API |
| Multi-user workspace admin | **googleapis** — per-user JWT |
| Prototyping & testing | **gws CLI** — zero code setup |
| CI/CD automation | Either — both support headless |

---

## 8. Implementation Priority

### Phase 1: googleapis core (HIGH PRIORITY)
1. Setup Service Account + DWD trong Google Admin Console
2. Implement `google-workspace-service.ts` với typed wrappers
3. Drive, Gmail, Sheets, Calendar — 4 services chính
4. Retry logic (exponential backoff)
5. Per-user JWT factory cho DWD

### Phase 2: gws CLI integration (MEDIUM)
1. Giữ nguyên gws guides đã tạo → agent skills
2. Implement mint-token bridge cho DWD workaround
3. Agent uses gws cho schema discovery & dry-run

### Phase 3: Optimization (LOW)
1. Connection pooling tuning
2. Batch API cho bulk operations
3. Streaming large file handling
4. Rate limit monitoring

---

## 9. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| gws CLI ko stable (v0.11, community) | Agent skill failures | Fallback to googleapis direct |
| DWD scope mismatch in Admin Console | 403 errors | Strict scope documentation |
| Post-04/2025 My Drive restriction | SA can't access user files | Use DWD impersonation (googleapis) |
| gws token expiry in long tasks | Stale token errors | Mint fresh token per task |
| Rate limiting (especially Gmail) | 429 errors | Exponential backoff + quota monitoring |
| Service Account key leak | Security breach | Env vars, Secret Manager, key rotation |

---

## 10. Kết luận

**googleapis direct là foundation bắt buộc** — DWD, performance, type safety ko thể thay thế.

**gws CLI là supplementary tool** — tuyệt vời cho agent exploration, prototyping, dry-run. Nhưng KHÔNG đủ làm core integration do thiếu DWD.

**Hybrid approach** cho best of both worlds: production reliability từ googleapis + developer/agent experience từ gws CLI.

---

## Unresolved Questions

1. **Post-04/2025 My Drive restriction** — có áp dụng cho DWD-impersonated access ko, hay chỉ SA's own Drive?
2. **Gmail send quota under DWD** — mỗi impersonated user có quota riêng hay chung project?
3. **gws DWD support timeline** — có PR/issue nào cho DWD trong gws CLI ko?
4. **Workload Identity Federation** — có cần thiết cho production hay SA key file đủ?
5. **Agent token lifecycle** — nên mint token mới mỗi task hay cache và refresh?
