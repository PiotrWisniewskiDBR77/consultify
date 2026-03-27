# V8.1 Evidence - Broader Sync post-Slack provider round-trip residual assessment

Lane: broader `Sync` completion
Date: 2026-03-27
Status: assessed

## Why this assessment was needed

After the twenty-second broader-sync packet landed, the shared governed provider round-trip seam now covers:

- `jira`
- `gmail`
- `teams`
- `slack`

The next question was whether the lane has finally reached deeper authority alignment as the next smallest honest step, or whether one more provider callback-driven coverage packet still remains thinner.

## What was checked

1. Shared governed provider round-trip coverage after packet `22`:
   - `server/src/services/v8/pmSyncExternalAuthMaterializationService.ts`
   - `server/src/routes/v8/sync.routes.ts`
   - `server/src/routes/integrations/integrations.routes.ts`
   - the shared governed provider seam now produces real provider auth and callback-driven materialization for `jira`, `gmail`, `teams`, and `slack`
   - other governed oauth2 connectors still fall back to the callback landing URL as `authUrl`
   - callback-driven token and refresh-secret materialization still stops at those four connectors

2. Remaining active governed oauth2 candidates:
   - `server/src/services/integrationHubService.ts`
   - `server/src/routes/v8/sync.routes.ts`
   - active `v8` / `sync-hub` surfaces still mark `slack`, `jira`, `gmail`, `asana`, and `teams` as `isV2Ready`
   - after the Slack packet, the only remaining active-ready oauth2 connector without shared governed provider round-trip coverage is `asana`

3. Why `asana` is still thinner than deeper authority alignment:
   - `server/src/services/integrationHubService.ts`
   - `server/src/routes/v8/sync.routes.ts`
   - `asana` already has bounded connector config on the active governed path through `workspace_gid`
   - the active governed runtime already carries an Asana token endpoint (`https://app.asana.com/-/oauth_token`)
   - adding a new Asana env-backed auth contract and a single provider branch is still smaller than aligning the separate user-level `/api/settings/integrations` authority surface

4. Why deeper authority alignment is still broader:
   - `server/src/routes/settings.routes.ts`
   - user-level `/api/settings/integrations/*` still writes separate preferences-backed connected truth with `authUrl: null`
   - that surface still uses different storage, ownership, and lifecycle semantics than the active governed connector path
   - so authority alignment still spans different models and remains broader than one more shared provider round-trip packet

## Assessment result

One more provider callback-driven coverage packet still remains the next smallest honest broader-sync step.

The final thinner candidate is `asana`.

Why:

- the shared governed seam is already proven across four connectors
- `asana` is now the only remaining active-ready oauth2 connector without shared provider round-trip coverage
- even though Asana needs a new explicit env-backed auth contract, that still remains a narrower bounded change than deeper authority alignment across separate authority surfaces
- deeper authority alignment still crosses separate ownership and storage models

## Outcome

The lane remains active.

No implementation was landed in this assessment packet.
The next honest implementation step is to promote `asana` governed provider round-trip coverage on the shared governed oauth2 seam.
