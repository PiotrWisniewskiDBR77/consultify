# V8.1 broader Sync run-now refresh preflight honesty seam

Date: 2026-03-27
Lane: broader `Sync` completion
Taxonomy: `T4`
Packet: tenth bounded packet after broader-lane promotion

## Why this packet

After credential materialization and refresh-result continuity landed, the active governed runtime path still let operators press `Run now` even when credential truth already said the token was expired or already inside the refresh window.

That meant:

- the governed sync route could still pretend a normal sync run was available even though no real token refresh executor existed,
- expired credentials were only reflected after manual post-fact recording instead of being honored before sync started,
- the active hub still had a split between governed auth truth and governed sync-run behavior.

This packet was thinner and more honest than pretending full provider-token refresh execution already existed.

## What changed

### Governed sync preflight

- updated `server/src/routes/v8/sync.routes.ts`
- `POST /api/v8/sync/integrations/:integrationId/sync` now performs a governed auth preflight for oauth2 connectors before starting a run
- if governed credential truth is already expired, the route records `credential_expired`, transitions auth truth to `degraded_reauth_needed`, logs audit, and blocks sync with `REFRESH_REAUTH_REQUIRED`
- if governed credential truth is already inside the refresh window, the route blocks sync with `REFRESH_EXECUTION_REQUIRED` instead of pretending the active runtime path can already execute token refresh

### Active hub honesty

- updated `src/components/Admin/UnifiedSyncHub.tsx`
- the active hub now stays on the governed V8 sync path when refresh preflight blocks the run
- `requires_reauth` integrations no longer expose a still-clickable `Run now` control

## Regression coverage

Passed:

- `server/src/routes/v8/__tests__/sync.routes.test.ts`
- `tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`

Verification command:

`npx vitest run server/src/routes/v8/__tests__/sync.routes.test.ts tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`

Result: `46` tests passing.

## Residual after this packet

Broader `Sync` completion is still not done.

Remaining honest residuals include:

- real governed refresh execution continuity instead of preflight blocking
- auth-break escalation and recovery continuity after refresh execution becomes real on the governed runtime path
- deeper authority alignment between governed `v8`, legacy `sync-hub`, canonical org-level `/api/integrations`, and user-level settings integrations
