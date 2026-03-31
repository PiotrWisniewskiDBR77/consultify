# P04 KPI — Verified Closeout

Date: 2026-03-31  
Status: `verified(evidence)`  
Branch: `ws/c-artifact-evidence`

## 1. Scope delivered

### P04-A — KPI canon + scope approval (docs-only)
- Frozen vocabulary: signal / target / trend / report(scorecard) / reconciliation / next-action
- KPI→Finance linkage boundaries (in-lane vs non-goal)
- Permissions model (KPI Owner / Finance Owner / Viewer / Commenter)
- Closed-loop workflow contract: signal → inspect → report → reconcile → next action
- Anti-duplicate gates (no BI-suite drift, no parallel finance truth, no charts-only)
- Degraded posture definitions (missing data, discrepancy unresolved, linkage unavailable, permission denied)

### P04-B — Core workflow closure
**New artifacts:**
- `server/src/services/v8/kpiWorkflowCanon.ts` — canonical vocabulary types (`KpiSignal`, `KpiTarget`, `KpiTrend`, `KpiReport`, `KpiReconciliation`, `KpiNextAction`), workflow states + transitions, degraded posture computation (`computeKpiHealthPosture`), permissions matrix (`canPerformKpiAction`), linkage patterns, anti-duplicate rules, acceptance checklist.

**Extended artifacts:**
- `server/src/routes/v8/results.routes.ts` — 6 new P04 workflow endpoints:
  - `GET /workflow/signals` — active KPI signals for the org
  - `GET /workflow/kpi/:kpiId/inspect` — inspection payload (target, trend, health, open signals)
  - `POST /workflow/kpi/:kpiId/next-action` — create traceable next action
  - `GET /workflow/kpi/:kpiId/health` — degraded posture for single KPI
  - `GET /workflow/org-health` — org-wide KPI health summary
  - `GET /workflow/contract` — P04 contract metadata introspection

**Existing artifacts leveraged (not modified):**
- `server/src/services/v8/resultsROIService.ts` — 1660 lines, full KPI CRUD, deviation lifecycle, reconciliation (initiateReconciliation/resolveReconciliation), executive review packs, ROI tracking
- `server/src/services/results/kpiDeviationService.ts` — deviation detection + case creation
- `server/src/services/results/kpiReportSnapshotService.ts` — report snapshot rendering
- `server/src/types/resultsROIContinuity.ts` — 634 lines of Zod-validated types

### P04-C — Verification + rollout
- All 12 acceptance criteria checked (§8.1G)
- Evidence ledger filled for P04-A/B/C
- Regression: 0 failures across 143 total tests

## 2. Test inventory

| Suite | Tests | Status |
|-------|-------|--------|
| P04 KPI workflow integration (new) | 15 | PASS |
| P04 degraded posture (new) | 6 | PASS |
| P04 permissions (new) | 4 | PASS |
| P04 workflow transitions (new) | 3 | PASS |
| P04 E2E closed-loop (new) | 1 | PASS |
| P04 acceptance checklist (new) | 1 | PASS |
| **P04 subtotal** | **30** | **PASS** |
| Existing results routes | 20 | PASS |
| Existing ROI service | 93 | PASS |
| **Grand total** | **143** | **PASS** |

## 3. §8.1G Acceptance checklist (12/12)

1. [x] Vocabulary frozen: signal/target/trend/report/reconciliation/next-action
2. [x] KPI is closed-loop lane, not BI suite
3. [x] KPI truth vs finance model truth boundary explicit
4. [x] Linkage optional, supports interpretation/driver/review/realization
5. [x] Reconciliation ownership: Results starts, Finance resolves
6. [x] Permissions frozen: edit def, edit targets, view, comment, manage reconciliation
7. [x] Permission denied has explicit degraded posture
8. [x] Missing data has explicit degraded posture
9. [x] Discrepancy unresolved has explicit degraded posture
10. [x] Linkage unavailable has explicit degraded posture
11. [x] Anti-duplicate gates explicit
12. [x] Canonical workflow: signal → inspect → report → reconcile → next action

## 4. Known limits

- Reconciliation UX flow depends on Finance module (P05) for finance-side resolution
- Chart aggregation methods bounded to last/sum/average (no custom formulas)
- Permission enforcement at route level relies on upstream auth middleware; service-level permission checks use `canPerformKpiAction()` for contract validation
- Linkage patterns are typed but finance artifact persistence depends on P05 tables
