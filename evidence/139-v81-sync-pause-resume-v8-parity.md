# V8.1 Sync Pause Resume V8 Parity

Date: 2026-03-26
Lane: `Sync / connectors / interoperability`
Taxonomy: `T2`
Status: `done`

## Goal

Add governed V8-first lifecycle control mutations for pausing and resuming integrations so the active
sync hub no longer mixes governed sync reads with legacy-only pause/resume actions.

## What changed

1. Backend V8 parity
   - extended `server/src/routes/v8/sync.routes.ts`
   - added `POST /api/v8/sync/integrations/:integrationId/pause`
   - added `POST /api/v8/sync/integrations/:integrationId/resume`

2. Frontend V8-first mutation seam
   - extended `src/services/api/v8/sync.ts`
   - updated `src/components/Admin/UnifiedSyncHub.tsx`
   - active pause/resume actions now try the governed V8 mutations first
   - legacy `sync-hub` pause/resume remains fallback-only for bounded compatibility statuses

3. Regression coverage
   - extended `server/src/routes/v8/__tests__/sync.routes.test.ts`
   - extended `tests/unit/services/v8-sync-api.test.ts`
   - extended `tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`

## Why this matters

This closes the next bounded lifecycle control gap inside the active sync hub:

- operators now pause and resume integrations through the same governed namespace that already backs sync observability and recovery reads
- the active sync lane no longer drops back to legacy-only lifecycle controls during normal pause/resume handling
- the next packet can focus on the remaining lifecycle action breadth instead of pause/resume drift

## Verification

`npx vitest run server/src/routes/v8/__tests__/sync.routes.test.ts tests/unit/services/v8-sync-api.test.ts tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`
