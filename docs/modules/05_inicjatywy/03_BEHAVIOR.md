---
module_id: MODULE_INITIATIVES
doc_kind: BEHAVIOR
version: 2.0
owner: user
status: review
last_updated: 2026-05-10
---

# Behavior — Inicjatywy

## Runtime Behavior (As-Is)

- Core initiatives flow runs in `InitiativesHub` with view modes (kanban/list/timeline/grid), filter chips, and preview/document interactions.
- Hub uses explicit lifecycle transitions and status metadata from initiative lifecycle services.
- Planning and governance context is loaded from V8 planning API contracts for decision chains and initiative snapshots.
- Cross-module handoff to execution/results is route- and status-driven, not implicit in hidden background jobs.

## Function Runtime Breakdown

- `IN_PORTFOLIO_HUB`: core operational function for portfolio work and transitions.
- `IN_ANALYSIS_WORKSPACE`: analysis-driven function for feasibility/resources/logic/timeline/completeness.
- `IN_ROADMAP_VIEW`, `IN_PORTFOLIO_VIEW`, `IN_ROI_VIEW`: route-level companion functions tied to planning/value lanes.

## Contract 2.0 Critical Behaviors

| Critical behavior | Route evidence | Component evidence | API evidence | Test evidence | Gate |
| --- | --- | --- | --- | --- | --- |
| Initiative portfolio hub renders and supports governed view modes. | `/initiatives`, `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` | `src/components/Initiatives/InitiativesHub.tsx` | `src/services/api.ts`, `server/src/routes/pmo/initiatives.routes.ts` | `tests/e2e/smoke/deploy-gate-api.spec.ts`; dedicated UI lifecycle tests missing | `NOT_DONE` |
| Capability payload governs editability, workflow CTAs, context create actions and AI availability. | `/initiatives?open=<id>` and card/detail contexts | `InitiativesHub`, `InitiativePreviewV3` | `GET /api/initiatives/:id/gate-readiness-check`, `InitiativeController.ts`, `initiativeAccessResolver.ts` | no dedicated capability UI regression bound | `NOT_DONE` |
| Analysis workspace supports readiness analysis without hidden downstream mutation. | `/initiatives` analysis tab | `InitiativesHub` analysis subviews | `src/services/api/v8/planning.ts`, initiative readiness APIs | no dedicated analysis UI test bound | `NOT_DONE` |
| Roadmap/portfolio/ROI lanes render as projections or handoff surfaces, not duplicate initiative truth. | `/roadmap`, `/portfolio`, `/roi` | `FullRoadmapView`, `PortfolioView`, `FullROIView` | initiative lifecycle/readiness plus finance/results APIs where applicable | lane-specific smoke evidence not bound | `NOT_DONE` |

## Initiative Transfer Behavior Findings

The initiative is the main transfer object through discovery, diagnosis, planning and execution. Current runtime evidence shows several creation/generation paths, but the contract must distinguish smart generation from simple create/link.

| Source/context | Expected behavior | Runtime finding |
| --- | --- | --- |
| Tools | Smart generator; one tool source may produce many good initiative candidates or none. | Generator APIs and modal exist; source/provenance needs end-to-end validation. |
| Assessment | Smart generator from approved assessment/report/gaps; one assessment may produce many candidates. | Wizard and `generate-initiatives` APIs exist; gating appears tied to approved assessments. |
| Interview | Smart consulting-grade initiative generator is desired; finding-level handoff should also exist. | Create/link finding handoff exists; full multi-initiative generator is a gap. |
| Conversation/chat/MyWork | Simple create/link from selected evidence or conversation, not forced diagnostic generator. | Teresa/chat/MyWork conversion paths exist; source envelope doctrine is incomplete. |
| Finance analysis | Proposal/create path from analysis and assumptions. | Finance initiative proposal/create API exists; module contract must recognize it as a valid source family. |
| KPI/results | KPI evidence may justify or recommend initiatives. | Runtime mostly links/tracks KPIs against initiatives; direct generator path remains a gap. |

Behavior rule: generators must be allowed to return zero initiatives when evidence does not support a meaningful consulting-grade initiative.

## State Handling (As-Is)

- Runtime tracks active tab/view/filter/scope, selected initiative sets, deep-link opens, and open document state.
- Loading/refresh/error state is explicitly maintained in hub state (`isLoading`, `isRefreshing`, `loadError`).
- Bulk operations and create/edit actions are explicit UI pathways with user-triggered controls.

## Execution Backbone Behavior

- Initiative validation happens in the initiative sheet/card: source, problem, owner, sponsor, scope, KPI hypothesis, risks and readiness.
- After validation/scheduling, day-to-day execution should be managed through linked Tasks and Decisions.
- Task assignment must be person-level and independent of initiative owner/sponsor/manager.
- Decision ownership/decider flow must remain separate from task assignee and initiative owner.
- Initiative UI may summarize task/decision progress, but must not become a hidden duplicate task or decision system.

## Security / Tenant / Governance (As-Is)

- Write operations are routed through governance helpers (`initiativeWriteTruth`) and shared API context.
- Pilot/role restrictions are checked in runtime via guard utilities.
- No separate route bypass exists for initiative status changes; transitions happen via explicit in-module actions.
- UI may display roles, but backend effective-role resolution remains the authority for material action availability.

## Initiative Card System Behavior

Canonical card behavior is defined in `INITIATIVE_CARD_SYSTEM_CONTRACT.md`.

- Card identity is one initiative ID across list, kanban, timeline, grid, preview/detail, modal and lane references.
- Card transitions must be explicit user actions backed by backend readiness and capability truth, not hidden background writes.
- The card must treat `GET /api/initiatives/:id/gate-readiness-check` as the source for executable transitions, effective roles, top-bar editability, context create actions and AI availability.
- Loading, empty, error, degraded and success states must preserve provenance and must not show stale initiative data as current success.

Evidence pointers:

| Evidence type | Pointer |
| --- | --- |
| Route evidence | `/initiatives` primary hub plus `/roadmap`, `/portfolio`, `/roi` companion lanes. |
| Component evidence | `src/components/Initiatives/InitiativesHub.tsx` with list/kanban/timeline/grid and preview behavior. |
| API/capabilities evidence | `server/src/routes/pmo/initiatives.routes.ts` and `server/src/controllers/InitiativeController.ts` for `gate-readiness-check`. |
| Test evidence | `tests/e2e/smoke/deploy-gate-api.spec.ts`; dedicated card UI transition regression remains a known gap. |

## Analysis Tab Behavioral Contract — `IN_ANALYSIS_WORKSPACE`

Scope: this behavioral annex applies only to `/initiatives` -> `InitiativesHub` tab `analysis`. It must not change runtime ownership for execution, finance, results, source traceability or companion lane functions.

### Purpose

The Analysis tab behaves as a readiness and planning diagnostic workspace. It helps the user decide what needs attention before promote/approve/schedule/execute handoff, but it does not perform hidden governance decisions or downstream mutations.

### Sub-View Behavior Matrix

| Sub-view | Required behavior | Allowed outputs | Disallowed behavior | Evidence |
| --- | --- | --- | --- | --- |
| `workload` / runtime `resources` | Derive workload/resource allocation from initiatives and users, show over/under allocation and let the user inspect or explicitly reassign. | Workload flags, owner reassignment proposals, quick-update requests when allowed. | Silent reassignment, local role inference, assignment of execution tasks. | `ResourcesAnalysis`, `/api/initiatives`, `gate-readiness-check`; UI regression missing. |
| `feasibility` | Evaluate budget, skills, time and risk signals with visible status and blockers. | Feasibility scores/dimensions, readiness blockers, explicit next-action guidance. | Treat score as gate approval or hide missing source evidence. | `FeasibilityAnalysis`, `POST /api/initiatives/readiness-analysis`, `initiatives.readiness-analysis.test.ts`. |
| `logic` | Show dependency graph/table, conflicts, cycle candidates and sequencing recommendations. | Dependency create/delete requests, discovery proposals, critical-path/sequencing panels. | Hidden dependency write, undocumented cross-module handoff, graph-as-proof without evidence. | `LogicAnalysis`, `DependencyGraphCanvas`, `/api/initiatives/portfolio/dependencies`; UI regression missing. |
| `timeline` | Show schedule quality, missing dates, delay/conflict signals and proposal-only optimization. | Date quick updates, schedule proposals, conflict/optimizer/delay panels. | Silent baseline, hidden schedule mutation, requiring baseline for `APPROVED` contrary to policy. | `TimelineAnalysis`, V8 planning readiness test. |
| `completeness` | Show missing critical/total fields, completeness %, gate-ready state and proposal-only auto-fill/triage. | Missing-field list, auto-fill/bulk-fix proposals, quick updates when allowed. | Fabricated source evidence, silent auto-fill, active write actions in terminal statuses. | `CompletenessAnalysis`, readiness/section-type tests, `InitiativeCompletenessChecker.test.tsx`. |

### Status / Role / CTA Behavior

- Backend capability payload from `GET /api/initiatives/:id/gate-readiness-check` is authoritative for analysis-tab editability, workflow actions, context create actions and AI availability.
- UI renders only executable workflow transitions where backend says the current user can execute them.
- Context create actions follow `INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`: planning/approved/scheduled/executing/blocked may expose `task`, `decision`, `raid`; draft/review/promoted may expose `decision`, `raid`; cancelled/archived expose none.
- AI availability follows `capabilities.ctaBar.canUseAi`; AI is disabled when cards are not editable or status is `CANCELLED`/`ARCHIVED`.
- Consultant overlay is advisory visibility only and does not grant material authority.

### Runtime State Behavior

| State | Behavior |
| --- | --- |
| `loading` | Do not show analysis conclusions as trusted until initiative/dependency/readiness data has loaded. |
| `empty` | Explain no initiatives or filtered-empty result and provide a safe next action. |
| `error` | Show visible failure feedback and avoid stale-success presentation. |
| `degraded` | Missing users, dependencies, capability payload, source evidence or AI availability produces read-only/partial state. |
| `success` | Render current analysis and confirm explicit mutations through toast/read-back/refetch. |

### Approval / Diff Rules

- Analysis AI actions create proposals, not decisions.
- Applying a proposal must be separate from generating it and must respect backend role, tenant and capability checks.
- High-impact changes to gates, status, schedule baseline, task creation, decision creation, finance assumptions or KPI/results truth must route through their owning flows.
- Dependency create/delete and timeline/owner quick updates require explicit user action and feedback.

### Behavioral Evidence Binding

| Critical claim | Route | Component | API | Test | Gate |
| --- | --- | --- | --- | --- | --- |
| Analysis tab supports five subviews without separate route. | `/initiatives` | `InitiativesHub`, `PortfolioAnalysisView` | `/api/initiatives` | no dedicated UI regression | `PASS_DOC`, `NOT_DONE_UI` |
| AI and CTA behavior is capability-driven. | `/initiatives` | `InitiativesHub` command row, analysis subviews | `GET /api/initiatives/:id/gate-readiness-check` | no dedicated UI capability regression | `PASS_DOC`, `NOT_DONE_UI` |
| Readiness/feasibility/completeness are backed by initiative readiness APIs. | `/initiatives` | `FeasibilityAnalysis`, `CompletenessAnalysis` | `POST /api/initiatives/readiness-analysis` | `tests/integration/initiatives/initiatives.readiness-analysis.test.ts` | `PASS_LIMITED` |
| Dependency logic writes use explicit dependency endpoints. | `/initiatives` | `LogicAnalysis` | `/api/initiatives/portfolio/dependencies` | no dedicated dependency UI regression | `PASS_DOC`, `NOT_DONE_UI` |
| Timeline analysis respects planning readiness policy. | `/initiatives` | `TimelineAnalysis` | `/api/v8/planning/initiatives/:initiativeId/gate-readiness-check` | `server/src/routes/v8/__tests__/planning.routes.test.ts` | `PASS_LIMITED` |

## Module Integration Baseline

This behavior contract is integrated for all five functions under `05_inicjatywy/MODULE_INTEGRATION`.

| Integration claim | Behavior rule | Evidence gate |
| --- | --- | --- |
| One initiative truth owner | `IN_PORTFOLIO_HUB` owns initiative identity and lifecycle; companion lanes are projections or handoff surfaces. | `PASS_DOC`, UI regression `NOT_DONE` |
| Analysis is diagnostic | `IN_ANALYSIS_WORKSPACE` can recommend and route, but cannot silently mutate execution, finance, results or source truth. | `PASS_DOC`, Analysis UI regression `NOT_DONE_UI` |
| Cross-module handoffs are explicit | Approved/scheduled scope goes to `06_realizacja`; KPI/value targets go to `07_rezultaty`; assumptions/budget envelope goes to `08_finanse`. | `PASS_DOC_WITH_GAPS` |
| Role/CTA/AI behavior is backend-owned | Effective roles, workflow actions, context create actions and AI availability come from backend capabilities. | `PASS_DOC`, capability UI regression `NOT_DONE` |
| Owner acceptance remains required | Runtime `DONE` cannot be claimed until owner acceptance and missing UI evidence are bound. | `PENDING_OWNER` |
