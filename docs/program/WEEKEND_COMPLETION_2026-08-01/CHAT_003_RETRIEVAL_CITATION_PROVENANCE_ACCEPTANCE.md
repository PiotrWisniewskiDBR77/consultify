# CHAT-03 — Retrieval and citation provenance acceptance

**Status:** `CODE_GO_FROZEN` (local acceptance)  
**Date:** 2026-08-02  
**Scope:** streamed citations and governed source ledger survive durable conversation read-back

## Accepted contract

- The active AI stream collects citation events and the server-generated `source_ledger` event.
- Stream completion forwards both structures to the active chat surface.
- The persisted assistant message stores citations together with the complete source ledger: used sources, policy-blocked source categories, degradation state and scope resolution.
- A fresh conversation GET and a direct PostgreSQL read return the same provenance data.
- Existing conversation ownership and tenant isolation remain the access boundary; the ledger does not enumerate forbidden cross-tenant objects, only governed blocked categories.

## Fixed gap

Before this change, citations survived persistence but `source_ledger` was dropped between stream completion and `conversation_messages.metadata`. The live answer could therefore show provenance that disappeared after hard reload. The persistence helper and active `UnifiedChatPanel` now carry the ledger through the same durable message write as citations.

## Evidence

Real PostgreSQL acceptance:

```text
tests/acceptance/chat-003-citation-provenance-readback.realdb.test.ts
1 passed
```

Transport and persistence regressions:

```text
tests/unit/hooks/useAIStream.test.ts
tests/unit/utils/chatPersistence.test.ts
25 passed

tests/components/AIChat/UnifiedChatPanel.test.tsx
targeted provenance persistence test: 1 passed
```

The broader Unified Chat run exposed one pre-existing/flaky split-resize assertion (`45` versus `64`) unrelated to citation persistence. The exact changed pipeline test passes independently; this unrelated failure is not counted as CHAT-03 evidence and is not hidden.

## Remaining deployment gate

Local acceptance does not prove provider availability or Railway deployment. Railway authenticated streaming and hard-reload smoke remain release-environment gates.
