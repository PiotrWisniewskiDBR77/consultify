# V8.1 broader Sync refresh-result continuity seam

Date: 2026-03-27
Lane: broader `Sync` completion
Taxonomy: `T4`
Packet: ninth bounded packet after broader-lane promotion

## Why this packet

After credential materialization continuity landed, the next smallest active residual inside broader post-auth continuity was refresh-result truth itself:

- the active sync hub could now materialize governed credential baseline metadata
- the repo already had shared `recordRefreshResult()` and auth-state governance primitives
- but the active governed runtime path still had no way to record refresh outcomes or reflect auth-break refresh results back into active integration truth

This made refresh-result continuity smaller and more honest than pretending real token refresh execution or full auth-escalation lifecycle continuity already existed.

## What changed

### Governed refresh-result mutation continuity

- updated `server/src/routes/v8/sync.routes.ts`
- added governed `POST /api/v8/sync/integrations/:integrationId/refresh-result`
- the new mutation records refresh result truth through `recordRefreshResult()`, records audit, and applies bounded auth-state alignment
- `credential_expired` and `scope_revoked` now transition the governed connector to `degraded_reauth_needed`, while `success` can restore healthy auth truth when appropriate

### Active surface continuity

- updated `src/services/api/v8/sync.ts`
- updated `src/components/Admin/UnifiedSyncHub.tsx`
- integrations with governed credential baseline can now record refresh results directly on the active sync hub
- the active credential card now shows last refresh result and last refresh timestamp
- auth-break refresh results now push the active hub into honest `requires_reauth` state instead of leaving stale `connected` truth behind

## Regression coverage

Passed:

- `server/src/routes/v8/__tests__/sync.routes.test.ts`
- `tests/unit/services/v8-sync-api.test.ts`
- `tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`

Verification command:

`npx vitest run server/src/routes/v8/__tests__/sync.routes.test.ts tests/unit/services/v8-sync-api.test.ts tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`

Result: `67` tests passing.

## Residual after this packet

Broader `Sync` completion is still not done.

Remaining honest residuals include:

- real governed refresh execution continuity rather than operator-recorded refresh outcomes
- auth-break escalation and recovery continuity once refresh execution exists end-to-end
- deeper authority alignment between governed `v8`, legacy `sync-hub`, canonical org-level `/api/integrations`, and user-level settings integrations
