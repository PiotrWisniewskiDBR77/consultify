# Initiatives / Execution / Results / Finance Sprint 6 Runtime Gate - 2026-05-15

## Verdict

`PASS_WITH_BUSINESS_MANUAL_FOLLOWUP`

Sprint 6 closes the developer-side runtime and contract preflight for Initiatives, Execution, Results, and Finance. The execution knowledge smoke, results and AI integrations smoke, finance gap-closure smoke, Tier-0 initiative create L4 flow, production build, and staging route/API probes all pass.

Full Business Owner workflow acceptance remains intentionally open for end-to-end initiative lifecycle rehearsal across planning, execution control, results deviation closure, investment case, and finance review.

## Scope

- Initiatives create/read Tier-0 path.
- Execution reporting, management, action queue, missing-plan handling, workload preview, timeline persistence, and action queue aggregation contracts.
- Results deviation closure, attribution, intent routing, org coverage, and integrations contract checks.
- Finance investment-case workflow, analysis metrics, valuation financial-model inputs, and budget document import parsing.
- Staging route/API availability for `/initiatives`, `/execution`, `/results`, `/finance`, and `/finance/investment`.

## Fix Applied

The Sprint 6 execution smoke initially failed:

`FAIL G02 reporting and management surfaces include action queue and missing-plan handling`

Root cause: `ExecutionHub` exposed the underlying execution action queue data and filters, but the Reports surface did not render an explicit action-center panel or workload context expected by the reporting/management contract.

The fix adds a read-only action center to the Execution reports tab with visible entries for:

- Action queue.
- Missing-plan handling.
- KPI deviation without plan.

It also adds a collapsed workload preview using `ExecutionWorkloadView` and keeps the `missing_dates` attention filter explicit in the ExecutionHub filtering path.

## Validation Evidence

- `npm run smoke:v3:execution-knowledge` -> PASS
  - execution hub exposes summary, reporting, and management tabs
  - reporting and management surfaces include action queue and missing-plan handling
  - timeline updates persist through execution control API with audit trail
  - action queue aggregates overdue, risk, communication, and KPI-plan gaps
  - risk signals are visible from execution reporting workspace
  - external RAG and case knowledge capture contracts pass
- `npm run smoke:v3:results-ai-integrations` -> PASS
  - deviation closure workflow, attribution, intent router, org coverage, and sync scope contracts pass
- `npm run smoke:v3:finance-gap-closure` -> PASS
  - investment tab, finance analysis metrics, valuation financial-model source, and budget import parsing contracts pass
- `npm run test:l4:local -- tests/e2e/smoke/tier0-initiative-create.spec.ts` -> `1/1 PASS`
  - project and initiative are created via API and read back successfully
- `npx vitest run src/components/Execution --passWithNoTests` -> PASS, no targeted component tests found
- Production build with `NODE_OPTIONS=--max-old-space-size=8192 npm run build` -> PASS
- `ReadLints` for `src/components/Execution/ExecutionHub.tsx` -> no linter errors

## Staging Route/API Probe

Target: `https://demo.consultify.ai`

- `GET /initiatives` -> `200`
- `GET /execution` -> `200`
- `GET /results` -> `200`
- `GET /finance` -> `200`
- `GET /finance/investment` -> `200`
- `GET /api/initiatives` unauthenticated -> `401 No token provided`
- `GET /api/execution/action-queue` unauthenticated -> `401 No token provided`
- `GET /api/results/deviations` unauthenticated -> `401 No token provided`
- `GET /api/finance/analyses` unauthenticated -> `401 No token provided`

The route probe confirms the user-facing app routes are available and core module APIs remain auth-gated.

## Remaining Risk

- `docs/modules/05_inicjatywy`, `docs/modules/06_realizacja`, `docs/modules/07_rezultaty`, and `docs/modules/08_finanse` remain `status: draft`.
- Full Business Owner rehearsal is still required before the module docs can be promoted out of draft: create initiative, move through execution control, handle missing plans/action queue, close result deviations with evidence, review attribution, and complete finance investment-case decisions.
- Staging probe covered route availability and auth gates, not a logged-in visual AnyGravity pass.
