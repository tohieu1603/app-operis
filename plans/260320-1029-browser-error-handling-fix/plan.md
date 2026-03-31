---
title: "Browser Tool Error Handling Fix"
description: "Improve error messages, add retry/recovery logic, and handle data failures in Operis Gateway browser module"
status: pending
priority: P1
effort: 3h
branch: Hung
tags: [browser, error-handling, cdp, playwright, reliability]
created: 2026-03-20
---

# Browser Tool Error Handling Fix

## Problem
Agent encounters recurring failures using browser tools due to unhelpful error messages, no retry mechanism for transient failures, no auto-restart on Chrome crash, and aggressive "Do NOT retry" messaging.

## Phases

### Phase 1: Better Error Messages — `phase-01-better-error-messages.md`
- **Status:** pending
- **Effort:** 45min
- **Files:** `agent.act.ts`, `agent.act.shared.ts`, `pw-tools-core.shared.ts`
- Improve error messages with valid kinds, example request bodies, extended AI-friendly errors

### Phase 2: Retry & Recovery — `phase-02-retry-and-recovery.md`
- **Status:** pending
- **Effort:** 1.5h
- **Files:** `pw-retry.ts` (new), `pw-tools-core.interactions.ts`, `client-fetch.ts`, `server-context.availability.ts`
- Add transient retry wrapper, smarter retry messaging, verify auto-restart flow

### Phase 3: Data Handling — `phase-03-data-handling.md`
- **Status:** pending
- **Effort:** 30min
- **Files:** `routes/agent.snapshot.ts`
- Screenshot save fallback with base64 inline response

## Key Constraints
- No API contract changes (route paths, response shapes)
- No new dependencies
- Max 2 retries for transient errors
- Files under 200 lines — retry wrapper in separate `pw-retry.ts`
- Maintain existing test compatibility

## Success Criteria
- [ ] Invalid `kind` errors list all valid kinds + example
- [ ] Missing `ref` errors show example for current kind
- [ ] Transient interaction failures retry up to 2 times
- [ ] Chrome crash triggers auto-relaunch on next `ensureBrowserAvailable()`
- [ ] Timeout errors distinguish transient vs permanent
- [ ] Screenshot save failure falls back to base64 inline
- [ ] All existing tests pass (`pnpm test`)

## Dependencies
- None (all changes are internal to `src/browser/`)
