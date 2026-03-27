# V8.1 Evidence - Broader Sync post-Asana provider round-trip residual assessment

Lane: broader `Sync` completion
Date: 2026-03-27
Status: assessed

## Why this assessment was needed

After the twenty-third broader-sync packet landed, the shared governed provider round-trip seam now covers all active-ready oauth2 connectors on the governed path:

- `jira`
- `gmail`
- `teams`
- `slack`
- `asana`

The next question was whether one more thinner provider or org-surface continuity packet still remains, or whether deeper authority alignment is now the next smallest honest broader-sync step.

## What was checked

1. Shared governed provider round-trip coverage after packet `23`:
   - `server/src/services/v8/pmSyncExternalAuthMaterializationService.ts`
   - `server/src/routes/v8/sync.routes.ts`
   - `shouldMaterializeCallbackDrivenAuth()` now covers `jira`, `gmail`, `asana`, `teams`, and `slack`
   - the active governed `v8` configure seam now prepares real provider authorization URLs for every active-ready oauth2 connector
   - callback-driven governed credential and refresh-secret materialization now also covers every active-ready oauth2 connector

2. Whether a thinner canonical org-level provider seam still remains:
   - `server/src/routes/integrations/integrations.routes.ts`
   - canonical and alias `/api/integrations` connect entrypoints already reuse `buildGovernedExternalAuthSession()` through shared `connectGovernedConnectorIntegration()`
   - that means org-level governed provider-auth initiation is no longer a Jira-only seam and no thinner single-provider org-level packet remains after Asana coverage

3. What still remains split-brained:
   - `server/src/routes/settings.routes.ts`
   - user-level `/api/settings/integrations/:provider/connect` still writes separate preferences-backed connected truth immediately
   - that surface still returns `authUrl: null` instead of governed external-auth preparation
   - it still bypasses governed onboarding states and the shared provider session builder entirely

4. Why this is now deeper authority alignment rather than another provider packet:
   - the remaining gap is no longer about one missing provider implementation on the shared seam
   - the remaining gap is about aligning distinct authority surfaces and storage models between governed `v8`, legacy `sync-hub`, canonical org-level `/api/integrations`, and user-level settings integrations
   - the residual is therefore cross-surface authority ownership, not another standalone provider extension

## Assessment result

Deeper authority alignment is now the next smallest honest broader-sync step.

Why:

- no active-ready oauth2 connector remains outside the shared governed provider round-trip seam
- no thinner canonical org-level provider-auth initiation seam remains after the shared org-level connect path reuse
- the remaining live split-brain is now the user-level settings integrations surface, which still claims fake immediate connected truth with `authUrl: null`

## Outcome

The lane remains active.

No implementation was landed in this assessment packet.
The next honest implementation step is to promote deeper authority alignment between governed sync surfaces and user-level settings integrations.
