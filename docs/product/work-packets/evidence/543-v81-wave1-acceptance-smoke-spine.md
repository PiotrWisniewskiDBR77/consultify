# 543 - V8.1 wave 1 acceptance smoke spine

Date: 2026-03-29
Owner: Cursor agent
Scope: deterministic smoke acceptance for the wave-1 must-have shell and entry spine

## Why this pass was needed

Wave 1 already had many focused unit/component closeout proofs, but manual acceptance was still scattered across separate module documents.

That left one practical gap:

- no single repeatable browser-level run proving the public entry assistant, internal assistant, and canonical must-have module routes still mount together after the closeout wave
- manual gates were too dependent on brittle ad-hoc browser sessions

## What landed

Added:

- `tests/e2e/smoke/wave1-module-closeout.spec.ts`

The suite now proves, on deterministic local Playwright runtime:

- `Anna` remains the external/public assistant on landing
- `Teresa` remains the internal in-app assistant on `/chat`
- core wave-1 must-have routes mount without route-boundary failure:
  - `/my-work`
  - `/interview`
  - `/assessment/overview`
  - `/initiatives`
  - `/execution`
  - `/kpi-okr`
  - `/benefits`
  - `/finance`
  - `/settings/integrations`
  - `/docs`
  - `/partner`

## Acceptance truth captured by the suite

### Public vs internal AI identity

- Landing confirms `Anna` widget opens with explicit public/external identity copy
- Landing confirms `Anna` exposes canonical CTA handoffs: `demo`, `trial`, `contact`
- `/chat` confirms the in-app assistant identity is `Teresa`, not `Anna`

### Canonical route truth

The smoke also preserved two important routing truths discovered during the run:

- `/kpi-okr` resolves to the canonical `Results` surface at `/benefits`
- `/settings/integrations` resolves to the canonical integrations surface at `/settings/connected-apps`

These redirects were encoded into the acceptance suite instead of being treated as false failures.

## Verification

Passed:

- `E2E_MODE=true E2E_USE_WEB_SERVER=true E2E_BACKEND_RUNNER=tsx E2E_API_URL=http://127.0.0.1:3001 E2E_BASE_URL=http://127.0.0.1:3000 npx playwright test --config playwright.config.ts tests/e2e/smoke/wave1-module-closeout.spec.ts`

Result:

- `13 / 13` tests passed

## Residual risk

- This suite validates the wave-1 shell and route spine, not every deep CRUD path inside `Notebook`, `Mind map`, `Whiteboard`, `Tables`, `Surveys`, or `Interview insights`
- Those deeper module behaviors continue to rely on the focused component/unit closeout suites recorded in their respective evidence documents

## Status

- Wave-1 now has one repeatable browser-level smoke spine covering the public assistant, internal assistant, and canonical must-have route shell
- The acceptance story is materially stronger and less dependent on fragile ad-hoc browser sessions
