# V8.1 Sync Error Resolution V8 Parity

Date: 2026-03-26
Lane: `Sync / connectors / interoperability`
Taxonomy: `T2`
Status: `done`

## Goal

Add a governed V8-first control mutation for resolving sync errors so the active sync hub no longer
mixes a V8 error list with a legacy-only error resolution action.

## What changed

1. Backend V8 parity
   - extended `server/src/routes/v8/sync.routes.ts`
   - added `POST /api/v8/sync/errors/:errorId/resolve`

2. Frontend V8-first mutation seam
   - extended `src/services/api/v8/sync.ts`
   - updated `src/components/Admin/UnifiedSyncHub.tsx`
   - active sync error resolution now tries the governed V8 mutation first
   - legacy `sync-hub` mutation remains fallback-only for bounded compatibility statuses

3. Regression coverage
   - extended `server/src/routes/v8/__tests__/sync.routes.test.ts`
   - extended `tests/unit/services/v8-sync-api.test.ts`
   - extended `tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`

## Why this matters

This closes the first bounded sync recovery mutation gap after the hub read cleanup:

- the active error list and error resolution action now sit on the same governed namespace
- operators no longer fall back to a legacy-only action during normal sync error recovery
- the next packet can focus on the remaining lifecycle controls instead of error-resolution drift

## Verification

`npx vitest run server/src/routes/v8/__tests__/sync.routes.test.ts tests/unit/services/v8-sync-api.test.ts tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx tests/unit/settings/sync-entry-resolver.test.ts`
