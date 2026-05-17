---
module_id: MODULE_FINANCE
doc_kind: UI_UX
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-11
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
- Statements function now has a dedicated docs audit backlog for provenance/review/Menu 3/test evidence normalization (`FN-STM-P0-001`, `FN-STM-P1-001`, `FN-STM-P2-001`).
- Analysis function now has a dedicated docs audit backlog for explainability/source-lineage/high-impact-approval/no-hidden-writes/test evidence normalization (`FN-ANL-P0-001`, `FN-ANL-P1-001`, `FN-ANL-P2-001`).
- Models function requires explicit assumptions confidence posture, mutation/review checkpoints, and degraded trust semantics normalization (`FN-MDL-P0-001`, `FN-MDL-P1-001`, `FN-MDL-P2-001`).
- Valuation function requires assumptions envelope, model/source provenance markers, and approval-before-final-claim/export normalization (`FN-VLU-P0-001`, `FN-VLU-P1-001`, `FN-VLU-P2-001`).
- Prediction function requires assumptions transparency, forecast uncertainty semantics, degraded-state guidance, and explicit approvals normalization (`FN-PRD-P0-001`, `FN-PRD-P1-001`, `FN-PRD-P2-001`).
- Investment function requires recommendation traceability, explicit risk assumptions, and no-hidden-finalization approval semantics normalization (`FN-INV-P0-001`, `FN-INV-P1-001`, `FN-INV-P2-001`).

## 9A. Function Addendum — FN_MODELS_WORKSPACE (docs audit 2026-05-11)

| Claim area | As-is status | Task linkage | Evidence posture |
| --- | --- | --- | --- |
| assumptions/source/confidence visibility in model UX | `PASS_WITH_P1` | `FN-MDL-P0-001` | baseline is present in finance UX doctrine; model-specific proof points remain partial |
| explicit review/approval boundary for high-impact model mutations | `PASS_WITH_P1` | `FN-MDL-P1-001` | explicit-action doctrine exists; models lane review checkpoints are not fully consolidated |
| degraded mode clarity for model trust | `PASS_WITH_P1` | `FN-MDL-P1-001` | degraded banner exists at module level; model-specific low-confidence next actions need stronger evidence |
| models-specific UI regression evidence | `NOT_DONE` | `FN-MDL-P2-001` | no dedicated models UI test evidence matrix linked in acceptance docs |

## 9B. Function Addendum — FN_VALUATION_WORKSPACE (docs audit 2026-05-11)

| Claim area | As-is status | Task linkage | Evidence posture | RAW source reference |
| --- | --- | --- | --- | --- |
| assumptions visibility in valuation UX (`owner/source/confidence/status`) | `PASS_WITH_P1` | `FN-VLU-P0-001` | assumptions doctrine exists in RAW and finance UI, but valuation-specific checklist remains partial | `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` (Workflow 12, req 966-971), `docs/product/FINANCIAL_ANALYSIS_V3.md` (2.5.3 Market Assumptions Panel) |
| model/source provenance visibility for valuation claims | `PASS_WITH_P1` | `FN-VLU-P1-001` | provenance expectations exist globally; valuation lane proof points remain partial | `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` (Company Valuation Engine + req 1048-1049), `docs/UI_UX/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09 2.md` (Valuation View + source confidence doctrine) |
| explicit approval before final claim/export | `PASS_WITH_P1` | `FN-VLU-P1-001` | review doctrine exists, but valuation-specific final-claim/export checkpoint wording was dispersed | `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` (Workflow 26, Workflow 28, req 1024) |
| valuation-specific UI regression evidence | `NOT_DONE` | `FN-VLU-P2-001` | no dedicated valuation UI evidence matrix linked in acceptance docs | `docs/modules/08_finanse/07_ACCEPTANCE_AND_TESTS.md` (valuation addendum + code gap) |

## 9C. Function Addendum — FN_PREDICTION_WORKSPACE (docs audit 2026-05-11)

| Claim area | As-is status | Task linkage | Evidence posture |
| --- | --- | --- | --- |
| assumptions/source/confidence visibility in prediction UX | `PASS_WITH_P1` | `FN-PRD-P0-001` | finance-level provenance doctrine exists; prediction-lane UI evidence is still partially linked |
| uncertainty visibility (confidence bands/probability) in forecasts | `PASS_WITH_P1` | `FN-PRD-P1-001` | RAW and product references require this posture; prediction-lane proof points are not normalized in one matrix |
| degraded-state guidance for low-confidence/partial predictions | `PASS_WITH_P1` | `FN-PRD-P1-001` | degraded mode exists globally, but prediction-specific next actions and escalation cues remain partial |
| explicit review/approval cues for high-impact prediction outputs | `PASS_WITH_P1` | `FN-PRD-P1-001` | explicit-action doctrine exists, yet prediction-specific approve/review checkpoints are not fully consolidated |
| prediction-specific UI regression evidence | `NOT_DONE` | `FN-PRD-P2-001` | no dedicated prediction UI test evidence matrix is linked in acceptance docs |

## 9D. Function Addendum — FN_INVESTMENT_WORKSPACE (docs audit 2026-05-11)

| Claim area | As-is status | Task linkage | Evidence posture |
| --- | --- | --- | --- |
| recommendation traceability in investment UX | `PASS_WITH_P1` | `FN-INV-P0-001` | investment decision metrics are present, but source/assumption/recommendation traceability cues are not fully consolidated in one UX evidence matrix |
| explicit risk assumptions visibility before go/no-go | `PASS_WITH_P1` | `FN-INV-P1-001` | risk score/fit doctrine exists in RAW and product references; investment-lane assumptions transparency remains partially linked |
| explicit review/approval cues for high-impact final recommendation | `BLOCKED_P1` | `FN-INV-P1-001` | doctrine is explicit, but no dedicated investment-lane runtime probe is linked as evidence |
| no hidden finalization posture in decision UI | `BLOCKED_P1` | `FN-INV-P1-001` | anti-hidden-finalization doctrine exists, yet dedicated investment-lane proof remains unresolved |
| investment-specific UI regression evidence | `NOT_DONE` | `FN-INV-P2-001` | no dedicated investment UI test evidence matrix is linked in acceptance docs |

## 9E. Function Addendum — FN_FINANCE_DETAIL_ROUTES (impact-only companion, docs audit 2026-05-11)

| Claim area | As-is status | Task linkage | Evidence posture |
| --- | --- | --- | --- |
| detail-route context integrity (`/finance/*/:id`) | `PASS_WITH_P2` | `FN-DTL-P0-001` | detail routes are mounted and reuse parent finance surface; dedicated companion probes remain partial |
| no hidden mutation path from deep-link entry | `PASS_WITH_P2` | `FN-DTL-P1-001` | governance doctrine exists; route-entry specific anti-hidden-write evidence is docs-level |
| dedicated detail-route UI regression evidence | `NOT_DONE` | `FN-DTL-P2-001` | no dedicated detail-route UI matrix is linked in acceptance docs |

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
