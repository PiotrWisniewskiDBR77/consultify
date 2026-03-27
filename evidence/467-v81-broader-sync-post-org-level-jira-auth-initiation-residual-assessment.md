# V8.1 Evidence - Broader Sync post-org-level Jira auth initiation residual assessment

Lane: broader `Sync` completion
Date: 2026-03-27
Status: assessed

## Why this assessment was needed

After the nineteenth broader-sync packet landed, governed Jira initiation now aligns across:

- active V8 sync surfaces,
- canonical org-level `/api/integrations/connect/:provider`,
- and alias org-level `/api/integrations/:provider/connect`.

The next question was whether one more thinner Jira-specific or org-level authority packet still remained before broader provider expansion, or whether the lane had now reached the wider callback-driven provider coverage residual directly.

## What was checked

1. Shared governed provider round-trip builder after packet `19`:
   - `server/src/services/v8/pmSyncExternalAuthMaterializationService.ts`
   - `server/src/routes/v8/sync.routes.ts`
   - `server/src/routes/integrations/integrations.routes.ts`
   - Jira now has one shared provider-session builder reused by V8 and org-level `/api/integrations`
   - that shared builder still returns real provider auth only for `jira`
   - non-Jira oauth2 connectors still fall back to the callback landing URL as `authUrl`
   - callback-driven token and refresh-secret materialization still exists only for `jira`

2. Remaining governed oauth2 connector set on the active path:
   - `server/src/services/integrationHubService.ts`
   - active governed oauth2 connectors still include `asana`, `slack`, `teams`, `gmail`, `azure_devops`, `powerbi`, and others
   - the current shared service already hints at future provider families (`gmail`, `teams`) through `hasGovernedExternalAuthEnvConfig()`, but no additional provider round-trip implementation is wired yet

3. Broader authority-alignment residual:
   - `server/src/routes/settings.routes.ts`
   - `src/hooks/useUserIntegrations.ts`
   - user-level `/api/settings/integrations/*` remains a separate preferences-backed ownership model
   - it still writes local connected truth with `authUrl: null` and does not participate in governed sync connector runtime truth
   - that remains broader than the active governed provider round-trip seam because it crosses different storage, scope, and ownership models

## Assessment result

No thinner honest packet remains before wider callback-driven provider round-trip coverage.

Why:

- the Jira-specific authority split on the active governed and org-level paths is now closed
- the next visible gap on the active path is no longer another Jira seam; it is that the shared governed provider builder and callback materializer still cover only one connector
- deeper authority alignment remains broader because user-level `/api/settings/integrations` still represents a separate ownership model rather than the active governed connector path

## Residual now considered real

The next honest residuals are now:

- wider callback-driven provider round-trip coverage for additional governed oauth2 connectors beyond `jira`
- deeper authority alignment between governed `v8`, legacy `sync-hub`, canonical org-level `/api/integrations`, and user-level settings integrations

## Outcome

The lane remains active.

No implementation was landed in this assessment packet.
The next honest implementation step is to promote wider callback-driven provider round-trip coverage explicitly, rather than pretending another thinner Jira-specific authority packet still remains first.
