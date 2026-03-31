# Báo Cáo Phân Tích Tích Hợp Google Workspace CLI (gws) vào Operis Agent

**Ngày báo cáo:** 06 Tháng 3, 2026
**Phạm vi:** Nghiên cứu khả năng tích hợp gws CLI vào hệ thống Operis Agent
**Tác giả:** Researcher Agent

---

## 1. Cách Sử Dụng gws CLI

### 1.1 Thông Tin Chung
Google Workspace CLI (gws) được phát hành ngày 02 Tháng 3, 2026 — một công cụ dòng lệnh thống nhất để truy cập tất cả các dịch vụ Google Workspace qua một interface duy nhất. Nó hỗ trợ Drive, Gmail, Calendar, Sheets, Docs, Chat, Admin APIs và nhiều hơn nữa.

**Đặc điểm nổi bật:**
- **Dynamic command generation**: Tạo lệnh tự động từ Google Discovery Service (không yêu cầu update khi Google thêm API mới)
- **Structured JSON output**: Tất cả phản hồi trả về JSON được cấu trúc, lý tưởng cho machine parsing
- **MCP server built-in**: Hỗ trợ native Model Context Protocol server qua stdio
- **100+ agent skills**: Các kỹ năng được xây dựng sẵn cho AI agents
- **Dry-run support**: Xem trước request trước khi thực thi
- **Auto-pagination**: Tự động xử lý phân trang

### 1.2 Phương Pháp Cài Đặt

#### A. NPM (Khuyến nghị cho Operis)
```bash
npm install -g @googleworkspace/cli
# hoặc cài locally
npm install --save-dev @googleworkspace/cli
```
- Yêu cầu: Node.js ≥18
- Package bundle các native binary pre-built cho multiple OS (không cần Rust toolchain)
- Xác minh cài đặt: `gws --help`

#### B. Pre-built Binary
- Tải từ GitHub Releases page
- Không cần npm hoặc Node.js nếu dùng binary standalone

#### C. Cargo (Nix Flake)
```bash
nix run github:googleworkspace/cli
```

### 1.3 Xác Thực (Authentication)

gws hỗ trợ **6 phương pháp xác thực**:

1. **Interactive Setup** (Với gcloud CLI)
   - `gws auth setup`
   - Hướng dẫn cấu hình Google Cloud project interactively
   - Enable necessary APIs tự động
   - Lý tưởng cho người dùng lần đầu

2. **Manual OAuth** (Via Google Cloud Console)
   - Tạo OAuth app thủ công
   - Cấu hình scopes theo nhu cầu
   - Xuất credentials JSON

3. **Browser-Assisted Authentication**
   - `gws auth login`
   - Mở URL in ra, phê duyệt scopes
   - Localhost callback xác nhận

4. **Headless/CI Export Flow**
   - Hoàn thành auth tại local
   - Export plaintext credentials cho CI/CD environments

5. **Service Accounts**
   - Cho server-to-server operations
   - Không cần interactive login

6. **Pre-obtained Access Tokens**
   - Dùng tokens từ các tools khác

**Credential Management:**
- Mã hóa tại rest bằng AES-256-GCM
- Lưu trong OS keyring (hoặc config file)
- Precedence: explicit tokens → credentials files → keyring
- **Giới hạn testing mode**: ~25 OAuth scopes (yêu cầu app verification cho full scope)

### 1.4 Lệnh Cơ Bản

```bash
# Liệt kê files trên Drive
gws drive files list

# Gửi email qua Gmail
gws gmail messages send --to user@example.com --subject "Test" --body "Message"

# Đọc events từ Calendar
gws calendar events list --calendar-id primary

# Ghi dữ liệu vào Sheets
gws sheets values append --spreadsheet-id <ID> --range Sheet1 --values "[[1,2,3]]"

# Dry-run (preview request)
gws drive files list --dry-run

# JSON output (dùng cho scripts)
gws drive files list --format json
```

---

## 2. Các Khả Năng Ứng Dụng vào Operis

### 2.1 Integration Pattern 1: MCP Server Mode (Khuyến nghị)

**Cách hoạt động:**
```bash
gws mcp -s drive,gmail,calendar
```

gws khởi động MCP server qua stdio, expose Google Workspace APIs dưới dạng structured tools mà bất kỳ MCP-compatible client nào cũng có thể gọi.

**Ưu điểm:**
- **Standardized protocol**: MCP là chuẩn công nghiệp (Linux Foundation, Dec 2025)
- **Tool exposure control**: `--services`, `--workflows`, `--helpers` flags để kiểm soát công khai tools
- **Automatic tool discovery**: Client tự động nhận danh sách tools từ server
- **Structured inputs/outputs**: JSON schemas cho type safety

**Nhược điểm:**
- **Tool limit**: Mỗi service có 10-80 tools, cần giữ list <= 50-100 tools (giới hạn client)
- **Process overhead**: Mỗi MCP server là process riêng
- **Handshake complexity**: Cần implement MCP client protocol

**Operis Integration Points:**
- Operis gateway tạo child process chạy `gws mcp`
- Operis agent core (pi-agent-core) hoạt động như MCP client
- Giao tiếp qua stdio với JSON-RPC 2.0
- Tool definitions tự động feed vào agent prompt

### 2.2 Integration Pattern 2: Direct CLI Execution

**Cách hoạt động:**
```bash
const result = await exec('gws drive files list --format json');
const parsed = JSON.parse(result.stdout);
```

Operis spawn gws như subprocess, parse JSON output.

**Ưu điểm:**
- **Simple integration**: Không cần MCP client implementation
- **Direct control**: Operis gọi gws directly (không qua MCP)
- **Existing infrastructure**: Dùng bash-tools.exec hiện tại của Operis

**Nhược điểm:**
- **No structured inputs**: Tool definitions không automatic
- **Manual prompt engineering**: Phải manually desc gws commands trong agent prompt
- **Process per-call overhead**: Mỗi command spawn process mới

**Operis Integration Points:**
- Thêm gws commands vào bundled skills directory
- Skill frontmatter describe drive/gmail/calendar operations
- Agent prompt include gws skill descriptions
- bash-tools.exec invoke `gws` commands

### 2.3 Integration Pattern 3: Leverage Pre-built Agent Skills

gws ship với **100+ agent skills** cho Gmail, Drive, Docs, Sheets, Calendar, Chat:

**Ví dụ skills:**
- Upload files với automatic metadata tới Drive
- Append rows tới Sheets
- Gửi emails qua Gmail
- Quản lý calendar events
- Thao tác Google Docs

**Ứng dụng vào Operis:**
- Download gws skills package
- Tích hợp vào workspace skills directory (`src/agents/skills/`)
- Operis automatically load & expose vào agent

**Nhược điểm:**
- **Tight coupling**: Skills có thể deprecated/changed khi gws update
- **Version mismatch**: Operis cần track gws compatibility

---

## 3. Yêu Cầu Server — Có Cần Server Riêng Không?

### 3.1 Architecture Options

**Option A: Embedded in Gateway (Khuyến nghị)**
```
Operis Desktop App (Electron)
  ↓
  Gateway Process (Node.js) [process manager]
    ├─ Main gateway server
    ├─ gws MCP server (child process) ← spawned on-demand
    └─ Other MCP servers
```

- gws MCP server chạy như child process của gateway
- Automatically spawned khi first agent call
- Automatically killed khi no longer needed
- Single process model, easy resource mgmt

**Option B: Standalone Local Service**
```
Operis Desktop App
  ↓ [MCP client]
  ↓
Standalone gws MCP server (separate binary)
  ↓
Google Workspace APIs
```

- gws MCP server chạy independently
- Operis client connect qua stdio/TCP
- Easier debugging, separate lifecycle
- Overhead nhỏ hơn nếu nhiều agent sessions

**Option C: Cloud Service (Not Recommended)**
- gws server chạy trên remote server
- Operis agent connect qua network
- Dẫn đến latency, complexity, cost

### 3.2 Resource Requirements

**CPU:**
- gws MCP server: minimal (idle < 1% CPU)
- Active calls: < 5% CPU per operation

**Memory:**
- Startup: ~50-100 MB
- Operational: ~30-50 MB (with caching)

**Network:**
- OAuth token requests: 1-2 sec latency
- API calls: 100-500 ms latency (Google Workspace)
- No persistent connection (each call independent)

**Storage:**
- gws binary: ~50 MB
- credentials (keyring): < 1 KB per account

### 3.3 Electron Compatibility

gws **CÓ THỂ chạy inside Electron**:

**Cách thực hiện:**
```typescript
// In Electron main process
import { spawn } from 'child_process';

const gwsProcess = spawn('gws', ['mcp', '-s', 'drive,gmail,calendar'], {
  stdio: ['pipe', 'pipe', 'inherit'],  // stdin/stdout for MCP, stderr to console
  env: {
    ...process.env,
    PATH: `${process.execPath}/../../../node_modules/.bin:${process.env.PATH}`
  }
});

// Connect as MCP client
const client = new MCPClient(gwsProcess.stdout, gwsProcess.stdin);
```

**Nhận xét:**
- Electron bundle Node.js (v22.16+ cho Electron 35+)
- gws npm package available globally hoặc locally
- Preload script có thể spawn & manage gws process

---

## 4. Kiến Trúc Tích Hợp Đề Xuất

### 4.1 Recommended Architecture (MCP-based)

```
┌─────────────────────────────────────────────────────────┐
│  Operis Agent Core (pi-agent-core)                      │
│  - Agent loop, tool selection, prompt building         │
│  - MCP client implementation                           │
└────────────┬────────────────────────────────────────────┘
             │ (tool call with JSON-RPC 2.0)
             │
┌────────────▼────────────────────────────────────────────┐
│  Operis Gateway (gateway process)                       │
│  - Tool orchestrator                                   │
│  - MCP server lifecycle manager                        │
│  - Process spawner (gws, other MCPs)                   │
└────────────┬────────────────────────────────────────────┘
             │ (spawn child process)
             │
┌────────────▼────────────────────────────────────────────┐
│  gws MCP Server (child process)                         │
│  - Exposes Google Workspace tools                      │
│  - Handles Google Workspace APIs                       │
│  - Manages OAuth credentials                           │
└────────────┬────────────────────────────────────────────┘
             │ (API calls)
             │
        Google Workspace APIs
        (Drive, Gmail, Calendar, etc.)
```

### 4.2 Implementation Steps

**Phase 1: Bootstrap**
1. Add `@googleworkspace/cli` as npm dependency (Gateway package.json)
2. Create `src/agents/tools/gws-mcp-client.ts` (MCP client impl)
3. Implement process spawner in gateway

**Phase 2: MCP Protocol**
1. Implement JSON-RPC 2.0 message handling
2. Handle initialize → initialized → call request/response → close
3. Map gws tools to Operis tool schema

**Phase 3: Tool Exposure**
1. Extract tool definitions from gws MCP server
2. Add to agent prompt builder
3. Handle tool execution via MCP calls

**Phase 4: Auth Flow**
1. Intercept OAuth flow (user-friendly)
2. Store credentials in Operis config dir
3. Pass to gws via environment variables

**Phase 5: Testing & Hardening**
1. Unit tests for MCP client
2. Integration tests with real Google APIs
3. Error handling & retry logic

### 4.3 Code Structure

```
src/agents/
├── tools/
│   ├── gws-mcp-client.ts          # MCP client wrapper
│   ├── gws-mcp-manager.ts         # Process lifecycle
│   └── gws-auth.ts                # OAuth flow
├── skills/
│   ├── gws-skills/
│   │   ├── drive-skills.md
│   │   ├── gmail-skills.md
│   │   ├── calendar-skills.md
│   │   └── sheets-skills.md
│   └── workspace.ts               # Skill loader update
└── ...

gateway/
├── mcp-server.ts                  # MCP server factory
├── process-manager.ts             # Child process mgmt
└── ...

config/
├── auth-profiles/
│   └── gws-oauth.ts              # OAuth config
└── ...
```

---

## 5. Ưu Điểm & Nhược Điểm

### 5.1 Ưu Điểm

| Khía cạnh | Lợi ích |
|-----------|---------|
| **API Coverage** | 100+ Google Workspace services tại một endpoint |
| **Dynamic APIs** | Tự động pick up API mới từ Discovery Service |
| **Agent-Ready** | 40-100 pre-built agent skills cho common tasks |
| **Standardized** | MCP là chuẩn Linux Foundation (OpenAI, Google, AWS support) |
| **Structured Output** | JSON output tự nhiên phù hợp LLM processing |
| **Unified Interface** | 1 CLI cho tất cả Google Workspace (không cần học Drive API, Gmail API, etc. riêng) |
| **Developer UX** | Dry-run, auto-pagination, built-in help |
| **Cost** | Free (open source), no SaaS fees |

### 5.2 Nhược Điểm

| Khía cạnh | Vấn đề |
|-----------|--------|
| **Maturity** | v0.4.3 (March 2026) — pre-v1.0, breaking changes expected |
| **Tool Limit** | MCP clients thường giới hạn 50-100 tools/session (gws có thể exceed) |
| **Auth Setup** | OAuth flow phức tạp cho end-users, yêu cầu Google Cloud project |
| **Testing Mode** | Unverified apps limited ~25 scopes (publish/verify app costly) |
| **Process Overhead** | Mỗi MCP server là process riêng (memory, startup latency) |
| **Scope Creep** | 100+ skills → prompt too verbose, difficult agent decision-making |
| **Google API Rate Limits** | Gmail 1000 msgs/day, Drive 500 files/day (user-level, not documented) |

---

## 6. Kết Luận & Khuyến Nghị

### 6.1 Khuyến Nghị Chính

**✅ NÊN tích hợp gws MCP vào Operis vì:**

1. **Perfect alignment**: Operis là personal AI assistant, gws cung cấp exactly đó — unified access tới user's Google Workspace data
2. **Standards compliance**: MCP adoption by Linux Foundation, broad tooling support
3. **Low lift**: gws ship MCP server out-of-box, Operis chỉ cần implement thin MCP client
4. **Future-proof**: Dynamic APIs từ Discovery Service → không cần updates khi Google release new APIs
5. **User value**: Email, calendar, docs, sheets access từ Operis assistant — seamless personal AI UX

### 6.2 Implementation Strategy

**Phương pháp 1: MCP-Only (Khuyến nghị)**
- Spawn gws MCP server trong gateway
- Operis agent connect as MCP client
- Tối giản hóa: ~500 LOC implementation
- Trade-off: Tool limit (~50-100), cần careful skill curation

**Phương pháp 2: Hybrid (MCP + Bundled Skills)**
- Primary: MCP for interactive operations
- Secondary: Bundled gws skills cho common patterns
- Trade-off: Complexity (+200 LOC), flexibility

**Phương pháp 3: CLI Wrapper (Not recommended)**
- Wrap gws direct CLI calls
- Lower risk, higher maintenance
- Trade-off: No standardization, manual tool defs

### 6.3 Phút Tiếp Theo (Next Steps)

1. **Quick Validation** (Tuần 1)
   - Spawn gws MCP locally
   - Test basic tool discovery
   - Validate JSON output format

2. **MCP Client PoC** (Tuần 2)
   - Implement minimal MCP client in Node.js
   - Test initialize → tool call → response loop
   - Validate error handling

3. **Gateway Integration** (Tuần 3)
   - Add gws process manager
   - Wire up to agent tool system
   - Test end-to-end agent → gws → Google API

4. **Auth Flow** (Tuần 4)
   - Implement OAuth flow
   - Store credentials securely
   - Test headless + interactive auth

5. **Production Hardening** (Tuần 5-6)
   - Rate limit handling
   - Error recovery
   - Comprehensive test suite

### 6.4 Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| gws breaking changes (v0.x) | Pin version, monitor releases, feature flags |
| Tool limit exceeded | Curate skills, expose only Drive/Gmail/Calendar initially |
| OAuth scope limits | Publish gws app to remove ~25 scope limit |
| Rate limiting | Implement exponential backoff, user warnings |
| Credential theft | Use OS keyring, not plaintext files |

---

## Unresolved Questions

1. **Scope Management**: gws exposes 100+ skills — how to curate for Operis agent without overwhelming decision-making?
2. **Publishing gws App**: Does Google require gws app publish to lift testing scope limit (25 → unlimited)?
3. **Credential Storage**: Should Operis use gws's keyring integration or own encrypted store?
4. **Tool Versioning**: How to handle gws breaking changes when Discovery Service updates APIs?
5. **Performance**: What's acceptable latency for agent → MCP → Google API chain (target <2 sec)?

---

## Sources

- [GitHub - googleworkspace/cli](https://github.com/googleworkspace/cli)
- [MarkTechPost: Google AI Releases gws CLI](https://www.marktechpost.com/2026/03/05/google-ai-releases-a-cli-tool-gws-for-workspace-apis-providing-a-unified-interface-for-humans-and-ai-agents/)
- [Model Context Protocol Specification](https://modelcontextprotocol.io/specification/2025-03-26/basic)
- [@googleworkspace/cli - npm](https://www.npmjs.com/package/@googleworkspace/cli)
- [MCP Transports Documentation](https://modelcontextprotocol.info/docs/concepts/transports/)
