---
module_id: MODULE_RESULTS
doc_kind: UI_UX
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# UI/UX — Rezultaty / Results & Value Realization

## 1. Main Screen

As-Is: `/benefits` renders `ResultsHub` with module tabs for initiatives, KPI surfaces, reports and ROI. `/kpi-okr` remains available for KPI-focused entry. The screen job is value realization review through ModuleHub controls, KPI/ROI drawers and modals.

## 2. Runtime States

- Loading: results runtime must show loading/source-state chips while KPI, ROI or report data loads.
- Empty: no-KPI/no-result/filter-empty states must explain whether data is absent, filtered out or not yet linked.
- Error: toast-driven handling and guarded fallbacks must surface failed loads/mutations.
- Degraded: partial KPI/ROI/report data must be visible as degraded and not used as complete truth.
- Success: updates, linked status operations and report refreshes must confirm what changed and what to review next.

## 3. Menu 2 / Menu 3 Contract

Menu 2 keeps module-level navigation. Menu 3 is the Results command/filter bar or active view control row for the selected tab, KPI, ROI or report context.

## 4. AI Actions Placement

Contextual AI analysis for KPI, ROI or value realization must live in Menu 3/right-side command placement or selected record controls. The route/canvas must not duplicate the same AI action.

## 5. Next Action Guidance

Results UX must tell the user whether to connect data, inspect KPI evidence, update tracking, review ROI assumptions, retry loading or export/report approved results.

## 6. Source / Evidence / Provenance

KPI, ROI, value claims and reports must show source-state, linked initiative/report context, assumptions and evidence. Missing or partial evidence must be explicit.

## 7. Approval / Diff / Review

High-impact tracking updates, linked status operations and generated value reports must be explicit user actions. Final KPI/ROI claims require review/approval before presentation as approved truth.

## 8. Anti-Patterns

- KPI/ROI numbers without assumptions or source-state.
- Partial data presented as complete success.
- Duplicate AI controls in canvas and Menu 3.
- Silent linked status updates.
- Error hidden behind stale dashboards.

## 9. As-Is Gaps

- Existing docs confirm source-state chips, dedicated degraded branches and explicit operations, but not every KPI/ROI claim's provenance UI.
- Approval/diff behavior for generated reports and linked status operations needs runtime validation.

## 10. Acceptance Criteria

- `/benefits` renders `ResultsHub`; `/kpi-okr` remains KPI-focused.
- Loading, empty, error, degraded and success states are explicit and actionable.
- AI analysis uses Menu 3/right-side placement without duplication.
- KPI/ROI/reports expose sources, assumptions and evidence.
- High-impact results operations require review/approval.

## 11. Function Annex — Results Functions

| Function ID | Function | Entry / Route | As-Is state | UI Component Footprint (key) | Contract |
| --- | --- | --- | --- | --- | --- |
| `RZ_INITIATIVES_TRACKING` | Initiatives Tracking | `/benefits` (tab `results_initiatives`) | real | initiatives workspace in `ResultsHub` | `functions/RZ_INITIATIVES_TRACKING.md` |
| `RZ_KPI_WORKSPACE` | KPI Workspace | `/benefits` (tab `results_kpi`) | real | KPI catalog/overview/queue/scorecards in `ResultsHub` | `functions/RZ_KPI_WORKSPACE.md` |
| `RZ_REPORTS_WORKSPACE` | Reports Workspace | `/benefits` (tab `results_reports`) | real | reporting workspace in `ResultsHub` | `functions/RZ_REPORTS_WORKSPACE.md` |
| `RZ_ROI_TRACKING` | ROI Tracking | `/benefits` (tab `roi`) | real | ROI tracking views/drawers in results runtime | `functions/RZ_ROI_TRACKING.md` |
| `RZ_ROI_ANALYSIS` | ROI Analysis | `/benefits` (tab `roi_analysis`) | real | `ROIAnalysisView` in results runtime | `functions/RZ_ROI_ANALYSIS.md` |
| `RZ_KPI_OKR_ROUTE` | KPI/OKR Route Surface | `/kpi-okr` | partial | `KpiOkrView` route-level KPI surface | `functions/RZ_KPI_OKR_ROUTE.md` |
