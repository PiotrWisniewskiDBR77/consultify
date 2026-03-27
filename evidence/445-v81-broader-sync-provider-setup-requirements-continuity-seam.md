# V8.1 broader Sync provider setup requirements continuity seam

Date: 2026-03-27
Lane: broader `Sync` completion
Taxonomy: `T4`
Packet: third bounded packet after broader-lane promotion

## Why this packet

The first two broader sync packets moved connect initiation onto a governed V8 seam and kept pending integrations honest on the live `UnifiedSyncHub`.

That left the next smallest active residual on the same live surface:

- the hub truthfully showed integrations as `pending`
- but it still did not tell the operator which provider-specific setup fields were actually still missing
- this left pending onboarding honest in status but opaque in follow-up requirements

This made provider setup requirements continuity smaller and more honest than claiming full OAuth callback / refresh completion.

## Why this is smaller than OAuth callback / refresh

OAuth callback / refresh continuity is still broader because it requires real provider round-trip handling, token lifecycle truth, and governed recovery behavior across multiple routes and provider families.

By contrast, this packet only exposes already-known connector setup requirements from the existing connector registry onto the governed V8 catalog and active sync hub surfaces.

## What changed

### Governed V8 contract continuity

- updated `server/src/routes/v8/sync.routes.ts`
- governed connector catalog responses now include `configFields`
- governed connect-initiation responses now echo the connector's setup requirements alongside the initiated pending integration

### Governed inventory continuity

- updated `server/src/services/v8/pmSyncInventoryService.ts`
- governed sync inventory rows now carry connector `configFields` into active integration readback

### Active surface continuity

- updated `src/services/api/v8/sync.ts`
- updated `src/components/Admin/UnifiedSyncHub.tsx`
- connector cards in the active connect modal now show the required provider setup fields before connect initiation
- pending onboarding banners now show the same required setup fields after initiation so operators can see what follow-up is still needed

## Regression coverage

Passed:

- `server/src/routes/v8/__tests__/sync.routes.test.ts`
- `tests/unit/services/v8-sync-api.test.ts`
- `tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`

Verification command:

`npx vitest run server/src/routes/v8/__tests__/sync.routes.test.ts tests/unit/services/v8-sync-api.test.ts tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`

Result: `55` tests passing.

## Residual after this packet

Broader `Sync` completion is still not done.

Remaining honest residuals include:

- provider-specific config submission / completion continuity after requirements are shown
- OAuth callback / refresh / reauthorization round-trip completion beyond initiation and requirements readback
- deeper authority alignment between governed `v8`, legacy `sync-hub`, canonical org-level `/api/integrations`, and user-level settings integrations
