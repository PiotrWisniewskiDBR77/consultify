# V8.1 broader Sync canonical integrations readback continuity seam

Date: 2026-03-27
Lane: broader `Sync` completion
Taxonomy: `T4`
Packet: fourteenth bounded packet after broader-lane promotion

## Why this packet

After auth-break recovery resolution continuity landed, the governed sync path could now create, advance, and resolve broader sync truth honestly, but the canonical org-level `/api/integrations` surface still could not read that governed connector-schema inventory back.

That meant:

- the active governed `v8` path could already create real `pending`, `requires_reauth`, and connected sync truth,
- but the canonical org-level integrations surface still assumed older `provider_id/settings` or `provider/config` schemas,
- so org-level settings could stay blind to governed pending setup rows or misread them once they existed.

This was thinner and more honest than jumping straight to canonical mutation authority alignment or real governed refresh execution.

## What changed

### Canonical org-level readback continuity

- updated `server/src/routes/integrations/integrations.routes.ts`
- canonical `GET /api/integrations` now detects governed connector-schema installations and delegates readback to `listGovernedIntegrations()`
- the canonical response now carries governed pending setup truth, including `onboarding_status`, configured fields, required fields, and parsed config for connector-backed rows

### Org-level settings honesty

- updated `src/components/settings/IntegrationSettings.tsx`
- org-level integration cards no longer label every existing row as `Connected`
- pending governed rows now render explicit setup/authorization/verification pending badges and suppress `Sync now` until setup is really complete
- when required fields are still missing, the canonical settings surface now shows that missing setup explicitly instead of pretending the integration is already ready

### Stability fix discovered during regression

- `IntegrationSettings.tsx` had hook usage after conditional early returns
- replaced those callback hooks with plain functions so loading transitions no longer violate React hook ordering

## Regression coverage

Passed:

- `server/src/routes/__tests__/integrations.routes.test.ts`
- `tests/components/settings/IntegrationSettings.sync-readback.test.tsx`

Verification command:

`npx vitest run server/src/routes/__tests__/integrations.routes.test.ts tests/components/settings/IntegrationSettings.sync-readback.test.tsx`

Result: `2` tests passing.

## Residual after this packet

Broader `Sync` completion is still not done.

Remaining honest residuals include:

- canonical org-level connect initiation authority continuity so `/api/integrations` no longer creates separate legacy connect truth next to governed `v8`
- real governed refresh execution continuity instead of preflight blocking plus operator-recorded refresh outcomes
- deeper authority alignment between governed `v8`, legacy `sync-hub`, canonical org-level `/api/integrations`, and user-level settings integrations
