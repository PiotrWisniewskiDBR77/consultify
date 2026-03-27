# V8.1 broader Sync governed refresh execution continuity seam

Date: 2026-03-27
Lane: broader `Sync` completion
Taxonomy: `T4`
Packet: seventeenth bounded packet after broader-lane promotion

## Why this packet

After the org-level authority seams were aligned, the active governed runtime still blocked `Run now` with `REFRESH_EXECUTION_REQUIRED` whenever an oauth2 credential entered the refresh window.

That meant:

- governed sync already tracked credential baseline truth,
- governed sync already tracked refresh outcomes and auth-break escalation truth,
- but the active runtime still could not execute the refresh step itself before syncing.

This was the next honest runtime packet before broader callback token materialization or deeper authority alignment.

## What changed

### Governed refresh-secret materialization

- added `server/src/services/v8/pmSyncRefreshExecutionService.ts`
- added `POST /api/v8/sync/integrations/:integrationId/refresh-secret` in `server/src/routes/v8/sync.routes.ts`
- governed oauth2 integrations can now materialize encrypted refresh runtime secrets on the V8 path without exposing those secrets back in responses
- the service uses encrypted storage plus soft schema detection, so the runtime stays honest when secret storage is unavailable

### Real refresh execution on the active runtime path

- updated `server/src/routes/v8/sync.routes.ts`
- when an oauth2 credential is expired or already inside the refresh window, `POST /api/v8/sync/integrations/:integrationId/sync` now attempts a real OAuth refresh grant before continuing
- successful refresh updates governed credential expiry truth, records a governed `success` refresh result, resolves stale escalations, and then lets the sync run continue
- auth-break refresh failures now record governed `credential_expired` or `scope_revoked` truth and degrade the connector into reauth-needed state
- missing refresh secrets no longer claim that refresh execution is not wired; the runtime now explicitly says that governed refresh execution exists but this connector still lacks the required governed secret material

## Regression coverage

Passed:

- `server/src/services/v8/__tests__/pmSyncRefreshExecutionService.test.ts`
- `server/src/routes/v8/__tests__/sync.routes.test.ts`

Verification command:

`npx vitest run server/src/services/v8/__tests__/pmSyncRefreshExecutionService.test.ts server/src/routes/v8/__tests__/sync.routes.test.ts`

Result: `39` tests passing.

## Residual after this packet

Broader `Sync` completion is still not done.

Remaining honest residuals include:

- callback-driven governed refresh secret or token materialization continuity instead of requiring manual refresh-secret submission after external auth
- deeper authority alignment between governed `v8`, legacy `sync-hub`, canonical org-level `/api/integrations`, and user-level settings integrations
