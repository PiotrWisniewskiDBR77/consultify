---
module_id: MODULE_INITIATIVES
doc_kind: IMPLEMENTATION_TASK_BOARD
owner_business: user
owner_tech: user
status: REVIEW
last_updated: 2026-05-10
---

# Implementation Task Board — 05_inicjatywy

## Purpose

Provide one module-level index of future deployable tasks for `05_inicjatywy` while keeping runtime implementation out of this docs-only registry-sync cycle.

This board does not replace the module contract, function contracts or execution cards. It records prioritized work rows so future agents can pick exactly one immutable `scope_anchor` without mixing initiative functions.

## Source Of Truth

- function dispatch protocol: `../_FUNCTION_AGENT_DISPATCH_PROTOCOL_2026-05-10.md`
- function card template: `../_FUNCTION_EXECUTION_CARD_TEMPLATE.md`
- module packet: `RAW_TARGET_STATE_2_0_PACKET.md`
- function cards: `function-cards/*_EXECUTION_CARD.md`
- registry sync card: `function-cards/MODULE_DELIVERY_EXECUTION_CARD.md`
- module integration card: `function-cards/MODULE_INTEGRATION_EXECUTION_CARD.md`
- function contracts: `functions/*.md`

## Board Rules

- Each task points to exactly one `scope_anchor`.
- Cross-module dependencies are dependency/impact only.
- If a task changes scope during execution, status becomes `BLOCKED_SCOPE_DRIFT`.
- `P0` tasks must close before `P1/P2` runtime expansion for the same function family.
- Status policy: `P0=READY`, `P1/P2=WAITING_P0` until relevant P0 rows close.
- Runtime code is out of scope for this registry-sync cycle.

## Task Index

| Task ID | Scope anchor | Priority | Status | Change type | Depends on | Evidence | Source card |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `IN-HUB-P0-001` | `05_inicjatywy/IN_PORTFOLIO_HUB` | `P0` | `READY` | `test` | owner acceptance | route/component/API/test | `function-cards/IN_PORTFOLIO_HUB_EXECUTION_CARD.md` |
| `IN-HUB-P0-002` | `05_inicjatywy/IN_PORTFOLIO_HUB` | `P0` | `READY` | `runtime/test` | `IN-HUB-P0-001` | route/component/API/test | `function-cards/IN_PORTFOLIO_HUB_EXECUTION_CARD.md` |
| `IN-HUB-P0-003` | `05_inicjatywy/IN_PORTFOLIO_HUB` | `P0` | `READY` | `runtime/test` | `IN-HUB-P0-001`,`IN-HUB-P0-002` | route/component/API/test | `function-cards/IN_PORTFOLIO_HUB_EXECUTION_CARD.md` |
| `IN-HUB-P0-004` | `05_inicjatywy/IN_PORTFOLIO_HUB` | `P0` | `READY` | `docs/runtime/test` | `IN-HUB-P0-002`,`IN-HUB-P0-003` | route/component/API/test | `function-cards/IN_PORTFOLIO_HUB_EXECUTION_CARD.md` |
| `IN-ANL-P0-001` | `05_inicjatywy/IN_ANALYSIS_WORKSPACE` | `P0` | `READY` | `test` | none | route `/initiatives`; components `InitiativesHub`, `PortfolioAnalysisView`, five subviews; APIs `/api/initiatives`, readiness/dependency/capability APIs; dedicated Analysis UI test | `function-cards/IN_ANALYSIS_WORKSPACE_EXECUTION_CARD.md` |
| `IN-ANL-P0-002` | `05_inicjatywy/IN_ANALYSIS_WORKSPACE` | `P0` | `READY` | `test` | `IN-ANL-P0-001` | route `/initiatives`; Menu 3 command row components; API `gate-readiness-check`; test verifies right-side AI/action placement and no canvas duplication | `function-cards/IN_ANALYSIS_WORKSPACE_EXECUTION_CARD.md` |
| `IN-ANL-P0-003` | `05_inicjatywy/IN_ANALYSIS_WORKSPACE` | `P0` | `READY` | `test` | `IN-ANL-P0-001` | route `/initiatives`; Analysis shell/subviews; APIs `/api/initiatives`, readiness/dependency APIs; test covers loading, empty, degraded/error and success states | `function-cards/IN_ANALYSIS_WORKSPACE_EXECUTION_CARD.md` |
| `IN-ANL-P0-004` | `05_inicjatywy/IN_ANALYSIS_WORKSPACE` | `P0` | `READY` | `docs` | `IN-ANL-P0-001`,`IN-ANL-P0-002`,`IN-ANL-P0-003` | route/component/API/test evidence gates updated in function and acceptance docs after tests exist | `function-cards/IN_ANALYSIS_WORKSPACE_EXECUTION_CARD.md` |
| `IN-ANL-P1-001` | `05_inicjatywy/IN_ANALYSIS_WORKSPACE` | `P1` | `WAITING_P0` | `docs` | `IN-ANL-P0-*` | route/component/API/test plus canonical raw visual evidence links for five Analysis subviews | `function-cards/IN_ANALYSIS_WORKSPACE_EXECUTION_CARD.md` |
| `IN-ANL-P1-002` | `05_inicjatywy/IN_ANALYSIS_WORKSPACE` | `P1` | `WAITING_P0` | `docs` | `IN-ANL-P0-*` | route/component/API/test plus manual audit checklist for role gating, CTA, AI disabled/degraded state and read-back | `function-cards/IN_ANALYSIS_WORKSPACE_EXECUTION_CARD.md` |
| `IN-HUB-P1-001` | `05_inicjatywy/IN_PORTFOLIO_HUB` | `P1` | `WAITING_P0` | `docs/runtime/test` | `IN-HUB-P0-*` | route/component/API/test | `function-cards/IN_PORTFOLIO_HUB_EXECUTION_CARD.md` |
| `IN-HUB-P1-002` | `05_inicjatywy/IN_PORTFOLIO_HUB` | `P1` | `WAITING_P0` | `docs/runtime/test` | `IN-HUB-P0-*` | route/component/API/test | `function-cards/IN_PORTFOLIO_HUB_EXECUTION_CARD.md` |
| `IN-ROAD-P1-001` | `05_inicjatywy/IN_ROADMAP_VIEW` | `P1` | `WAITING_P0` | `test` | `IN-HUB-P0-001` | route/component/API/test | `function-cards/IN_ROADMAP_VIEW_EXECUTION_CARD.md` |
| `IN-PORT-P1-001` | `05_inicjatywy/IN_PORTFOLIO_VIEW` | `P1` | `WAITING_P0` | `test` | `IN-HUB-P0-001` | route/component/API/test | `function-cards/IN_PORTFOLIO_VIEW_EXECUTION_CARD.md` |
| `IN-ROI-P1-001` | `05_inicjatywy/IN_ROI_VIEW` | `P1` | `WAITING_P0` | `docs/runtime/test` | `IN-HUB-P0-*` | route/component/API/test | `function-cards/IN_ROI_VIEW_EXECUTION_CARD.md` |
| `IN-XLANE-P2-001` | `05_inicjatywy/MODULE_DELIVERY` | `P2` | `WAITING_P0` | `test` | `IN-HUB-P0-*`,`IN-ANL-P0-001`,`IN-ROAD-P1-001`,`IN-PORT-P1-001`,`IN-ROI-P1-001` | route/component/API/test | `function-cards/MODULE_DELIVERY_EXECUTION_CARD.md` |
| `IN-HUB-P2-001` | `05_inicjatywy/IN_PORTFOLIO_HUB` | `P2` | `WAITING_P0` | `docs/test` | `IN-HUB-P0-*`,`IN-HUB-P1-*` | route/component/API/test | `function-cards/IN_PORTFOLIO_HUB_EXECUTION_CARD.md` |
| `IN-ANL-P2-001` | `05_inicjatywy/IN_ANALYSIS_WORKSPACE` | `P2` | `WAITING_P0` | `docs` | `IN-ANL-P0-*`,`IN-ANL-P1-*` | route/component/API/test plus naming decision for author `workload` vs runtime `resources` | `function-cards/IN_ANALYSIS_WORKSPACE_EXECUTION_CARD.md` |
| `IN-INT-P0-001` | `05_inicjatywy/MODULE_INTEGRATION` | `P0` | `READY` | `test/docs` | `IN-HUB-P0-*` | route `/initiatives`; component `InitiativesHub`; APIs `/api/initiatives`, `gate-readiness-check`; dedicated portfolio hub UI lifecycle/card evidence | `function-cards/MODULE_INTEGRATION_EXECUTION_CARD.md` |
| `IN-INT-P0-002` | `05_inicjatywy/MODULE_INTEGRATION` | `P0` | `READY` | `test/docs` | `IN-ANL-P0-*` | route `/initiatives`; component `PortfolioAnalysisView` and five subviews; readiness/dependency/capability APIs; dedicated Analysis UI evidence | `function-cards/MODULE_INTEGRATION_EXECUTION_CARD.md` |
| `IN-INT-P0-003` | `05_inicjatywy/MODULE_INTEGRATION` | `P0` | `READY` | `test/docs` | `IN-HUB-P0-*`,`IN-ANL-P0-*` | route `/initiatives`; Menu 3 command row/right-side action evidence; API `gate-readiness-check`; UI placement test/audit | `function-cards/MODULE_INTEGRATION_EXECUTION_CARD.md` |
| `IN-INT-P0-004` | `05_inicjatywy/MODULE_INTEGRATION` | `P0` | `READY` | `docs` | `IN-INT-P0-001`,`IN-INT-P0-002`,`IN-INT-P0-003` | route/component/API/test references updated in `07_ACCEPTANCE_AND_TESTS.md`, `STATUS.md`, `INTEGRATION_REPORT.md`; docs gate rerun | `function-cards/MODULE_INTEGRATION_EXECUTION_CARD.md` |
| `IN-INT-P0-005` | `05_inicjatywy/MODULE_INTEGRATION` | `P0` | `READY` | `docs` | `IN-INT-P0-004` | owner acceptance or explicit `NO_GO` recorded in `STATUS.md` and `INTEGRATION_REPORT.md` | `function-cards/MODULE_INTEGRATION_EXECUTION_CARD.md` |
| `IN-INT-P0-006` | `05_inicjatywy/MODULE_INTEGRATION` | `P0` | `READY` | `docs` | `IN-INT-P0-005` | RAW semantic + world-class certification update linked to packet and certification report with explicit runtime separation | `function-cards/MODULE_INTEGRATION_EXECUTION_CARD.md` |
| `IN-INT-P1-001` | `05_inicjatywy/MODULE_INTEGRATION` | `P1` | `WAITING_P0` | `test/docs` | `IN-INT-P0-*`,`IN-ROAD-P1-001` | route `/roadmap`; component `FullRoadmapView`; initiative readiness APIs; lane smoke evidence | `function-cards/MODULE_INTEGRATION_EXECUTION_CARD.md` |
| `IN-INT-P1-002` | `05_inicjatywy/MODULE_INTEGRATION` | `P1` | `WAITING_P0` | `test/docs` | `IN-INT-P0-*`,`IN-PORT-P1-001` | route `/portfolio`; component `PortfolioView`; initiative list/status APIs; lane smoke evidence | `function-cards/MODULE_INTEGRATION_EXECUTION_CARD.md` |
| `IN-INT-P1-003` | `05_inicjatywy/MODULE_INTEGRATION` | `P1` | `WAITING_P0` | `test/docs` | `IN-INT-P0-*`,`IN-ROI-P1-001` | route `/roi`; component `FullROIView`; finance/results initiative link APIs; lane smoke evidence | `function-cards/MODULE_INTEGRATION_EXECUTION_CARD.md` |
| `IN-INT-P1-004` | `05_inicjatywy/MODULE_INTEGRATION` | `P1` | `WAITING_P0` | `docs` | `IN-INT-P0-*` | source-envelope taxonomy decision plus route/component/API/test impact mapping | `function-cards/MODULE_INTEGRATION_EXECUTION_CARD.md` |
| `IN-INT-P1-005` | `05_inicjatywy/MODULE_INTEGRATION` | `P1` | `WAITING_P0` | `docs` | `IN-INT-P0-*`,`IN-ANL-P1-001` | Analysis raw visual evidence links or accepted `WARNING_DOC`; route/component/API/test references preserved | `function-cards/MODULE_INTEGRATION_EXECUTION_CARD.md` |
| `IN-INT-P1-006` | `05_inicjatywy/MODULE_INTEGRATION` | `P1` | `WAITING_P0` | `test/docs` | `IN-INT-P0-*` | handoff boundary route/component/API/test evidence for task, decision, results and finance links; no new graph edge unless owner approves | `function-cards/MODULE_INTEGRATION_EXECUTION_CARD.md` |
| `IN-INT-P2-001` | `05_inicjatywy/MODULE_INTEGRATION` | `P2` | `WAITING_P0` | `docs` | `IN-INT-P0-*`,`IN-ANL-P2-001` | product naming decision for `workload` vs `resources`; route/component/API/test impact preserved | `function-cards/MODULE_INTEGRATION_EXECUTION_CARD.md` |
| `IN-INT-P2-002` | `05_inicjatywy/MODULE_INTEGRATION` | `P2` | `WAITING_P0` | `docs` | `IN-INT-P0-*`,`IN-INT-P1-004` | KPI/results -> initiative policy decision; contract update/open question closure | `function-cards/MODULE_INTEGRATION_EXECUTION_CARD.md` |
| `IN-INT-P2-003` | `05_inicjatywy/MODULE_INTEGRATION` | `P2` | `WAITING_P0` | `docs` | `IN-INT-P0-*`,`IN-INT-P1-004` | interview generator policy decision; contract update/open question closure | `function-cards/MODULE_INTEGRATION_EXECUTION_CARD.md` |
| `IN-INT-P2-004` | `05_inicjatywy/MODULE_INTEGRATION` | `P2` | `WAITING_P0` | `docs` | `IN-INT-P0-*` | future work graph view concept backlog with initiative -> milestones -> tasks -> decisions and owner boundaries | `function-cards/MODULE_INTEGRATION_EXECUTION_CARD.md` |

## Current Readiness

- documentation gate: `PASS`
- registry sync: `COMPLETED`
- runtime implementation: `NOT_STARTED_BY_THIS_BOARD`
- owner acceptance: `PENDING_FOR_RUNTIME_ROWS`
- scope guard: `PASS` — every task has one scope anchor
- registry sync note: `IN_ANALYSIS_WORKSPACE` rows normalized on 2026-05-10 with source card `function-cards/IN_ANALYSIS_WORKSPACE_EXECUTION_CARD.md`
- registry sync note: `MODULE_INTEGRATION` rows normalized on 2026-05-10 with source card `function-cards/MODULE_INTEGRATION_EXECUTION_CARD.md`

## Taskboard + Function Card Integrity Audit — 2026-05-11

| Check | Result | Evidence |
| --- | --- | --- |
| Task ID uniqueness | `PASS` | Board rows use unique task identifiers for this module. |
| Scope anchor clarity | `PASS` | Every row maps to one `05_inicjatywy/<function>` scope anchor. |
| Source card existence | `PASS` | Source card paths point to existing `function-cards/*_EXECUTION_CARD.md` files. |
| Priority dependency policy | `PASS` | `P0` rows lead; `P1/P2` rows are dependency-gated by matching P0/P1 rows or explicit integration prerequisites. |
| Runtime authorization | `PASS_DOCS_ONLY` | Board records future work; it does not authorize runtime edits in this documentation pass. |

Audit note: Initiatives board includes function rows plus module integration rows.
