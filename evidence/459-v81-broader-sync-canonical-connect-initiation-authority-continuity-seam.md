# V8.1 broader Sync canonical connect initiation authority continuity seam

Date: 2026-03-27
Lane: broader `Sync` completion
Taxonomy: `T4`
Packet: fifteenth bounded packet after broader-lane promotion

## Why this packet

After canonical readback continuity landed, the org-level `IntegrationSettings` surface could finally see governed connector-schema pending truth, but the canonical connect entrypoint itself still did not create that truth.

That meant:

- canonical `GET /api/integrations` could now read governed sync onboarding state honestly,
- but canonical `POST /api/integrations/connect/:provider` still did not own governed connector initiation on the same schema,
- so the main org-level connect path still risked creating mismatched authority assumptions right where setup begins.

This was thinner and more honest than jumping straight to alias-route continuity or real governed refresh execution.

## What changed

### Canonical governed connect initiation

- updated `server/src/routes/integrations/integrations.routes.ts`
- canonical `POST /api/integrations/connect/:provider` now detects connector-schema installs and creates governed `pending` integration rows instead of pretending immediate connected truth
- when required config is already complete for oauth2 connectors, the route now moves auth truth to `connecting`, issues governed sync external-auth session state, and returns `authUrl`
- when setup is still incomplete, the route returns honest `onboardingStatus` without faking a ready connection

### Org-level connect-surface honesty

- updated `src/components/settings/IntegrationSettings.tsx`
- canonical org-level connect flow no longer toasts `connected successfully`
- when the canonical route returns `authUrl`, the surface starts external auth explicitly
- when config is still incomplete, the surface now tells operators setup started and further configuration is still required

## Regression coverage

Passed:

- `server/src/routes/__tests__/integrations.routes.test.ts`
- `tests/components/settings/IntegrationSettings.sync-readback.test.tsx`

Verification command:

`npx vitest run server/src/routes/__tests__/integrations.routes.test.ts tests/components/settings/IntegrationSettings.sync-readback.test.tsx`

Result: `4` tests passing.

## Residual after this packet

Broader `Sync` completion is still not done.

Remaining honest residuals include:

- legacy alias `/api/integrations/:provider/connect` authority continuity for older surfaces still bypassing the canonical connect route
- real governed refresh execution continuity instead of preflight blocking plus operator-recorded refresh outcomes
- deeper authority alignment between governed `v8`, legacy `sync-hub`, canonical org-level `/api/integrations`, and user-level settings integrations
