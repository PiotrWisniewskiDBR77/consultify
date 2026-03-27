# V8.1 Evidence - Broader Sync Post-Reauth Residual Assessment

Lane: broader `Sync` completion
Date: 2026-03-27
Status: assessed

## Why this assessment was needed

After reauth pending-state honesty landed, the lane still had two named residual buckets:

- external authorization callback continuity
- post-auth refresh / recovery continuity

The question was whether one more thinner honest packet still existed before moving into either of those heavier areas.

## What was checked

1. Active broader-sync onboarding surfaces after the first five packets:
   - `src/components/Admin/UnifiedSyncHub.tsx`
   - `server/src/routes/v8/sync.routes.ts`
   - `server/src/routes/syncHub.routes.ts`

2. Existing callback/runtime seams:
   - no sync-specific governed callback route exists under `/api/v8/sync/*`
   - no bounded legacy sync callback route exists under `sync-hub`
   - repo-level OAuth callbacks in `server/src/routes/oauthRoutes.routes.ts` are app-auth / social-connect flows, not governed org-level sync connector completion

3. Provider-validation viability:
   - the currently active governed sync connector set remains dominated by `oauth2` connectors
   - non-OAuth connectors now truthfully stop at `configuration_submitted_pending_validation`
   - but there is no thinner shared runtime validation seam on the active hub that can honestly complete those providers without inventing provider-specific verification contracts

## Assessment result

No thinner honest post-reauth packet remains before external authorization callback continuity.

Why:

- connect initiation, pending-surface honesty, setup requirements, config submission, and reauth-trigger honesty are now all closed on the active sync hub
- the remaining gap is no longer about visible trigger continuity; it is about completing the external authorization round-trip itself
- `post-auth refresh / recovery` depends on that round-trip existing first, so it is not a smaller next packet
- `provider validation continuity` would require connector-specific completion semantics that are broader and less honest than first landing a shared callback-completion seam

## Residual now considered real

The next honest residuals are:

- external authorization callback continuity for governed sync connectors
- post-auth refresh / recovery continuity once callback completion exists
- deeper authority alignment between governed `v8`, legacy `sync-hub`, canonical org-level `/api/integrations`, and user-level settings integrations

## Outcome

The lane remains active, but no additional runtime packet was landed in this assessment.
The next honest implementation step is to promote external authorization callback continuity explicitly, rather than pretending one more thinner packet still exists beforehand.
