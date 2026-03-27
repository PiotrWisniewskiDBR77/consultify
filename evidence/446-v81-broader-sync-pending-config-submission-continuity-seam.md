# V8.1 broader Sync pending config submission continuity seam

Date: 2026-03-27
Lane: broader `Sync` completion
Taxonomy: `T4`
Packet: fourth bounded packet after broader-lane promotion

## Why this packet

The third broader sync packet exposed provider setup requirements on the governed catalog and pending onboarding surfaces.

That left the next smallest active residual on the same live sync hub:

- operators could now see which provider setup fields were still required
- but the active `UnifiedSyncHub` still had no governed way to submit those fields after connect initiation
- this left pending onboarding honest in requirements readback but incomplete in follow-up action continuity

This made pending config submission continuity smaller and more honest than jumping straight to full OAuth callback / refresh lifecycle continuity.

## What changed

### Governed V8 mutation continuity

- updated `server/src/routes/v8/sync.routes.ts`
- added governed `POST /api/v8/sync/integrations/:integrationId/configure`
- the new mutation merges submitted setup fields into the pending integration config, records audit, and returns honest onboarding status instead of pretending callback completion already exists

### Governed inventory readback

- updated `server/src/services/v8/pmSyncInventoryService.ts`
- governed sync inventory rows now expose `configuredFields` and a derived pending `onboardingStatus`
- the readback keeps provider secrets opaque while still telling the active UI which setup fields are already saved

### Active surface continuity

- updated `src/services/api/v8/sync.ts`
- updated `src/components/Admin/UnifiedSyncHub.tsx`
- pending integrations on the live hub can now open a bounded provider-config editor for missing required fields
- after config submission, the hub truthfully shifts pending messaging from `auth or config required` to `external auth still required` when configuration is complete for governed OAuth connectors
- sync controls remain disabled until broader auth lifecycle continuity is actually implemented

## Regression coverage

Passed:

- `server/src/routes/v8/__tests__/sync.routes.test.ts`
- `tests/unit/services/v8-sync-api.test.ts`
- `tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`

Verification command:

`npx vitest run server/src/routes/v8/__tests__/sync.routes.test.ts tests/unit/services/v8-sync-api.test.ts tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`

Result: `58` tests passing.

## Residual after this packet

Broader `Sync` completion is still not done.

Remaining honest residuals include:

- OAuth callback / refresh / reauthorization round-trip continuity after pending config submission
- provider validation / completion continuity for connectors that are configured but not yet externally authorized
- deeper authority alignment between governed `v8`, legacy `sync-hub`, canonical org-level `/api/integrations`, and user-level settings integrations
