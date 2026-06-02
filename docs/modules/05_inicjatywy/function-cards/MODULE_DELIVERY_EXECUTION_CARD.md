---
module_id: MODULE_INITIATIVES
function_id: MODULE_DELIVERY
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
status: REVIEW
last_updated: 2026-05-10
---

# Function Execution Card — MODULE_DELIVERY

## 1. Metadata

- scope_anchor: `05_inicjatywy/MODULE_DELIVERY`
- primary_module: `05_inicjatywy`
- primary_function: `MODULE_DELIVERY`
- parent_function: `MODULE_DELIVERY`
- owner_business: `user`
- owner_tech: `user`
- work_type: `docs-only`
- status: `REVIEW`
- cycle: `Decision -> UI/UX -> Build contract -> Impact -> Done`

## 2. Scope Anchor

- in scope:
  - `IMPLEMENTATION_TASK_BOARD.md`
  - `function-cards/MODULE_DELIVERY_EXECUTION_CARD.md`
  - optional status reference in `RAW_TARGET_STATE_2_0_PACKET.md`
- out of scope:
  - runtime implementation,
  - edits to `src/**`, `server/**`, `tests/**`,
  - changing other module contracts,
  - promoting dependency modules/functions to primary scope.
- allowed global documents:
  - `../_FUNCTION_AGENT_DISPATCH_PROTOCOL_2026-05-10.md`
  - `../_FUNCTION_EXECUTION_CARD_TEMPLATE.md`
- forbidden files:
  - runtime code,
  - non-`05_inicjatywy` module contracts,
  - unrelated function cards.
- immutable rule: this registry-sync cycle is locked to `05_inicjatywy/MODULE_DELIVERY`.

## 3. Dependency Scope

Dependency scope is read-only / impact-only unless explicitly promoted by owner decision.

| Dependency | Allowed use | Forbidden use |
| --- | --- | --- |
| `05_inicjatywy/IN_PORTFOLIO_HUB` | register P0/P1/P2 task rows for future execution | editing runtime or changing function contract meaning |
| `05_inicjatywy/IN_ANALYSIS_WORKSPACE` | register candidate review, duplicate/merge/split and confidence task rows | implementing analysis runtime |
| `05_inicjatywy/IN_ROADMAP_VIEW` | register lane smoke task row | changing roadmap ownership |
| `05_inicjatywy/IN_PORTFOLIO_VIEW` | register lane smoke task row | changing portfolio ownership |
| `05_inicjatywy/IN_ROI_VIEW` | register ROI boundary/read-back task row | changing finance/results ownership |
| `02_moja-praca/MW_DECISIONS` | impact context for decision-to-initiative conversion/read-back | mutating My Work decision contracts |
| `03_wywiad/WY_INITIATIVES` | impact context for interview candidate review and handoff | mutating Interview contracts |
| `06_realizacja`, `07_rezultaty`, `08_finanse` | downstream owner read-back and boundary context | changing downstream contracts |

## 4. Source Inputs

- RAW sources:
  - prior chat-derived task list for module 05 P0/P1/P2 registry sync.
- module contracts:
  - `RAW_TARGET_STATE_2_0_PACKET.md`
  - `STATUS.md`
  - `07_ACCEPTANCE_AND_TESTS.md`
  - `04_UI_UX.md`
  - `05_DATA_AND_INTEGRATIONS.md`
  - `06_PERMISSIONS_AND_SECURITY.md`
- function contracts:
  - `functions/IN_PORTFOLIO_HUB.md`
  - `functions/IN_ANALYSIS_WORKSPACE.md`
  - `functions/IN_ROADMAP_VIEW.md`
  - `functions/IN_PORTFOLIO_VIEW.md`
  - `functions/IN_ROI_VIEW.md`
- runtime evidence sources:
  - `src/routes/routeConfig.ts`
  - `src/routes/AppRoutes.tsx`
  - `src/components/Initiatives/InitiativesHub.tsx`
  - `src/views/FullRoadmapView.tsx`
  - `src/views/PortfolioView.tsx`
  - `src/views/FullROIView.tsx`
  - `server/src/routes/pmo/initiatives.routes.ts`
  - `server/src/controllers/InitiativeController.ts`
- previous decisions:
  - docs-only registry sync,
  - module readiness remains `NOT_DONE` until UI/card/lifecycle test evidence and owner acceptance are bound,
  - no runtime edits in this cycle.

## 5. Decision Matrix

| Requirement | AS-IS | TARGET | DELTA | Decision | Rationale |
| --- | --- | --- | --- | --- | --- |
| P0/P1/P2 gap plan | exists in chat and module packet, not as normalized board rows | board rows with task ID, scope anchor, priority, status, change type, dependency, evidence and source card | add module task board | `NEW` | future agents need durable registry rows |
| Multi-function task list | spans several `IN_*` functions | preserve 1 task = 1 scope_anchor while using module delivery card as registry owner | normalize rows by function anchor | `ENHANCE` | avoid scope drift |
| Runtime blockers | known but not executable from registry | P0 rows isolate card UI smoke, capabilities, read-back and owner acceptance | add explicit P0 rows | `NEW` | close `BLOCKED_P1` path without runtime edits now |
| ROW-derived management ideas | candidate review, read-back, duplicate/merge/split, confidence and quality dashboard are not normalized as tasks | add prioritized P0/P1/P2 rows | `ENHANCE` | improve future initiative management delivery |
| Runtime work | not allowed in this prompt | no runtime edits | keep untouched | `KEEP` | docs-only constraint |

## 6. UI/UX Component Contract

- approved shell/component family: `InitiativesHub`, `InitiativePreviewV3`, analysis subviews, `FullRoadmapView`, `PortfolioView`, `FullROIView`.
- Menu 2 surface: module-level navigation remains unchanged.
- Menu 3 actions: future contextual AI and workflow actions must live in command-row/right-side space.
- AI action placement: no duplicate AI toolbar in the initiative canvas when Menu 3 exists.
- runtime states: loading, empty, error, degraded, success, toast/read-back and refresh resistance must be evidenced before `DONE`.
- source/provenance/evidence UI: initiative cards and candidate flows must expose source envelope or missing-evidence state.
- approval/review/diff behavior: candidate review and high-impact transitions follow proposal -> approval -> execution -> audit/read-back.
- anti-patterns: hidden handoff, success without owner read-back, local permission inference, duplicated truth in downstream modules.

## 7. Contract Update Plan

| File | Required update | Reason | Status |
| --- | --- | --- | --- |
| `IMPLEMENTATION_TASK_BOARD.md` | create normalized task registry for P0/P1/P2 | durable ROW-compatible registry | `DONE` |
| `function-cards/MODULE_DELIVERY_EXECUTION_CARD.md` | create registry sync card | source card for all rows in this sync | `DONE` |
| `RAW_TARGET_STATE_2_0_PACKET.md` | optional reference to registry sync | keep module packet aware of future task board | `PENDING_OPTIONAL` |
| `functions/*.md` | no change in this registry sync | function contracts already exist; runtime work deferred | `NO_CHANGE` |

## 8. Implementation Backlog

| Task ID | Priority | Change type | Description | Depends on | Acceptance evidence | Done gate |
| --- | --- | --- | --- | --- | --- | --- |
| `IN-HUB-P0-001` | `P0` | `test` | Add `/initiatives` card lifecycle smoke covering open, preview/detail, capability render, locked/degraded states. | owner acceptance | route/component/API/test | evidence complete |
| `IN-HUB-P0-002` | `P0` | `runtime/test` | Add capability-driven CTA regression for workflow CTAs, context create actions and AI availability from backend capabilities. | `IN-HUB-P0-001` | route/component/API/test | capability evidence complete |
| `IN-HUB-P0-003` | `P0` | `runtime/test` | Add toast/read-back/refresh evidence for create, edit and status transition flows. | `IN-HUB-P0-001`,`IN-HUB-P0-002` | route/component/API/test | read-back evidence complete |
| `IN-HUB-P0-004` | `P0` | `docs/runtime/test` | Complete owner acceptance packet and handoff/read-back tracker for task, decision, ROI and roadmap handoffs. | `IN-HUB-P0-002`,`IN-HUB-P0-003` | route/component/API/test | owner acceptance complete |
| `IN-ANL-P0-001` | `P0` | `docs/runtime/test` | Add initiative candidate review model: accept, edit, reject, defer before canonical write. | owner acceptance | route/component/API/test | candidate review gate complete |
| `IN-ANL-P1-001` | `P1` | `docs/runtime/test` | Add duplicate, merge, split, confidence and missing-evidence gates for initiative candidates. | `IN-ANL-P0-001` | route/component/API/test | waiting for P0 close |
| `IN-HUB-P1-001` | `P1` | `docs/runtime/test` | Resolve source-envelope taxonomy across tools, assessment, interview, chat/MyWork, finance and KPI/results. | `IN-HUB-P0-*` | route/component/API/test | waiting for P0 close |
| `IN-HUB-P1-002` | `P1` | `docs/runtime/test` | Add decision-to-initiative conversion contract with proposal, approval, handoff and owner read-back. | `IN-HUB-P0-*` | route/component/API/test | waiting for P0 close |
| `IN-ROAD-P1-001` | `P1` | `test` | Add `/roadmap` lane smoke proving projection/handoff behavior without duplicate initiative truth. | `IN-HUB-P0-001` | route/component/API/test | waiting for P0 close |
| `IN-PORT-P1-001` | `P1` | `test` | Add `/portfolio` lane smoke proving projection/drill-through behavior without duplicate initiative truth. | `IN-HUB-P0-001` | route/component/API/test | waiting for P0 close |
| `IN-ROI-P1-001` | `P1` | `docs/runtime/test` | Add ROI assumptions/read-back boundary with finance/results ownership preserved. | `IN-HUB-P0-*` | route/component/API/test | waiting for P0 close |
| `IN-XLANE-P2-001` | `P2` | `test` | Add cross-lane E2E package for `/initiatives`, `/roadmap`, `/portfolio`, `/roi`. | `IN-HUB-P0-*`,`IN-ANL-P0-001`,`IN-ROAD-P1-001`,`IN-PORT-P1-001`,`IN-ROI-P1-001` | route/component/API/test | waiting for P0/P1 close |
| `IN-HUB-P2-001` | `P2` | `docs/test` | Add visual evidence baseline and semantic status/color audit for cards and lifecycle states. | `IN-HUB-P0-*`,`IN-HUB-P1-*` | route/component/API/test | waiting for P0/P1 close |
| `IN-ANL-P2-001` | `P2` | `runtime/test` | Add initiative quality dashboard for missing sources, missing owner, stale read-back and conflicts. | `IN-ANL-P0-001`,`IN-ANL-P1-001` | route/component/API/test | waiting for P0/P1 close |

## 9. Evidence Plan

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Initiative card lifecycle and capability behavior is release-ready | `/initiatives` | `InitiativesHub`, `InitiativePreviewV3` | `/api/initiatives`, `gate-readiness-check` | `IN-HUB-P0-001`, `IN-HUB-P0-002`, `IN-HUB-P0-003` | `MISSING` |
| Candidate initiatives are reviewed before canonical write | `/initiatives` analysis/candidate flow | `InitiativesHub`, analysis subviews | initiative create/handoff APIs | `IN-ANL-P0-001` | `MISSING` |
| Source envelope and decision conversion are governed | `/initiatives` + source/decision links | initiative card/detail and conversion surfaces | source, decision, initiative APIs | `IN-HUB-P1-001`, `IN-HUB-P1-002` | `MISSING` |
| Companion lanes are projections/handoffs | `/roadmap`, `/portfolio`, `/roi` | `FullRoadmapView`, `PortfolioView`, `FullROIView` | initiative + finance/results APIs | `IN-ROAD-P1-001`, `IN-PORT-P1-001`, `IN-ROI-P1-001`, `IN-XLANE-P2-001` | `MISSING` |
| Visual/status quality is auditable | `/initiatives` route family | card, status chip and lane components | read-only evidence where applicable | `IN-HUB-P2-001`, `IN-ANL-P2-001` | `MISSING` |

## 10. Cross-Module Impact

- impacted modules:
  - `02_moja-praca/MW_DECISIONS` for decision-to-initiative conversion and read-back impact,
  - `03_wywiad/WY_INITIATIVES` for candidate review and interview-originated initiative handoff impact,
  - `06_realizacja` for downstream execution handoff/read-back,
  - `07_rezultaty` for KPI/benefits evidence boundary,
  - `08_finanse` for ROI assumptions/model boundary.
- handoff changes: none in this docs-only registry sync; future runtime work must update `MODULE_INTERACTION_GRAPH.md` or `ARTIFACT_LINEAGE_MATRIX.md` before changing handoff semantics.
- ownership impact: none; task rows preserve owner-module boundaries.
- security/tenant impact: future rows must preserve backend capabilities, deny-by-default and no hidden writes.
- E2E workflow impact: future validation should prove `proposal -> approval -> execution -> audit/read-back`.
- global contract updates needed: none for this registry-sync cycle.

## 11. Done Gate

- contract complete: `PASS`
- UI/UX complete: `PASS_DOC`
- evidence complete: `PASS_DOC_WITH_MISSING_RUNTIME_EVIDENCE`
- implementation backlog ready: `PASS`
- impact complete: `PASS`
- owner acceptance: `PENDING_FOR_RUNTIME_ROWS`
- rerun gate: required after registry sync
- registry sync completed: `2026-05-10`
- runtime edits: `NONE`

## 12. Open Questions

| Question | Owner | Due | Blocking? |
| --- | --- | --- | --- |
| Function-specific execution cards split status | system | 2026-05-10 | `resolved` |
| Which test lane owns the first `/initiatives` card lifecycle smoke: component, Playwright smoke, or manual Anygravity? | user | before `IN-HUB-P0-001` | `yes` |
| Should source-envelope taxonomy be resolved in module 05 first or in global `SOURCE_TRACEABILITY_SPEC.md` first? | user | before `IN-HUB-P1-001` | `no` |
