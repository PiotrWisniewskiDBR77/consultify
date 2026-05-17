---
module_id: MODULE_INITIATIVES
doc_kind: TESTS
version: 2.0
owner: user
status: review
last_updated: 2026-05-10
---

# Acceptance & Tests — Inicjatywy

## Acceptance Matrix (As-Is Runtime Paths)

| Path / flow | Current runtime evidence | Status |
| --- | --- | --- |
| Sidebar Initiatives -> route family | `menuConfig.ts` + routes `/initiatives`, `/roadmap`, `/portfolio`, `/roi` | pass |
| Core module workspace | `/initiatives` -> `InitiativesHub` | pass |
| Governance lifecycle integration | `initiativeLifecycle` + `initiativeWriteTruth` usage in hub | pass |
| V8 planning evidence path | `v8/planning.ts` imported and consumed | pass |
| Module-local frontend tests in initiatives folder | not found | gap (`code_gap`) |

## Function-Level Acceptance Matrix

| Function | Acceptance focus | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `IN_PORTFOLIO_HUB` | Portfolio runtime, view modes, card variants and governed transitions are operational. | `/initiatives`, `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` | `src/components/Initiatives/InitiativesHub.tsx`, `InitiativePreviewV3`, portfolio card components | `src/services/api.ts`, `server/src/routes/pmo/initiatives.routes.ts`, `server/src/controllers/InitiativeController.ts` | `tests/e2e/smoke/deploy-gate-api.spec.ts`; dedicated UI card/transition tests missing | `NOT_DONE` |
| `IN_ANALYSIS_WORKSPACE` | Analysis subviews are present, source-backed and actionable without hidden downstream writes. | `/initiatives` analysis tab | `src/components/Initiatives/InitiativesHub.tsx` analysis subviews | `src/services/api/v8/planning.ts`, initiative readiness APIs | dedicated analysis UI regression not found | `NOT_DONE` |
| `IN_ROADMAP_VIEW` | Roadmap route is mounted and remains a planning projection/handoff surface. | `/roadmap`, `src/routes/AppRoutes.tsx` | `src/views/FullRoadmapView.tsx` | initiative lifecycle/readiness APIs | lane-specific route smoke not bound | `NOT_DONE` |
| `IN_PORTFOLIO_VIEW` | Portfolio route is mounted and references initiative truth without re-owning it. | `/portfolio`, `src/routes/AppRoutes.tsx` | `src/views/PortfolioView.tsx` | initiative list/status APIs through `src/services/api.ts` | lane-specific route smoke not bound | `NOT_DONE` |
| `IN_ROI_VIEW` | ROI route is mounted and preserves finance/results boundaries. | `/roi`, `src/routes/AppRoutes.tsx` | `src/views/FullROIView.tsx` | finance/results ROI APIs plus initiative link APIs | related results/finance tests exist; initiative ROI lane gate not bound | `NOT_DONE` |

## Confirmed Automated Evidence (As-Is)

- `tests/e2e/smoke/deploy-gate-api.spec.ts` covers basic project + initiative CRUD through `/api/initiatives`.
- `tests/e2e/smoke/deploy-gate-api-tools-workflow.spec.ts` covers tools initiative generation error/empty-list behavior.
- `tests/components/Interview/InsightViewer.p10-handoff.test.tsx` and `tests/unit/services/v8-interview-api.test.ts` cover interview initiative handoff/link paths.
- `tests/components/Results/*` include initiative/KPI link evidence, but not a full KPI-to-initiative generator gate.
- No dedicated `src/components/Initiatives/*test*` file found in current tree scan.

## Testing Canon Mapping

| Phase | Required? | Evidence | Decision |
| --- | --- | --- | --- |
| Automated / technical checks | yes | `npm run docs:contract:rerun-gate` -> 19 modules, 77 function contracts, 0 errors, 0 warnings | `PASS_DOC` |
| API Gate | yes | `tests/e2e/smoke/deploy-gate-api.spec.ts` initiative CRUD | `PASS_LIMITED` |
| DB-Compat Gate | yes for runtime changes | no runtime/schema changes in this cycle | `N/A_DOC_ONLY` |
| UI Smoke Gate | yes for user-facing module | dedicated initiative UI/card/lifecycle evidence not found | `NOT_DONE` |
| Manual Anygravity | yes before `DONE` | not run in this cycle | `NOT_DONE` |

## Evidence Binding Baseline

| Critical claim | Route | Component | API | Test | Gate |
| --- | --- | --- | --- | --- | --- |
| The module exists to manage initiative lifecycle and planning decisions. | `/initiatives` | `InitiativesHub` | `/api/initiatives`, `gate-readiness-check` | API smoke only | `NOT_DONE` |
| Backend capabilities govern action availability. | `/initiatives?open=<id>` | `InitiativePreviewV3`, `InitiativesHub` | `GET /api/initiatives/:id/gate-readiness-check` | no dedicated UI capability regression bound | `NOT_DONE` |
| Companion lanes are projections/handoffs, not duplicate initiative truth. | `/roadmap`, `/portfolio`, `/roi` | `FullRoadmapView`, `PortfolioView`, `FullROIView` | initiative lifecycle plus finance/results APIs | no lane smoke bound here | `NOT_DONE` |
| Cross-module handoff preserves source/evidence/approval boundaries. | `/initiatives` and downstream links | `InitiativesHub`, task/decision/results/finance components | `initiativeLifecycleCanon`, task/decision/finance/results APIs | partial related tests only | `NOT_DONE` |
| AI actions remain advisory, source-backed and Menu 3/right-side placed. | `/initiatives` command row/context | `InitiativesHub` command row / preview chat opener | capabilities `canUseAi`, Teresa/AI proposal APIs | no bound UI placement audit test | `NOT_DONE` |

## Known Gaps / Blockers

- `code_gap`: missing automated regression tests for initiative lifecycle UI transitions.
- `doc_gap`: no embedded UI evidence links (recording/screenshot) in this module file yet.
- `source_doctrine_gap`: `SOURCE_TRACEABILITY_SPEC.md` is narrower than runtime/product intent because it recognizes ToolSession and AssessmentReport only, while runtime also contains interview, chat/MyWork, finance and KPI/results-related initiative paths.
- `interview_generator_gap`: interview finding handoff exists, but a full multi-initiative smart generator equivalent to tools/assessment is not confirmed.
- `kpi_generator_gap`: KPI/results surfaces link and track initiatives, but direct KPI-to-initiative generation is not confirmed.
- `execution_assignment_gap`: task assignment support exists in task runtime, but initiative acceptance must explicitly verify person-level task assignment from initiative context.

## Initiative Card System Acceptance

Canonical card acceptance is defined in `INITIATIVE_CARD_SYSTEM_CONTRACT.md`.

| Acceptance focus | Expected evidence | Status |
| --- | --- | --- |
| Card identity is one initiative ID across variants | `InitiativesHub` list/kanban/timeline/grid/preview mappings | pass-doc |
| Card permissions are backend capability-driven | `GET /api/initiatives/:id/gate-readiness-check` and capabilities docs | pass-doc |
| AI actions follow Menu 3/right-side placement | `04_UI_UX.md` and Menu 3 rules | pass-doc |
| Source/provenance is visible or explicitly missing | `SOURCE_TRACEABILITY_SPEC.md` and card contract | pass-doc, runtime validation needed |
| Explicit approval and transition readiness are enforced | `GATE_DEFINITION_OF_DONE.md`, `INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`, backend route/controller evidence | pass-doc |
| List/kanban/timeline/grid/preview variants have automated UI regression coverage | dedicated component/e2e test references | gap |
| RAW visual evidence for requested card cue | `assets/Screenshot_2026-05-10_at_17.01.22-9fef8da3-12b1-4236-8ae0-3458d893b878.png` | gap: file not found in active workspace |
| Tools generator supports one source -> many initiatives | `Api.generateToolInitiatives`, `GenerateInitiativesModal` | pass-doc, source lineage validation needed |
| Assessment generator supports one source -> many initiatives | `Api.generateAssessmentInitiatives`, `InitiativesGenerationWizardModal` / `InitiativeGeneratorWizard` | pass-doc, source lineage validation needed |
| Interview can produce initiatives | `InsightViewer` handoff and `interviewPromoteFinding` | partial: create/link confirmed, generator not confirmed |
| Conversation/MyWork can seed initiatives | Teresa/chat handoff and MyWork conversion routes | partial: source envelope gap |
| Finance analysis can create initiative proposals | `V8FinanceApi.getInitiativeProposals`, `createInitiativesFromAnalysis` | partial: source envelope gap |
| KPI/results can generate initiatives | Results/KPI mappings and ROI evidence APIs | gap: tracking/linking confirmed, generation not confirmed |
| Initiative-linked tasks support assignees | `TaskDetailView`, `TasksMilestonesSection`, `my-work.routes.ts` `assignee_id` | pass-doc, initiative-context UI smoke needed |
| Initiative-linked decisions remain separate artefacts | `governanceLinkDecision`, `governanceGetDecisions`, `DecisionDetailView` | pass-doc, initiative-context UI smoke needed |

## Gate Vocabulary (Used For Reporting)

- `PASS`, `PASS_WITH_P2`, `BLOCKED_P1`, `INCONCLUSIVE`.

## Analysis Tab Acceptance Matrix — `IN_ANALYSIS_WORKSPACE`

Scope: this matrix covers only `/initiatives` -> `InitiativesHub` tab `analysis`. Runtime code and tests are not changed in this docs-only cycle.

### Required Sub-View Acceptance

| Sub-view | Acceptance criteria | Route evidence | Component evidence | API evidence | Test evidence | Gate |
| --- | --- | --- | --- | --- | --- | --- |
| `workload` / runtime `resources` | User can see allocation state, overloaded/underutilized resources, initiative drill-through and explicit reassignment proposal/apply flow. | `/initiatives` analysis tab | `InitiativesHub`, `PortfolioAnalysisView`, `ResourcesAnalysis` | `/api/initiatives`, `GET /api/initiatives/:id/gate-readiness-check` | No dedicated workload UI regression bound. | `NOT_DONE_UI` |
| `feasibility` | User can inspect budget/skills/time/risk feasibility, visible blockers and source-backed next actions. | `/initiatives` analysis tab | `InitiativesHub`, `PortfolioAnalysisView`, `FeasibilityAnalysis`, `usePortfolioAnalysisData` | `POST /api/initiatives/readiness-analysis`, `gate-readiness-check` | `tests/integration/initiatives/initiatives.readiness-analysis.test.ts` covers readiness metrics; no UI regression. | `PASS_LIMITED` |
| `logic` | User can inspect dependencies, conflicts/cycles/critical-path candidates and only mutate dependencies through explicit create/delete actions. | `/initiatives` analysis tab | `InitiativesHub`, `PortfolioAnalysisView`, `LogicAnalysis`, `DependencyGraphCanvas` | `/api/initiatives/portfolio/dependencies` | No dedicated dependency UI regression bound. | `NOT_DONE_UI` |
| `timeline` | User can distinguish no-date, delayed, at-risk and on-schedule initiatives; date edits and schedule proposals are explicit and validated. | `/initiatives` analysis tab | `InitiativesHub`, `PortfolioAnalysisView`, `TimelineAnalysis` | `/api/initiatives`, `/api/v8/planning/initiatives/:initiativeId/gate-readiness-check` | `server/src/routes/v8/__tests__/planning.routes.test.ts` covers V8 readiness envelope; no timeline UI regression. | `PASS_LIMITED` |
| `completeness` | User can see completeness %, missing critical/total fields, gate-ready state and proposal-only AI auto-fill/bulk-fix/triage flows. | `/initiatives` analysis tab | `InitiativesHub`, `PortfolioAnalysisView`, `CompletenessAnalysis`, `InitiativeCompletenessChecker` | `POST /api/initiatives/readiness-analysis`, `/api/initiatives/section-types`, `gate-readiness-check` | `tests/components/PMO/InitiativeCompletenessChecker.test.tsx`, `tests/integration/initiatives/initiatives.readiness-analysis.test.ts`, `tests/integration/initiatives/initiatives.section-types.test.ts`; no full analysis UI regression. | `PASS_LIMITED` |

### Cross-Cutting Acceptance

| Requirement | Acceptance criteria | Evidence | Gate |
| --- | --- | --- | --- |
| Status/role/CTA consistency | Analysis tab reads backend capability truth for editability, workflow CTAs, context create actions and AI availability; frontend does not infer authority locally. | `docs/product/INITIATIVE_CAPABILITIES_SYSTEM.md`, `docs/product/INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`, `server/src/controllers/InitiativeController.ts`, `server/src/services/initiative/initiativeAccessResolver.ts`. | `PASS_DOC` |
| AI placement | Contextual AI actions render through Menu 3 right-side command space and are not duplicated in the canvas. | `InitiativesHub` `commandRowContent`, `PortfolioAnalysisView` `onRegisterActions`, subview `getMenu3AiButtonClass`. | `PASS_DOC`, UI audit needed |
| Runtime states | Loading, empty, error, degraded and success states are documented for all five subviews. | `functions/IN_ANALYSIS_WORKSPACE.md`, `04_UI_UX.md`. | `PASS_DOC`, UI smoke needed |
| Approval/diff | AI and high-impact changes are proposal/review/apply flows; no hidden gate/status/task/decision/finance/results mutation. | `functions/IN_ANALYSIS_WORKSPACE.md`, `03_BEHAVIOR.md`, `06_PERMISSIONS_AND_SECURITY.md`. | `PASS_DOC` |
| Evidence binding | Every critical claim has route, component, API and test pointer; missing UI tests are explicitly marked. | This matrix and function contract evidence table. | `PASS_DOC_WITH_UI_GAPS` |
| Raw visual packet | Five requested screenshot labels are accounted for, but files are missing in active workspace. | Filename search returned no `assets/Screenshot_2026-05-10_at_19.48*.png`. | `WARNING_DOC` |

### Analysis Tab Test Canon Mapping

| Phase | Required? | Evidence | Decision |
| --- | --- | --- | --- |
| Automated / technical checks | yes | `npm run docs:contract:rerun-gate` for docs integrity. | pending gate run |
| API Gate | yes | `initiatives.readiness-analysis.test.ts`, `initiatives.section-types.test.ts`, `server/src/routes/v8/__tests__/planning.routes.test.ts`. | `PASS_LIMITED` |
| DB-Compat Gate | no for this cycle | Docs-only change; runtime/schema untouched. | `N/A_DOC_ONLY` |
| UI Smoke Gate | yes before runtime done | Missing dedicated Analysis tab UI regression for all five subviews. | `NOT_DONE_UI` |
| Manual Anygravity | yes before final runtime done | Not run in docs-only contract update. | `NOT_DONE` |

### Analysis Tab Evidence Binding Table

| Critical claim | Route | Component | API | Test | Gate |
| --- | --- | --- | --- | --- | --- |
| Analysis workspace is mounted inside initiatives hub. | `/initiatives` | `InitiativesHub`, `PortfolioAnalysisView` | `/api/initiatives` | no dedicated UI regression | `PASS_DOC`, `NOT_DONE_UI` |
| Workload/resources analysis remains explicit and capability-gated. | `/initiatives` analysis -> workload/resources | `ResourcesAnalysis` | `/api/initiatives`, `gate-readiness-check` | no dedicated UI regression | `PASS_DOC`, `NOT_DONE_UI` |
| Feasibility/readiness claims are API-backed. | `/initiatives` analysis -> feasibility | `FeasibilityAnalysis` | `POST /api/initiatives/readiness-analysis` | `initiatives.readiness-analysis.test.ts` | `PASS_LIMITED` |
| Dependency logic writes use explicit dependency APIs. | `/initiatives` analysis -> logic | `LogicAnalysis`, `DependencyGraphCanvas` | `/api/initiatives/portfolio/dependencies` | no dedicated UI regression | `PASS_DOC`, `NOT_DONE_UI` |
| Timeline analysis follows readiness/baseline policy. | `/initiatives` analysis -> timeline | `TimelineAnalysis` | `/api/v8/planning/initiatives/:initiativeId/gate-readiness-check` | `server/src/routes/v8/__tests__/planning.routes.test.ts` | `PASS_LIMITED` |
| Completeness analysis exposes gate readiness and missing fields. | `/initiatives` analysis -> completeness | `CompletenessAnalysis`, `InitiativeCompletenessChecker` | `/api/initiatives/readiness-analysis`, `/api/initiatives/section-types` | `InitiativeCompletenessChecker.test.tsx`, `initiatives.section-types.test.ts` | `PASS_LIMITED` |

## Module Integration Evidence Baseline

| Requirement | Contract section | Runtime evidence | Test evidence | Status |
| --- | --- | --- | --- | --- |
| Function inventory is complete and synchronized with module contracts. | `README.md`, `02_SCOPE.md`, `04_UI_UX.md`, `functions/*.md` | `/initiatives`, `/roadmap`, `/portfolio`, `/roi` route family. | docs gate; function-specific UI tests missing. | `PASS_DOC_WITH_GAPS` |
| Initiative portfolio hub owns lifecycle and cards. | `03_BEHAVIOR.md`, `IN_PORTFOLIO_HUB.md`, `INITIATIVE_CARD_SYSTEM_CONTRACT.md` | `InitiativesHub`, `InitiativePreviewV3`, `/api/initiatives`, `gate-readiness-check`. | `deploy-gate-api.spec.ts`; UI lifecycle/card regression missing. | `PASS_LIMITED`, `NOT_DONE_UI` |
| Analysis workspace is diagnostic and source-backed. | `03_BEHAVIOR.md`, `04_UI_UX.md`, `IN_ANALYSIS_WORKSPACE.md` | `PortfolioAnalysisView`, Analysis subviews, readiness/dependency APIs. | partial readiness/section/completeness tests; Analysis UI regression missing. | `PASS_LIMITED`, `NOT_DONE_UI` |
| Companion lanes are projections/handoffs. | lane function contracts, `05_DATA_AND_INTEGRATIONS.md` | `FullRoadmapView`, `PortfolioView`, `FullROIView`. | lane smoke not bound. | `PASS_DOC`, `NOT_DONE_UI` |
| Backend capabilities govern role/CTA/AI. | `06_PERMISSIONS_AND_SECURITY.md`, product matrices. | `InitiativeController`, `initiativeAccessResolver`, `GET /api/initiatives/:id/gate-readiness-check`. | UI capability regression missing. | `PASS_DOC`, `NOT_DONE_UI` |
| Existing cross-module handoffs preserve owner boundaries. | `MODULE_INTERACTION_GRAPH.md`, `ARTIFACT_LINEAGE_MATRIX.md`. | task/decision/results/finance link APIs and module routes. | partial related tests only. | `PASS_DOC_WITH_GAPS` |

Integration testing canon decision: `PASS_DOC_WITH_GAPS`. The module may proceed to the next docs wave, but runtime `DONE` remains blocked until P0/P1 evidence tasks are executed and owner acceptance is recorded.

## RAW Evidence Trace Annex — 2026-05-11

| Critical thesis | RAW source | Contract decision | Evidence / closure |
| --- | --- | --- | --- |
| Initiative recommendation/status/value claims need source envelope or missing-evidence state. | `docs/modules/05_inicjatywy/RAW_INPUT.md`; `docs/RAW/implementation-pmo/107_RAW_IMPLEMENTATION_PMO_ENGINE_2026-05-09.md`; `docs/RAW/results/105_RAW_RESULTS_VALUE_REALIZATION_ENGINE_2026-05-09.md` | `ENHANCE` source-envelope taxonomy. | API/route mapped; owner taxonomy decision `OPEN_QUESTION`; UI tests `NOT_DONE`. |
| AI may propose/refine initiatives but cannot silently approve or mutate downstream truth. | `docs/RAW/teresa-chat/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md` | `KEEP` proposal-only and backend capability-gated. | capability API mapped; lifecycle/card regression `NOT_DONE`. |
