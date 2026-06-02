---
module_id: MODULE_INITIATIVES
doc_kind: INTEGRATION_REPORT
version: 1.0
owner: user
status: review
last_updated: 2026-05-10
scope_anchor: 05_inicjatywy/MODULE_INTEGRATION
work_type: docs-only
---

# Integration Report — 05_inicjatywy

## Executive Verdict

Verdict: `GO_FOR_NEXT_DOCS_WAVE`, `NO_GO_RUNTIME_DONE`.

The module is documentation-integrated end-to-end for the current Contract 2.0 wave. Function contracts, module 00-07 contracts, RAW packet, task board and evidence baseline are aligned. Runtime readiness remains `NOT_DONE` because dedicated initiative UI lifecycle/card regression, Analysis tab UI regression, companion-lane smoke evidence and final owner acceptance for runtime `DONE` are not bound.

Docs gate decision: `APPROVED_FOR_DOCS` after `npm run docs:contract:rerun-gate` returns 0 errors and 0 warnings.

## Function Coverage Matrix

| Function | Route / entry | Module contract alignment | Route evidence | Component evidence | API evidence | Test evidence | Integration gate |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `IN_PORTFOLIO_HUB` | `/initiatives` | Aligned with 00-07 as initiative identity, lifecycle, cards, preview and governed actions. | `/initiatives`, route config and app routes. | `src/components/Initiatives/InitiativesHub.tsx`, `InitiativePreviewV3`, card variants. | `/api/initiatives`, `GET /api/initiatives/:id/gate-readiness-check`, `InitiativeController`. | `tests/e2e/smoke/deploy-gate-api.spec.ts`; dedicated UI card/lifecycle regression missing. | `PASS_DOC`, `NOT_DONE_UI` |
| `IN_ANALYSIS_WORKSPACE` | `/initiatives` analysis tab | Aligned with 00-07 as readiness analysis without hidden downstream mutation. | `/initiatives` analysis tab. | `InitiativesHub`, `PortfolioAnalysisView`, five Analysis subviews. | `/api/initiatives`, `/api/initiatives/readiness-analysis`, dependency APIs, capability API. | API/component-adjacent tests exist; dedicated Analysis UI regression missing. | `PASS_DOC`, `NOT_DONE_UI` |
| `IN_ROADMAP_VIEW` | `/roadmap` | Aligned as scheduling/roadmap projection, not duplicate initiative truth. | `/roadmap`, route config and app routes. | `src/views/FullRoadmapView.tsx`. | initiative lifecycle/readiness APIs and roadmap service boundaries. | Lane smoke not bound. | `PASS_DOC`, `NOT_DONE_UI` |
| `IN_PORTFOLIO_VIEW` | `/portfolio` | Aligned as portfolio rollup/prioritization projection. | `/portfolio`, route config and app routes. | `src/views/PortfolioView.tsx`. | `src/services/api.ts`, initiative list/status APIs. | Lane smoke not bound. | `PASS_DOC`, `NOT_DONE_UI` |
| `IN_ROI_VIEW` | `/roi` | Aligned as ROI/value context while finance/results retain truth ownership. | `/roi`, route config and app routes. | `src/views/FullROIView.tsx`. | finance/results ROI evidence APIs plus initiative link APIs. | Related finance/results tests exist; initiative ROI lane gate missing. | `PASS_DOC`, `NOT_DONE_UI` |

## Contract Consistency Findings

### P0

| Finding | Resolution | Status |
| --- | --- | --- |
| Module 00-07 and five function contracts must agree on the same function inventory. | Function inventory is locked as `IN_PORTFOLIO_HUB`, `IN_ANALYSIS_WORKSPACE`, `IN_ROADMAP_VIEW`, `IN_PORTFOLIO_VIEW`, `IN_ROI_VIEW`. | `PASS_DOC` |
| Backend capabilities must govern role/CTA/AI availability. | `03_BEHAVIOR.md`, `04_UI_UX.md`, `06_PERMISSIONS_AND_SECURITY.md`, `07_ACCEPTANCE_AND_TESTS.md` and function contracts bind to `GET /api/initiatives/:id/gate-readiness-check`. | `PASS_DOC` |
| AI actions must be Menu 3 right-side only and proposal-based. | Module UI/UX contract and Analysis annex enforce Menu 3 placement, no duplication and no hidden writes. | `PASS_DOC`, `NOT_DONE_UI` |
| Critical claims require route/component/API/test evidence. | Evidence baseline exists, but UI regression gaps remain explicitly `NOT_DONE`. | `PASS_DOC_WITH_GAPS` |

### P1

| Finding | Resolution | Status |
| --- | --- | --- |
| Source envelope taxonomy is broader than current `SOURCE_TRACEABILITY_SPEC.md`. | Kept as open question; module-local contract requires wrapping all valid source families. | `OPEN_QUESTION` |
| Dedicated initiative UI lifecycle/card and Analysis UI regressions are missing. | Future tasks are registered in `IMPLEMENTATION_TASK_BOARD.md` and function cards. | `WAITING_P0_EXECUTION` |
| Companion lane smoke evidence is route-bound but not test-bound. | Lane functions remain `NOT_DONE_UI` until smoke/regression is added. | `WAITING_P0_EXECUTION` |

### P2

| Finding | Resolution | Status |
| --- | --- | --- |
| `workload` author label differs from runtime `resources`. | Alias is documented; naming cleanup remains P2. | `OPEN_QUESTION` |
| Raw visual evidence screenshots for Analysis are not bound. | Gap remains explicit until canonical file location is provided. | `WARNING_DOC` |

## Handoff Impact Summary

No new cross-module handoff edge is introduced by this integration. Existing edges in `MODULE_INTERACTION_GRAPH.md` remain valid:

| Edge | Type | Integration decision |
| --- | --- | --- |
| `01_czat` -> `05_inicjatywy` | `write_request` | Conversation may propose/draft; initiative owner accepts or rejects. |
| `03_wywiad` -> `05_inicjatywy` | `handoff` | Interview findings/opportunities preserve source evidence. |
| `04_narzedzia` -> `05_inicjatywy` | `write_request` | Tool recommendations require source/confidence context. |
| `05_inicjatywy` -> `06_realizacja` | `handoff` | Only approved/scheduled initiative scope can seed execution; execution owns tasks. |
| `05_inicjatywy` -> `07_rezultaty` | `handoff` | KPI targets and expected value hand off; Results owns realized measurement. |
| `05_inicjatywy` -> `08_finanse` | `handoff` | Budget envelope/assumptions hand off; Finance owns models. |

`ARTIFACT_LINEAGE_MATRIX.md` already contains `Initiative dossier` as owned by `05_inicjatywy` with downstream distribution to `06`, `07`, `08`, `09`; no new artifact type is added.

## Evidence Baseline Table

| Requirement | Contract section | Runtime evidence | Test evidence | Status |
| --- | --- | --- | --- | --- |
| Initiative lifecycle and portfolio hub are primary module truth. | `02_SCOPE.md`, `03_BEHAVIOR.md`, `IN_PORTFOLIO_HUB.md` | `/initiatives`, `InitiativesHub`, `/api/initiatives`, `gate-readiness-check`. | `tests/e2e/smoke/deploy-gate-api.spec.ts`; UI lifecycle/card regression missing. | `PASS_LIMITED`, `NOT_DONE_UI` |
| Analysis tab supports workload/resources, feasibility, logic, timeline and completeness without hidden mutation. | `03_BEHAVIOR.md`, `04_UI_UX.md`, `IN_ANALYSIS_WORKSPACE.md` | `/initiatives` analysis tab, `PortfolioAnalysisView`, five subviews, readiness/dependency APIs. | readiness/section/completeness tests partial; Analysis UI regression missing. | `PASS_LIMITED`, `NOT_DONE_UI` |
| Roadmap, portfolio and ROI lanes are projections/handoffs, not duplicate truth owners. | `02_SCOPE.md`, `05_DATA_AND_INTEGRATIONS.md`, lane function contracts. | `/roadmap`, `/portfolio`, `/roi`; `FullRoadmapView`, `PortfolioView`, `FullROIView`. | lane-specific smoke missing. | `PASS_DOC`, `NOT_DONE_UI` |
| Role, CTA and AI availability are backend capability-driven. | `06_PERMISSIONS_AND_SECURITY.md`, product capability/status matrices. | `GET /api/initiatives/:id/gate-readiness-check`, `InitiativeController`, `initiativeAccessResolver`. | no dedicated UI capability regression. | `PASS_DOC`, `NOT_DONE_UI` |
| Cross-module handoff preserves owner boundaries. | `05_DATA_AND_INTEGRATIONS.md`, `MODULE_INTERACTION_GRAPH.md`, `ARTIFACT_LINEAGE_MATRIX.md`. | lifecycle/readiness APIs, task/decision/finance/results links. | partial task/decision/results/finance tests only. | `PASS_DOC_WITH_GAPS` |
| AI remains advisory, source-backed and reviewable. | `03_BEHAVIOR.md`, `04_UI_UX.md`, `06_PERMISSIONS_AND_SECURITY.md`, `DRD/UI_UX_SOURCE_OF_TRUTH.md`. | Menu 3 command row / capability payload. | no UI placement audit regression. | `PASS_DOC`, `NOT_DONE_UI` |

## Gate Result

Gate command: `npm run docs:contract:rerun-gate`.

Result after integration:

- Checked modules: `19`
- Checked function contracts: `77`
- Errors: `0`
- Warnings: `0`
- Report: `test-results/module-contract-gate/module-contract-gate.md`

Expected decision vocabulary:

- `APPROVED_FOR_DOCS`: docs gate returns 0 errors and 0 warnings.
- `BLOCKED_*`: any docs contract error, warning that violates gate, scope drift, or failed validation.

## Remaining Risks And Next Action

| Risk | Severity | Owner / next action |
| --- | --- | --- |
| Dedicated initiative UI lifecycle/card regression is missing. | `P0` | Execute `IN-HUB-P0-*` tasks before runtime done. |
| Dedicated Analysis tab UI regression is missing. | `P0` | Execute `IN-ANL-P0-*` tasks. |
| Companion lane smoke evidence is missing for `/roadmap`, `/portfolio`, `/roi`. | `P1` | Execute lane smoke tasks in task board. |
| Source-envelope taxonomy is open. | `P1` | Owner decision on source family taxonomy replacing ToolSession/AssessmentReport-only doctrine. |
| Final owner acceptance for runtime `DONE` is not recorded. | `P1` | Owner reviews this integration report and explicitly accepts or returns changes. |

Next action: owner review of this integration report, then execute P0 evidence tasks from `IMPLEMENTATION_TASK_BOARD.md`.
