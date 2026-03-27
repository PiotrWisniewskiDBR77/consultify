# V8.1 broader Sync Asana governed provider round-trip coverage seam

Date: 2026-03-27
Lane: broader `Sync` completion
Taxonomy: `T4`
Packet: twenty-fourth bounded packet after broader-lane promotion

## Why this packet

After the post-Slack assessment, `asana` was the final active-ready oauth2 connector still missing real shared governed provider round-trip coverage.

That made it the next honest broader-sync implementation step because:

- active `v8` / `sync-hub` surfaces already treat `asana` as `isV2Ready`,
- the governed runtime already carries the Asana token endpoint,
- and extending the existing shared materialization seam was still smaller than crossing into deeper authority alignment.

## What changed

### Asana now has a real governed provider authorization URL

- updated `server/src/services/v8/pmSyncExternalAuthMaterializationService.ts`
- `buildGovernedExternalAuthSession()` now returns a real Asana OAuth authorization URL for `asana`
- the shared builder now uses env-backed Asana client credentials
- the active V8 pending-configuration seam now prepares a real provider authorization URL once Asana reaches `pending_external_auth`

### Asana callback now materializes governed credential and refresh truth

- updated `server/src/services/v8/pmSyncExternalAuthMaterializationService.ts`
- `shouldMaterializeCallbackDrivenAuth()` now includes `asana`
- Asana callback materialization now exchanges the authorization code for tokens on `https://app.asana.com/-/oauth_token`
- the materializer resolves authenticated Asana user identity from `https://app.asana.com/api/1.0/users/me`
- the materializer stores governed credential baseline truth through `pmSyncAuthService`
- when a refresh token is issued, it also stores governed refresh execution secret material through `pmSyncRefreshExecutionService`

### Asana env contract is now explicit

- updated `server/src/config/Config.ts`
- updated `server/src/config/ConfigValidator.ts`
- updated `.env.example`
- updated `.env.production.example`
- Asana client credentials are now part of the shared governed auth configuration contract instead of remaining implicit

### Focused regressions were extended

- updated `server/src/services/v8/__tests__/pmSyncExternalAuthMaterializationService.test.ts`
- updated `server/src/routes/v8/__tests__/sync.routes.test.ts`
- added focused coverage for real Asana provider auth URL preparation and callback-driven governed materialization

### Scope stayed bounded

- no new authority surface was promoted
- no `/api/settings/integrations` ownership alignment was attempted
- no broader post-provider authority packet was mixed into this seam

## Regression coverage

Passed:

- `server/src/services/v8/__tests__/pmSyncExternalAuthMaterializationService.test.ts`
- `server/src/routes/v8/__tests__/sync.routes.test.ts`

Verification command:

`npx vitest run server/src/services/v8/__tests__/pmSyncExternalAuthMaterializationService.test.ts server/src/routes/v8/__tests__/sync.routes.test.ts`

Result: `51` tests passing.

## Residual after this packet

Broader `Sync` completion is still not done.

Remaining honest residuals include:

- assessing whether any thinner provider packet still remains after Asana coverage, or whether deeper authority alignment is now the next smallest broader-sync step
- deeper authority alignment still remains between governed `v8`, legacy `sync-hub`, canonical org-level `/api/integrations`, and user-level settings integrations
