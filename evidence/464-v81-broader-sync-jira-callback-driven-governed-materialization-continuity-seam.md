# V8.1 broader Sync Jira callback-driven governed materialization continuity seam

Date: 2026-03-27
Lane: broader `Sync` completion
Taxonomy: `T4`
Packet: eighteenth bounded packet after broader-lane promotion

## Why this packet

After governed refresh execution landed, the active sync path could refresh Jira credentials only if an operator manually materialized refresh-secret truth after external auth.

That meant:

- the active `UnifiedSyncHub` still surfaced a local callback placeholder instead of a real provider authorization URL,
- the public callback route still stopped at callback-arrived truth instead of exchanging the provider `code`,
- and governed refresh continuity still depended on a manual post-callback secret write even on the primary Jira path.

The smallest honest packet was to close that round-trip on one real active governed connector instead of pretending a thinner non-provider-specific packet still existed.

## What changed

### Jira governed auth round-trip now has a real provider URL

- added `server/src/services/v8/pmSyncExternalAuthMaterializationService.ts`
- governed V8 sync surfaces now treat Jira as requiring `client_id` and `client_secret` alongside `site_url` and `cloud_id`
- `server/src/routes/v8/sync.routes.ts` now returns a real Atlassian authorization URL plus the registered callback URL when Jira pending setup reaches external-auth-ready state
- `server/src/services/v8/pmSyncInventoryService.ts` now mirrors those governed Jira setup fields back into active inventory/readback so the surface and runtime stay aligned

### Callback now materializes governed credential and refresh truth

- updated `server/src/routes/syncHub.routes.ts`
- Jira callback requests with `state` + provider `code` now exchange the authorization code against Atlassian OAuth
- the callback stores governed credential baseline truth through `pmSyncAuthService`
- the callback stores governed refresh execution secret material through `pmSyncRefreshExecutionService`
- the callback still leaves the connector in `connected_pending_verification`, so the existing governed verification step remains honest instead of being skipped

### Active hub now points operators at the real Jira authorization path

- updated `src/components/Admin/UnifiedSyncHub.tsx`
- pending Jira setup now shows the real provider authorization URL and the registered callback URL together
- the hub opens the governed provider authorization window as soon as V8 configuration or reauth prepares the external-auth session
- the shared V8 sync API types now expose `authUrl` in addition to `callbackUrl`

## Regression coverage

Passed:

- `server/src/routes/v8/__tests__/sync.routes.test.ts`
- `server/src/routes/__tests__/syncHub.routes.test.ts`
- `tests/unit/services/v8-sync-api.test.ts`
- `tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`

Verification command:

`npx vitest run server/src/routes/v8/__tests__/sync.routes.test.ts server/src/routes/__tests__/syncHub.routes.test.ts tests/unit/services/v8-sync-api.test.ts tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`

Result: `76` tests passing.

## Residual after this packet

Broader `Sync` completion is still not done.

Remaining honest residuals include:

- assessing whether wider callback-driven provider round-trip coverage or deeper authority alignment is now the next smallest broader-sync packet
- non-Jira governed connectors still do not all perform callback-driven token/secret materialization on the active path
- deeper authority alignment still remains between governed `v8`, legacy `sync-hub`, canonical org-level `/api/integrations`, and user-level settings integrations
