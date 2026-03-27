# V8.1 broader Sync credential materialization readback seam

Date: 2026-03-27
Lane: broader `Sync` completion
Taxonomy: `T4`
Packet: eighth bounded packet after broader-lane promotion

## Why this packet

The post-verification residual assessment showed that the next honest broader-sync area was post-auth credential / refresh continuity.

That broader area still had a smallest active gap before real refresh runtime:

- the active sync hub could now reach connected truth after callback verification
- the repo already had governed credential and refresh primitives in `pmSyncAuthService`
- but no active sync route or active sync surface could materialize credential baseline truth into `v8_connection_credentials`

This made governed credential materialization and readback smaller and more honest than pretending token refresh execution already existed.

## What changed

### Governed credential mutation continuity

- updated `server/src/routes/v8/sync.routes.ts`
- added governed `POST /api/v8/sync/integrations/:integrationId/credential`
- the new mutation resolves the governed integration, stores credential baseline truth through `storeCredential()`, records audit, and returns the saved credential readback

### Governed inventory readback continuity

- updated `server/src/services/v8/pmSyncInventoryService.ts`
- governed sync inventory now reads credential baseline truth through `getCredential()`
- active integration rows can now expose provider account, workspace or tenant, scopes, and refresh-readiness metadata without reopening legacy settings surfaces

### Active surface continuity

- updated `src/services/api/v8/sync.ts`
- updated `src/components/Admin/UnifiedSyncHub.tsx`
- connected governed OAuth integrations now expose an inline `Add governed credential` flow on the active hub
- after save, the active hub immediately refreshes and shows the recorded credential baseline on the same integration surface

## Regression coverage

Passed:

- `server/src/services/v8/__tests__/pmSyncInventoryService.test.ts`
- `server/src/routes/v8/__tests__/sync.routes.test.ts`
- `tests/unit/services/v8-sync-api.test.ts`
- `tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`

Verification command:

`npx vitest run server/src/services/v8/__tests__/pmSyncInventoryService.test.ts server/src/routes/v8/__tests__/sync.routes.test.ts tests/unit/services/v8-sync-api.test.ts tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`

Result: `66` tests passing.

## Residual after this packet

Broader `Sync` completion is still not done.

Remaining honest residuals include:

- real governed refresh execution / refresh-result continuity after credential baseline is recorded
- auth-break escalation and recovery continuity once refresh execution exists
- deeper authority alignment between governed `v8`, legacy `sync-hub`, canonical org-level `/api/integrations`, and user-level settings integrations
