---
module_id: MODULE_INITIATIVES
function_id: MODULE_INTEGRATION
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
status: REVIEW
last_updated: 2026-05-10
---

# Function Execution Card — MODULE_INTEGRATION

## 1. Metadata

- `scope_anchor`: `05_inicjatywy/MODULE_INTEGRATION`
- `primary_module`: `05_inicjatywy`
- `primary_function`: `MODULE_INTEGRATION`
- `parent_function`: none
- `owner_business`: user
- `owner_tech`: user
- `work_type`: `docs-only`
- `status`: `REVIEW`

## 2. Scope Anchor

- in scope: future integration backlog for closing module-level gaps across function evidence, handoff evidence, owner acceptance and Contract 2.0 integration readiness
- out of scope: runtime implementation, editing `src/**`, `server/**`, `tests/**`, or promoting dependency modules to primary scope
- allowed global documents: none in this registry-sync cycle unless explicitly requested later
- forbidden files: all runtime and test source files in this registry-sync cycle

## 3. Dependency Scope

Dependency scope is read-only / impact-only unless explicitly promoted by owner decision.

| Dependency | Allowed use | Forbidden use |
| --- | --- | --- |
| `IN_PORTFOLIO_HUB` | Evidence dependency for portfolio hub UI/card/lifecycle regression. | Editing function runtime or replacing function-owned backlog. |
| `IN_ANALYSIS_WORKSPACE` | Evidence dependency for Analysis subviews and Menu 3 placement. | Editing function runtime or replacing function-owned backlog. |
| `IN_ROADMAP_VIEW` | Evidence dependency for `/roadmap` lane smoke. | Owning roadmap runtime implementation. |
| `IN_PORTFOLIO_VIEW` | Evidence dependency for `/portfolio` lane smoke. | Owning portfolio route runtime implementation. |
| `IN_ROI_VIEW` | Evidence dependency for `/roi` lane smoke. | Owning ROI/finance/results runtime implementation. |
| `06_realizacja`, `07_rezultaty`, `08_finanse` | Handoff impact context only. | Editing downstream contracts or owning their truth. |

## 4. Source Inputs

- RAW sources:
  - `RAW_TARGET_STATE_2_0_PACKET.md`
  - `INTEGRATION_REPORT.md`
- module contracts:
  - `03_BEHAVIOR.md`
  - `04_UI_UX.md`
  - `05_DATA_AND_INTEGRATIONS.md`
  - `06_PERMISSIONS_AND_SECURITY.md`
  - `07_ACCEPTANCE_AND_TESTS.md`
  - `STATUS.md`
- function contracts:
  - `functions/IN_PORTFOLIO_HUB.md`
  - `functions/IN_ANALYSIS_WORKSPACE.md`
  - `functions/IN_ROADMAP_VIEW.md`
  - `functions/IN_PORTFOLIO_VIEW.md`
  - `functions/IN_ROI_VIEW.md`
- runtime evidence sources:
  - `/initiatives`, `/roadmap`, `/portfolio`, `/roi`
  - `InitiativesHub`, `PortfolioAnalysisView`, `FullRoadmapView`, `PortfolioView`, `FullROIView`
  - `/api/initiatives`, `GET /api/initiatives/:id/gate-readiness-check`, readiness/dependency/finance/results link APIs
- previous decisions:
  - module integration verdict is `GO_FOR_NEXT_DOCS_WAVE`, `NO_GO_RUNTIME_DONE`
  - docs gate passed with 0 errors and 0 warnings

## 5. Decision Matrix

| Requirement | AS-IS | TARGET | DELTA | Decision | Rationale |
| --- | --- | --- | --- | --- | --- |
| Portfolio hub evidence | API smoke exists; UI lifecycle/card evidence missing. | Integration can verify dedicated UI evidence exists. | Coordinate closure through existing `IN-HUB-*` tasks. | `ENHANCE` | Avoids duplicating function-owned execution tasks. |
| Analysis evidence | Contract complete; Analysis UI regression missing. | Integration can verify five subviews and Menu 3 evidence. | Coordinate closure through existing `IN-ANL-*` tasks. | `ENHANCE` | Keeps one scope per execution task. |
| Companion lane evidence | Route/component evidence exists; smoke missing. | Integration can verify lane smoke evidence. | Coordinate closure through lane tasks. | `ENHANCE` | Keeps lane runtime work out of integration scope. |
| Owner acceptance | Missing. | Owner acceptance or explicit `NO_GO` is recorded. | Add module integration owner acceptance task. | `NEW` | Required before `DONE`. |
| Source envelope taxonomy | Open. | Decision recorded before runtime done. | Add docs decision task. | `NEW` | Prevents source/provenance drift. |
| Visual and naming gaps | Known P2/P1 gaps. | Evidence or accepted gap is recorded. | Add deferred integration tasks. | `DEFER` | Not needed for docs gate, needed for stronger next wave. |

## 6. UI/UX Component Contract

- approved shell/component family: module route family `/initiatives`, `/roadmap`, `/portfolio`, `/roi`
- Menu 2 surface: `Inicjatywy`
- Menu 3 actions: contextual AI/actions must stay in right-side command row slots for active module/function contexts
- AI action placement: Menu 3 right-side only, no duplicated canvas AI action
- runtime states: loading, empty, error, degraded, success evidence required before runtime `DONE`
- source/provenance/evidence UI: source envelope and missing-evidence states must be visible
- approval/review/diff behavior: high-impact AI/governance mutations require proposal -> approval -> execution -> audit
- anti-patterns: hidden writes, local role inference, duplicate initiative truth, fake success, stale data presented as current

## 7. Contract Update Plan

| File | Required update | Reason | Status |
| --- | --- | --- | --- |
| `IMPLEMENTATION_TASK_BOARD.md` | Add normalized `IN-INT-*` rows. | Register module integration development backlog. | `DONE_DOC` |
| `function-cards/MODULE_INTEGRATION_EXECUTION_CARD.md` | Maintain backlog, dependencies and evidence plan. | Source card for integration tasks. | `DONE_DOC` |
| `RAW_TARGET_STATE_2_0_PACKET.md` | Optional registry reference. | Keep packet linked to integration backlog. | `DONE_DOC` |

## 8. Implementation Backlog

| Task ID | Priority | Change type | Description | Depends on | Acceptance evidence | Done gate |
| --- | --- | --- | --- | --- | --- | --- |
| `IN-INT-P0-001` | `P0` | `test/docs` | Verify portfolio hub UI lifecycle/card regression evidence is present and update integration status. | `IN-HUB-P0-*` | route `/initiatives`; `InitiativesHub`; `/api/initiatives`, `gate-readiness-check`; dedicated UI evidence | `READY` |
| `IN-INT-P0-002` | `P0` | `test/docs` | Verify Analysis workspace UI regression evidence for all five subviews is present and update integration status. | `IN-ANL-P0-*` | route `/initiatives`; `PortfolioAnalysisView`; five subviews; readiness/dependency/capability APIs; dedicated UI evidence | `READY` |
| `IN-INT-P0-003` | `P0` | `test/docs` | Verify Menu 3 AI placement evidence across portfolio and analysis surfaces. | `IN-HUB-P0-*`, `IN-ANL-P0-*` | command row/right-side action evidence; `gate-readiness-check`; UI placement test/audit | `READY` |
| `IN-INT-P0-004` | `P0` | `docs` | Update `07_ACCEPTANCE_AND_TESTS.md`, `STATUS.md` and `INTEGRATION_REPORT.md` after P0 evidence is real. | `IN-INT-P0-001`, `IN-INT-P0-002`, `IN-INT-P0-003` | route/component/API/test references updated; docs gate rerun | `READY` |
| `IN-INT-P0-005` | `P0` | `docs` | Record owner acceptance or explicit `NO_GO` with reason for module integration. | `IN-INT-P0-004` | owner decision in `STATUS.md` and `INTEGRATION_REPORT.md` | `READY` |
| `IN-INT-P0-006` | `P0` | `docs` | Sync `RAW_TARGET_STATE_2_0_PACKET.md` with RAW semantic + world-class certification verdict and keep runtime evidence rows explicitly separate. | `IN-INT-P0-005` | packet + certification report consistency | `READY` |
| `IN-INT-P1-001` | `P1` | `test/docs` | Verify `/roadmap` lane smoke evidence and update integration status. | `IN-INT-P0-*`, `IN-ROAD-P1-001` | route `/roadmap`; `FullRoadmapView`; initiative readiness APIs; lane smoke evidence | `WAITING_P0` |
| `IN-INT-P1-002` | `P1` | `test/docs` | Verify `/portfolio` lane smoke evidence and update integration status. | `IN-INT-P0-*`, `IN-PORT-P1-001` | route `/portfolio`; `PortfolioView`; initiative list/status APIs; lane smoke evidence | `WAITING_P0` |
| `IN-INT-P1-003` | `P1` | `test/docs` | Verify `/roi` lane smoke evidence and update integration status. | `IN-INT-P0-*`, `IN-ROI-P1-001` | route `/roi`; `FullROIView`; finance/results initiative link APIs; lane smoke evidence | `WAITING_P0` |
| `IN-INT-P1-004` | `P1` | `docs` | Record source-envelope taxonomy decision and update affected module docs. | `IN-INT-P0-*` | source family decision; route/component/API/test impact mapping | `WAITING_P0` |
| `IN-INT-P1-005` | `P1` | `docs` | Bind raw visual evidence for Analysis tab or keep explicit accepted evidence gap. | `IN-INT-P0-*`, `IN-ANL-P1-001` | screenshot/evidence links or accepted `WARNING_DOC` | `WAITING_P0` |
| `IN-INT-P1-006` | `P1` | `test/docs` | Verify handoff evidence for task/decision/results/finance linkage. | `IN-INT-P0-*` | route/component/API/test for handoff boundaries; no new graph edge unless owner approves | `WAITING_P0` |
| `IN-INT-P2-001` | `P2` | `docs` | Resolve naming decision for `workload` vs runtime `resources`. | `IN-INT-P0-*`, `IN-ANL-P2-001` | product decision and docs alignment | `WAITING_P0` |
| `IN-INT-P2-002` | `P2` | `docs` | Clarify KPI/results -> initiative policy: generate initiative or proposal only. | `IN-INT-P0-*`, `IN-INT-P1-004` | contract update / open question closed | `WAITING_P0` |
| `IN-INT-P2-003` | `P2` | `docs` | Clarify interview generator policy: 0..N smart generator vs finding-level create/link. | `IN-INT-P0-*`, `IN-INT-P1-004` | contract update / open question closed | `WAITING_P0` |
| `IN-INT-P2-004` | `P2` | `docs` | Add future concept backlog for work graph view: initiative -> milestones -> tasks -> decisions. | `IN-INT-P0-*` | future docs backlog entry with owner boundaries | `WAITING_P0` |

## 9. Evidence Plan

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Portfolio hub evidence is integration-ready. | `/initiatives` | `InitiativesHub`, card/preview components | `/api/initiatives`, `gate-readiness-check` | `IN-INT-P0-001` | `MISSING` |
| Analysis evidence is integration-ready. | `/initiatives` analysis tab | `PortfolioAnalysisView`, five subviews | readiness/dependency/capability APIs | `IN-INT-P0-002` | `MISSING` |
| Menu 3 AI placement is verified. | `/initiatives` command row | `commandRowContent`, `onRegisterActions` | `capabilities.ctaBar.canUseAi` | `IN-INT-P0-003` | `MISSING` |
| Companion lanes are smoke-bound. | `/roadmap`, `/portfolio`, `/roi` | `FullRoadmapView`, `PortfolioView`, `FullROIView` | initiative/finance/results APIs | `IN-INT-P1-001..003` | `WAITING_P0` |
| Handoff evidence preserves ownership boundaries. | module route family | initiative/task/decision/results/finance components | handoff/link APIs | `IN-INT-P1-006` | `WAITING_P0` |

## 10. Cross-Module Impact

- impacted modules: `06_realizacja`, `07_rezultaty`, `08_finanse` as handoff evidence context only
- handoff changes: none in registry sync; any future new edge must update `MODULE_INTERACTION_GRAPH.md`
- ownership impact: none; initiative remains owner for what/why/readiness, downstream modules keep canonical truth
- security/tenant impact: backend capability and tenant checks remain authority
- E2E workflow impact: future tests should convert `NO_GO_RUNTIME_DONE` toward runtime readiness
- global contract updates needed: none now

## 11. Done Gate

- contract complete: `yes`
- UI/UX complete: `docs yes`, runtime evidence pending
- evidence complete: `no`, P0/P1 test evidence pending
- implementation backlog ready: `yes`
- impact complete: `yes`
- owner acceptance: `pending`
- rerun gate: required after future docs evidence updates

## 12. Open Questions

| Question | Owner | Due | Blocking? |
| --- | --- | --- | --- |
| What is the canonical source-envelope taxonomy for all valid initiative source families? | user | before runtime done | `yes` |
| Should KPI/results create initiatives directly or only recommend proposals? | user | P2 | `no` |
| Should interview use 0..N smart generation or finding-level create/link only? | user | P2 | `no` |

## 13. Registry Sync Note

Registry sync completed for `05_inicjatywy/MODULE_INTEGRATION` on 2026-05-10. This card records future module integration development tasks only; no runtime code, server code or tests were edited in this cycle.
