---
doc_id: SYSTEM_TRACEABILITY_MATRIX
doc_kind: ENTERPRISE_GOVERNANCE_MATRIX
owner: user
status: active
last_updated: 2026-05-10
---

# System Traceability Matrix

## Purpose

Provide one application-wide traceability map from requirements to runtime evidence.

This matrix is the bridge between:

- RAW author input,
- module contracts,
- function contracts,
- object and artifact ownership,
- runtime routes/components/APIs,
- tests and release gates.

## Traceability Rule

Every critical requirement must resolve to:

`requirement -> module -> function -> object/artifact -> route -> component -> API -> test -> owner`

If any link is missing, the requirement is not release-ready.

## Core Traceability Rows

| Requirement class | Module scope | Function scope | Object/artifact | Runtime evidence | Test evidence | Owner source |
| --- | --- | --- | --- | --- | --- | --- |
| Chat/AI proposal work | `01_czat` | `CZ_CHAT_ENGINE`, `CZ_CANVAS_WORKSPACE` | `Conversation`, proposal, source refs | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx`, `src/views/AIChatWelcomeView.tsx`, `server/src/routes/ai.routes.ts`, `server/src/routes/conversations.routes.ts` | `tests/components/AppRoutes.ai-chat-routing.test.tsx`, `tests/integration/ai/ai-chat.routes.test.ts`, `server/src/services/ai/__tests__/chatPolicyGateway.contract.test.ts` | function contracts + ownership registry |
| Personal work routing | `02_moja-praca` | all `MW_*` | task/action pointer, idea, note | My Work routes + hub/workspace components | My Work regression/e2e | function contracts |
| Idea family workspace and format handoff | `02_moja-praca`, with handoff impact to `01_czat`, `05_inicjatywy`, `06_realizacja` and artifact lanes | `MW_IDEAS`, `MW_IDEAS_MINDMAP`, `MW_IDEAS_TABLE`, `MW_IDEAS_PROCESS_FLOW`, `MW_IDEAS_WHITEBOARD` | idea workspace artifact, map/table/flow/board state, source refs, candidate handoff payload | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx`, `src/views/MyWorkView.tsx`, `src/components/MyWork/MyWorkHub.tsx`, `src/components/MyWork/IdeaMapWorkspace.tsx`, `src/components/MyWork/IdeaWorkspaceToolbar.tsx`, `server/src/routes/my-work.routes.ts` | `tests/unit/mywork/crossToolTransform.test.ts`, `tests/unit/mywork/aiProposalRuntime.test.ts`, format-specific tests in `02_moja-praca/07_ACCEPTANCE_AND_TESTS.md`; owner read-back e2e remains `code_gap` | `MW_IDEAS` family contract + ownership registry |
| Discovery and diagnosis | `03_wywiad`, `04_narzedzia` | `WY_MY_ASSIGNMENTS`, `WY_MANAGED_ASSIGNMENTS`, `WY_SESSIONS`, `WY_TEMPLATES`, `WY_INSIGHTS`, `WY_INITIATIVES`, `WY_PENDING_REVIEW`, `NZ_*` | interview session, finding, insight, candidate initiative, evidence pack | routes `/interview`, `/discovery`, `/project-intelligence`; component `src/components/Interview/InterviewHub.tsx`; V8 interview APIs | no dedicated full `InterviewHub` journey suite bound; candidate handoff/read-back is `NOT_DONE` | `03_wywiad/RAW_TARGET_STATE_2_0_PACKET.md`, `04_UI_UX.md`, `07_ACCEPTANCE_AND_TESTS.md`, function contracts |
| Initiative lifecycle and planning | `05_inicjatywy` | `IN_PORTFOLIO_HUB`, `IN_ANALYSIS_WORKSPACE`, `IN_ROADMAP_VIEW`, `IN_PORTFOLIO_VIEW`, `IN_ROI_VIEW` | `Initiative`, `Decision`, source envelope, task/decision/KPI/ROI links | routes: `/initiatives`, `/roadmap`, `/portfolio`, `/roi`; components: `src/components/Initiatives/InitiativesHub.tsx`, `src/views/FullRoadmapView.tsx`, `src/views/PortfolioView.tsx`, `src/views/FullROIView.tsx`; APIs: `/api/initiatives`, `GET /api/initiatives/:id/gate-readiness-check`, `server/src/controllers/InitiativeController.ts`, `server/src/routes/pmo/initiatives.routes.ts` | `tests/e2e/smoke/deploy-gate-api.spec.ts` for API CRUD; dedicated initiative UI lifecycle/card tests and lane smoke evidence are `NOT_DONE` | `docs/modules/05_inicjatywy/RAW_TARGET_STATE_2_0_PACKET.md`, `07_ACCEPTANCE_AND_TESTS.md`, function contracts |
| Execution lifecycle | `06_realizacja` | `RL_EXECUTION_PORTFOLIO`, `RL_EXECUTION_REPORTS`, `RL_EXECUTION_MANAGER`, `RL_FULL_EXECUTION_VIEW`, `RL_ROLLOUT_VIEW` | execution task bundle, blocker, decision, PMO report, manager intervention, rollout proposal | routes `/implementation`, `/execution`, `/rollout`; components `ExecutionHub`, `FullExecutionView`, `FullRolloutView`; V8 execution-control APIs | API/service tests exist; Menu 3 placement, missing-evidence report guard, manager/rollout approval/read-back and full state matrix are `NOT_DONE` | `06_realizacja/RAW_TARGET_STATE_2_0_PACKET.md`, `04_UI_UX.md`, `07_ACCEPTANCE_AND_TESTS.md`, function contracts |
| Results and finance | `07_rezultaty`, `08_finanse` | `RZ_*`, `FN_*` | `KPI`, `ROI`, `FinancialModel` | results/finance views + APIs | results/finance tests | object graph |
| Outputs and artifacts | `09_outputs` to `13_meeting` with format lane handshake to `10/11/12` | `OUT_*`, `DOC_*`, `TB_*`, `PR_*`, `ME_*` | output package, document artifact, table artifact, deck artifact, meeting pack | routes: `/presentations`, `/reports*`, `/presentations/wizard`, `/presentations/builder/:deckId`, `/presentations/shared/:shareToken`, `/wordy`, `/excele`, `/prezentacje`; components: `ReportsAndPresentationsHub`, `ReportBuilderView`, `PresentationWizard`, `DeckBuilder`, `SharedPresentationView`, placeholders on `wordy/excele/prezentacje`; dormant target views imported in `AppRoutes.tsx` (`WordyView`, `ExceleView`, `PrezentacjeView`) but not mounted | outputs hub regression tests and cross-lane ownership evidence remain `NOT_DONE`; approval-before-export and Menu 3-only action evidence remain `NOT_DONE` | `09_outputs/DEEP_INTEGRATION_AUDIT_2026-05-11.md`, module packets `09/10/11/12`, artifact lineage matrix |
| Integrations and marketplace | `14_mcp-iris`, `15_mcp-marketplace` | `IRIS_*`, `MCPM_*` | connector execution report, capability listing | MCP routes/components/APIs | integration tests | control plane + function contracts |
| Organization and admin planes | `16_organizacja`, `17_panel-administratora`, `18_ustawienia` | `ORG_*`, `ADM_*`, `SET_*` | org context, policy, preference | org/admin/settings routes + APIs | readiness/admin smoke | control plane contract |
| Partner workflow | `19_portal-partnerski` | `PART_*` | partner deliverable | partner routes/components/APIs | partner smoke/e2e | module contract |

## RAW Conversion Gate

Before RAW input can become implementation scope:

1. Add or update a traceability row.
2. Identify impacted module(s) and function(s).
3. Link object/artifact owner.
4. Identify evidence that exists and evidence that must be created.
5. Add acceptance criteria in module/function contracts.

## Required Evidence Granularity

- route evidence: exact route or route file reference,
- component evidence: exact view/container/component path,
- API evidence: backend route/service or frontend API boundary,
- test evidence: exact test file or planned test pack with owner/date.

## Release Use

Release readiness requires all critical rows to be either:

- `COMPLETE` with evidence, or
- `DEFERRED_P2` with owner, due date, and release acceptance.
