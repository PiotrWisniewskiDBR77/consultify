# V8.1 broader Sync Gmail governed provider round-trip coverage seam

Date: 2026-03-27
Lane: broader `Sync` completion
Taxonomy: `T4`
Packet: twentieth bounded packet after broader-lane promotion

## Why this packet

After the post-org-level-Jira assessment, the next honest broader-sync residual was no longer another Jira-specific authority seam.

The shared governed provider builder now served V8 and org-level `/api/integrations`, but only Jira produced a real provider authorization round-trip. Additional governed oauth2 connectors still fell back to the callback landing URL as `authUrl`, and callback-driven token / refresh-secret materialization still stopped at Jira.

The thinnest real widening step was to extend that shared governed round-trip to one env-backed oauth2 connector rather than jump straight into a broader multi-provider bundle or deeper authority alignment.

## What changed

### Gmail now has a real governed provider authorization URL

- updated `server/src/services/v8/pmSyncExternalAuthMaterializationService.ts`
- `buildGovernedExternalAuthSession()` now returns a real Google OAuth authorization URL for `gmail`
- the shared builder uses the governed sync-hub callback URL plus env-backed Google client configuration
- the active V8 pending-configuration seam now prepares a real provider authorization URL once Gmail reaches `pending_external_auth`

### Gmail callback now materializes governed credential and refresh truth

- updated `server/src/services/v8/pmSyncExternalAuthMaterializationService.ts`
- `shouldMaterializeCallbackDrivenAuth()` now includes `gmail`
- Gmail callback materialization now exchanges the Google authorization code for tokens
- the materializer fetches Google userinfo and stores governed credential baseline truth through `pmSyncAuthService`
- when a refresh token is issued, it also stores governed refresh execution secret material through `pmSyncRefreshExecutionService`

### Scope stayed bounded

- no new authority surface was promoted
- no `/api/settings/integrations` ownership alignment was attempted
- no wider provider family bundle was mixed into the same packet

## Regression coverage

Passed:

- `server/src/services/v8/__tests__/pmSyncExternalAuthMaterializationService.test.ts`
- `server/src/routes/v8/__tests__/sync.routes.test.ts`

Verification command:

`npx vitest run server/src/services/v8/__tests__/pmSyncExternalAuthMaterializationService.test.ts server/src/routes/v8/__tests__/sync.routes.test.ts`

Result: `39` tests passing.

## Residual after this packet

Broader `Sync` completion is still not done.

Remaining honest residuals include:

- assessing whether another provider callback-driven coverage packet or deeper authority alignment is now the next smallest broader-sync step
- non-Jira, non-Gmail governed oauth2 connectors still do not all produce real provider auth URLs and callback-driven materialization on the shared governed seam
- deeper authority alignment still remains between governed `v8`, legacy `sync-hub`, canonical org-level `/api/integrations`, and user-level settings integrations
