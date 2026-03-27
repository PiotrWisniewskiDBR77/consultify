# V8.1 broader Sync completion split-brain map

Date: 2026-03-27
Lane: broader `Sync` completion
Taxonomy: `T4`
Status: active

## Current live surface

The live broader sync residual is centered on:

- `src/components/Admin/UnifiedSyncHub.tsx`
- `server/src/routes/v8/sync.routes.ts`
- `server/src/routes/syncHub.routes.ts`
- `server/src/routes/integrations/integrations.routes.ts`
- `server/src/routes/settings.routes.ts`

with `UnifiedSyncHub` still acting as the visible admin/operator sync shell.

## Split-brain findings

1. active sync hub reads and most lifecycle mutations already prefer governed `/api/v8/sync/*`, but the visible connect CTA still used legacy `POST /api/sync-hub/connect`
2. the legacy `sync-hub` connect route expects connector-specific config truth while the active UI submits empty config from the catalog modal
3. the legacy `sync-hub` connect flow promotes fake `connected` truth immediately even though broader OAuth/provider onboarding completion is still not implemented
4. canonical org-level `/api/integrations/*` and user-level `/api/settings/integrations/*` remain parallel connection surfaces with different contracts and scope
5. broader sync completion therefore starts with connect/onboarding authority rather than pretending full callback/refresh/provider completion is already solved

## Smallest clean starting packet

Chosen packet:

- add a governed V8-first connect initiation seam for the active sync hub
- keep newly initiated sync connections in an honest `pending` onboarding state
- leave callback/refresh/provider-specific follow-up breadth explicit for later packets

## Follow-up candidates

- OAuth callback / reauthorization round-trip continuity on governed sync seams
- provider-specific onboarding/config follow-up continuity after the initial connect action
- org-level sync completion alignment between `v8`, `sync-hub`, and canonical `/api/integrations` authority
