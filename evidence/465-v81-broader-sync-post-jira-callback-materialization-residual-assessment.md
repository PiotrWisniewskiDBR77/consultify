# V8.1 Evidence - Broader Sync post-Jira-callback materialization residual assessment

Lane: broader `Sync` completion
Date: 2026-03-27
Status: assessed

## Why this assessment was needed

After the eighteenth broader-sync packet landed, the active governed Jira path now has:

- a real provider authorization URL on the V8 path,
- callback-driven governed credential materialization,
- and callback-driven governed refresh-secret materialization.

The next question was whether the lane should now jump to wider provider coverage, or whether a thinner authority seam still remained first.

## What was checked

1. Active governed Jira path after packet `18`:
   - `server/src/routes/v8/sync.routes.ts`
   - `server/src/services/v8/pmSyncExternalAuthMaterializationService.ts`
   - `server/src/routes/syncHub.routes.ts`
   - `src/components/Admin/UnifiedSyncHub.tsx`
   - the active V8 path now builds a real Jira provider authorization URL and the public callback now exchanges the provider `code` into governed credential plus refresh-secret truth

2. Canonical org-level connect surfaces:
   - `server/src/routes/integrations/integrations.routes.ts`
   - `src/components/settings/IntegrationSettings.tsx`
   - `src/components/settings/integrations/IntegrationsMarketplace.tsx`
   - `src/components/settings/notifications/NotificationChannelsSettings.tsx`
   - canonical `POST /api/integrations/connect/:provider` and alias `POST /api/integrations/:provider/connect` still reuse their own duplicated `connectGovernedConnectorIntegration()` helper
   - that helper still issues only a sync auth session and returns the local callback landing URL as `authUrl`
   - those org-level settings surfaces still open whatever `authUrl` they receive, so Jira there remains on the older placeholder path instead of the real governed provider round-trip

3. Broader user-level authority breadth:
   - `src/hooks/useUserIntegrations.ts`
   - `server/src/routes/settings.routes.ts`
   - user-scoped settings integrations remain a separate ownership/storage model and still represent a broader authority-alignment problem than the org-level canonical/alias Jira initiation seam

## Assessment result

A thinner honest packet still remains before wider callback-driven provider coverage.

That thinner packet is:

- canonical org-level Jira provider-auth initiation continuity across `/api/integrations/connect/:provider` and `/api/integrations/:provider/connect`

Why:

- the active V8 Jira path is now honest end-to-end through callback materialization
- but the org-level canonical and alias connect routes still emit stale placeholder `authUrl` truth because they duplicate the older callback-only helper instead of reusing the new governed provider session builder
- wider provider coverage would broaden scope across additional providers before the existing Jira authority seam is re-closed on already-promoted org-level surfaces
- deeper authority alignment remains broader still because it crosses org-level governed surfaces plus distinct user-scoped settings integrations

## Residual now considered real

The next honest residuals are now:

- canonical org-level Jira provider-auth initiation continuity across canonical and alias `/api/integrations` connect routes
- wider callback-driven provider round-trip coverage for additional governed connectors after the Jira org-level authority seam is re-closed
- deeper authority alignment between governed `v8`, legacy `sync-hub`, canonical org-level `/api/integrations`, and user-level settings integrations

## Outcome

The lane remains active.

No implementation was landed in this assessment packet.
The next honest implementation step is to promote canonical org-level Jira provider-auth initiation continuity explicitly, rather than skipping ahead to wider provider coverage or deeper authority alignment.
