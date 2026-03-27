# V8.1 Evidence - Broader Sync post-Teams provider round-trip residual assessment

Lane: broader `Sync` completion
Date: 2026-03-27
Status: assessed

## Why this assessment was needed

After the twenty-first broader-sync packet landed, the shared governed provider round-trip seam now covers:

- `jira`
- `gmail`
- `teams`

The next question was whether one more provider callback-driven coverage packet still remains thinner than deeper authority alignment, or whether the lane has now reached the point where the separate authority surfaces should be aligned before any more provider work lands.

## What was checked

1. Shared governed provider round-trip coverage after packet `21`:
   - `server/src/services/v8/pmSyncExternalAuthMaterializationService.ts`
   - `server/src/routes/v8/sync.routes.ts`
   - `server/src/routes/integrations/integrations.routes.ts`
   - the shared governed provider seam now produces real provider auth and callback-driven materialization for `jira`, `gmail`, and `teams`
   - other governed oauth2 connectors still fall back to the callback landing URL as `authUrl`
   - callback-driven token and refresh-secret materialization still stops at those three connectors

2. Remaining active governed oauth2 candidates:
   - `server/src/services/integrationHubService.ts`
   - `server/src/routes/v8/sync.routes.ts`
   - active `v8` / `sync-hub` surfaces still mark `slack`, `jira`, `gmail`, `asana`, and `teams` as `isV2Ready`
   - after the Teams packet, the remaining active-ready oauth2 connectors are `slack` and `asana`

3. Why `slack` is still thinner than deeper authority alignment:
   - `server/src/routes/v8/sync.routes.ts`
   - `tests/server/services/userIntegrationService.test`
   - the active governed runtime already carries a Slack token endpoint (`https://slack.com/api/oauth.v2.access`)
   - legacy repo assumptions still reference `SLACK_CLIENT_ID` and Slack OAuth URL generation, which means Slack auth shape is less speculative than Asana in this codebase
   - `asana` has an endpoint hint, but the repo does not show the same existing auth-config clue on the active path

4. Why deeper authority alignment is still broader:
   - `server/src/routes/settings.routes.ts`
   - user-level `/api/settings/integrations/*` still writes separate preferences-backed connected truth with `authUrl: null`
   - that surface still uses different storage, ownership, and lifecycle semantics than the active governed connector path
   - so authority alignment still spans different models and remains broader than one more shared provider round-trip packet

## Assessment result

One more provider callback-driven coverage packet still remains the next smallest honest broader-sync step.

The thinnest next candidate is `slack`.

Why:

- the shared governed seam is already proven across three connectors
- `slack` remains active-ready on governed surfaces
- the repo already carries stronger Slack-specific OAuth clues than it does for Asana
- deeper authority alignment still crosses separate ownership and storage models, so it remains broader than one more provider seam

## Outcome

The lane remains active.

No implementation was landed in this assessment packet.
The next honest implementation step is to promote `slack` governed provider round-trip coverage on the shared governed oauth2 seam.
