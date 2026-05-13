---
module_id: MODULE_INITIATIVES
function_id: IN_ANALYSIS_WORKSPACE
function_name: Initiatives — Analysis Workspace
doc_kind: FUNCTION_CONTRACT
status: review
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — Analysis Workspace

## 1. Function Identity
- Function ID: `IN_ANALYSIS_WORKSPACE`
- Runtime anchor: `InitiativesHub` tab `analysis`
- Feature state: `real`
- Scope anchor: `05_inicjatywy/IN_ANALYSIS_WORKSPACE`
- Work type: `docs-only`
- Canonical sub-views: `workload`, `feasibility`, `logic`, `timeline`, `completeness`
- Runtime subview key note: author label `workload` maps to runtime `resources` in `AnalysisSubview`; the contract name remains `workload` for this tab.

## 2. User Job and Business Outcome
- Purpose / job-to-be-done: give the initiative owner, PMO and sponsor a single analysis tab that answers whether the initiative set is staffed, feasible, logically sequenced, schedulable and complete enough for the next governance action.
- Business outcome: decisions about promote/approve/schedule/fix are based on visible evidence, backend capabilities and explicit review, not on hidden AI writes or local role assumptions.
- The tab supports readiness and planning; it does not own execution tasks, financial models, KPI results or final gate decisions.

## 3. Trigger and Entry Points
- Primary route: `/initiatives`.
- Entry point: `InitiativesHub` tab `analysis`.
- Sub-view switcher: Menu 3 command row chips inside `InitiativesHub`.
- Preview / drill-through: selected initiative opens via `InitiativesHub` preview/detail flow.
- No standalone route is introduced for this function.

## 4. UI Component Footprint
- Container: `src/components/Initiatives/InitiativesHub.tsx`.
- Analysis shell: `src/components/Initiatives/Analysis/PortfolioAnalysisView.tsx`.
- Shared analysis data derivation: `src/components/Initiatives/Analysis/usePortfolioAnalysisData.ts`.
- Sub-view components:
  - `workload`: `ResourcesAnalysis.tsx` runtime key `resources`.
  - `feasibility`: `FeasibilityAnalysis.tsx`.
  - `logic`: `LogicAnalysis.tsx` plus `DependencyGraphCanvas.tsx`.
  - `timeline`: `TimelineAnalysis.tsx`.
  - `completeness`: `CompletenessAnalysis.tsx`.
- Command row placement: `InitiativesHub` passes analysis chips and registered action buttons through `ModuleHub.commandRowContent`; contextual AI actions must render on the right side of Menu 3 through `onRegisterActions`.

## 5. Inputs, Data Contracts, and Dependencies
- Initiative list/read model from `/api/initiatives` and shared `Api` service.
- Portfolio dependency read/write model from `/api/initiatives/portfolio/dependencies`.
- Backend capability payload from `GET /api/initiatives/:id/gate-readiness-check`.
- Readiness analysis endpoint `POST /api/initiatives/readiness-analysis` for AI-assisted readiness metrics.
- Section and AI support endpoints `POST /api/initiatives/suggest-sections`, `POST /api/initiatives/generate-section`, and `/api/initiatives/section-types`.
- V8 planning/readiness references from `src/services/api/v8/planning.ts` and `/api/v8/planning/initiatives/:initiativeId/gate-readiness-check`.
- Source/provenance, role and status constraints from:
  - `docs/product/INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`
  - `docs/product/INITIATIVE_CAPABILITIES_SYSTEM.md`
  - `docs/product/INITIATIVE_GOVERNANCE_MODEL.md`
  - `docs/modules/05_inicjatywy/05_DATA_AND_INTEGRATIONS.md`
  - `docs/modules/05_inicjatywy/06_PERMISSIONS_AND_SECURITY.md`

## 6. Outputs and Side Effects
- Analysis conclusions and explicit next-action routing to portfolio/execution.
- Recommendations, readiness gaps and proposed actions for review.
- No hidden mutation of execution, outputs, finance, results or source truth.
- Allowed direct outputs:
  - initiative preview/open requests,
  - quick update requests when backend capabilities allow edits,
  - dependency create/delete requests in the portfolio dependency API,
  - proposed AI analysis panels that require user review before apply,
  - visible readiness issues and next-action guidance.
- Disallowed side effects:
  - automatic gate transition,
  - silent task/decision/RAID creation,
  - hidden reassignment,
  - hidden schedule baseline mutation,
  - direct finance/results/source truth mutation.

## 6.1 Sub-Views Contract

| Sub-view | User job | Inputs | Outputs | Component footprint | Data dependencies | CTA actions | Role gating | AI actions | Critical risks | Acceptance criteria | Evidence pointers |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `workload` | See whether people/roles are overallocated, underused or missing before scheduling. | Initiatives, owners, users, assigned initiatives, quick-update capability. | Workload table, utilization flags, owner reassignment proposals, preview/open action. | `ResourcesAnalysis.tsx`, `PortfolioAnalysisView.tsx`, `InitiativesHub` Menu 3 chips. | `/api/initiatives`, users list, `QuickUpdatePayload`, `GET /api/initiatives/:id/gate-readiness-check`. | Open initiative, sort/filter, reassign owner only through explicit quick update. | Edit/reassign only when backend capability permits card/field edit; otherwise read-only/degraded. | AI rebalancing must register in Menu 3 right side and produce reviewable proposals. | Local reassignment could bypass governance if not checked against backend capabilities; workload can be stale if user data is partial. | User can identify overloaded resources, see empty/partial states, and any reassignment is explicit, reviewable and refetched. | Route `/initiatives`; components `InitiativesHub`, `PortfolioAnalysisView`, `ResourcesAnalysis`; API `/api/initiatives`, `gate-readiness-check`; tests `tests/integration/initiatives/initiatives.readiness-analysis.test.ts`, no dedicated UI regression bound. |
| `feasibility` | Judge whether each initiative is realistic across budget, skills, time and risk. | Initiative budget, owner, dates, risk/status and feasibility dimensions. | Feasibility score, red/amber/green dimensions, blockers and open initiative action. | `FeasibilityAnalysis.tsx`, `PortfolioAnalysisView.tsx`. | Derived `InitiativeFeasibility`, initiative fields, readiness/gate APIs. | Open initiative, inspect blockers, propose fixes only through explicit action. | Sponsor/PMO/Initiative Owner roles can act only through capabilities payload; AI cannot grant authority. | AI feasibility help is advisory and source-backed; placement Menu 3 right side only. | Feasibility score can become false authority if source gaps are not visible. | Every red/amber condition has an initiative pointer and next action or missing-evidence state. | Route `/initiatives`; components `InitiativesHub`, `PortfolioAnalysisView`, `FeasibilityAnalysis`; API `/api/initiatives/readiness-analysis`, `gate-readiness-check`; tests `initiatives.readiness-analysis.test.ts`, UI regression missing. |
| `logic` | Understand initiative dependencies, sequencing conflicts, cycles and critical path candidates. | Portfolio dependencies, initiative dates/status, keyword/relationship signals. | Dependency table/graph, conflict flags, discovered dependency proposals, cycle/critical path/sequencing panels. | `LogicAnalysis.tsx`, `DependencyGraphCanvas.tsx`, `PortfolioAnalysisView.tsx`. | `/api/initiatives/portfolio/dependencies`, initiative list, planning timeline fields. | Open initiative, create dependency, delete dependency, inspect graph. | Dependency writes require edit capability and tenant/project boundary; read-only when capability is absent. | AI discovery/critical path/sequencing can suggest only; user must accept before dependency mutation. | Incorrect dependency writes can alter planning truth; graph may imply causality without sufficient evidence. | Dependency add/delete is explicit, conflicts/cycles are visible, and AI suggestions remain pending until accepted. | Route `/initiatives`; components `InitiativesHub`, `PortfolioAnalysisView`, `LogicAnalysis`, `DependencyGraphCanvas`; API `/api/initiatives/portfolio/dependencies`; tests no dedicated dependency UI regression bound. |
| `timeline` | See whether initiatives have usable dates, conflicts, delays and schedule optimization options. | Initiative planned start/end, owner, dependencies and status. | Gantt-like bars, date edits, conflicts, auto-schedule proposals, optimizer/delay impact panels. | `TimelineAnalysis.tsx`, `PortfolioAnalysisView.tsx`. | Initiative timeline fields, dependencies, readiness policy that baseline timeline blocks from `SCHEDULED` onward. | Open initiative, edit dates, apply schedule proposal after review. | Date edits and scheduling actions require backend capability; `APPROVED` does not require baseline, `SCHEDULED+` does. | Auto-schedule/optimizer/delay impact actions must appear in Menu 3 right-side action slot and require apply/review. | Premature baseline mutation or hidden schedule changes can violate PMO governance. | No-date, delayed, at-risk and on-schedule states are distinguishable; any date mutation is explicit and validated. | Route `/initiatives`; components `InitiativesHub`, `PortfolioAnalysisView`, `TimelineAnalysis`; API `/api/initiatives`, `gate-readiness-check`, V8 planning readiness; tests `server/src/routes/v8/__tests__/planning.routes.test.ts`, UI regression missing. |
| `completeness` | Determine whether initiatives have enough required fields/evidence to proceed through gates. | Initiative level/status, owners, timeline, source/provenance, required field model, readiness blockers. | Completeness score, missing critical/total counts, gate-ready flag, AI auto-fill/bulk fix/triage proposals. | `CompletenessAnalysis.tsx`, `PortfolioAnalysisView.tsx`, optional `InitiativeCompletenessChecker` evidence. | `useCompletenessRows`, gate readiness, section types, readiness analysis, source/evidence contracts. | Open initiative, inspect missing fields, apply auto-fill only through explicit quick update. | Completion fixes require capabilities; terminal `CANCELLED`/`ARCHIVED` cannot expose active create/AI write actions. | Auto-fill, triage and bulk fixer are proposal-only until user applies; Menu 3 right side only. | Auto-fill can fabricate missing evidence if provenance is not enforced. | Missing critical fields are visible, gate-ready state is explainable, and AI fills never apply silently. | Route `/initiatives`; components `InitiativesHub`, `PortfolioAnalysisView`, `CompletenessAnalysis`, `tests/components/PMO/InitiativeCompletenessChecker.test.tsx`; API `/api/initiatives/readiness-analysis`, `/api/initiatives/section-types`, `gate-readiness-check`; tests readiness and completeness component tests, analysis UI regression missing. |

## 7. Ownership and Handoff Boundaries
- Analysis supports decisions; does not silently mutate execution/output canon.

| Handoff | Owner boundary |
| --- | --- |
| To `IN_PORTFOLIO_HUB` | Analysis informs initiative readiness and next actions. |
| To `06_realizacja` | Only approved/scheduled initiative scope can become execution work. |
| To decisions | Decision artefacts remain governed decision truth, not inline analysis fields. |
| To `08_finanse` / `07_rezultaty` | Analysis may expose assumptions/value gaps, but finance owns models and results owns realized KPI/benefit truth. |

## 8. Runtime States and UX Behavior
- `loading`: initiative list, dependency data or readiness data is not trusted yet; show skeleton/spinner/refresh indicator before analysis conclusions.
- `empty`: no initiatives or filtered-empty analysis state; explain whether the user should create/import initiatives, clear filters or choose another project/scope.
- `error`: API/load/action failure; show toast/banner/inline error and do not present stale analysis as current success.
- `degraded`: partial dependencies, missing users, missing capability payload, unavailable AI, pilot restrictions or source/evidence gaps; keep read-only where authority is uncertain.
- `success`: analysis subview renders current rows/cards/graph and any explicit action confirms via toast/read-back/refetch.

## 9. AI, Source, Evidence, Approval
- AI analysis requires visible provenance and review for high-impact actions.
- AI never decides, approves, schedules, assigns, creates execution work or changes gates by itself.
- AI actions are allowed only when `capabilities.ctaBar.canUseAi = true` and `aiAllowedSectionKeys` permits the context or wildcard.
- When AI is denied, the right-side CTA can be visible but disabled with explanation.
- All contextual AI actions must be rendered in Menu 3 right-side command space via `commandRowContent` / `onRegisterActions`; do not duplicate the same action inside the canvas.
- AI outputs must be represented as proposals/diffs:
  - workload reassignment proposal,
  - feasibility/readiness recommendation,
  - dependency discovery/sequencing proposal,
  - timeline schedule proposal,
  - completeness auto-fill/bulk-fix/triage proposal.
- Applying a proposal is a separate user action and must respect backend capability, role and tenant checks.

## 9.1 Status / Role / CTA Constraints

| Constraint | Contract |
| --- | --- |
| Status authority | `INITIATIVE_STATUS_ROLE_CTA_MATRIX.md` and backend `gate-readiness-check` own status, available transitions and CTA eligibility. |
| Workflow actions | UI renders only executable `availableTransitions[]` where `canCurrentUserExecute = true`; do not render disabled workflow buttons. |
| Context create actions | `contextCreateActions` are backend-owned: planning/approved/scheduled/executing/blocked can expose `task`, `decision`, `raid`; draft/review/promoted can expose `decision`, `raid`; cancelled/archived expose none. |
| AI CTA | `canUseAi = true` only when cards are editable and status is not `CANCELLED`/`ARCHIVED`; otherwise disabled with explanation. |
| Role source | Effective roles come from backend/userRoles and role resolver; frontend must not infer authority from local matrices. |
| Consultant overlay | Advisory/visible only; it does not grant authority by itself. |
| Terminal states | `CANCELLED` and `ARCHIVED` are read-only/degraded for active analysis writes and AI write proposals. |

## 9.2 Approval / Diff Rules

- Any action that changes owner, priority, date, dependency, status, schedule, completeness field or downstream work must show what will change before apply where the UI provides a proposal flow.
- High-impact governance actions must route to explicit gate/decision workflows, not analysis-local mutation.
- AI proposal apply must be idempotent from the user's perspective: proposed changes remain reviewable, rejected changes do not mutate state, accepted changes produce toast/read-back evidence.
- Dependency create/delete and timeline changes must be explicit user actions with success/error feedback and refresh/read-back.
- Missing source/provenance must be displayed as degraded, not silently filled.

## 10. Security, Roles, and Tenancy
- Standard tenant ACL and deny-by-default behavior.
- Tenant/project scope is mandatory for all dependency, readiness and initiative update actions.
- If backend capability or effective-role data is missing, the analysis tab must deny writes and show degraded/read-only state.
- Sensitive internals, stack traces, hidden prompts or raw private payloads must not be exposed in UI.
- The analysis tab may summarize task/decision/readiness state but must not duplicate task, decision, finance or results canonical truth.

## 11. Acceptance Criteria and Test Evidence

| Criterion | Status |
| --- | --- |
| Analysis tab exposes all five subviews: workload/resources, feasibility, logic, timeline and completeness. | `PASS_DOC` |
| Each subview has documented inputs, outputs, CTA actions, role gating, AI constraints and risks. | `PASS_DOC` |
| AI actions are constrained to Menu 3 right-side placement and proposal/review flows. | `PASS_DOC`; runtime UI audit needed |
| Backend capabilities govern editability, CTAs and AI availability. | `PASS_DOC`; UI capability regression missing |
| Runtime states cover loading, empty, error, degraded and success. | `PASS_DOC`; UI smoke evidence missing |
| Critical claims bind to route, component, API and test evidence. | `PASS_DOC`; several tests are API/integration only |
| No hidden cross-module mutation is allowed from the analysis tab. | `PASS_DOC` |
| Raw visual packet for workload/feasibility/logic/timeline/completeness is referenced by labels, but screenshot files were not found in active workspace. | `WARNING_DOC` |

| Evidence type | Pointer | Gate |
| --- | --- | --- |
| Route evidence | `/initiatives` analysis tab inside `InitiativesHub`. | `PASS_DOC` |
| Component evidence | `src/components/Initiatives/InitiativesHub.tsx`, `src/components/Initiatives/Analysis/PortfolioAnalysisView.tsx`, `ResourcesAnalysis.tsx`, `FeasibilityAnalysis.tsx`, `LogicAnalysis.tsx`, `TimelineAnalysis.tsx`, `CompletenessAnalysis.tsx`. | `PASS_DOC` |
| API evidence | `src/services/api.ts`, `src/services/api/v8/planning.ts`, `server/src/routes/pmo/initiatives.routes.ts`, `server/src/controllers/InitiativeController.ts`, `server/src/services/initiative/initiativeAccessResolver.ts`. | `PASS_DOC` |
| Test evidence | `tests/integration/initiatives/initiatives.readiness-analysis.test.ts`, `tests/integration/initiatives/initiatives.suggest-sections.test.ts`, `tests/integration/initiatives/initiatives.section-types.test.ts`, `tests/components/PMO/InitiativeCompletenessChecker.test.tsx`, `server/src/routes/v8/__tests__/planning.routes.test.ts`; no dedicated analysis UI regression bound. | `PASS_LIMITED` / `NOT_DONE_UI` |

## 11.1 Evidence Binding Table

| Critical claim | Route | Component | API | Test | Gate |
| --- | --- | --- | --- | --- | --- |
| Analysis tab exists inside the initiatives hub. | `/initiatives` | `InitiativesHub`, `PortfolioAnalysisView` | `/api/initiatives` | no dedicated UI regression | `PASS_DOC`, `NOT_DONE_UI` |
| Workload/resources analysis can identify allocation issues and propose explicit reassignment. | `/initiatives` analysis -> workload/resources | `ResourcesAnalysis` | `/api/initiatives`, `gate-readiness-check` | no dedicated workload UI regression | `PASS_DOC`, `NOT_DONE_UI` |
| Feasibility analysis evaluates budget/skills/time/risk dimensions. | `/initiatives` analysis -> feasibility | `FeasibilityAnalysis`, `usePortfolioAnalysisData` | `/api/initiatives/readiness-analysis`, `gate-readiness-check` | `initiatives.readiness-analysis.test.ts` | `PASS_LIMITED` |
| Logic analysis manages dependencies through explicit dependency API calls. | `/initiatives` analysis -> logic | `LogicAnalysis`, `DependencyGraphCanvas` | `/api/initiatives/portfolio/dependencies` | no dedicated dependency UI regression | `PASS_DOC`, `NOT_DONE_UI` |
| Timeline analysis handles date quality, conflicts and schedule proposals without hidden baselines. | `/initiatives` analysis -> timeline | `TimelineAnalysis` | `/api/initiatives`, `/api/v8/planning/initiatives/:initiativeId/gate-readiness-check` | `server/src/routes/v8/__tests__/planning.routes.test.ts` | `PASS_LIMITED` |
| Completeness analysis exposes gate readiness/missing critical fields and AI fill proposals. | `/initiatives` analysis -> completeness | `CompletenessAnalysis`, `InitiativeCompletenessChecker` | `/api/initiatives/readiness-analysis`, `/api/initiatives/section-types`, `gate-readiness-check` | `InitiativeCompletenessChecker.test.tsx`, `initiatives.readiness-analysis.test.ts`, `initiatives.section-types.test.ts` | `PASS_LIMITED` |
| AI availability and CTAs are backend capability-driven. | `/initiatives` | `InitiativesHub` command row, analysis subviews | `GET /api/initiatives/:id/gate-readiness-check` | no dedicated UI capability regression | `PASS_DOC`, `NOT_DONE_UI` |

## 12. Open Risks and Change Log
- Risk: analysis subview semantics can drift without dedicated UI regression coverage.
- Risk: raw screenshot files for the required visual packet were not found in the active workspace, so visual evidence is not bound.
- Risk: `workload` vs runtime `resources` naming must remain documented until code/UI labels converge.
- Change log: contract hardened for five Analysis subviews, I/O, CTA/role/AI constraints, runtime states, approval/diff rules and evidence map.

## 13. Open Questions
1. Should the user-facing label be normalized from runtime `Resources` to author-requested `Workload`, or should the contract continue to carry both names?
2. Where should the five raw screenshot files be stored or linked so UI/UX evidence can be bound without relying on filename-only intent?
3. Which test owner will add the missing dedicated Analysis tab UI regression for all five subviews?

## RAW Hard Gate Trace — 2026-05-11

- RAW source: `docs/modules/05_inicjatywy/RAW_INPUT.md`; impact contexts from PMO/Results/Finance RAW.
- Contract decision: `ENHANCE` workload/resources, feasibility, logic, timeline and completeness as evidence-led readiness checks.
- Evidence: route/component/API mapped; five-subview UI regression and raw visual evidence remain `NOT_DONE`.
