# V8.1 broader Sync Teams governed provider round-trip coverage seam

Date: 2026-03-27
Lane: broader `Sync` completion
Taxonomy: `T4`
Packet: twenty-first bounded packet after broader-lane promotion

## Why this packet

After the post-Gmail assessment, the next honest broader-sync residual was still one more provider callback-driven coverage seam rather than deeper authority alignment.

`teams` was the thinnest next provider because:

- it was already marked active-ready on the governed `v8` and `sync-hub` surfaces,
- the shared governed auth helper already hinted Microsoft env-backed auth availability,
- and it needed only one more shared provider branch instead of a broader authority or provider-family bundle.

## What changed

### Teams now has a real governed provider authorization URL

- updated `server/src/services/v8/pmSyncExternalAuthMaterializationService.ts`
- `buildGovernedExternalAuthSession()` now returns a real Microsoft OAuth authorization URL for `teams`
- the shared builder uses `tenant_id` plus env-backed Microsoft client credentials
- the active V8 pending-configuration seam now prepares a real provider authorization URL once Teams reaches `pending_external_auth`

### Teams callback now materializes governed credential and refresh truth

- updated `server/src/services/v8/pmSyncExternalAuthMaterializationService.ts`
- `shouldMaterializeCallbackDrivenAuth()` now includes `teams`
- Teams callback materialization now exchanges the Microsoft authorization code for tokens
- the materializer fetches Microsoft Graph `me` identity and stores governed credential baseline truth through `pmSyncAuthService`
- when a refresh token is issued, it also stores governed refresh execution secret material through `pmSyncRefreshExecutionService`

### Scope stayed bounded

- no new authority surface was promoted
- no `/api/settings/integrations` ownership alignment was attempted
- no broader Microsoft-family multi-provider bundle was mixed into the same packet

## Regression coverage

Passed:

- `server/src/services/v8/__tests__/pmSyncExternalAuthMaterializationService.test.ts`
- `server/src/routes/v8/__tests__/sync.routes.test.ts`

Verification command:

`npx vitest run server/src/services/v8/__tests__/pmSyncExternalAuthMaterializationService.test.ts server/src/routes/v8/__tests__/sync.routes.test.ts`

Result: `43` tests passing.

## Residual after this packet

Broader `Sync` completion is still not done.

Remaining honest residuals include:

- assessing whether one more provider callback-driven coverage packet or deeper authority alignment is now the next smallest broader-sync step
- non-Jira, non-Gmail, non-Teams governed oauth2 connectors still do not all produce real provider auth URLs and callback-driven materialization on the shared governed seam
- deeper authority alignment still remains between governed `v8`, legacy `sync-hub`, canonical org-level `/api/integrations`, and user-level settings integrations
