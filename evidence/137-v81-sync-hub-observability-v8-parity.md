# V8.1 Sync Hub Observability V8 Parity

Date: 2026-03-26
Lane: `Sync / connectors / interoperability`
Taxonomy: `T2`
Status: `done`

## Goal

Move the active sync hub observability/read surfaces onto governed V8-first seams instead of keeping
catalog, health summary, unresolved errors, and audit log on direct legacy `sync-hub` reads.

## What changed

1. Backend V8 parity
   - extended `server/src/routes/v8/sync.routes.ts`
   - added `GET /api/v8/sync/connectors`
   - added `GET /api/v8/sync/health`
   - added `GET /api/v8/sync/errors`
   - added `GET /api/v8/sync/audit-log`

2. Frontend V8-first client seam
   - extended `src/services/api/v8/sync.ts`
   - updated `src/components/Admin/UnifiedSyncHub.tsx`
   - the active sync hub now reads catalog, health summary, errors, and audit log from governed V8 first
   - legacy `sync-hub` reads remain fallback-only for bounded compatibility statuses

3. Regression coverage
   - extended `server/src/routes/v8/__tests__/sync.routes.test.ts`
   - extended `tests/unit/services/v8-sync-api.test.ts`
   - extended `tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`

## Why this matters

This removes another active sync read island from the operator-facing hub:

- the sync hub no longer mixes governed V8 auth/conflict sections with separate legacy observability reads during normal operation
- catalog, health summary, unresolved errors, and audit log now share the governed sync namespace
- the next packet can focus on bounded operator recovery mutations rather than hub read ambiguity

## Verification

`npx vitest run server/src/routes/v8/__tests__/sync.routes.test.ts tests/unit/services/v8-sync-api.test.ts tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx tests/unit/settings/sync-entry-resolver.test.ts`
