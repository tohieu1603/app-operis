# Research Report: gws CLI (Google Workspace CLI) Deep Dive

**Date:** 2026-03-11
**Version researched:** v0.11.1 (released 2026-03-10)
**Source:** https://github.com/googleworkspace/cli

---

## Executive Summary

`gws` is a community-authored (not officially supported) Rust binary that dynamically builds its entire command surface from Google's Discovery Service at runtime. It supports service account auth, headless/CI operation via env vars, and outputs structured JSON — making it viable for Node.js process-spawn integration. The critical limitation for agent use cases is **no Domain-Wide Delegation (DWD) / user impersonation support**. Per-call process spawn overhead is the main performance concern; Discovery Documents are cached for 24h mitigating cold start.

---

## 1. Internal Architecture

### Language & Build
- Written entirely in **Rust** (Cargo workspace)
- Published as native binary: `gws` / `gws.exe` (x64 Windows, ARM/x64 Linux, Apple Silicon/Intel macOS)
- Also on npm as `@googleworkspace/cli@0.11.1` — wraps the prebuilt native binary, no Rust toolchain needed
- Async runtime: **Tokio**; HTTP client: **reqwest** (rustls-tls-native-roots, no OpenSSL dep)

### How It Discovers and Calls APIs (Two-Phase Parse)
```
argv[1] = service name (e.g., "drive")
  → fetch Discovery Document from googleapis.com/discovery/v1/apis/{service}/{version}/rest
  → cache to ~/.config/gws/cache/{service}_{version}.json  (24h TTL)
  → build clap::Command tree from document's resources/methods
  → re-parse remaining argv
  → authenticate (see below)
  → build HTTP request from parsed params + body JSON
  → execute → output JSON to stdout
```

**Key implication:** First call to a new service fetches the Discovery doc (network round-trip). Subsequent calls within 24h are cache-hit (disk read only). Cold start for a cached service = binary startup + disk read + API HTTP call — all in Rust, so startup is fast (no JVM/Node overhead).

---

## 2. Authentication

### Full Priority Order (from `src/auth.rs`)
| Priority | Mechanism | Notes |
|---|---|---|
| 0 | `GOOGLE_WORKSPACE_CLI_TOKEN` env var | Raw access token; bypasses all credential loading |
| 1 | `GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE` env var | Path to JSON (user OAuth or service account) |
| 2 | Encrypted credentials (`~/.config/gws/credentials.enc`) | Set by `gws auth login` |
| 3 | Plaintext credentials (`~/.config/gws/credentials.json`) | User OAuth only |
| 4 | ADC via `GOOGLE_APPLICATION_CREDENTIALS` env var | Any JSON credentials file |
| 5 | ADC well-known path (`~/.config/gcloud/application_default_credentials.json`) | gcloud default login |

### Service Account Support
**YES — fully supported.** The `Credential` enum in `auth.rs` handles both `AuthorizedUser` and `ServiceAccount` key types. Detected automatically from the JSON file type. Token cached to `sa_token_cache.json` with AES-256-GCM encryption.

Usage:
```bash
export GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE=/path/to/service-account.json
gws drive files list
```

### Domain-Wide Delegation (DWD) / Impersonation
**NOT SUPPORTED.** Searched `src/auth.rs` for `subject`, `impersonat`, `delegate`, `domain.wide` — zero matches. The `yup-oauth2` library used supports DWD via `ServiceAccountAuthenticator::with_subject()`, but gws does not expose this parameter. No CLI flag or env var for subject/impersonation.

### Headless / CI Mode
**YES — fully supported** via env vars:
```bash
# Option A: pre-obtained token (e.g., from gcloud or another OAuth flow)
export GOOGLE_WORKSPACE_CLI_TOKEN=$(gcloud auth print-access-token)

# Option B: exported credentials file
gws auth export --unmasked > credentials.json   # on machine with browser
export GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE=/path/to/credentials.json  # on CI

# Option C: service account key file
export GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE=/path/to/sa.json
```

### OAuth Interactive Flow
- `gws auth setup` — one-time GCP project creation (requires `gcloud` CLI)
- `gws auth login` — browser-based PKCE OAuth with loopback server
- Credentials encrypted at rest with AES-256-GCM; key in OS keyring or `~/.config/gws/.encryption_key`
- Keyring backend selectable: `GOOGLE_WORKSPACE_CLI_KEYRING_BACKEND=keyring|file`

---

## 3. Limitations

### No DWD / User Impersonation
Cannot act as a specific user within a Workspace domain. Service account gets its own Drive/Gmail (unless DWD is configured — which gws doesn't support). This is a hard blocker for multi-user Workspace admin scenarios.

### Token Expiry Bug
Open issue: `gmail +watch` and `events +subscribe` exit after ~1 hour due to expired access token. The token refresh logic doesn't keep long-running watch sessions alive.

### Rate Limiting
**No automatic retry on 429/quota errors.** The executor loop does not implement exponential backoff. Errors surface immediately as structured JSON to stderr with HTTP status code. Caller must implement retry logic.

### Error Reporting
Errors are structured JSON on stderr/stdout — good for programmatic parsing:
```json
{
  "error": {
    "code": 403,
    "message": "...",
    "reason": "accessNotConfigured",
    "enable_url": "https://console.developers.google.com/apis/api/..."
  }
}
```
Special handling for `accessNotConfigured` — extracts the enable URL and prints an actionable hint to stderr.

### Scope Management Issues (open bugs)
- OAuth scopes not properly ordered
- Auth scope picker missing scopes for People, Chat, and some services
- People service doesn't request contacts OAuth scope during auth login
- `recommended` scope preset includes 85+ scopes → exceeds ~25-scope limit for unverified apps in testing mode

### Discovery Doc Failures
Open issue: `Failed to fetch Discovery Document for drive/v3: HTTP 404 Not Found` — sporadic failures fetching from googleapis.com.

### Windows Install Bug (fixed in v0.11.1)
Previous: Windows install missing `gws.exe`. Fixed in v0.11.1 released 2026-03-10.

---

## 4. Node.js Integration Pattern

### Spawning via `execFileSync` / `spawnSync`
```javascript
const { execFileSync } = require('child_process');

function callGws(args, env = {}) {
  try {
    const result = execFileSync('gws', args, {
      encoding: 'utf8',
      env: {
        ...process.env,
        GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE: '/path/to/creds.json',
        ...env,
      },
      timeout: 30000, // 30s timeout
    });
    return JSON.parse(result);
  } catch (err) {
    // err.stdout contains JSON error, err.stderr contains human hint
    throw JSON.parse(err.stdout || '{}');
  }
}

// Example
const files = callGws(['drive', 'files', 'list', '--params', '{"pageSize":10}']);
```

### Overhead Per Call
- Rust binary startup: ~5-20ms (fast, no runtime to spin up)
- Discovery doc: cached 24h on disk; cache miss = extra network round-trip
- Token: cached encrypted on disk, refreshed when expired
- Total per-call overhead estimate: **30-100ms** for cached calls; **500ms-2s** for first call to new service

### JSON Output Reliability
- All successful responses: JSON to stdout
- All errors: JSON to stderr (structured `GwsError`)
- Structured JSON output for all formats including errors, dry-run previews, download metadata
- CSV/YAML/table output formats available via `--format` flag

### Concurrent Calls
- No built-in concurrency limiting
- Each process spawn is independent
- Google API rate limits apply per-user/project regardless
- Recommended: implement concurrency limit in caller (e.g., `p-limit` in Node.js)

### Timeout Handling
`gws` has no built-in request timeout beyond `reqwest` defaults. The `timeout` option in `execFileSync`/`spawnSync` is the safest guard.

### Pagination
Built-in flags:
```bash
--page-all           # auto-paginate all pages, emits NDJSON (one JSON per line)
--page-limit <N>     # max pages (default: 10)
--page-delay <MS>    # delay between pages (default: 100ms)
```
Note: `--page-all` outputs **NDJSON** (newline-delimited JSON), not a single JSON array. Parser must split by newlines.

---

## 5. Environment Variables Reference

| Variable | Purpose |
|---|---|
| `GOOGLE_WORKSPACE_CLI_TOKEN` | Pre-obtained access token (highest priority) |
| `GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE` | Path to OAuth user or service account JSON |
| `GOOGLE_WORKSPACE_CLI_CLIENT_ID` | OAuth client ID (alternative to client_secret.json) |
| `GOOGLE_WORKSPACE_CLI_CLIENT_SECRET` | OAuth client secret |
| `GOOGLE_WORKSPACE_CLI_CONFIG_DIR` | Override config dir (default: `~/.config/gws`) |
| `GOOGLE_WORKSPACE_CLI_KEYRING_BACKEND` | `keyring` or `file` — fixes Docker/keyring-less envs |
| `GOOGLE_WORKSPACE_CLI_SANITIZE_TEMPLATE` | Model Armor template path |
| `GOOGLE_WORKSPACE_CLI_SANITIZE_MODE` | `warn` (default) or `block` |
| `GOOGLE_WORKSPACE_PROJECT_ID` | GCP project ID for quota/billing (`x-goog-user-project` header) |
| `GOOGLE_APPLICATION_CREDENTIALS` | ADC credentials file path (standard gcloud env var) |

Can also be set in `.env` file (loaded via `dotenvy` crate).

---

## 6. Comparative Assessment for Agent Integration

| Aspect | Rating | Notes |
|---|---|---|
| Service account auth | Good | Fully supported via credentials file |
| DWD / impersonation | Bad | Not supported — hard limitation |
| Headless/CI operation | Good | Env var driven, no browser needed |
| JSON output | Good | Structured, reliable, parse-friendly |
| Process spawn overhead | Acceptable | 30-100ms per call (Rust binary) |
| Rate limit handling | Poor | No auto-retry; caller must implement |
| Error detail | Good | Structured JSON with reason codes |
| Pagination | Good | Built-in with `--page-all` |
| Token auto-refresh | Good | Handled internally via yup-oauth2 |
| Long-running watch | Poor | Token expiry bug after ~1 hour |
| Concurrent calls | Neutral | No coordination; Google quotas apply |
| Windows support | Good | Fixed in v0.11.1 |

---

## 7. Agent Skills Integration

The repo ships `skills/` directory with 100+ `SKILL.md` files — one per API plus high-level helpers. These are the exact skills referenced in agent.operis GWS guide files. Install:
```bash
npx skills add https://github.com/googleworkspace/cli
```
Or directly symlink for OpenClaw/Operis:
```bash
ln -s $(pwd)/skills/gws-* ~/.operis/skills/
```
The `gws-shared` skill includes an `install` block that auto-installs the CLI via `npm` if `gws` isn't on PATH.

---

## Resources

- Repo: https://github.com/googleworkspace/cli
- npm: https://www.npmjs.com/package/@googleworkspace/cli
- Releases: https://github.com/googleworkspace/cli/releases
- Open issues: https://github.com/googleworkspace/cli/issues
- Auth source: `src/auth.rs`
- Executor source: `src/executor.rs`
- Discovery source: `src/discovery.rs`

---

## Unresolved Questions

1. **DWD workaround:** Is there a way to pre-mint impersonated tokens externally (e.g., via Google Auth Library in Node.js) and pass them via `GOOGLE_WORKSPACE_CLI_TOKEN`? This would bypass the DWD gap but requires token lifecycle management outside gws.

2. **Rate limit handling:** No exponential backoff in gws — what retry strategy should the Node.js caller implement? Minimum: catch `rateLimitExceeded` reason in JSON error, backoff 1s * 2^n up to 32s.

3. **Discovery doc fetch failures:** The open issue about `HTTP 404 Not Found` on Discovery fetch is intermittent. Is there a fallback or local cache seeding strategy?

4. **Performance at scale:** Actual measured cold-start time on Windows for `gws.exe` — Rust binaries on Windows can be slower than Linux due to NTFS and AV scanning. Needs benchmarking.

5. **Scope pre-configuration for agent use:** For an agent that needs to call many services, can all required scopes be pre-authorized in a single `gws auth login` call, or does each service need a separate login?
