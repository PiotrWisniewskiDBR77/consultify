---
module_id: MODULE_INITIATIVES
doc_kind: RAW_TARGET_STATE_2_0_PACKET
version: 2.0
owner: user
status: review
last_updated: 2026-05-10
scope_anchor: 05_inicjatywy/MODULE_DELIVERY
---

# RAW Target State 2.0 Packet — Inicjatywy

## As-Is

Module `05_inicjatywy` is an active, function-first contract for the initiative lifecycle and initiative-backed planning surfaces.

| Area | Verified evidence | Status |
| --- | --- | --- |
| Primary route | `/initiatives` mounted to `InitiativesHub` through `src/routes/routeConfig.ts` and `src/routes/AppRoutes.tsx`. | `PASS_DOC` |
| Companion routes | `/roadmap`, `/portfolio`, `/roi` mounted to `FullRoadmapView`, `PortfolioView`, `FullROIView`. | `PASS_DOC` |
| Primary component | `src/components/Initiatives/InitiativesHub.tsx` owns list/kanban/timeline/grid, preview and analysis workspace footprint. | `PASS_DOC` |
| Capability API | `GET /api/initiatives/:id/gate-readiness-check` is the backend source for transitions, effective roles, editability, context create actions and AI availability. | `PASS_DOC` |
| Backend route/controller | `server/src/routes/pmo/initiatives.routes.ts`, `server/src/routes/initiatives.routes.ts`, `server/src/controllers/InitiativeController.ts`, `server/src/Gateway.ts`. | `PASS_DOC` |
| Automated tests | Basic initiative CRUD API smoke exists in `tests/e2e/smoke/deploy-gate-api.spec.ts`; tool initiative generator and related initiative handoffs have partial test evidence. Dedicated initiative UI lifecycle/card tests are not found. | `NOT_DONE` |

Current module status is therefore `REVIEW / NOT_DONE`: documentation can be normalized, but release readiness is blocked by missing dedicated UI transition/card regression evidence and unresolved source-envelope doctrine.

## Author Target

The target state is a governed initiative work system that makes it unambiguous:

- why an initiative exists,
- which source/evidence created or justified it,
- what status, role and gate rules govern it,
- which actions are available to the current user,
- how it hands off to execution, results and finance without stealing their ownership,
- how AI can assist only through visible, governed, source-backed actions.

The module must remain the owner for initiative readiness, planning, governance decisions and portfolio context. It must not become the hidden task system, KPI truth, finance model owner or execution manager.

## Delta

| Delta ID | Finding | Required resolution | Status |
| --- | --- | --- | --- |
| `IN-DELTA-001` | Function map exists but responsibility, owners, I/O and handoffs need one explicit 2.0 baseline. | Add function/dependency/evidence matrix to module contract and function contracts. | `DONE_DOC` |
| `IN-DELTA-002` | Existing evidence points are useful but too generic for the system traceability rule. | Bind critical claims to route, component, API and test evidence; mark missing test links as `NOT_DONE`. | `DONE_DOC` |
| `IN-DELTA-003` | Source doctrine conflict: `SOURCE_TRACEABILITY_SPEC.md` is narrower than runtime/product intent. | Close docs taxonomy as `sourceRefs`, `evidenceRefs`, `confidence`, `approvalState`, `missingEvidence`; runtime proof still required. | `DECISION_CLOSED_DOCS`; runtime `NOT_DONE` |
| `IN-DELTA-004` | Initiative UI transition/card tests are missing or not module-dedicated. | Add explicit acceptance gap and test baseline. | `NOT_DONE` |
| `IN-DELTA-005` | Owner acceptance is not recorded in this execution cycle. | Packet remains `review`; final `DONE` requires owner acceptance. | `NOT_DONE` |

## Contract 2.0

### Locked Decisions

| Decision | Result | Evidence |
| --- | --- | --- |
| Function inventory | Locked as `IN_PORTFOLIO_HUB`, `IN_ANALYSIS_WORKSPACE`, `IN_ROADMAP_VIEW`, `IN_PORTFOLIO_VIEW`, `IN_ROI_VIEW`. | `README.md`, `04_UI_UX.md`, `functions/*.md` |
| Primary route | `/initiatives` is the primary module route. | `CODEMAP.md`, `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` |
| Companion lane routes | `/roadmap`, `/portfolio`, `/roi` are initiative-related lane views, not separate initiative truth owners. | `CODEMAP.md`, `04_UI_UX.md`, function contracts |
| Capability source of truth | Backend capabilities from `GET /api/initiatives/:id/gate-readiness-check` drive editability, transitions, context create actions and AI availability. | `INITIATIVE_CAPABILITIES_SYSTEM.md`, `INITIATIVE_STATUS_ROLE_CTA_MATRIX.md` |
| AI governance | AI is advisory only, source-backed, no hidden writes, no gate approval, Menu 3/right-side placement. | `DRD/UI_UX_SOURCE_OF_TRUTH.md`, `04_UI_UX.md`, `06_PERMISSIONS_AND_SECURITY.md` |

### Function Map

| Function | Responsibility | Business owner | Tech owner | Route / entry | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `IN_PORTFOLIO_HUB` | Primary portfolio hub for initiative identity, lifecycle, view modes, preview and governed actions. | user | user | `/initiatives` | `src/components/Initiatives/InitiativesHub.tsx` | `src/services/api.ts`, `server/src/routes/pmo/initiatives.routes.ts`, `server/src/controllers/InitiativeController.ts` | `tests/e2e/smoke/deploy-gate-api.spec.ts`; UI transition/card tests missing | `NOT_DONE` |
| `IN_ANALYSIS_WORKSPACE` | Analysis workspace for resources, feasibility, logic, timeline and completeness before execution. | user | user | `InitiativesHub` analysis tab | `src/components/Initiatives/InitiativesHub.tsx` | `src/services/api/v8/planning.ts`, initiative planning/gate APIs | no dedicated UI regression evidence found | `NOT_DONE` |
| `IN_ROADMAP_VIEW` | Roadmap lane for sequencing, scheduling context and dependency visibility. | user | user | `/roadmap` | `src/views/FullRoadmapView.tsx` | initiative lifecycle/readiness APIs and roadmap service boundaries | route evidence only; dedicated lane smoke not bound here | `NOT_DONE` |
| `IN_PORTFOLIO_VIEW` | Portfolio rollup/prioritization lane that references initiative truth without owning it. | user | user | `/portfolio` | `src/views/PortfolioView.tsx` | `src/services/api.ts`, initiative list/status APIs | route evidence only; dedicated lane smoke not bound here | `NOT_DONE` |
| `IN_ROI_VIEW` | ROI/value lane that links initiative assumptions and benefits without becoming finance/results truth. | user | user | `/roi` | `src/views/FullROIView.tsx` | finance/results ROI evidence APIs plus initiative links | related results/finance tests exist; initiative ROI lane gate not bound | `NOT_DONE` |

### Dependency Map

| Function | Inputs | Outputs | Handoff boundary |
| --- | --- | --- | --- |
| `IN_PORTFOLIO_HUB` | Initiative records, source links, lifecycle status, capabilities, planning snapshots, user scope/filter state. | Initiative updates, status transition requests, preview/detail opens, task/decision/RAID create requests, downstream links. | Sends approved/scheduled scope to `06_realizacja`; sends KPI/value targets to `07_rezultaty`; sends assumptions/budget envelope to `08_finanse`; does not own their canonical records. |
| `IN_ANALYSIS_WORKSPACE` | Initiative metrics, feasibility/resource/timeline/completeness data, decision chain context. | Analysis conclusions, readiness gaps, recommendations and explicit next actions. | Supports decisions; cannot silently mutate execution, finance, outputs or results truth. |
| `IN_ROADMAP_VIEW` | Scheduled/approved initiatives, timeline fields, dependencies, baseline/readiness status. | Roadmap schedule view and explicit scheduling/handoff context. | Roadmap lane visualizes and schedules; initiative identity stays in `05`, execution tasks stay in `06`. |
| `IN_PORTFOLIO_VIEW` | Portfolio rollups, initiative health, status, value and prioritization metadata. | Portfolio prioritization context and drill-through links. | Portfolio view is a projection; it does not create a second portfolio initiative object. |
| `IN_ROI_VIEW` | Initiative value hypotheses, KPI/benefit links, finance/result evidence and assumptions. | ROI context, value readouts and explicit finance/results handoffs. | Finance owns model assumptions; Results owns realized KPI/benefit measurements. |

## Cross-Module Impact

No new cross-module handoff was introduced in this documentation cycle. Existing system edges remain valid:

- `01_czat` -> `05_inicjatywy` as a governed `write_request` for draft recommendations/proposals.
- `03_wywiad` -> `05_inicjatywy` as evidence-backed handoff for opportunities/pain points.
- `04_narzedzia` -> `05_inicjatywy` as analysis-backed recommendation write request.
- `05_inicjatywy` -> `06_realizacja` as approved initiative/scope handoff.
- `05_inicjatywy` -> `07_rezultaty` as KPI targets and expected value handoff.
- `05_inicjatywy` -> `08_finanse` as assumptions and budget envelope handoff.

`MODULE_INTERACTION_GRAPH.md` and `ARTIFACT_LINEAGE_MATRIX.md` do not require new edges for this cycle. `SYSTEM_TRACEABILITY_MATRIX.md` requires a more granular row for module 05 and is updated by this packet.

## Delivery Plan

| Step | Scope | Evidence / gate | Result |
| --- | --- | --- | --- |
| 1 | RAW extraction packet | This file with As-Is, Author Target, Delta, Contract 2.0, impact, delivery plan and open questions. | `DONE_DOC` |
| 2 | Function map | `04_UI_UX.md`, `05_DATA_AND_INTEGRATIONS.md`, `functions/*.md`. | `DONE_DOC` |
| 3 | Dependency map | `05_DATA_AND_INTEGRATIONS.md`, function contracts, system traceability row. | `DONE_DOC` |
| 4 | Contract update | `00_META.md` through `07_ACCEPTANCE_AND_TESTS.md`, `STATUS.md`, `CHANGELOG.md`. | `DONE_DOC` |
| 5 | Evidence binding | Route/component/API/test matrix in acceptance and traceability docs. | `NOT_DONE` where test evidence is missing |
| 6 | Gate | `npm run docs:contract:rerun-gate` -> 19 modules, 77 function contracts, 0 errors, 0 warnings. | `PASS_DOC` |
| 7 | Traceability baseline | `SYSTEM_TRACEABILITY_MATRIX.md` maps requirement -> contract -> evidence -> status. | `DONE_DOC` |
| 8 | Future task registry | `IMPLEMENTATION_TASK_BOARD.md` and `function-cards/MODULE_DELIVERY_EXECUTION_CARD.md` record P0/P1/P2 rows for future execution without runtime edits. | `REGISTRY_SYNC_PASS` |
| 9 | Module integration | `INTEGRATION_REPORT.md`, `STATUS.md`, `CHANGELOG.md`, 03-07 integration baselines and gate rerun. | `APPROVED_FOR_DOCS` when gate returns 0 errors / 0 warnings |

## Module Integration Addendum — `05_inicjatywy/MODULE_INTEGRATION`

### Integration As-Is

| Area | Integrated state | Evidence status |
| --- | --- | --- |
| Function inventory | `5/5` functions documented and referenced by 00-07. | `PASS_DOC` |
| Module contracts | 00-07 agree on owner boundaries, capability-driven actions and no hidden AI writes. | `PASS_DOC` |
| Task registry | Future P0/P1/P2 rows exist in `IMPLEMENTATION_TASK_BOARD.md`; function cards manage execution. | `PASS_DOC` |
| Cross-module graph | Existing edges cover chat/interview/tools -> initiatives and initiatives -> execution/results/finance. | `PASS_NO_NEW_EDGE` |
| Artifact lineage | `Initiative dossier` exists with owner `05_inicjatywy`; no new artifact type added. | `PASS_NO_NEW_ARTIFACT` |
| Evidence | Route/component/API is bound; several critical UI tests remain missing. | `PASS_DOC_WITH_GAPS` |
| Owner acceptance | Not recorded for runtime `DONE`. | `PENDING_OWNER` |

### Integration Delta

| Delta ID | Finding | Resolution | Status |
| --- | --- | --- | --- |
| `IN-INT-001` | Module needed a single integration report after function-level work. | Added `INTEGRATION_REPORT.md`. | `DONE_DOC` |
| `IN-INT-002` | 03-07 had evidence but no single integration baseline statement. | Added integration baseline sections to behavior, UI/UX, data, permissions and acceptance docs. | `DONE_DOC` |
| `IN-INT-003` | Status/changelog needed to distinguish docs integration from runtime done. | Updated `STATUS.md` and `CHANGELOG.md`. | `DONE_DOC` |
| `IN-INT-004` | Cross-module handoff understanding was checked. | No graph/lineage edits required because no new edge/artifact was introduced. | `PASS_NO_NEW_EDGE` |
| `IN-INT-005` | Owner acceptance remains missing. | Keep module status `review` and runtime done blocked. | `PENDING_OWNER` |

### Integration Delivery Plan

| Priority | Work item | Evidence / gate | Status |
| --- | --- | --- | --- |
| `P0` | Owner review of integration report and approval/return decision. | `INTEGRATION_REPORT.md`, `STATUS.md`. | `PENDING_OWNER` |
| `P0` | Execute initiative UI lifecycle/card regression tasks. | `IMPLEMENTATION_TASK_BOARD.md` `IN-HUB-P0-*`. | `WAITING_EXECUTION` |
| `P0` | Execute Analysis tab UI regression tasks. | `IMPLEMENTATION_TASK_BOARD.md` `IN-ANL-P0-*`. | `WAITING_EXECUTION` |
| `P1` | Bind lane smoke evidence for `/roadmap`, `/portfolio`, `/roi`. | `IN-ROAD-P1-001`, `IN-PORT-P1-001`, `IN-ROI-P1-001`. | `WAITING_P0` |
| `P1` | Bind source-envelope taxonomy in runtime. | Docs decision: `sourceRefs`, `evidenceRefs`, `confidence`, `approvalState`, `missingEvidence`; source traceability/runtime evidence update required. | `DECISION_CLOSED_DOCS`; runtime `WAITING_P0` |
| `P2` | Resolve naming and raw visual evidence gaps. | Analysis function card and task board P2/P1 rows. | `WAITING_P0` |

Registry reference: module integration development gaps are normalized in `IMPLEMENTATION_TASK_BOARD.md` and `function-cards/MODULE_INTEGRATION_EXECUTION_CARD.md` under scope anchor `05_inicjatywy/MODULE_INTEGRATION`. Registry sync completed on 2026-05-10 without runtime edits.

## Open Questions

1. `DECISION_CLOSED_DOCS`: Canonical source-envelope taxonomy is `sourceRefs`, `evidenceRefs`, `confidence`, `approvalState`, `missingEvidence`; runtime owner acceptance remains evidence-gated.
2. Should interview become a true multi-initiative smart generator, or is finding-level create/link sufficient for v1?
3. Should KPI/results be allowed to generate new initiatives directly, or only recommend/create proposals for user approval?

---

## Scope Packet — `05_inicjatywy/IN_ANALYSIS_WORKSPACE`

### As-Is

`IN_ANALYSIS_WORKSPACE` exists inside `/initiatives` as the `InitiativesHub` tab `analysis`. Runtime evidence shows a five-subview analysis shell:

| Area | Verified evidence | Status |
| --- | --- | --- |
| Route / entry | `/initiatives` -> `InitiativesHub` tab `analysis`. | `PASS_DOC` |
| Command row / Menu 3 | `InitiativesHub` hides normal view modes on analysis and renders analysis subview chips plus registered action buttons via `commandRowContent`. | `PASS_DOC` |
| Analysis shell | `PortfolioAnalysisView` receives `subview`, initiatives, users, project and callback hooks. | `PASS_DOC` |
| Workload runtime key | Author label `workload` maps to runtime `resources` / `ResourcesAnalysis`. | `WARNING_DOC` |
| Feasibility | `FeasibilityAnalysis` consumes derived feasibility dimensions. | `PASS_DOC` |
| Logic / dependencies | `LogicAnalysis` and `DependencyGraphCanvas` consume and mutate portfolio dependencies explicitly. | `PASS_DOC` |
| Timeline | `TimelineAnalysis` consumes timeline bars, dates, dependencies and quick updates. | `PASS_DOC` |
| Completeness | `CompletenessAnalysis` consumes completeness rows, missing critical counts and readiness state. | `PASS_DOC` |
| API evidence | `/api/initiatives`, `/api/initiatives/portfolio/dependencies`, `/api/initiatives/readiness-analysis`, `/api/initiatives/section-types`, `GET /api/initiatives/:id/gate-readiness-check`, V8 planning readiness. | `PASS_DOC` |
| Test evidence | API/integration and component-adjacent evidence exists; dedicated Analysis tab UI regression for all five subviews is not bound. | `NOT_DONE_UI` |
| Raw visual input | Required screenshot filenames for workload, wykonalność, logika/dependencies, harmonogram and kompletność were not found in the active workspace. | `WARNING_DOC` |

### Author Target

The Analysis tab should operate as the initiative readiness cockpit:

- `workload`: can the organization/team absorb the work?
- `feasibility`: is the initiative realistic across budget, skills, time and risk?
- `logic`: are dependencies and sequencing coherent?
- `timeline`: are dates, conflicts and delay impacts understood?
- `completeness`: is the initiative complete enough for its next governance action?

The target state is evidence-led and backend-governed. Analysis can recommend, propose and route, but it must not silently approve gates, create downstream work, mutate finance/results/source truth or bypass tenant/role controls.

### Delta

| Delta ID | Finding | Required resolution | Status |
| --- | --- | --- | --- |
| `IN-AN-DELTA-001` | Existing function contract was too thin for the five subviews. | Add purpose, I/O, subview matrix, runtime states, CTA/role/AI constraints and evidence binding. | `DONE_DOC` |
| `IN-AN-DELTA-002` | Module docs referenced analysis generally but lacked subview-level UI/behavior/acceptance annexes. | Update `04_UI_UX.md`, `03_BEHAVIOR.md`, `07_ACCEPTANCE_AND_TESTS.md` for Analysis only. | `DONE_DOC` |
| `IN-AN-DELTA-003` | `workload` raw label and runtime `resources` key can drift. | Record alias and open question for copy/runtime normalization. | `WARNING_DOC` |
| `IN-AN-DELTA-004` | Dedicated UI regression evidence for all five subviews is missing. | Mark `NOT_DONE_UI` and require follow-up UI smoke/regression. | `NOT_DONE_UI` |
| `IN-AN-DELTA-005` | Raw screenshot files requested in the packet were not found. | Bind labels as raw intent and record visual evidence gap/open question. | `WARNING_DOC` |

### Contract 2.0

| Contract area | Locked rule |
| --- | --- |
| Scope | Only `IN_ANALYSIS_WORKSPACE` in `05_inicjatywy`; no runtime code, server code or tests changed in this docs-only cycle. |
| Subviews | Required set is `workload/resources`, `feasibility`, `logic`, `timeline`, `completeness`. |
| Route | `/initiatives` remains the only route for this function. |
| Component truth | `InitiativesHub` + `PortfolioAnalysisView` + five subview components are the evidence footprint. |
| API truth | Backend capability and readiness APIs govern action availability and analysis evidence. |
| Status/role/CTA | `INITIATIVE_STATUS_ROLE_CTA_MATRIX.md` and `INITIATIVE_CAPABILITIES_SYSTEM.md` are binding; frontend cannot infer authority. |
| AI | AI is advisory, Menu 3 right-side only, proposal/diff based, no hidden write/approval. |
| Runtime states | `loading`, `empty`, `error`, `degraded`, `success` must be visible and honest for all subviews. |
| Approval/diff | Owner/date/dependency/completeness/timeline proposal apply is explicit; gate/status/downstream mutations route to owning flows. |
| Done evidence | Done requires route + component + API + test binding; missing UI tests keep runtime readiness `NOT_DONE_UI`. |

### Analysis Tab Matrix

| Sub-view | User job | Component footprint | Data dependencies | CTA actions | Role gating | AI actions | Critical risks | Acceptance criteria | Evidence pointers |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `workload` / `resources` | Check team load and rebalance initiative ownership safely. | `InitiativesHub`, `PortfolioAnalysisView`, `ResourcesAnalysis`. | Initiative list, users, owner fields, capabilities. | Open initiative, sort/filter, explicit reassignment apply. | Backend capability required for reassignment/edit. | AI rebalance proposals in Menu 3 right side only. | Stale workload, local role inference, hidden reassignment. | Allocation state visible; reassignment is explicit and refetched. | `/initiatives`; `/api/initiatives`; `gate-readiness-check`; no UI regression. |
| `feasibility` | Decide whether initiatives are realistic across budget/skills/time/risk. | `PortfolioAnalysisView`, `FeasibilityAnalysis`. | Initiative fields, readiness metrics, feasibility dimensions. | Open initiative, inspect blocker, propose fix. | Sponsor/PMO/Owner action only via capabilities. | Advisory recommendations only. | Scores treated as proof without evidence. | Every red/amber state has reason or missing-evidence marker. | `/api/initiatives/readiness-analysis`; `initiatives.readiness-analysis.test.ts`. |
| `logic` | Validate dependencies, cycles, conflicts and sequencing. | `LogicAnalysis`, `DependencyGraphCanvas`. | Portfolio dependency API, initiative dates/status. | Create/delete dependency, inspect graph, open initiative. | Dependency writes require capability and tenant/project scope. | Discovery/critical path/sequencing proposals only. | Bad dependency mutation, graph-as-proof. | Writes are explicit; conflicts/cycles visible. | `/api/initiatives/portfolio/dependencies`; UI regression missing. |
| `timeline` | Verify schedule quality and delay/conflict impact. | `TimelineAnalysis`. | Planned dates, dependencies, readiness policy. | Edit dates, apply schedule proposal, open initiative. | Date edits require capability; baseline policy follows status matrix. | Auto-schedule/optimizer/delay impact proposal only. | Hidden baseline or premature schedule mutation. | No-date/delayed/at-risk/on-schedule states visible; date edits validated. | V8 readiness test; UI regression missing. |
| `completeness` | Confirm required fields/evidence and gate-ready state. | `CompletenessAnalysis`, `InitiativeCompletenessChecker`. | Completeness rows, readiness analysis, section types, source evidence. | Inspect missing fields, apply auto-fill proposal, open initiative. | Capability required; terminal statuses disable active write actions. | Auto-fill/bulk-fix/triage proposal only. | Fabricated evidence, silent auto-fill. | Missing critical fields and gate-ready state explainable. | `InitiativeCompletenessChecker.test.tsx`, readiness/section-types tests. |

### Cross-Module Impact

No new cross-module handoff is introduced. This packet clarifies that `IN_ANALYSIS_WORKSPACE` may surface and route cross-module context but cannot own it:

- `05_inicjatywy` -> `06_realizacja`: only approved/scheduled scope may become execution work through explicit task/decision flows.
- `05_inicjatywy` -> Decisions: gate and governance choices remain Decision artefacts and audit trails.
- `05_inicjatywy` -> `08_finanse`: finance owns assumptions/models; analysis may expose gaps or handoff links.
- `05_inicjatywy` -> `07_rezultaty`: results owns realized KPI/benefit truth; analysis may show readiness/completeness context.
- Teresa/AI: AI can advise and propose, but no hidden learning/write/approval behavior is allowed.

Impact note: missing Analysis UI tests block runtime done, but do not require changing cross-module handoff contracts in this docs-only cycle.

### Delivery Plan

| Priority | Work item | Expected evidence | Gate |
| --- | --- | --- | --- |
| `P0` | Contract hardening for function file and module annexes. | Updated `functions/IN_ANALYSIS_WORKSPACE.md`, `03_BEHAVIOR.md`, `04_UI_UX.md`, `07_ACCEPTANCE_AND_TESTS.md`. | `DONE_DOC` |
| `P0` | Evidence map for route/component/API/test per subview. | Tables in function contract and acceptance doc. | `DONE_DOC_WITH_UI_GAPS` |
| `P1` | Bind raw visual packet files or add screenshots to canonical evidence location. | Existing/linked files for the five named screenshots. | `WARNING_DOC` until provided |
| `P1` | Add dedicated Analysis tab UI regression covering five subviews and Menu 3 AI placement. | New UI/component/e2e test evidence. | `NOT_DONE_UI` |
| `P2` | Normalize author `workload` label vs runtime `resources` key. | Product copy or documented alias decision. | `OPEN_QUESTION` |

Registry reference: future execution tasks for this scope are normalized in `IMPLEMENTATION_TASK_BOARD.md` and `function-cards/IN_ANALYSIS_WORKSPACE_EXECUTION_CARD.md`. Registry sync completed on 2026-05-10 without runtime edits.

### Open Questions

1. Should the first Analysis subview be renamed in runtime/UI from `Resources` to `Workload`, or should docs keep the alias permanently?
2. Where are the five raw screenshot files stored so the visual packet can be bound as evidence?
3. Which test lane should own the missing dedicated Analysis tab UI regression across all five subviews and Menu 3 AI placement?

## Normalized Gap Register — 2026-05-11

### P0 must close

| Gap | Evidence location | Required closure | Current status |
| --- | --- | --- | --- |
| Owner acceptance for runtime `DONE` is missing. | `STATUS.md`; `INTEGRATION_REPORT.md`; `function-cards/MODULE_INTEGRATION_EXECUTION_CARD.md` | Record owner acceptance or explicit `NO_GO` before runtime done. | `NOT_DONE` |
| Dedicated portfolio hub and analysis UI regression evidence is missing. | `/initiatives`; `InitiativesHub`; `PortfolioAnalysisView`; `07_ACCEPTANCE_AND_TESTS.md` | Bind route/component/API/test evidence for lifecycle/card and five analysis subviews. | `NOT_DONE` |

### P1 runtime evidence

| Gap | Evidence needed | Blocking reason | Current status |
| --- | --- | --- | --- |
| `/roadmap`, `/portfolio` and `/roi` lane smoke evidence is not bound. | route/component/API/test smoke per lane. | Companion lanes cannot be claimed runtime-ready without direct smoke evidence. | `NOT_DONE` |
| Source-envelope taxonomy is closed for docs, but not proven in runtime. | source traceability update and route/component/API/test evidence that initiative creation, analysis and handoffs preserve `sourceRefs`, `evidenceRefs`, `confidence`, `approvalState`, `missingEvidence`. | Source/provenance behavior can drift across initiative creation, analysis and handoffs. | `DECISION_CLOSED_DOCS`; runtime `NOT_DONE` |
| Menu 3 AI placement for portfolio/analysis actions needs direct evidence. | command-row/right-side slot evidence and no duplicated canvas toolbar check. | UI governance requires contextual AI actions in Menu 3. | `NOT_DONE` |

### P2 premium hardening

| Gap | Evidence needed | Current status |
| --- | --- | --- |
| Analysis visual evidence for workload/resources, feasibility, logic, timeline and completeness is not bound. | screenshots/recordings or accepted evidence-gap note. | `NOT_DONE` |
| `workload` vs runtime `resources` naming decision is unresolved. | product copy decision and docs alignment. | `OPEN_QUESTION` |
| KPI/results and interview initiative generation policies need final owner decisions. | proposal-only vs direct-create policy decisions. | `OPEN_QUESTION` |

## RAW Depth Hard Gate Annex — 2026-05-11

### RAW Sources

| Source | Status | Mapping |
| --- | --- | --- |
| `docs/modules/05_inicjatywy/RAW_INPUT.md` | `USED` | module-local initiative baseline. |
| `docs/modules/05_inicjatywy/RAW_TARGET_STATE_2_0_PACKET.md` | `USED` | this packet and scope anchors. |
| `docs/RAW/99_RAW_INPUT 2.md` | `IMPACT_ONLY` | global RAW index; confirms initiative adjacent RAW sources. |
| `docs/RAW/implementation-pmo/107_RAW_IMPLEMENTATION_PMO_ENGINE_2026-05-09.md` | `IMPACT_ONLY` | downstream execution handoff constraints. |
| `docs/RAW/execution-hub/103_RAW_EXECUTION_HUB_AI_EXECUTION_MANAGEMENT_ENGINE_2026-05-09.md` | `IMPACT_ONLY` | task/decision/action pointer boundary; Initiatives must not become task manager. |
| `docs/RAW/results/105_RAW_RESULTS_VALUE_REALIZATION_ENGINE_2026-05-09.md` | `IMPACT_ONLY` | KPI/value target handoff to Results. |
| `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` | `IMPACT_ONLY` | assumptions and budget envelope handoff; Finance owns finance model truth. |
| `docs/RAW/teresa-chat/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md` | `IMPACT_ONLY` | chat/AI proposal write-request into initiative draft flow. |

### RAW synthesis: must / should / out

| Class | RAW-derived requirement | Contract decision |
| --- | --- | --- |
| must | Initiative is the canonical owner of what/why/readiness and approval, not execution, finance or results truth. | `KEEP` ownership boundary. |
| must | Every initiative recommendation/status/value claim needs source envelope or `MISSING_EVIDENCE`. | `ENHANCE`; source-envelope taxonomy owner decision remains blocking. |
| must | Capability API governs allowed transitions and AI availability. | `KEEP`; backend capability remains source of truth. |
| should | Analysis workspace should expose workload/resources, feasibility, logic, timeline and completeness with visible degraded states. | `ENHANCE`; UI evidence remains NOT_DONE. |
| should | Companion lanes `/roadmap`, `/portfolio`, `/roi` should have smoke-bound evidence. | `ENHANCE`; P1 taskboard rows. |
| out | Direct runtime edits, new tests and new cross-module ownership edges. | `OUT_OF_SCOPE` for this docs-only pass. |

### As-Is vs Target vs Delta

| Dimension | As-Is | RAW target | Delta | Evidence / plan |
| --- | --- | --- | --- | --- |
| Source envelope | source links are referenced but taxonomy was previously unresolved. | every recommendation and initiative has `sourceRefs`, `evidenceRefs`, `confidence`, `approvalState` and `missingEvidence`. | docs taxonomy closed; runtime binding missing. | `DECISION_CLOSED_DOCS`; runtime `NOT_DONE`. |
| UI lifecycle | route/component/API evidence exists. | lifecycle/card UI regression proves transition, read-back and state matrix. | dedicated UI tests missing. | `NOT_DONE`: `IN-HUB-P0-*`, `IN-ANL-P0-*`. |
| Handoff | graph covers `05 -> 06/07/08/09`. | handoffs carry sourceRefs, evidenceRefs and approval state. | lane smoke/read-back evidence incomplete. | `NOT_DONE`: P1 lane smoke and handoff evidence. |

### Decision table

| Requirement | Decision | Rationale | Evidence trace |
| --- | --- | --- | --- |
| Keep initiative lifecycle owner in `05_inicjatywy`. | `KEEP` | prevents Execution/Results/Finance ownership drift. | `MODULE_INTERACTION_GRAPH.md`; `ARTIFACT_LINEAGE_MATRIX.md`; function contracts. |
| Add explicit source-envelope taxonomy before runtime done. | `ENHANCE` | RAW hard gate requires source -> decision -> contract -> evidence. | `STATUS.md`; `function-cards/MODULE_INTEGRATION_EXECUTION_CARD.md`; taxonomy decision closed in docs, runtime evidence `NOT_DONE`. |
| Treat companion lanes as separate truth owners. | `DEFER/REJECT` | lanes are projections/handoffs, not new initiative truth. | `CODEMAP.md`; `04_UI_UX.md`; `SYSTEM_TRACEABILITY_MATRIX.md`. |

### Evidence trace

Critical thesis: AI may propose/refine initiatives only through visible source-backed actions and cannot silently approve or mutate downstream truth.

- RAW source: `docs/RAW/teresa-chat/104...`, `docs/RAW/implementation-pmo/107...`, `docs/modules/05_inicjatywy/RAW_INPUT.md`.
- contract decision: `ENHANCE`, proposal-only and capability-governed.
- contract files: `04_UI_UX.md`, `06_PERMISSIONS_AND_SECURITY.md`, `07_ACCEPTANCE_AND_TESTS.md`, `functions/IN_PORTFOLIO_HUB.md`, `functions/IN_ANALYSIS_WORKSPACE.md`.
- evidence: route/component/API mapped; dedicated UI lifecycle/card tests remain `NOT_DONE`.

## RAW Semantic + World-Class Certification Addendum — 2026-05-11

Certification posture for `05_inicjatywy`:

- `DOCS_CERTIFIED`: `YES`
- `TARGET_WORLD_CLASS_CERTIFIED`: `YES_WITH_RUNTIME_CONDITION`
- `RUNTIME_CERTIFIED`: `NO`

Current semantic benchmark conclusion:

- initiative ownership and no-hidden-write doctrine are strong,
- source-envelope taxonomy is closed in docs (`sourceRefs`, `evidenceRefs`, `confidence`, `approvalState`, `missingEvidence`),
- runtime evidence for lifecycle cards, companion lane smoke and read-back still blocks runtime certification.
