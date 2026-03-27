# V8.1 Evidence - Broader Sync post-org-surface alignment residual assessment

Lane: broader `Sync` completion
Date: 2026-03-27
Status: assessed

## Why this assessment was needed

After canonical and alias org-level connect initiation continuity landed, the lane still had two named residual buckets:

- real governed refresh execution continuity
- deeper authority alignment between governed `v8`, legacy `sync-hub`, canonical org-level `/api/integrations`, and user-level settings integrations

The question was whether one more thinner honest packet still existed before moving into either of those heavier areas.

## What was checked

1. Org-level authority seams after the latest packets:
   - `server/src/routes/integrations/integrations.routes.ts`
   - `src/components/settings/IntegrationSettings.tsx`
   - `src/components/settings/integrations/IntegrationsMarketplace.tsx`
   - `src/components/settings/notifications/NotificationChannelsSettings.tsx`
   - both org-level connect entrypoints now route into the same governed connector initiation path
   - org-level readback already surfaces governed pending truth instead of fake immediate connected truth
   - no thinner org-level connect/readback split remains inside the same ownership model

2. User-scoped settings breadth:
   - `server/src/routes/settings.routes.ts`
   - `src/hooks/useUserIntegrations.ts`
   - user settings integrations still live in separate user-preferences storage with their own connect/refresh/config flows
   - pulling that surface onto governed sync authority would require ownership and data-model decisions across user-scoped and org-scoped systems, not one more local seam

3. Governed refresh runtime viability:
   - `server/src/routes/v8/sync.routes.ts`
   - `server/src/services/v8/pmSyncAuthService.ts`
   - the active governed sync path can now materialize credentials, record refresh outcomes, and block stale runs honestly
   - but the active runtime still has no real provider token refresh executor, and the route explicitly returns `REFRESH_EXECUTION_REQUIRED` when the credential is already inside the refresh window
   - no smaller runtime packet remains that would be more honest than promoting real refresh execution itself

## Assessment result

No thinner honest packet remains before real governed refresh execution continuity.

Why:

- the active governed sync path is now aligned across sync hub and org-level connect/readback surfaces
- remaining user-level settings work is broader authority alignment, not one more local continuity seam
- refresh execution is the next real runtime gap because the system already stores credential baseline truth and refresh-result truth, but still cannot execute the refresh step itself

## Residual now considered real

The next honest residuals are:

- real governed refresh execution continuity for governed sync connectors
- deeper authority alignment between governed `v8`, legacy `sync-hub`, canonical org-level `/api/integrations`, and user-level settings integrations

## Outcome

The lane remains active, but no additional runtime packet was landed in this assessment.
The next honest implementation step is to promote real governed refresh execution continuity explicitly, rather than pretending one more thinner authority packet still exists beforehand.
