---
module_id: MODULE_INITIATIVES
doc_kind: UI_UX
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# UI/UX — Inicjatywy

## 1. Main Screen

As-Is: `/initiatives` renders `InitiativesHub` in a no-padding module workspace layout. Related initiative lane surfaces remain available through `/roadmap`, `/portfolio` and `/roi`. The screen job is initiative portfolio work across kanban/list/timeline/grid, table+preview and open-document patterns.

## 2. Runtime States

- Loading: hub refresh/loading states must be visible before initiative data is trusted.
- Empty: no-initiative or filtered-empty states must tell the user how to create, import, clear filters or inspect another scope.
- Error: failures must use toast/banner handling and must not leave stale data looking current.
- Degraded: pilot restrictions, partial portfolio data or unavailable linked lanes must be visible.
- Success: creation, update, status transition or deep-link open must confirm the result and identify the next review/action.

## 3. Menu 2 / Menu 3 Contract

Menu 2 keeps module-level navigation. Menu 3 is the initiative command row for the active view, selected initiative or open document. `InitiativesHub` may register analysis action nodes in command-row space.

## 4. AI Actions Placement

Initiative analysis actions must render in Menu 3/right-side command space or row-scoped controls. The same AI action must not appear both in the initiative canvas and in Menu 3.

## 5. Next Action Guidance

The UX must tell the user whether to create/refine an initiative, review assumptions, move status, open linked ROI/roadmap data, clear filters or request access.

## 6. Source / Evidence / Provenance

Initiative recommendations, expected value and status summaries must show linked source documents, interviews, ROI assumptions or explicit missing-evidence status.

## 7. Approval / Diff / Review

High-impact transitions, portfolio decisions and value/ROI changes require explicit gated actions and visible review/diff where available. No hidden mutation path is allowed.

## 8. Anti-Patterns

- Status/value changes without review or visible result.
- AI recommendation without source/evidence.
- Hidden pilot/role denial.
- Duplicated AI toolbar in canvas.
- Stale portfolio data presented as current success.

## 9. As-Is Gaps

- Existing docs confirm hub state, status/filter chips and gated actions, but the per-transition approval/diff UI matrix is not fully enumerated.
- Provenance display for all initiative recommendations and ROI links needs runtime validation.

## 10. Acceptance Criteria

- `/initiatives` renders `InitiativesHub` as the main initiative screen.
- Loading, empty, error, degraded and success states are visible across portfolio views.
- AI analysis actions use Menu 3/right-side placement without duplication.
- Initiative claims and value data show source/provenance or missing-evidence status.
- High-impact transitions require explicit review/approval.

## 11. Function Annex — Initiatives Functions

| Function ID | Function | Entry / Route | As-Is state | UI Component Footprint (key) | Contract |
| --- | --- | --- | --- | --- | --- |
| `IN_PORTFOLIO_HUB` | Portfolio Hub | `/initiatives` | real | `InitiativesHub` (table/kanban/timeline/grid + preview) | `functions/IN_PORTFOLIO_HUB.md` |
| `IN_ANALYSIS_WORKSPACE` | Analysis Workspace | `InitiativesHub` tab `analysis` | real | analysis command row + subviews in `InitiativesHub` | `functions/IN_ANALYSIS_WORKSPACE.md` |
| `IN_ROADMAP_VIEW` | Roadmap View | `/roadmap` | real | `FullRoadmapView` | `functions/IN_ROADMAP_VIEW.md` |
| `IN_PORTFOLIO_VIEW` | Portfolio Route View | `/portfolio` | real | `PortfolioView` | `functions/IN_PORTFOLIO_VIEW.md` |
| `IN_ROI_VIEW` | ROI View | `/roi` | real | `FullROIView` | `functions/IN_ROI_VIEW.md` |
