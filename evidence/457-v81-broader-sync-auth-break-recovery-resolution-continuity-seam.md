# V8.1 broader Sync auth-break recovery resolution continuity seam

Date: 2026-03-27
Lane: broader `Sync` completion
Taxonomy: `T4`
Packet: thirteenth bounded packet after broader-lane promotion

## Why this packet

After auth-break recovery initiation continuity landed, operators could finally start governed re-authorization directly from the active escalation panel, but the governed path still left stale unresolved auth escalations behind even after recovery truth returned to `healthy`.

That meant:

- the active recovery panel could now start re-authorization,
- the governed path could already mark connector auth back to `healthy` after verification or successful refresh-result recording,
- but unresolved auth escalations still required separate manual cleanup instead of closing automatically when the governed recovery path actually succeeded.

This was thinner and more honest than jumping straight to real governed refresh execution.

## What changed

### Governed escalation resolution helper

- updated `server/src/services/v8/pmSyncAuthService.ts`
- added `resolveAuthEscalationsForConnector()` to close every unresolved auth escalation for a connector within an organization
- the helper is scoped by connector plus organization and returns the resolved records for bounded audit/readback continuity

### Recovery-success continuity on the governed path

- updated `server/src/routes/v8/sync.routes.ts`
- governed `POST /api/v8/sync/connectors/:id/auth-state` now resolves active auth escalations whenever the connector is explicitly returned to `healthy`
- governed `POST /api/v8/sync/integrations/:integrationId/refresh-result` now resolves active auth escalations when a `success` refresh result is recorded
- audit details now record how many governed escalations were auto-resolved on successful refresh-result recovery

### Active hub readback continuity

- updated `tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`
- the active `UnifiedSyncHub` no longer leaves stale `credential_expired` escalation work visible after governed verification completion returns auth truth to `healthy`
- this keeps the active `Sync Health` surface aligned with real governed recovery success instead of requiring a second manual resolve step for already-fixed auth-breaks

## Regression coverage

Passed:

- `server/src/services/v8/__tests__/pmSyncAuthService.test.ts`
- `server/src/routes/v8/__tests__/sync.routes.test.ts`
- `tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`

Verification command:

`npx vitest run server/src/services/v8/__tests__/pmSyncAuthService.test.ts server/src/routes/v8/__tests__/sync.routes.test.ts tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`

Result: `133` tests passing.

## Residual after this packet

Broader `Sync` completion is still not done.

Remaining honest residuals include:

- real governed refresh execution continuity instead of preflight blocking plus operator-recorded refresh outcomes
- deeper authority alignment between governed `v8`, legacy `sync-hub`, canonical org-level `/api/integrations`, and user-level settings integrations
