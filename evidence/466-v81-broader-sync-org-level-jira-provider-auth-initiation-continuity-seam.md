# V8.1 broader Sync org-level Jira provider-auth initiation continuity seam

Date: 2026-03-27
Lane: broader `Sync` completion
Taxonomy: `T4`
Packet: nineteenth bounded packet after broader-lane promotion

## Why this packet

After the post-Jira-callback assessment, a thinner authority seam still remained on org-level settings surfaces.

That meant:

- the active governed V8 Jira path already returned a real Atlassian authorization URL,
- but canonical `POST /api/integrations/connect/:provider` and alias `POST /api/integrations/:provider/connect` still used their own duplicated helper,
- and those org-level routes still returned the local callback placeholder as `authUrl` instead of the real governed provider round-trip.

The next honest packet was to re-close that Jira initiation seam on org-level canonical and alias routes before broadening into additional providers.

## What changed

### Canonical and alias org-level connect routes now reuse the governed Jira auth builder

- updated `server/src/routes/integrations/integrations.routes.ts`
- removed the duplicated callback-only Jira initiation logic from the org-level governed connect helper
- canonical and alias `/api/integrations` connect routes now reuse the shared governed external-auth session builder
- when Jira has the required governed config, org-level routes now return the same real Atlassian authorization URL as the active V8 path

### Org-level Jira config-field truth now stays aligned with the governed path

- org-level governed connect initiation now evaluates Jira readiness against the same governed config fields as V8
- Jira on org-level settings surfaces now treats `client_id` and `client_secret` as required alongside `site_url` and `cloud_id`
- this prevents org-level routes from claiming external-auth readiness before the real governed provider session can actually be built

## Regression coverage

Passed:

- `server/src/routes/__tests__/integrations.routes.test.ts`
- `tests/components/settings/IntegrationSettings.sync-readback.test.tsx`

Verification command:

`npx vitest run server/src/routes/__tests__/integrations.routes.test.ts tests/components/settings/IntegrationSettings.sync-readback.test.tsx`

Result: `5` tests passing.

## Residual after this packet

Broader `Sync` completion is still not done.

Remaining honest residuals include:

- assessing whether wider callback-driven provider round-trip coverage or deeper authority alignment is now the next smallest broader-sync packet
- non-Jira governed connectors still do not all perform real provider round-trip initiation plus callback-driven token/secret materialization on the active path
- deeper authority alignment still remains between governed `v8`, legacy `sync-hub`, canonical org-level `/api/integrations`, and user-level settings integrations
