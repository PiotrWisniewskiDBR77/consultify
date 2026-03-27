# V8.1 Sync Disconnect V8 Parity

Date: 2026-03-26
Lane: `Sync / connectors / interoperability`
Taxonomy: `T2`
Status: `done`

## Goal

Add a governed V8-first lifecycle mutation for disconnecting integrations so the active
`UnifiedSyncHub` no longer depends on a legacy-only disconnect trigger.

## What changed

1. Backend V8 parity
   - extended `server/src/routes/v8/sync.routes.ts`
   - added `POST /api/v8/sync/integrations/:integrationId/disconnect`

2. Frontend V8-first mutation seam
   - extended `src/services/api/v8/sync.ts`
   - updated `src/components/Admin/UnifiedSyncHub.tsx`
   - active `Disconnect` now tries the governed V8 mutation first
   - legacy `sync-hub/disconnect/*` remains fallback-only for bounded compatibility statuses

3. Regression coverage
   - extended `server/src/routes/v8/__tests__/sync.routes.test.ts`
   - extended `tests/unit/services/v8-sync-api.test.ts`
   - extended `tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`

## Why this matters

This closes the last obvious operator lifecycle control gap inside the active sync hub:

- governed sync control actions now cover `error resolution`, `pause`, `resume`, `run now`, `reauth`, and `disconnect`
- active-hub disconnect handling no longer depends on the legacy-only mutation path
- the remaining sync residuals are now concentrated in broader provider onboarding and provider-specific mutation breadth

## Verification

`npx vitest run server/src/routes/v8/__tests__/sync.routes.test.ts tests/unit/services/v8-sync-api.test.ts tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`
