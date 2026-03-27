# V8.1 Evidence - Broader Sync post-refresh-execution residual assessment

Lane: broader `Sync` completion
Date: 2026-03-27
Status: assessed

## Why this assessment was needed

After governed refresh execution continuity landed, the lane still had two visible residual buckets:

- callback-driven governed refresh secret or token materialization continuity
- deeper authority alignment between governed `v8`, legacy `sync-hub`, canonical org-level `/api/integrations`, and user-level settings integrations

The question was whether one more thinner honest packet still existed before moving into either of those broader areas.

## What was checked

1. Current active external-auth round-trip on the governed sync path:
   - `server/src/routes/v8/sync.routes.ts`
   - `server/src/routes/syncHub.routes.ts`
   - `server/src/services/syncExternalAuthSessionService.ts`
   - governed connect/configure and reauth flows still issue only a bounded sync auth session and return a local callback landing URL
   - the public callback route still records callback arrival truth only and does not perform provider token exchange or governed refresh-secret materialization

2. Provider-auth/runtime viability:
   - `server/src/services/oauthService.ts`
   - `server/src/config/Config.ts`
   - repo-level OAuth helpers only cover app-auth/social flows (`google`, `linkedin`) rather than governed sync connector completion
   - the active sync connector set has no shared sync-specific provider authorization URL generator or token-exchange service for connectors like `jira`, `asana`, `slack`, or `teams`
   - because current sync `authUrl` is still a callback landing placeholder, callback-driven governed secret materialization would require the real provider authorization round-trip itself, not just one more local write seam

3. Remaining authority breadth:
   - `server/src/routes/integrations/integrations.routes.ts`
   - `server/src/routes/settings.routes.ts`
   - `src/hooks/useUserIntegrations.ts`
   - deeper authority alignment is broader still because it spans governed `v8`, legacy `sync-hub`, org-level canonical integrations, and separate user-scoped settings integrations with different storage and ownership models

## Assessment result

No thinner honest packet remains before callback-driven governed refresh secret or token materialization continuity.

Why:

- the active governed sync runtime can now execute real refresh when governed secret material already exists
- the remaining gap on the active path is no longer a local runtime seam; it is the missing provider authorization and token-exchange round-trip that would materialize governed secret or token truth directly from callback completion
- deeper authority alignment is broader than that because it crosses multiple surfaces and ownership models instead of staying on the active governed sync path

## Residual now considered real

The next honest residuals are:

- callback-driven governed refresh secret or token materialization continuity for governed sync connectors
- deeper authority alignment between governed `v8`, legacy `sync-hub`, canonical org-level `/api/integrations`, and user-level settings integrations

## Outcome

The lane remains active, but no additional runtime packet was landed in this assessment.
The next honest implementation step is to promote callback-driven governed refresh secret or token materialization continuity explicitly, rather than pretending one more thinner shared packet still exists beforehand.
