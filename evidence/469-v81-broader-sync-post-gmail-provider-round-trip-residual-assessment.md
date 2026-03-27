# V8.1 Evidence - Broader Sync post-Gmail provider round-trip residual assessment

Lane: broader `Sync` completion
Date: 2026-03-27
Status: assessed

## Why this assessment was needed

After the twentieth broader-sync packet landed, the shared governed provider round-trip seam now covers:

- `jira`
- `gmail`

across the shared builder and callback materialization flow.

The next question was whether the lane should continue with another provider callback-driven coverage packet, or whether the smallest honest next step had now become deeper authority alignment across the remaining integration surfaces.

## What was checked

1. Shared governed provider round-trip coverage after packet `20`:
   - `server/src/services/v8/pmSyncExternalAuthMaterializationService.ts`
   - `server/src/routes/v8/sync.routes.ts`
   - `server/src/routes/integrations/integrations.routes.ts`
   - the shared governed provider seam now produces real provider auth and callback-driven materialization for `jira` and `gmail`
   - other governed oauth2 connectors still fall back to the callback landing URL as `authUrl`
   - callback-driven token and refresh-secret materialization still stops at `jira` and `gmail`

2. Remaining active governed oauth2 candidates:
   - `server/src/services/integrationHubService.ts`
   - `server/src/routes/v8/sync.routes.ts`
   - active `v8` / `sync-hub` surfaces still mark `slack`, `jira`, `gmail`, `asana`, and `teams` as `isV2Ready`
   - among the remaining connectors, `teams` is the only active-ready oauth2 connector already hinted by shared env-backed auth wiring through `hasGovernedExternalAuthEnvConfig()`
   - `teams` also already has shared Microsoft env configuration available through `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, and `MICROSOFT_CALLBACK_URL`

3. Why `teams` is thinner than other remaining providers:
   - `server/src/services/v8/pmSyncExternalAuthMaterializationService.ts`
   - `server/src/config/Config.ts`
   - `teams` already has a bounded connector-specific config shape (`tenant_id`) and env-backed provider credentials
   - `slack` and `asana` still need additional provider-specific app-auth decisions not yet hinted in the shared governed helper
   - `azure_devops` and `powerbi` share the Microsoft family, but they are not the thinnest next step because the active governed surfaces do not currently treat them as the narrow active-ready continuation seam

4. Why deeper authority alignment is still broader:
   - `server/src/routes/settings.routes.ts`
   - user-level `/api/settings/integrations/*` still writes separate preferences-backed connected truth with `authUrl: null`
   - that surface still uses different storage, ownership, and lifecycle semantics than the active governed connector path
   - so authority alignment remains broader than one more shared provider round-trip packet

## Assessment result

Another provider callback-driven coverage packet is still the next smallest honest broader-sync step.

The thinnest candidate is `teams`.

Why:

- the shared governed seam is already proven across `jira` and `gmail`
- `teams` is already wired into the active-ready governed surfaces
- `teams` already has env-backed shared auth configuration, making it a thinner bounded extension than `slack`, `asana`, or a broader Microsoft-family bundle
- deeper authority alignment still crosses different ownership models and remains broader than one more provider seam

## Outcome

The lane remains active.

No implementation was landed in this assessment packet.
The next honest implementation step is to promote `teams` governed provider round-trip coverage on the shared governed oauth2 seam.
