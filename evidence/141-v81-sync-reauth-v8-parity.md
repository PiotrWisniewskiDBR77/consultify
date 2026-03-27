# V8.1 Sync Reauth V8 Parity

Date: 2026-03-26
Lane: `Sync / connectors / interoperability`
Taxonomy: `T2`
Status: `done`

## Goal

Add a governed V8-first lifecycle mutation for integration reauthorization so the active
`UnifiedSyncHub` no longer falls back to a legacy-only reauth trigger for token-recovery handling.

## What changed

1. Backend V8 parity
   - extended `server/src/routes/v8/sync.routes.ts`
   - added `POST /api/v8/sync/integrations/:integrationId/reauth`
   - preserved the bounded pending -> connected recovery flow already used by the legacy seam

2. Frontend V8-first mutation seam
   - extended `src/services/api/v8/sync.ts`
   - updated `src/components/Admin/UnifiedSyncHub.tsx`
   - active `Re-authorize` now tries the governed V8 mutation first
   - legacy `sync-hub/reauth/*` remains fallback-only for bounded compatibility statuses

3. Regression coverage
   - extended `server/src/routes/v8/__tests__/sync.routes.test.ts`
   - extended `tests/unit/services/v8-sync-api.test.ts`
   - extended `tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`

## Why this matters

This closes another operator lifecycle gap inside the active sync hub:

- governed sync control actions now cover `error resolution`, `pause`, `resume`, `run now`, and `reauth`
- token-recovery handling no longer depends on the legacy-only route during normal active-hub recovery
- the remaining sync residuals are now concentrated in broader provider connect/disconnect/onboarding breadth rather than the main bounded operator controls

## Verification

`npx vitest run server/src/routes/v8/__tests__/sync.routes.test.ts tests/unit/services/v8-sync-api.test.ts tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`
