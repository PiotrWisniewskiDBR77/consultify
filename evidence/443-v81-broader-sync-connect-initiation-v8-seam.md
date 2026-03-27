# V8.1 broader Sync connect initiation V8 seam

Date: 2026-03-27
Lane: broader `Sync` completion
Taxonomy: `T4`
Packet: first bounded packet after broader-lane promotion

## Why this packet

The accepted bounded `Sync / connectors / interoperability` lane already moved the active sync hub onto governed V8 reads plus bounded lifecycle-control mutations, but the visible connect CTA still ran through legacy `POST /api/sync-hub/connect`.

That legacy connect path was still a real active residual:

- it backed the visible `Connect` action in `UnifiedSyncHub`
- it mixed a config-heavy backend contract with an active connect modal that submits empty config
- it upgraded the happy path to fake `connected` truth even though broader OAuth/provider completion still remains outside the accepted bounded lane

This makes connect initiation continuity the smallest honest first packet for broader `Sync` completion.

## What changed

### Governed V8 runtime parity

- added `POST /api/v8/sync/connectors/:connectorId/connect` in `server/src/routes/v8/sync.routes.ts`
- the new route validates the connector, inserts a governed integration row, records audit, and returns the V8 mutation envelope
- newly initiated integrations stay in `pending` status with explicit `pending_external_auth_or_configuration` onboarding truth instead of claiming live completion

### Shared client seam

- added `V8SyncApi.connectIntegration()` in `src/services/api/v8/sync.ts`
- the new client contract exposes the initiated integration payload and onboarding status

### Active surface continuity

- updated `src/components/Admin/UnifiedSyncHub.tsx`
- active connect actions now prefer `V8SyncApi.connectIntegration()` during normal operation
- fallback to legacy `POST /api/sync-hub/connect` remains bounded to compatibility statuses only
- the active connect toast now reports connection initiation / pending onboarding truth instead of pretending the connector is already fully connected

## Regression coverage

Passed:

- `server/src/routes/v8/__tests__/sync.routes.test.ts`
- `tests/unit/services/v8-sync-api.test.ts`
- `tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`

Verification command:

`npx vitest run server/src/routes/v8/__tests__/sync.routes.test.ts tests/unit/services/v8-sync-api.test.ts tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`

Result: `54` tests passing.

## Residual after this packet

Broader `Sync` completion is still not done.

Remaining honest residuals include:

- OAuth callback / refresh / reauthorization round-trip completion beyond the initiation seam
- provider-specific setup/config follow-up after the initial connect action
- deeper authority alignment between governed `v8`, legacy `sync-hub`, canonical org-level `/api/integrations`, and user-level settings integrations
- wider provider breadth that should not be smuggled into this first packet
