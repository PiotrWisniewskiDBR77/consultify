# Module 07 — Rezultaty — Readiness Scorecard

**Readiness: 52/100 — Tier: Alpha**
**Route(s):** `/benefits` → `ResultsHub`, `/kpi-okr` → redirect alias to `/benefits`
**One-line verdict:** KPI CRUD, measurement recording, deviation lifecycle, and ROI tracking are genuinely backend-wired; KPI reports (approval/finalization guard), ROI analysis lock-state proof, enterprise Schedules/Wallboards/Connectors UI, and all frontend tests are missing or unverified stubs.

---

## What's REAL (verified + backend-wired)

- `src/components/Results/ResultsHub.tsx:306–338` — `loadResultsKpis()` calls V8 catalog via `V8ResultsApi.getKpiCatalog`, with fallback to legacy `/benefits/kpis`.
- `src/services/api/v8/results.ts:476–581` — Full V8ResultsApi client: dashboard, KPI CRUD, time-series, ROI portfolio, deviation case lifecycle, report create/refresh, workflow signals.
- `server/src/routes/v8/results.routes.ts` (2237 lines) — Real DB-backed routes for dashboard, KPI catalog, drawer detail, ROI portfolio summary, ROI initiative detail, KPI create/update/delete, time-series, deviation cases (acknowledge/RCA/actions/resolve/close), reconciliation, KPI signals, next-actions, workflow status.
- `server/src/services/v8/resultsROIService.ts:2501–2505` — `locked` KPI status blocks definition/target edits (permission guard is real).
- `server/src/services/resultsEnterpriseService.ts:34–60` — KPI connectors: `INSERT INTO kpi_connectors` (real DB write).
- `server/src/services/resultsEnterpriseService.ts:796–808` — Schedule approval gate: `approval_required && approval_status !== 'approved'` blocks dispatch (approval guard implemented in enterprise service layer).
- `src/views/KpiOkrView.tsx:6` — `/kpi-okr` is a live redirect to `/benefits`; no dead code.
- Tests: `server/src/routes/v8/__tests__/results.routes.test.ts`, `p04-kpi-workflow.test.ts` (863 lines), `resultsROIService.test.ts`, `resultsRuntime.test.ts`, `kpiReconciliationFlow.test.ts` — backend contract coverage is present.

---

## What's MOCK / hardcoded / stub

- `src/components/Results/resultsShowcaseData.ts:85–92` — `shouldUseResultsShowcaseData()` returns `true` on `localhost` or `DEV` mode, injecting fake KPI/initiative/schedule/wallboard/connector data. All three enterprise sub-views (Schedules, Wallboards, Connectors) fall back to this showcase data when the real API call fails or returns empty. Dev users see polished UX backed by hardcoded fixtures.
- `src/components/Results/ResultsReportingEnterpriseViews.tsx` — Schedules, Wallboards, Connectors views call `resultsEnterpriseService` via the API but display showcase data on fallback; no server-to-UI approval state propagation for schedules (approval status is stored in DB but not surfaced as a blocked/locked state in the UI chip).
- `src/components/Results/ResultsKpiScorecardsView.tsx` — Scorecards view exists but no specific evidence that goals/OKR backend table is populated vs. showcase.

---

## What's BROKEN / NO_GO / missing

- **RZ_REPORTS_WORKSPACE P1 BLOCKED**: `server/src/routes/v8/results.routes.ts:1274–1317` — KPI report creation has no explicit approval/finalization guard at the HTTP layer. The `p04AssertKpiPermission(req, res, 'create_report')` only checks the role header; there is no check that prevents creating a report on a KPI set that is in a `finalized` or `locked` state. The "no-hidden-finalization regression" claimed in STATUS.md has no visible proof in route or snapshot service code.
- **RZ_ROI_ANALYSIS P1 BLOCKED**: `src/components/Results/ROIAnalysisView.tsx` — The UI fetches ROI portfolio data but contains no explicit approval/lock state display, no `LOCKED` badge, no "explicit approval" interaction. `shouldFallbackToLegacyResults` is the only error branch. STATUS.md flags this as `BLOCKED_P1` and code confirms: no lock/approval UI exists.
- **No frontend tests**: CODEMAP.md admits "No dedicated `src/components/Results/*test*` files found" — confirmed in code. Zero component-level tests for `ResultsHub`, `ROIAnalysisView`, `ResultsKpiReportsView`, `ROITrackingView`.
- **Duplicate route surface**: `/kpi-okr` redirects to `/benefits` but `KpiOkrView` still exists as a registered route in the app; doc says "P2_DECISION_PENDING" (retire vs alias vs parallel). Not broken, but tech debt.

---

## Backend wiring

Real for core KPI CRUD, time-series recording, deviation lifecycle, ROI assumptions + realized entry recording, reconciliation, signals/next-actions, and enterprise connectors/schedules/wallboards (DB writes verified). Missing: approval/finalization guard enforcement at the HTTP layer for `POST /kpi-reports` and no lock-state proof for ROI analysis assumptions editing.

---

## UI/UX consistency

`ResultsHub` mounts correctly within `ModuleHub` shell using standard `TabConfig`, `ViewMode`, `FilterChip`, and `CommandRow` patterns — consistent with approved shell. `ROIAnalysisView` uses a bespoke navy-900 dark background card layout (comment "DBR77: navy-900 dark bg") that diverges slightly from the standard slate/white card pattern used elsewhere.

---

## Tests

Backend: good coverage — `results.routes.test.ts`, `p04-kpi-workflow.test.ts` (863 lines), `resultsROIService.test.ts`, `resultsRuntime.test.ts`, `kpiReconciliationFlow.test.ts`.
Frontend: zero — no component tests for any Results surface.

---

## Doc-vs-code drift

- STATUS.md claims `BLOCKED_P1` for `RZ_REPORTS_WORKSPACE` and `RZ_ROI_ANALYSIS` — confirmed by code.
- CODEMAP.md claim that `/kpi-okr` → `KpiOkrView` is a "legacy/parallel KPI route surface" — partially correct; it is now a redirect, not a real view.
- CODEMAP.md: "No dedicated `src/components/Results/*test*` files found" — confirmed accurate.
- The approval gate for scheduled reports (`approval_required` flag) is implemented in `resultsEnterpriseService.ts` but docs frame this as missing; the service-layer guard exists but the HTTP route and UI do not surface/enforce approval state visibly — gap is real but narrower than docs imply.

---

## Top gaps to reach market-ready (prioritized)

1. **Add report finalization/approval guard at HTTP layer** (`server/src/routes/v8/results.routes.ts:1274`) — check snapshot/report status before allowing creation on locked KPI sets; add regression test asserting no hidden finalization.
2. **Add ROI Analysis lock/approval state to UI** (`src/components/Results/ROIAnalysisView.tsx`) — surface locked/approved badge, block edits when ROI assumptions are finalized; this is the explicit P1 blocker.
3. **Write frontend component tests** — at minimum `ResultsHub`, `ROIAnalysisView`, and `ResultsKpiReportsView`; zero coverage is a production risk.
4. **Eliminate showcase data fallback in production builds** (`src/components/Results/resultsShowcaseData.ts:85–92`) — `shouldUseResultsShowcaseData()` activates on all `DEV` and `localhost` origins; gate it strictly behind a feature flag so staging/UAT does not mask real backend failures.
5. **Resolve /kpi-okr dual-surface** — retire `KpiOkrView` route registration or officially alias; current state leaks a dead route into the router manifest.
6. **Propagate approval status chip to Schedule UI** (`ResultsReportingEnterpriseViews.tsx`) — `approval_status` is stored and gated in the backend but the schedule list row does not render it as a blocking/pending state.
