# V8.1 Sync Run Now V8 Parity

Date: 2026-03-26
Lane: `Sync / connectors / interoperability`
Taxonomy: `T2`
Status: `done`

## Goal

Add a governed V8-first lifecycle mutation for manual `run now` sync execution so the active
`UnifiedSyncHub` no longer relies on a legacy-only trigger path for the primary operator action.

## What changed

1. Backend V8 parity
   - extended `server/src/routes/v8/sync.routes.ts`
   - added `POST /api/v8/sync/integrations/:integrationId/sync`
   - preserved the existing guardrails for paused/disconnected integrations and rate limiting

2. Frontend V8-first mutation seam
   - extended `src/services/api/v8/sync.ts`
   - updated `src/components/Admin/UnifiedSyncHub.tsx`
   - active `Run now` now tries the governed V8 mutation first
   - legacy `sync-hub/sync/*` remains fallback-only for bounded compatibility statuses

3. Regression coverage
   - extended `server/src/routes/v8/__tests__/sync.routes.test.ts`
   - extended `tests/unit/services/v8-sync-api.test.ts`
   - extended `tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`

## Why this matters

This closes the next obvious lifecycle control gap inside the active sync hub:

- governed sync reads and governed sync control actions now cover `errors`, `pause`, `resume`, and `run now`
- the live hub keeps rate-limit behavior on the governed path instead of silently downgrading to legacy mutation handling
- the remaining sync lane residuals are now narrower lifecycle/provider breadth items rather than the primary operator run action

## Verification

`npx vitest run server/src/routes/v8/__tests__/sync.routes.test.ts tests/unit/services/v8-sync-api.test.ts tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`
