# V8.1 broader Sync post-callback verification continuity seam

Date: 2026-03-27
Lane: broader `Sync` completion
Taxonomy: `T4`
Packet: seventh bounded packet after broader-lane promotion

## Why this packet

After callback landing continuity landed, the next smallest active residual was immediately after callback receipt:

- the governed callback route could now record `connected_pending_verification`
- but the active sync hub still stranded operators in pending onboarding even after the existing governed auth-state seam could mark the connector `healthy`
- the only completion control lived in the lower V8 connector-health panel, and governed inventory still kept integrations visibly `pending` even when auth truth had already moved to `healthy`

This made post-callback verification / ready-state promotion continuity smaller and more honest than jumping straight into token refresh / recovery breadth.

## What changed

### Governed inventory continuity

- updated `server/src/services/v8/pmSyncInventoryService.ts`
- governed inventory now promotes integrations from `pending` to `connected` when connector auth truth is already `healthy`
- pending onboarding status now clears once callback verification is explicitly completed

### Active surface continuity

- updated `src/components/Admin/UnifiedSyncHub.tsx`
- callback-received pending integrations now expose a direct `Mark verification complete` action on the active onboarding banner
- the action reuses the existing governed auth-state seam with a callback-specific reason and refreshes the active integrations inventory, so operators no longer need to switch to the lower connector-health panel to finish the flow

## Regression coverage

Passed:

- `server/src/services/v8/__tests__/pmSyncInventoryService.test.ts`
- `tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`

Verification command:

`npx vitest run server/src/services/v8/__tests__/pmSyncInventoryService.test.ts tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`

Result: `13` tests passing.

## Residual after this packet

Broader `Sync` completion is still not done.

Remaining honest residuals include:

- post-auth refresh / recovery continuity once ready-state promotion exists on the active hub
- deeper authority alignment between governed `v8`, legacy `sync-hub`, canonical org-level `/api/integrations`, and user-level settings integrations
- wider provider-specific verification semantics that should not be smuggled into this shared callback-to-ready-state packet
