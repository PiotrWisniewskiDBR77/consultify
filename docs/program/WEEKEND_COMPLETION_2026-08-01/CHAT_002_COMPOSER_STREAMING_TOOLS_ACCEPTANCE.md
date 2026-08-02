# CHAT-02 — Composer, streaming and tools acceptance

**Status:** `CODE_GO_FROZEN` (local acceptance)  
**Date:** 2026-08-02  
**Scope:** active chat composer, SSE transport, bounded recovery and client tool events

## Accepted contract

- The composer starts one streamed request and exposes Stop while generation is active.
- Stop aborts the request, releases typing/streaming state and keeps already received partial text visible.
- Text and typed SSE events are parsed across fragmented network chunks.
- Teresa client-tool events continue through the governed manifest/registry boundary accepted in CHAT-04.
- Retryable transport/provider failures are not persisted as successful assistant answers.
- Recovery performs at most three automatic retries with visible exponential backoff (`1.5s`, `3s`, `6s`).
- Every retry replaces a failed partial response instead of appending and duplicating it.
- Access, organization, budget, rate-limit and confirmation failures are not automatically retried.
- After retry exhaustion the panel exposes a manual Try again action using the exact last request; Dismiss clears the error.

## Fixed gaps

1. A provider/pipeline error delivered as a valid SSE event was converted to friendly assistant text and completed as success, preventing real recovery.
2. The UI advertised three retries, but the implementation performed only one retry attempt.
3. Retry classification relied mainly on message text and could retry structured budget/rate-limit errors whose code was not present in the friendly message.

## Evidence

```text
tests/unit/hooks/useAIStream.test.ts
tests/unit/services/api-chat-stream-recovery.test.ts
tests/unit/actions/teresaActionManifest.test.ts
tests/components/AIChat/EnhancedChatInput.teresa-error-toast.test.tsx
34 passed

tests/components/AIChat/UnifiedChatPanel.test.tsx
3 scoped recovery/persistence tests passed

TypeScript type-check: PASS
Production build: PASS (10,200 modules transformed)
```

## Honest boundary

The full UnifiedChatPanel suite still has the previously recorded, unrelated split-resize assertion (`45` versus `64`). The Teresa voice test file also has a stale `CoThinkerActivePill` mock. Neither failure exercises composer streaming, Stop, SSE parsing, tool transport or retry recovery, so they are disclosed but not counted as CHAT-02 failures.

Railway still requires an authenticated live-provider stream smoke, including a forced connection interruption. That is a deployment/environment gate rather than local code acceptance.
