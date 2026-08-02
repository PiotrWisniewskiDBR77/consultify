# CHAT-05 — Proposal, approval and audit acceptance

**Status:** `CODE_GO_FROZEN` (local acceptance)  
**Date:** 2026-08-02  
**Scope:** governed proposal lifecycle from draft through durable read-back

## Accepted contract

- Teresa creates a proposal only; no target write exists before explicit approval and execution.
- Approval and rejection are explicit, tenant-scoped state transitions with durable audit entries.
- Execution atomically claims an approved proposal, so parallel requests cannot create two handoff receipts.
- A retry after completion is idempotent and returns the existing completed result.
- Rejection is terminal and cannot be executed later.
- A fresh proposal read reconstructs completed state, allowed actions, audit count and target result reference.
- The Teresa lifecycle is mirrored into the AI Run ledger without the PostgreSQL timestamp/text type conflict previously found by the real-database test.

## Fixed gaps

1. Two concurrent execute requests could both observe `approved` and perform the owner-module handoff.
2. Retrying a successfully completed execute returned an invalid-transition error instead of the durable receipt.
3. The handoff receipt table did not enforce one receipt per proposal.
4. Excele `workbook_ref` was omitted from fresh read-back result extraction.
5. AI Run ledger close-state updates mixed text and timestamp branches in PostgreSQL and silently skipped the mirror update.

## Evidence

```text
tests/acceptance/chat-005-proposal-approval-audit.realdb.test.ts
2 passed

server/src/routes/v8/__tests__/p08-teresa-service.test.ts
server/src/routes/v8/__tests__/p08-teresa-e2e-lifecycle.test.ts
71 passed
```

The real PostgreSQL acceptance drives the real auth middleware, V8 organization context, HTTP router and SQL implementation. It proves no pre-approval write, approve/execute lifecycle, parallel execute safety, completed retry, one durable receipt, exact audit sequence, fresh read-back, terminal rejection and cross-tenant denial.

## Honest boundary

The accepted test target is the deterministic Excele handoff receipt. It proves the shared proposal/approval/audit mechanism used by all Teresa targets, but it does not claim that every external target service is available in a deployed environment. Railway still requires an authenticated smoke for each target-module adapter; that is a deployment gate, not local code acceptance.
