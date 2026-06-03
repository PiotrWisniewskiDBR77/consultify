# Module 07 — Rezultaty — Readiness Scorecard

**Readiness: 74/100 — Tier: Beta (was 52 → Δ +22)**
**Route(s):** `/benefits` → `ResultsHub`
**One-line verdict:** All three P1 blockers from the June 2 audit have been closed — finalization guard is at the HTTP layer with regression tests, ROI lock/approval UI is live per-row + banner, showcase data is now explicit-demo-only. Module moves from Alpha to Beta; remaining gaps are frontend smoke-test coverage, ROIAssumptionEditor disabled-prop mismatch, and /kpi-okr ghost route.

---

## Δ vs baseline (52 → 74)

| Area | Was | Now |
|---|---|---|
| Report finalization guard (HTTP) | Missing | **Implemented** — `findKpiReportFinalizationViolation` at `results.routes.ts:162`, called at `results.routes.ts:1377` |
| ROI lock/approval UI | Missing | **Implemented** — `LockBadge`, `deriveROILockState`, governance banner at `ROIAnalysisView.tsx:230–260, 462–473` |
| Showcase data gating | Auto-fires on localhost/DEV | **Fixed** — `resultsShowcaseData.ts:85–91` delegates to `shouldAllowDemoData()` which requires explicit demo session toggle |
| Frontend tests | Zero | `__tests__/ROIAnalysisView.smoke.test.tsx` (4 cases), `ResultsHub.smoke.test.tsx`, `ResultsKpiReportsView.smoke.test.tsx` added |
| Schedule approval chip | Stored in DB, not surfaced in UI | **Implemented** — `ScheduleApprovalChip` at `ResultsReportingEnterpriseViews.tsx:62–102`, wired to schedule rows at line 354 |

---

## Functionality

**Real / backend-wired:**
- KPI CRUD, time-series recording, deviation lifecycle — unchanged, confirmed real.
- `findKpiReportFinalizationViolation` (`results.routes.ts:162–219`): two-step guard — (1) blocks on `benefits_realization/review/locked` KPI status; (2) blocks on existing `finalized/locked/approved` snapshot. Exported and tested by `results-finalization-guard.test.ts` with 5 focused cases including schema-degradation path.
- ROI lock/approval: `deriveROILockState` derives state from initiative lifecycle status; `LockBadge` renders per-row; "Record actual" action is `disabled={!editable}` with tooltip at `ROIAnalysisView.tsx:721–733`; `ROIDetailDrawer` passes `readOnly = lockState !== 'open'` to `ROIAssumptionEditor` at `ROIDetailDrawer.tsx:84, 379–381`.
- `ScheduleApprovalChip` renders Auto/Approved/Pending/Rejected states with correct amber "Dispatch is blocked" tooltip for pending.

**Remaining functional gaps:**
- `ROIAssumptionEditor` receives `disabled` prop but `ROIDetailDrawer` passes `onChange: () => {}` / `onSave: async () => {}` instead of the `disabled` prop directly (`ROIDetailDrawer.tsx:379–381`). The `disabled` prop defined at `ROIAssumptionEditor.tsx:41` is therefore never set from the lock path — inputs in the editor are not visually disabled, only silently ignored. Edit forms appear editable when locked.
- Snapshot guard query (`results.routes.ts:200–204`) is org-scoped but not KPI-scoped: any finalized snapshot in the org blocks all new reports regardless of KPI selection. This may over-block when org has multiple KPI sets in different states.

---

## Intra-module flow & states

`ResultsHub` → tabs: KPI Overview, KPI Queue, Signal Sheet, Initiatives, ROI Analysis, ROI Tracking, KPI Reports, Scorecards, Schedules/Wallboards/Connectors (enterprise). Initiative status change calls `updateInitiativeStatusWriteTruth` then `refreshResultsTruth` at `ResultsHub.tsx:777–793` — status propagates immediately to ROI lock derivation. KPI create/delete flows through V8 API, optimistic list update. Deviation lifecycle (acknowledge → RCA → actions → resolve → close) fully wired. Report creation now guarded end-to-end.

---

## UI/UX adherence

- `ResultsHub` correctly uses `ModuleHub`, `TabConfig`, `ViewMode`, `FilterChip`, `CommandRow` — standard shell fully maintained.
- `ROIAnalysisView` intentionally uses navy-900 dark-bg cards per DBR77 spec (`ROIAnalysisView.tsx:1–4` comment). Rounded-xl cards, crimson/emerald/rose semantic colors consistent with design system. LockBadge uses emerald for approved, slate for locked — correct.
- `ScheduleApprovalChip` uses light/dark-mode safe Tailwind classes (slate/emerald/rose/amber with `dark:` variants).
- `ResultsReportingEnterpriseViews.tsx:110` uses `rounded-xl border` pattern on workspace stat cards — consistent.

---

## Cross-module handoffs

- **Initiatives → Results**: `updateInitiativeStatusWriteTruth` at `ResultsHub.tsx:777` writes status back to Initiatives module; lock state in ROI view derives from the returned status, completing the loop. No event bus — direct API call is synchronous and sufficient.
- **Execution → Results**: KPI time-series recording at `results.routes.ts:1224` reads `measurement_frequency` from `initiative_kpis` — shared table with Initiatives. Deviation side-effects from measurement recording wired via `kpiDeviationService`.
- **Report Builder**: KPI report creation at `results.routes.ts:1352–1411` calls `ReportBuilderService.createReport` + section population + status update — full cross-module write wired.

---

## Risks / regressions

1. **ROIAssumptionEditor disabled-prop mismatch** (`ROIDetailDrawer.tsx:377–381`): locked initiatives show assumption form as visually editable (inputs enabled) — user can type but save is a no-op. Misleading UX. P2.
2. **Snapshot guard over-blocks** (`results.routes.ts:200`): org-wide finalized snapshot check may prevent legitimate new reports on unrelated KPI sets in the same org. P2.
3. **Legacy route finalization bypass** (`results-kpi-reports.routes.ts:309`): legacy POST `/kpi-reports` has no `findKpiReportFinalizationViolation` call. If the frontend `shouldFallbackToLegacyResults` path routes here, the 409 guard is bypassed entirely. Same gap on the legacy `/kpi-reports/:snapshotId/refresh` (line 358). P2.
4. **LATERAL JOIN on SQLite** (`benefits.routes.ts:81–107`): KPI list query uses `LEFT JOIN LATERAL (...)` which SQLite does not support. PostgreSQL is fine; any SQLite-backed CI or dev environment crashes this endpoint at runtime. P1 if SQLite path is used.
5. **`/kpi-okr` ghost route**: `AppRoutes.tsx:1918` registers it as `<Navigate replace>` — confirmed redirect-only, no dead KpiOkrView component rendering. Tech debt only. P3.
6. **Frontend smoke tests thin**: 3 test files added but `ResultsKpisTableV3`, `KPITimeSeriesDrawer`, `ResultsReportingEnterpriseViews` have no coverage. Any regression in these surfaces is invisible.

---

## Top gaps to reach 98

1. Pass `disabled={readOnly}` into `ROIAssumptionEditor` from `ROIDetailDrawer` (1-line fix) — close the false-editable UX.
2. Add `findKpiReportFinalizationViolation` guard to legacy `results-kpi-reports.routes.ts:309` POST and refresh endpoints.
3. Verify LATERAL JOIN usage in `benefits.routes.ts:81` against active DB adapter — replace with correlated subquery if SQLite path is live.
4. Narrow snapshot guard to per-KPI scope or add opt-out for unscoped org checks.
5. Add smoke tests for `ResultsReportingEnterpriseViews` (ScheduleApprovalChip + showcase path) and `KPITimeSeriesDrawer`.
6. Retire or formally alias `/kpi-okr` route.
