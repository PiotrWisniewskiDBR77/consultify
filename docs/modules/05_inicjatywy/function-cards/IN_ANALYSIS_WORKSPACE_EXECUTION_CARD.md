---
module_id: MODULE_INITIATIVES
function_id: IN_ANALYSIS_WORKSPACE
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
status: REVIEW
last_updated: 2026-05-10
---

# Function Execution Card — IN_ANALYSIS_WORKSPACE

## 1. Metadata

- `scope_anchor`: `05_inicjatywy/IN_ANALYSIS_WORKSPACE`
- `primary_module`: `05_inicjatywy`
- `primary_function`: `IN_ANALYSIS_WORKSPACE`
- `parent_function`: none
- `owner_business`: user
- `owner_tech`: user
- `work_type`: `docs-only`
- `status`: `REVIEW`

## 2. Scope Anchor

- in scope: registry tasks for `/initiatives` -> `InitiativesHub` tab `analysis` and subviews `workload/resources`, `feasibility`, `logic`, `timeline`, `completeness`
- out of scope: runtime implementation, `src/**`, `server/**`, `tests/**`, companion initiative functions, execution/finance/results ownership
- allowed global documents: module task board, this function execution card, optional module packet reference
- forbidden files: all runtime source and test files in this registry-sync cycle

## 3. Dependency Scope

Dependency scope is read-only / impact-only unless explicitly promoted by owner decision.

| Dependency | Allowed use | Forbidden use |
| --- | --- | --- |
| `06_realizacja` | Impact context for execution handoff evidence. | Editing execution runtime or task ownership. |
| `07_rezultaty` | Impact context for KPI/benefit readiness evidence. | Owning realized KPI or benefits truth. |
| `08_finanse` | Impact context for assumptions/value gap links. | Owning finance models or financial calculations. |
| Teresa / AI surfaces | Impact context for proposal-only AI behavior. | Hidden writes, hidden learning or approval authority. |

## 4. Source Inputs

- RAW sources:
  - `RAW_TARGET_STATE_2_0_PACKET.md` scope packet `05_inicjatywy/IN_ANALYSIS_WORKSPACE`
- module contracts:
  - `03_BEHAVIOR.md`
  - `04_UI_UX.md`
  - `07_ACCEPTANCE_AND_TESTS.md`
- function contracts:
  - `functions/IN_ANALYSIS_WORKSPACE.md`
- runtime evidence sources:
  - route `/initiatives`
  - `src/components/Initiatives/InitiativesHub.tsx`
  - `src/components/Initiatives/Analysis/PortfolioAnalysisView.tsx`
  - `src/components/Initiatives/Analysis/*Analysis.tsx`
  - `/api/initiatives`
  - `/api/initiatives/portfolio/dependencies`
  - `/api/initiatives/readiness-analysis`
  - `/api/initiatives/section-types`
  - `GET /api/initiatives/:id/gate-readiness-check`
- previous decisions:
  - Analysis tab docs are `APPROVED_FOR_DOCS`.
  - Runtime/UI evidence remains `NOT_DONE_UI` until dedicated Analysis tab regression is bound.

## 5. Decision Matrix

| Requirement | AS-IS | TARGET | DELTA | Decision | Rationale |
| --- | --- | --- | --- | --- | --- |
| Analysis UI evidence | API/integration evidence exists; dedicated UI regression is missing. | Five subviews have route/component/API/test evidence. | Add Analysis tab smoke/regression task. | `ENHANCE` | Closes `NOT_DONE_UI` without changing runtime in this registry cycle. |
| Menu 3 AI placement | Contract requires right-side placement. | Test/audit verifies no duplicated canvas AI action. | Add placement verification task. | `ENHANCE` | Required by AI actions Menu 3 rule. |
| Runtime states | Contract documents states. | Smoke evidence covers loading, empty, degraded/error and success. | Add state coverage task. | `ENHANCE` | Prevents stale success and hidden degraded behavior. |
| Evidence docs | Current docs mark gaps. | Docs are updated after test evidence exists. | Add docs evidence update task. | `ENHANCE` | Keeps route/component/API/test binding honest. |
| Raw visual packet | Screenshot files not bound. | Canonical visual evidence is linked or gap stays explicit. | Add visual binding task. | `DEFER` | Waiting on P0 and screenshot location. |
| Manual audit | Not recorded as checklist. | Role/CTA/AI/read-back checklist exists per subview. | Add audit task. | `DEFER` | Useful before runtime done. |
| `workload` vs `resources` | Alias documented. | Product naming decision is recorded. | Add naming cleanup task. | `DEFER` | Prevents future copy/runtime drift. |

## 6. UI/UX Component Contract

- approved shell/component family: `InitiativesHub` + `PortfolioAnalysisView` + five Analysis subview components
- Menu 2 surface: `Inicjatywy`
- Menu 3 actions: analysis subview chips on the command row and contextual action/AI buttons on the right side
- AI action placement: Menu 3 right-side only; no duplicated canvas action
- runtime states: `loading`, `empty`, `error`, `degraded`, `success`
- source/provenance/evidence UI: missing evidence must be visible as degraded, not filled silently
- approval/review/diff behavior: AI outputs are proposals; apply is explicit and capability-gated
- anti-patterns: hidden writes, local role inference, automatic gate transition, hidden dependency/date/owner mutation

## 7. Contract Update Plan

| File | Required update | Reason | Status |
| --- | --- | --- | --- |
| `functions/IN_ANALYSIS_WORKSPACE.md` | Update evidence gates after P0 test evidence exists. | Replace `NOT_DONE_UI` only when evidence is real. | `WAITING_P0` |
| `03_BEHAVIOR.md` | Update behavior evidence gate after UI regression. | Keep behavior claims evidence-bound. | `WAITING_P0` |
| `04_UI_UX.md` | Bind visual evidence or keep screenshot gap. | Raw visual packet is currently unbound. | `WAITING_P1` |
| `07_ACCEPTANCE_AND_TESTS.md` | Update Analysis acceptance matrix after tests. | Convert limited/gap statuses only with evidence. | `WAITING_P0` |
| `RAW_TARGET_STATE_2_0_PACKET.md` | Optional status reference if visual/test evidence changes. | Keep packet status aligned. | `OPTIONAL` |

## 8. Implementation Backlog

| Task ID | Priority | Change type | Description | Depends on | Acceptance evidence | Done gate |
| --- | --- | --- | --- | --- | --- | --- |
| `IN-ANL-P0-001` | `P0` | `test` | Add dedicated Analysis tab UI smoke/regression covering route entry and five subviews. | none | route `/initiatives`; components `InitiativesHub`, `PortfolioAnalysisView`, five subviews; APIs stubbed/bound; test evidence present | `READY` |
| `IN-ANL-P0-002` | `P0` | `test` | Verify Menu 3 right-side AI/action placement and no duplicated canvas AI action. | `IN-ANL-P0-001` | route/component/API/test | `READY` |
| `IN-ANL-P0-003` | `P0` | `test` | Cover Analysis tab smoke states: loading, empty, degraded/error and success. | `IN-ANL-P0-001` | route/component/API/test | `READY` |
| `IN-ANL-P0-004` | `P0` | `docs` | Update function and acceptance evidence gates after P0 tests are real. | `IN-ANL-P0-001`, `IN-ANL-P0-002`, `IN-ANL-P0-003` | route/component/API/test | `READY` |
| `IN-ANL-P1-001` | `P1` | `docs` | Bind raw visual evidence for five Analysis subviews or keep explicit evidence gap. | `IN-ANL-P0-*` | route/component/API/test plus visual evidence links | `WAITING_P0` |
| `IN-ANL-P1-002` | `P1` | `docs` | Add manual audit checklist for role gating, CTA availability, AI disabled state, degraded state and read-back per subview. | `IN-ANL-P0-*` | route/component/API/test plus manual audit checklist | `WAITING_P0` |
| `IN-ANL-P2-001` | `P2` | `docs` | Resolve product naming decision for author `workload` vs runtime `resources`. | `IN-ANL-P0-*`, `IN-ANL-P1-*` | route/component/API/test plus naming decision note | `WAITING_P0` |

## 9. Evidence Plan

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Analysis tab is mounted under initiatives. | `/initiatives` | `InitiativesHub`, `PortfolioAnalysisView` | `/api/initiatives` | `IN-ANL-P0-001` | `MISSING` |
| All five subviews are reachable. | `/initiatives` tab `analysis` | `ResourcesAnalysis`, `FeasibilityAnalysis`, `LogicAnalysis`, `TimelineAnalysis`, `CompletenessAnalysis` | `/api/initiatives`, dependency/readiness APIs | `IN-ANL-P0-001` | `MISSING` |
| AI/actions obey Menu 3 right-side placement. | `/initiatives` command row | `InitiativesHub.commandRowContent`, `PortfolioAnalysisView.onRegisterActions` | `gate-readiness-check` | `IN-ANL-P0-002` | `MISSING` |
| Runtime states are honest. | `/initiatives` | Analysis shell and subviews | `/api/initiatives`, readiness/dependency APIs | `IN-ANL-P0-003` | `MISSING` |
| Evidence gates update only after tests exist. | `/initiatives` | Analysis docs/component pointers | listed APIs | `IN-ANL-P0-004` | `WAITING_P0` |

## 10. Cross-Module Impact

- impacted modules: `06_realizacja`, `07_rezultaty`, `08_finanse`, Teresa/AI surfaces as impact-only context
- handoff changes: none in this registry-sync cycle
- ownership impact: none; analysis cannot own execution, finance or results truth
- security/tenant impact: backend capabilities remain source of truth
- E2E workflow impact: future Analysis UI evidence should reduce `NOT_DONE_UI`
- global contract updates needed: none now

## 11. Done Gate

- contract complete: `yes`
- UI/UX complete: `docs yes`, runtime evidence pending
- evidence complete: `no`, P0 test evidence pending
- implementation backlog ready: `yes`
- impact complete: `yes`
- owner acceptance: `pending`
- rerun gate: required after future docs evidence updates

## 12. Open Questions

| Question | Owner | Due | Blocking? |
| --- | --- | --- | --- |
| Where are the five raw visual screenshots stored for canonical binding? | user | before P1 | `no` |
| Should the UI label become `Workload` or keep runtime `Resources` with alias? | user | before P2 | `no` |
| Which future test lane owns the dedicated Analysis tab UI regression? | user/tech owner | before P0 execution | `yes` |

## 13. Registry Sync Note

Registry sync completed for `05_inicjatywy/IN_ANALYSIS_WORKSPACE` on 2026-05-10. This card records future tasks only; no runtime code, server code or tests were edited in this cycle.
