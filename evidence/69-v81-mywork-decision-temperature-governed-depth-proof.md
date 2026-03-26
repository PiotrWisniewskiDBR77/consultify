# 69 - V8.1 MyWork Decision Temperature governed depth proof

Date: 2026-03-25
Deployment: `694ffe6a-b68e-4be7-81aa-3c03d1550a45`
Surface: `https://stage.consultinity.ai/my-work`

## Goal

Advance the residual `MyWork roof` maturity hardening without reopening scope by proving that `decisionTemperature` now reads a governed V8 planning source rather than only local stitched Home copy.

## Implementation

- `GET /api/my-work/home/v2` now calls `planningContinuityService.getPendingDecisions(organizationId)`.
- `Decision Temperature` now injects a governed planning signal into the existing signal list:
  - pending chains open -> warning signal with chain/step counts
  - no pending chains -> neutral signal stating the governed planning spine is currently clear
- `roof/summary` now classifies `decisionTemperature` as `backed_by_real_service`.

## Local validation

- `npx vitest run tests/integration/routes/v8.my-work.routes.test.ts tests/components/MyWork/HomeView.outputs.test.tsx --maxWorkers=1 --maxConcurrency=1`
- Result: `11` tests passed

## Live staging proof

1. Deployment / health
   - `railway deployment list --service consultify --environment staging --limit 2 --json`
     - latest deployment `694ffe6a-b68e-4be7-81aa-3c03d1550a45` -> `SUCCESS`
   - `railway service status --service consultify --environment staging --json`
     - service online on deployment `694ffe6a-b68e-4be7-81aa-3c03d1550a45`
   - `GET https://stage.consultinity.ai/ping` -> `200`
   - `GET https://stage.consultinity.ai/api/health` -> `200`

2. Live authenticated My Work load
   - Browser network after fresh reload of `/my-work` showed:
     - `GET /api/v8/my-work/roof/summary` -> `200`
     - `GET /api/my-work/home/v2` -> `200`

3. Visible roof truth
   - The live roof banner now reads:
     - `Roof truth: Home V2 aggregated + outputs bridge · 5 real · 3 partial · 0 non-canonical`

4. Visible governed planning signal
   - The live `Decision Temperature` block now surfaces:
     - `Governed decision chains are currently clear`
     - `The governed planning spine does not currently report any pending decision chains for this organization.`

## Result

- `decisionTemperature` is now staging-proven as governed depth, not only stitched narrative.
- Residual `MyWork roof` partial set is reduced to:
  - `momentum`
  - `sparkField`
  - `commandDock`
