# V8.1 broader Sync legacy alias connect authority continuity seam

Date: 2026-03-27
Lane: broader `Sync` completion
Taxonomy: `T4`
Packet: sixteenth bounded packet after broader-lane promotion

## Why this packet

After canonical connect initiation continuity landed, the main org-level `connect/:provider` path finally created governed `pending` truth, but the still-used alias `POST /api/integrations/:provider/connect` continued to represent a separate authority surface for older settings UIs.

That meant:

- canonical org-level connect initiation was now governed,
- but alias-based settings consumers could still start setup through a different entrypoint,
- so broader sync authority at connect initiation was still split across two org-level routes even though both were meant to express the same action.

This was thinner and more honest than jumping straight to real governed refresh execution.

## What changed

### Alias-route authority continuity

- updated `server/src/routes/integrations/integrations.routes.ts`
- legacy alias `POST /api/integrations/:provider/connect` now reuses the same governed connector initiation helper as canonical `POST /api/integrations/connect/:provider`
- alias entry now returns the same governed `onboardingStatus` and `authUrl` contract instead of silently diverging from canonical connect authority

### Legacy settings-surface honesty

- updated `src/components/settings/integrations/IntegrationsMarketplace.tsx`
- updated `src/components/settings/notifications/NotificationChannelsSettings.tsx`
- alias-based settings surfaces no longer toast `connected successfully` when the alias route only starts governed pending setup
- these surfaces now keep their local state honest and tell the operator whether setup started, validation is pending, or external authorization must still be completed

## Regression coverage

Passed:

- `server/src/routes/__tests__/integrations.routes.test.ts`
- `tests/components/settings/LegacyAliasConnectContinuity.test.tsx`

Verification command:

`npx vitest run server/src/routes/__tests__/integrations.routes.test.ts tests/components/settings/LegacyAliasConnectContinuity.test.tsx`

Result: `5` tests passing.

## Residual after this packet

Broader `Sync` completion is still not done.

Remaining honest residuals include:

- real governed refresh execution continuity instead of preflight blocking plus operator-recorded refresh outcomes
- deeper authority alignment between governed `v8`, legacy `sync-hub`, canonical org-level `/api/integrations`, and user-level settings integrations
