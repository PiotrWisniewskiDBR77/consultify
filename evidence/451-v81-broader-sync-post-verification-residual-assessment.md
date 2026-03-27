# V8.1 Evidence - Broader Sync Post-Verification Residual Assessment

Lane: broader `Sync` completion
Date: 2026-03-27
Status: assessed

## Why this assessment was needed

After post-callback verification continuity landed, the lane still had two named residual buckets:

- post-auth refresh / recovery continuity
- deeper authority alignment between governed `v8`, legacy `sync-hub`, canonical org-level `/api/integrations`, and user-level settings integrations

The question was whether one more thinner honest packet still existed before moving into either of those heavier areas.

## What was checked

1. Governed auth baseline runtime viability:
   - `server/src/services/v8/pmSyncAuthService.ts`
   - `server/src/routes/v8/sync.routes.ts`
   - `server/src/routes/syncHub.routes.ts`
   - the repo has shared auth-baseline primitives such as `storeCredential()`, `recordRefreshResult()`, refresh timing policies, and auth escalations
   - but these primitives are not wired into the active sync callback/runtime seam
   - `recordRefreshResult()` currently requires an existing row in `v8_connection_credentials`, and no sync route stores that credential after callback landing

2. Legacy settings and org-surface authority breadth:
   - `server/src/routes/settings.routes.ts`
   - `server/src/routes/integrations/integrations.routes.ts`
   - `src/hooks/useUserIntegrations.ts`
   - user settings integrations still use separate user-scoped storage and trivial refresh/connect flows
   - canonical `/api/integrations` still carries its own connect/disconnect/toggle semantics against the shared `integrations` table
   - these surfaces are broader than the active sync hub and would require cross-surface ownership decisions rather than one more local continuity seam

3. Active broader-sync surface state after the first seven implementation packets:
   - `src/components/Admin/UnifiedSyncHub.tsx`
   - the active hub can now carry the operator from governed connect initiation through pending config, reauth honesty, callback landing, and explicit verification completion into connected truth
   - the remaining gap is no longer about visible onboarding continuity on that active surface

## Assessment result

No thinner honest post-verification packet remains before broader post-auth credential / refresh continuity.

Why:

- the active sync hub onboarding chain is now continuous through ready-state promotion
- governed refresh/recovery primitives exist, but they are still disconnected from the callback/runtime seam because no sync route materializes credential state into `v8_connection_credentials`
- inventing a fake refresh packet without real stored credential truth would be less honest than explicitly promoting credential / refresh continuity
- deeper authority alignment is broader still because it spans separate user-scoped settings flows, org-scoped `/api/integrations`, and active `v8` sync surfaces with mismatched contracts and ownership models

## Residual now considered real

The next honest residuals are:

- broader post-auth credential / refresh / recovery continuity for governed sync connectors
- deeper authority alignment between governed `v8`, legacy `sync-hub`, canonical org-level `/api/integrations`, and user-level settings integrations

## Outcome

The lane remains active, but no additional runtime packet was landed in this assessment.
The next honest implementation step is to promote broader post-auth credential / refresh continuity explicitly, rather than pretending one more thinner packet still exists beforehand.
