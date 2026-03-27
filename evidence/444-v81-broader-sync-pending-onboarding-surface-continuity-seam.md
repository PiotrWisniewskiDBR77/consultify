# V8.1 broader Sync pending onboarding surface continuity seam

Date: 2026-03-27
Lane: broader `Sync` completion
Taxonomy: `T4`
Packet: second bounded packet after broader-lane promotion

## Why this packet

The first broader sync packet moved active connect initiation onto a governed V8 seam and kept newly initiated integrations in honest `pending` onboarding state.

That created the next smallest active residual on the live sync hub:

- the active `UnifiedSyncHub` surface now showed a real `pending` state
- but it still exposed ready-state sync controls like `Run now`, `Pause`, and `Resume`
- this mixed truthful onboarding status with misleading operator actions before auth/config setup was complete

This makes pending-onboarding surface continuity the next smallest honest packet for broader `Sync` completion.

## What changed

### Active surface continuity

- updated `src/components/Admin/UnifiedSyncHub.tsx`
- pending integrations now render a dedicated onboarding banner instead of looking like a degraded-but-usable connector
- the hub now explains that external auth or provider configuration must complete before sync controls become available
- `Run now` and `Pause` actions are disabled for `pending` integrations
- `Resume` is hidden for `pending` integrations
- `Disconnect` remains available so operators can still back out of an incomplete setup

### Runtime truth preserved

- no fake callback/refresh/provider completion was added
- the packet keeps the broader lane honest by matching the visible UI controls to the already-recorded `pending` onboarding truth

## Regression coverage

Passed:

- `tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`

Verification command:

`npx vitest run tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`

Result: `9` tests passing.

## Residual after this packet

Broader `Sync` completion is still not done.

Remaining honest residuals include:

- OAuth callback / refresh / reauthorization round-trip completion beyond the initiation seam
- provider-specific setup/config follow-up after connect initiation
- deeper authority alignment between governed `v8`, legacy `sync-hub`, canonical org-level `/api/integrations`, and user-level settings integrations
