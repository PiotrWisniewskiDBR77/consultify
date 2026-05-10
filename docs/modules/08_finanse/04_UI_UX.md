---
module_id: MODULE_FINANCE
doc_kind: UI_UX
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# UI/UX — Finanse / Finance & Intelligence

## 1. Main Screen

As-Is: finance routes render `FinanceHub` through `EconomicsView`. The hub uses table/grid/preview patterns with per-tab actions and modals for create/import/export. Detail routes `/finance/statements/:id`, `/finance/models/:id` and `/finance/analyses/:id` reuse the same finance surface.

## 2. Runtime States

- Loading: runtime flags must show while finance statements, models, analyses or previews load.
- Empty: empty/filter-empty components must explain whether no financial data exists or filters hide it.
- Error: `financeErrorMap` and toasts must translate failures into business-readable copy.
- Degraded: `FinanceDegradedBanner`, fallback mode and policy/feature restrictions must be visible before the user trusts calculations.
- Success: create/import/export/model actions must confirm completion and point to review, assumptions or output next steps.

## 3. Menu 2 / Menu 3 Contract

Menu 2 keeps module-level navigation. Menu 3 is the finance runtime top bar/command-row cluster for the active tab, selected row, model or analysis context.

## 4. AI Actions Placement

Contextual AI invocation must use finance command-row/right-side controls, row/action controls or approved chat-open helpers. The same AI action must not be duplicated under the canvas.

## 5. Next Action Guidance

Finance UX must tell the user whether to import data, create a model, inspect assumptions, retry degraded data, review analysis, export, or request access.

## 6. Source / Evidence / Provenance

Financial claims, ROI calculations, analyses and exports must show source statements, model assumptions, confidence/evidence or explicit missing-data status.

## 7. Approval / Diff / Review

Create/import/export and high-impact finance calculations must be explicit actions. Generated analyses and ROI outputs require review/approval before use as final business truth.

## 8. Anti-Patterns

- Finance numbers without assumptions/source statements.
- Fallback/degraded mode hidden behind a normal dashboard.
- Raw calculation/API internals in user-facing errors.
- Duplicate AI toolbar under canvas.
- Export success without review/read-back evidence.

## 9. As-Is Gaps

- Existing docs confirm degraded banners, mapped errors and policy gates, but not every calculation/export provenance UI.
- Review/diff evidence for generated finance analyses and exports remains to be validated.

## 10. Acceptance Criteria

- Finance routes render `FinanceHub` through `EconomicsView`.
- Loading, empty, error, degraded and success states are explicit.
- AI actions use Menu 3/right-side or row/action placement without duplication.
- Finance outputs expose source data, assumptions and evidence.
- High-impact calculations/exports require review/approval.

## 11. Function Annex — Finance Functions

| Function ID | Function | Entry / Route | As-Is state | UI Component Footprint (key) | Contract |
| --- | --- | --- | --- | --- | --- |
| `FN_STATEMENTS_WORKSPACE` | Statements Workspace | `/economics`, `/finance` (tab `statements`) | real | statements table/grid/preview + import flows in `FinanceHub` | `functions/FN_STATEMENTS_WORKSPACE.md` |
| `FN_MODELS_WORKSPACE` | Models Workspace | `/economics`, `/finance` (tab `models`) | real | model workspace in `FinanceHub` | `functions/FN_MODELS_WORKSPACE.md` |
| `FN_ANALYSIS_WORKSPACE` | Analysis Workspace | `/economics`, `/finance` (tab `analysis`) | real | analysis workspace in `FinanceHub` | `functions/FN_ANALYSIS_WORKSPACE.md` |
| `FN_PREDICTION_WORKSPACE` | Prediction Workspace | `/economics`, `/finance` (tab `prediction`) | real | prediction workspace in `FinanceHub` | `functions/FN_PREDICTION_WORKSPACE.md` |
| `FN_VALUATION_WORKSPACE` | Valuation Workspace | `/economics`, `/finance` (tab `valuation`) | real | valuation workspace in `FinanceHub` | `functions/FN_VALUATION_WORKSPACE.md` |
| `FN_INVESTMENT_WORKSPACE` | Investment Analysis Workspace | `/economics`, `/finance` (tab `investment`) | real | investment-case workspace in `FinanceHub` | `functions/FN_INVESTMENT_WORKSPACE.md` |
| `FN_FINANCE_DETAIL_ROUTES` | Detail Route Surfaces | `/finance/statements/:id`, `/finance/models/:id`, `/finance/analyses/:id` | real | detail-route mounting through `EconomicsView` | `functions/FN_FINANCE_DETAIL_ROUTES.md` |
