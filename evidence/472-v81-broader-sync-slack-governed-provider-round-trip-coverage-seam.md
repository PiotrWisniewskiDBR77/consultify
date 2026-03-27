# V8.1 broader Sync Slack governed provider round-trip coverage seam

Date: 2026-03-27
Lane: broader `Sync` completion
Taxonomy: `T4`
Packet: twenty-second bounded packet after broader-lane promotion

## Why this packet

After the post-Teams assessment, the next honest broader-sync residual was still one more provider callback-driven coverage seam rather than deeper authority alignment.

`slack` was the thinnest next provider because:

- it remained active-ready on the governed `v8` and `sync-hub` surfaces,
- the active governed runtime already carried the Slack OAuth token endpoint,
- and the repo still contained legacy Slack OAuth assumptions, so the auth shape was less speculative than a wider authority packet.

## What changed

### Slack now has a real governed provider authorization URL

- updated `server/src/services/v8/pmSyncExternalAuthMaterializationService.ts`
- `buildGovernedExternalAuthSession()` now returns a real Slack OAuth authorization URL for `slack`
- the shared builder uses `workspace_id` plus env-backed Slack client credentials
- the active V8 pending-configuration seam now prepares a real provider authorization URL once Slack reaches `pending_external_auth`

### Slack callback now materializes governed credential and refresh truth

- updated `server/src/services/v8/pmSyncExternalAuthMaterializationService.ts`
- `shouldMaterializeCallbackDrivenAuth()` now includes `slack`
- Slack callback materialization now exchanges the Slack authorization code for tokens
- the materializer stores governed credential baseline truth from Slack workspace/user response fields through `pmSyncAuthService`
- when a refresh token is issued, it also stores governed refresh execution secret material through `pmSyncRefreshExecutionService`

### Slack env contract is now explicit

- updated `server/src/config/Config.ts`
- updated `server/src/config/ConfigValidator.ts`
- updated `.env.example`
- updated `.env.production.example`
- Slack client credentials are now part of the shared governed auth configuration contract instead of living only in legacy assumptions

### Scope stayed bounded

- no new authority surface was promoted
- no `/api/settings/integrations` ownership alignment was attempted
- no broader Slack/Asana bundle was mixed into the same packet

## Regression coverage

Passed:

- `server/src/services/v8/__tests__/pmSyncExternalAuthMaterializationService.test.ts`
- `server/src/routes/v8/__tests__/sync.routes.test.ts`

Verification command:

`npx vitest run server/src/services/v8/__tests__/pmSyncExternalAuthMaterializationService.test.ts server/src/routes/v8/__tests__/sync.routes.test.ts`

Result: `47` tests passing.

## Residual after this packet

Broader `Sync` completion is still not done.

Remaining honest residuals include:

- assessing whether one more provider callback-driven coverage packet or deeper authority alignment is now the next smallest broader-sync step
- non-Jira, non-Gmail, non-Teams, non-Slack governed oauth2 connectors still do not all produce real provider auth URLs and callback-driven materialization on the shared governed seam
- deeper authority alignment still remains between governed `v8`, legacy `sync-hub`, canonical org-level `/api/integrations`, and user-level settings integrations
