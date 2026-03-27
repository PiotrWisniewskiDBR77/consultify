# V8.1 broader Sync reauth pending-state honesty seam

Date: 2026-03-27
Lane: broader `Sync` completion
Taxonomy: `T4`
Packet: fifth bounded packet after broader-lane promotion

## Why this packet

After pending config submission continuity landed, the next smallest active residual was on reauthorization itself:

- the active sync hub could trigger reauthorization for `requires_reauth` integrations
- but the governed V8 reauth mutation still auto-promoted the integration back to `connected` after a timeout
- this mixed a real reauth trigger with fake callback completion even though no governed callback round-trip exists yet

This made reauth pending-state honesty smaller and more honest than implementing full OAuth callback / refresh lifecycle continuity in one packet.

## What changed

### Governed V8 runtime truth

- updated `server/src/routes/v8/sync.routes.ts`
- governed `POST /api/v8/sync/integrations/:integrationId/reauth` now keeps integrations in `pending` state instead of auto-claiming recovery
- the route transitions connector auth truth to `connecting`, derives honest pending onboarding status, and records audit without pretending callback completion already happened

### Bounded legacy fallback truth

- updated `server/src/routes/syncHub.routes.ts`
- legacy fallback reauth no longer auto-resolves to `connected` after a timeout either

### Active surface continuity

- updated `src/services/api/v8/sync.ts`
- updated `src/components/Admin/UnifiedSyncHub.tsx`
- the active hub now refreshes immediately after reauth initiation and shows honest pending-auth messaging instead of waiting for a fake recovered state

## Regression coverage

Passed:

- `server/src/routes/v8/__tests__/sync.routes.test.ts`
- `tests/unit/services/v8-sync-api.test.ts`
- `tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`

Verification command:

`npx vitest run server/src/routes/v8/__tests__/sync.routes.test.ts tests/unit/services/v8-sync-api.test.ts tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`

Result: `59` tests passing.

## Residual after this packet

Broader `Sync` completion is still not done.

Remaining honest residuals include:

- real OAuth callback / external authorization round-trip continuity after reauth or connect initiation
- refresh / recovery continuity once external authorization completes
- deeper authority alignment between governed `v8`, legacy `sync-hub`, canonical org-level `/api/integrations`, and user-level settings integrations
