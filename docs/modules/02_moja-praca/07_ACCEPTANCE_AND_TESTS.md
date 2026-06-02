---
module_id: MODULE_MY_WORK
doc_kind: TESTS
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-18
---

# Acceptance & Tests — Moja Praca / My Work

## Acceptance Matrix (As-Is Runtime Paths)

| Path / flow | Current runtime evidence | Status |
| --- | --- | --- |
| Sidebar My Work -> `/my-work/*` | `menuConfig.ts` + `AppRoutes.tsx` -> `MyWorkView` | pass |
| Route shell | `MyWorkView.tsx` mounts `MyWorkHub` in `SplitLayout` | pass |
| Main personal orchestration workspace | `MyWorkHub.tsx` tab runtime + open-document state | pass |
| Module-level automated tests | only table-platform test under MyWork path | partial |
| End-to-end My Work hub regression tests | no dedicated suite found | gap (`code_gap`) |

## RADAR Acceptance Matrix (MW_HOME_RADAR)

| Radar requirement | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Home route enters Radar surface | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` | `src/views/MyWorkView.tsx`, `src/components/MyWork/MyWorkHub.tsx` | n/a | `tests/components/MyWork/HomeView.outputs.test.tsx` | pass |
| Radar Home renders loading/empty/error-safe shell | n/a | `src/components/MyWork/Home/HomeView.tsx`, `src/components/MyWork/Home/useHomeData.ts` | `server/src/routes/my-work/home.routes.ts` | `tests/components/MyWork/HomeView.outputs.test.tsx` (retryable error state) | pass |
| Radar data feed retrieval | n/a | `src/components/MyWork/Home/useRadarData.ts` | `server/src/routes/my-work/radar.routes.ts`, `server/src/Gateway.ts` (`/api/my-work`) | no direct frontend hook test | partial |
| Radar triage cards expose priority/evidence/uncertainty/next-action | n/a | `src/components/MyWork/Home/RadarTriageCard.tsx`, `src/components/MyWork/Home/useRadarTriageData.ts` | `server/src/routes/v8/radar-triage.routes.ts` | `tests/integration/p06-radar-triage.contract.test.ts` | pass |
| Triage handoff endpoint contract | n/a | `src/components/MyWork/Home/useRadarTriageData.ts` (`executeTriageHandoff`) | `server/src/routes/v8/radar-triage.routes.ts` (`POST /signals/:signalId/handoff`) | `tests/integration/p06-radar-triage.contract.test.ts` | pass |
| Deny/degraded posture explicit for triage states | n/a | `src/components/MyWork/Home/RadarTriageCard.tsx` (`degraded_*`, `blocked_permission`) | `server/src/routes/v8/radar-triage.routes.ts` | `tests/integration/p06-radar-triage.contract.test.ts` (triage states/degraded contract) | pass |
| Radar is inspiration/education-first, not event-management-first | n/a | contract-level UX/behavior docs (`04_UI_UX.md`, `03_BEHAVIOR.md`) | n/a | no dedicated automated assertion | partial (`doc_contract_only`) |
| Top to-do/headline hero strip is not part of target Radar main layout | n/a | contract-level UX docs (`04_UI_UX.md`, `MW_HOME_RADAR.md`) | n/a | no dedicated automated assertion | partial (`target_locked`) |
| Literal radar visualization is required in target UX (technology orientation) | n/a | target contract docs (`04_UI_UX.md`, `RAW_TARGET_STATE_2_0_PACKET.md`) | n/a | no runtime proof yet | gap (`DEFER_P2`) |
| RADAR Layout v1 includes 4 main sections (`header`, `radar map`, `insight feed`, `detail panel`) | n/a | target contract docs (`04_UI_UX.md`, `MW_HOME_RADAR.md`) | n/a | no runtime proof yet | partial (`doc_contract_only`) |
| Top to-do hero is forbidden in target main layout | n/a | target contract docs (`04_UI_UX.md`, `MW_HOME_RADAR.md`) | n/a | no runtime proof yet | partial (`target_locked`) |
| Reading-first density is mandatory for RADAR main experience | n/a | target contract docs (`04_UI_UX.md`) | n/a | no runtime proof yet | partial (`doc_contract_only`) |
| Radar is a true circular radar view (rings + quadrants), not list/dashboard-first | n/a | target contract docs (`MW_HOME_RADAR.md`, `04_UI_UX.md`) | n/a | no runtime proof yet | partial (`doc_contract_only`) |
| Radar uses interactive signal icons/dots for technologies and ideas | n/a | target contract docs (`MW_HOME_RADAR.md`, `04_UI_UX.md`) | n/a | no runtime proof yet | partial (`doc_contract_only`) |
| Click on signal icon highlights point and updates right preview panel in-place | n/a | target contract docs (`MW_HOME_RADAR.md`, `03_BEHAVIOR.md`, `04_UI_UX.md`) | n/a | no runtime proof yet | partial (`doc_contract_only`) |
| Right panel remains preview-only; Teresa opens as separate action surface | n/a | target contract docs (`MW_HOME_RADAR.md`, `03_BEHAVIOR.md`, `04_UI_UX.md`) | n/a | no runtime proof yet | partial (`doc_contract_only`) |

## Function-Level Acceptance Matrix

| Function | Acceptance focus | Runtime/code evidence | Status |
| --- | --- | --- | --- |
| `MW_HOME_RADAR` | home/radar orchestration and next-action routing | `MyWorkHub.tsx`, `HomeView.tsx` | pass |
| `MW_IDEAS` | ideas list + workspace entry | `MyWorkHub.tsx`, `MyIdeasListContent.tsx`, `IdeaMapWorkspace.tsx` | pass |
| `MW_IDEAS_MINDMAP` | recommendation-map mode | `IdeaMapWorkspace.tsx`, `IdeaRecommendationMap.tsx`, `IdeaWorkspaceToolbar.tsx` | pass |
| `MW_IDEAS_TABLE` | table-mode runtime and context bridge | `IdeaMapWorkspace.tsx`, `IdeaTableTool.tsx` | pass |
| `MW_IDEAS_PROCESS_FLOW` | process-flow tool mode | `IdeaMapWorkspace.tsx`, `IdeaProcessFlowTool.tsx`, `IdeaWorkspaceTools.tsx` | pass |
| `MW_IDEAS_WHITEBOARD` | whiteboard tool mode and facilitation context | `IdeaMapWorkspace.tsx`, `IdeaWhiteboardTool.tsx`, `IdeaWorkspaceTools.tsx` | pass |
| `MW_NOTEBOOK` | `Notatki` entry opens folder table, then selected folder opens note-card workspace with context linkage | `MyWorkHub.tsx`, `NotebookContent.tsx` | pass |
| `MW_INBOX` | triage controls and source-item open behavior | `MyWorkHub.tsx`, `InboxContent.tsx`, `NotificationDetailView.tsx` | pass |
| `MW_CALENDAR` | calendar runtime and open-item handoff | `MyWorkHub.tsx`, `TasksCalendarView.tsx` | pass |
| `MW_TASKS` | list/kanban/calendar task modes + detail | `MyWorkHub.tsx`, `MyTasksListContent.tsx`, `TasksKanbanBoard.tsx`, `TasksCalendarView.tsx`, `TaskDetailView.tsx` | pass |
| `MW_DECISIONS` | table/kanban/timeline decision modes + detail | `MyWorkHub.tsx`, `DecisionsPanelContent.tsx`, `DecisionsKanbanBoard.tsx`, `DecisionsTimelineView.tsx`, `DecisionDetailView.tsx` | pass |
| `MW_MANAGER` | role-gated manager dashboard flow | `MyWorkHub.tsx`, `ExecutiveDashboard.tsx` | pass (role-restricted) |

## Idea Family Acceptance Matrix (Unified)

| Family claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| `MW_IDEAS` is one parent function with four formats inside `02_moja-praca`, not four modules. | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` (`/my-work/*`) | `src/views/MyWorkView.tsx`, `src/components/MyWork/MyWorkHub.tsx`, `src/components/MyWork/IdeaMapWorkspace.tsx`, `src/components/MyWork/IdeaWorkspaceToolbar.tsx` | `src/services/api.ts` (`/my-work/my-ideas/*`) | `tests/navigation/routeMapping.test.ts`, `tests/e2e/smoke/wave1-mywork-deep-acceptance.spec.ts` | pass |
| Format boundaries are explicit: Mind Map = relations, Table = structured records, Flow = sequence/readiness, Whiteboard = facilitation/synthesis. | `src/routes/AppRoutes.tsx` + function contracts | `IdeaRecommendationMap.tsx`, `IdeaTableTool.tsx`, `IdeaProcessFlowTool.tsx`, `IdeaWhiteboardTool.tsx` | `server/src/routes/my-work.routes.ts`, `server/src/routes/table-platform.routes.ts` where Table platform is involved | format-specific matrices below | pass |
| Cross-format switching preserves provenance, selected scope and intent. | `src/routes/AppRoutes.tsx` + workspace routing | `src/components/MyWork/transforms/crossToolTransform.ts`, `src/components/MyWork/IdeaMapWorkspace.tsx`, `src/components/MyWork/IdeaWorkspaceToolbar.tsx` | `server/src/routes/my-work.routes.ts` (`/my-ideas/:id/map`, `/my-ideas/:id/map/sync`, `/my-ideas/:id/activity`) | `tests/unit/mywork/crossToolTransform.test.ts` | pass |
| AI suggestions remain proposals until accepted across all formats. | `src/routes/AppRoutes.tsx` (`/my-work/*`) | `IdeaWorkspaceToolbar.tsx`, format tools, proposal/governance panels | `server/src/routes/my-work.routes.ts` (`/my-ideas/:id/ai-suggestions`, format-specific AI action endpoints) | `tests/unit/mywork/aiProposalRuntime.test.ts`, format-specific tests below | partial (`format_specific_coverage_mixed`) |
| Menu 3/right command row is the contract location for contextual AI actions. | `src/routes/AppRoutes.tsx` | `src/components/MyWork/IdeaWorkspaceToolbar.tsx` plus format tools | n/a | no single placement audit covering all format actions | partial (`ui_alignment_audit_needed`) |
| Handoff to `05_inicjatywy` / `06_realizacja` / artifact lanes is candidate-only until owner review and read-back. | `src/routes/AppRoutes.tsx` + downstream navigation pattern | `src/components/MyWork/IdeaMapWorkspace.tsx`, `IdeaWorkspaceTools.tsx`, format tools | `server/src/routes/my-work.routes.ts` (`/my-ideas/:id/convert`, `/my-ideas/:id/outcomes/:outcomeId/convert`) | `tests/integration/routes/my-work.test.js` plus missing owner read-back e2e | partial (`owner_read_back_gap`) |
| Shared loading/empty/error/degraded/success state grammar exists for all formats. | `src/routes/AppRoutes.tsx` | `IdeaMapWorkspace.tsx`, `IdeaTableTool.tsx`, `IdeaProcessFlowTool.tsx`, `IdeaWhiteboardTool.tsx`, `CollaborationOverlay.tsx` | `server/src/routes/my-work.routes.ts`, `server/src/routes/table-platform.routes.ts` | existing state tests below; no single all-format state matrix test | partial (`state_coverage_mixed`) |

## Idea Family Conflict Review

| Conflict ID | Dotyczy formatow | Typ konfliktu | Severity | Rekomendowana decyzja | Status |
| --- | --- | --- | --- | --- | --- |
| `IDEA-C01` | Mind Map vs Table vs Flow vs Whiteboard | ownership | high | Wszystkie cztery sa formatami jednej rodziny `Idea` w `02_moja-praca`; zaden nie jest osobnym modulem ani ownerem downstream lifecycle. | resolved |
| `IDEA-C02` | Table vs Flow | data | high | Table owns rows/fields/scoring; Flow owns sequence/conditions/lanes/readiness. Transform carries source/field/dependency context as draft until reviewed. | resolved |
| `IDEA-C03` | Mind Map vs Whiteboard | UX | medium | Mind Map owns relationship topology; Whiteboard owns workshop/facilitation/session synthesis. | resolved |
| `IDEA-C04` | All formats | UX | high | Menu 3/right command row is canonical for contextual AI actions; canvas cannot duplicate same AI actions. | resolved |
| `IDEA-C05` | All formats vs `05_inicjatywy` / `06_realizacja` | handoff | high | Handoff emits candidate payload only; owner module must review, mutate and read back before success is claimed. | resolved |
| `IDEA-C06` | All formats | evidence | medium | Missing e2e/read-back coverage is tracked as `code_gap`; provenance/evidence remains required by contract. | resolved |

## Mind Map Contract Acceptance Matrix (`MW_IDEAS_MINDMAP`)

| Critical claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Mind Map jest lane funkcji `Idea` wewnatrz `02_moja-praca` (nie osobny modul) | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` (`/my-work/*`) | `src/views/MyWorkView.tsx`, `src/components/MyWork/MyWorkHub.tsx` | `src/services/api.ts` (`my-work/my-ideas/*` boundary) | `tests/navigation/routeMapping.test.ts`, `tests/components/MyWork/IdeasMindMap.redirect.test.tsx` | pass |
| Mind Map dziala jako jeden z 4 systemow workspace i obsluguje przejscia miedzy narzedziami | `src/routes/AppRoutes.tsx` + workspace routing through My Work lane | `src/components/MyWork/IdeaMapWorkspace.tsx`, `src/components/MyWork/IdeaWorkspaceToolbar.tsx`, `src/components/MyWork/IdeaRecommendationMap.tsx` | `server/src/routes/my-work.routes.ts` (`/my-ideas/:id/map`, `/my-ideas/:id/map/sync`) | `tests/e2e/smoke/wave1-mywork-deep-acceptance.spec.ts`, `tests/unit/mywork/crossToolTransform.test.ts` | pass |
| Source/provenance i AI governance sa widoczne przed zatwierdzeniem i handoffem | `src/routes/routeConfig.ts` (`MY_WORK`) | `src/components/MyWork/mindmap/AIGovernancePanel.tsx`, `src/components/MyWork/mindmap/CanvasLeftToolbar.tsx` | `server/src/routes/my-work.routes.ts` (`/my-ideas/:id/map/ai-suggestions`, `/my-ideas/:id/activity`) | `tests/unit/mywork/aiProposalRuntime.test.ts`, `tests/unit/mindmap/canvasLeftToolbar.test.tsx` | pass |
| Handoff do downstream functions/modules pozostaje explicit i source-aware | `src/routes/AppRoutes.tsx` + module transition flow | `src/components/MyWork/IdeaMapWorkspace.tsx` (convert/quick-action events) | `server/src/routes/my-work.routes.ts` (`/my-ideas/:id/convert`, `/my-ideas/:id/outcomes/:outcomeId/convert`) | `tests/integration/routes/my-work.test.js`, `tests/integration/p12-mindmap-builder.contract.test.ts` | pass |
| UI states loading/empty/error/degraded/success sa jawne i prowadza do next action | `src/routes/AppRoutes.tsx` (`/my-work/*`) | `src/components/MyWork/IdeaMapWorkspace.tsx`, `src/components/MyWork/mindmap/CollaborationOverlay.tsx` | `server/src/routes/my-work.routes.ts` (map/presence endpoints) | `tests/components/CollaborationOverlay.degraded-state.test.tsx`, `tests/components/MyWork/IdeaProcessFlowTool.error-state.test.tsx` | partial (`state_coverage_mixed`) |

## Table Contract Acceptance Matrix (`MW_IDEAS_TABLE`)

| Critical claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Table jest formatem funkcji `Idea` wewnatrz `02_moja-praca`, a nie osobnym modulem | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` (`/my-work/*`) | `src/views/MyWorkView.tsx`, `src/components/MyWork/MyWorkHub.tsx`, `src/components/MyWork/IdeaMapWorkspace.tsx` | `src/services/api.ts` (`/my-work/my-ideas/*` boundary) | `tests/navigation/routeMapping.test.ts`, `src/components/MyWork/table/__tests__/TablePlatformFrontend.test.tsx` | pass |
| Table mode otwiera sie w idea workspace i respektuje `tpTable` / `tpView` | `src/routes/AppRoutes.tsx` + My Work route scope | `src/components/MyWork/IdeaMapWorkspace.tsx`, `src/components/MyWork/IdeaTableTool.tsx`, `src/components/MyWork/table/ViewRouter.tsx` | `server/src/routes/table-platform.routes.ts`, `server/src/routes/my-work.routes.ts` | `src/components/MyWork/table/__tests__/TablePlatformFrontend.test.tsx` | pass |
| Model tabeli obejmuje rows, columns/field types, views, sort/filter/group i statuses | `src/routes/routeConfig.ts` (`MY_WORK`) | `src/components/MyWork/IdeaTableTool.tsx`, `src/components/MyWork/table/TableToolbar.tsx`, `src/components/MyWork/table/useTablePlatformIntegration.ts` | `server/src/routes/table-platform.routes.ts`, `server/src/routes/my-work.routes.ts` (`/my-ideas/:id/ai-table-action`, `/ai-fill`, `/export-csv`) | `tests/unit/table/useTableSchema.test.ts`, `tests/unit/table/useTableRows.test.ts`, `tests/unit/table/useTableViews.test.ts`, `tests/unit/table/tableTypes.test.ts` | pass |
| Source/provenance i AI honesty sa widoczne przed approval/handoff | `src/routes/AppRoutes.tsx` (`/my-work/*`) | `src/components/MyWork/IdeaTableTool.tsx`, table proposal/assistant components under `src/components/MyWork/table/` | `server/src/routes/my-work.routes.ts` (`/my-ideas/:id/ai-suggestions`, `/my-ideas/:id/ai-table-action`, `/my-ideas/:id/ai-fill`, `/my-ideas/:id/activity`) | `tests/components/MyWork/IdeaTableTool.honesty.test.tsx`, `tests/unit/table/AITableProposal.test.tsx`, `tests/unit/table/AITableAssistant.test.tsx` | pass |
| Cross-tool transform zachowuje table context i provenance intent | `src/routes/AppRoutes.tsx` + workspace routing through My Work lane | `src/components/MyWork/IdeaMapWorkspace.tsx`, `src/components/MyWork/transforms/crossToolTransform.ts`, `src/components/MyWork/IdeaWorkspaceToolbar.tsx` | `server/src/routes/my-work.routes.ts` (`/my-ideas/:id/map`, `/my-ideas/:id/map/sync`, `/my-ideas/:id/activity`) | `tests/unit/mywork/crossToolTransform.test.ts`, `tests/unit/table/conversion.test.ts` | pass |
| Handoff do task/initiative/workflow/artifact pozostaje explicit i source-aware | `src/routes/AppRoutes.tsx` + module transition flow | `src/components/MyWork/IdeaTableTool.tsx`, `src/components/MyWork/IdeaMapWorkspace.tsx` | `src/services/api.ts` (`convertIdea`, outcome conversion), `server/src/routes/my-work.routes.ts` (`/my-ideas/:id/convert`, `/my-ideas/:id/outcomes/:outcomeId/convert`) | `tests/integration/routes/my-work.test.js`, `server/scripts/smoke-v5-ideas-workspace-e2e.ts` | partial (`owner_read_back_gap`) |
| UI states loading/empty/error/degraded/success sa jawne i prowadza do next action | `src/routes/AppRoutes.tsx` (`/my-work/*`) | `src/components/MyWork/IdeaTableTool.tsx`, `src/components/MyWork/table/` hooks/components | `server/src/routes/my-work.routes.ts`, `server/src/routes/table-platform.routes.ts` | `tests/components/MyWork/IdeaTableTool.honesty.test.tsx`, `src/components/MyWork/table/__tests__/TablePlatformFrontend.test.tsx` | partial (`state_coverage_mixed`) |

## Process Flow Contract Acceptance Matrix (`MW_IDEAS_PROCESS_FLOW`)

| Critical claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Process Flow jest formatem funkcji `Idea` wewnatrz `02_moja-praca`, a nie osobnym modulem | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` (`/my-work/*`) | `src/views/MyWorkView.tsx`, `src/components/MyWork/MyWorkHub.tsx`, `src/components/MyWork/IdeaMapWorkspace.tsx` | `src/services/api.ts` (`/my-work/my-ideas/*` boundary) | `tests/navigation/routeMapping.test.ts` | pass |
| Flow mode uruchamia sie w idea workspace i korzysta ze wspolnego shella narzedzi | `src/routes/AppRoutes.tsx` + My Work route scope | `src/components/MyWork/IdeaProcessFlowTool.tsx`, `src/components/MyWork/IdeaWorkspaceToolbar.tsx`, `src/components/MyWork/IdeaWorkspaceTools.tsx` | `server/src/routes/my-work.routes.ts` (`/my-ideas/:id/map*`) | `tests/components/MyWork/IdeaProcessFlowTool.error-state.test.tsx` | pass |
| Node/edge/condition model i guard rails sa jawne dla krytycznych przejsc | `src/routes/AppRoutes.tsx` (`/my-work/*`) | `src/components/MyWork/IdeaProcessFlowTool.tsx`, `src/components/MyWork/IdeaWorkspaceTools.tsx` | `server/src/routes/my-work.routes.ts` (`/my-ideas/:id/convert`, `/my-ideas/:id/activity`) | `tests/unit/mywork/crossToolTransform.test.ts` | partial (`guardrail_e2e_gap`) |
| Source/provenance dla krokow krytycznych jest widoczne przed high-impact handoff | `src/routes/routeConfig.ts` (`MY_WORK`) | `src/components/MyWork/IdeaProcessFlowTool.tsx`, `src/components/MyWork/IdeaWorkspaceToolbar.tsx` | `server/src/routes/my-work.routes.ts` (`/my-ideas/:id/ai-suggestions`, `/my-ideas/:id/convert`) | `tests/unit/mywork/aiProposalRuntime.test.ts` | partial (`flow_specific_coverage_gap`) |
| AI assistance i approval points sa egzekwowalne (proposal -> accept/reject -> convert) | `src/routes/AppRoutes.tsx` + workspace route scope | `src/components/MyWork/IdeaProcessFlowTool.tsx`, `src/components/MyWork/IdeaWorkspaceToolbar.tsx` | `server/src/routes/my-work.routes.ts` (`/my-ideas/:id/ai-suggestions`, `/my-ideas/:id/convert`) | `tests/unit/mywork/aiProposalRuntime.test.ts`, `tests/integration/routes/my-work.test.js` | partial (`full_chain_gap`) |
| Error/degraded states maja recovery paths i nie ukrywaja ograniczen | `src/routes/AppRoutes.tsx` (`/my-work/*`) | `src/components/MyWork/IdeaProcessFlowTool.tsx`, `src/components/MyWork/mindmap/CollaborationOverlay.tsx` | `server/src/routes/my-work.routes.ts` | `tests/components/MyWork/IdeaProcessFlowTool.error-state.test.tsx`, `tests/components/CollaborationOverlay.degraded-state.test.tsx` | pass |
| Handoff do `05_inicjatywy` / `06_realizacja` pozostaje explicit i owner-safe | `src/routes/AppRoutes.tsx` + module transition flow | `src/components/MyWork/IdeaMapWorkspace.tsx`, `src/components/MyWork/IdeaProcessFlowTool.tsx` | `server/src/routes/my-work.routes.ts` (`/my-ideas/:id/convert`, `/my-ideas/:id/outcomes/:outcomeId/convert`) | `tests/integration/routes/my-work.test.js` | partial (`owner_read_back_gap`) |

## Whiteboard Contract Acceptance Matrix (`MW_IDEAS_WHITEBOARD`)

| Critical claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Whiteboard jest formatem funkcji `Idea` wewnatrz `02_moja-praca`, a nie osobnym modulem | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` (`/my-work/*`) | `src/views/MyWorkView.tsx`, `src/components/MyWork/MyWorkHub.tsx`, `src/components/MyWork/IdeaMapWorkspace.tsx`, `src/components/MyWork/IdeaWorkspaceToolbar.tsx` | `src/services/api.ts` (`getMyIdeaMap`, `saveMyIdeaMap`, `syncMyIdeaMap`) | `tests/navigation/routeMapping.test.ts`, `tests/e2e/smoke/wave1-mywork-deep-acceptance.spec.ts` | pass |
| Whiteboard model obejmuje elementy, relacje, adnotacje i grupowanie z jawna semantyka | `src/routes/AppRoutes.tsx` (`/my-work/*`) | `src/components/MyWork/IdeaWhiteboardTool.tsx`, `src/components/MyWork/whiteboard/whiteboardContracts.ts`, `src/components/MyWork/whiteboard/whiteboardInteractionGrammar.ts`, `src/components/MyWork/whiteboard/nodes/*` | `server/src/routes/my-work.routes.ts` (`/my-ideas/:id/map`, `/my-ideas/:id/map/sync`) | `tests/unit/mywork/whiteboardNodes.test.ts`, `tests/unit/mywork/whiteboardInteractionGrammar.test.ts` | pass |
| Wspolpraca i facylitacja maja jawny model role/phase/timer/voting | `src/routes/AppRoutes.tsx` + workspace lane | `src/components/MyWork/IdeaMapWorkspace.tsx`, `src/components/MyWork/IdeaWhiteboardTool.tsx`, `src/components/MyWork/whiteboard/WhiteboardSessionPanel.tsx` | `src/services/api.ts` (`facilitation*` methods), `server/src/routes/my-work.routes.ts` (`/my-ideas/:id/activity`) | `tests/unit/mywork/whiteboardIntegration.test.ts`, `server/src/routes/v8/__tests__/p13-whiteboard-canon.test.ts` | pass |
| Versioning i audit trail sa wspierane przez snapshots/activity | `src/routes/AppRoutes.tsx` | `src/components/MyWork/IdeaWhiteboardTool.tsx` (history/activity hooks) | `server/src/routes/my-work.routes.ts` (`/my-ideas/:id/map/snapshots`, `/my-ideas/:id/activity`) | `tests/unit/mywork/whiteboardIntegration.test.ts` | partial (`snapshot_depth_gap`) |
| Provenance i source trace sa utrzymywane przy cross-tool transform i handoffie | `src/routes/AppRoutes.tsx` + transition flow | `src/components/MyWork/transforms/crossToolTransform.ts`, `src/components/MyWork/IdeaMapWorkspace.tsx`, `src/components/MyWork/IdeaWorkspaceTools.tsx` | `src/services/api.ts` (`convertMyIdea`, `convertMyIdeaSelection`), `server/src/routes/my-work.routes.ts` (`/my-ideas/:id/convert`, `/my-ideas/:id/outcomes/:outcomeId/convert`) | `tests/unit/mywork/crossToolTransform.test.ts`, `tests/integration/routes/my-work.test.js` | partial (`owner_read_back_gap`) |
| Whiteboard AI governance: proposal-first i explicit approval przed conversion | `src/routes/AppRoutes.tsx` (`/my-work/*`) | `src/components/MyWork/IdeaWhiteboardTool.tsx`, `src/components/MyWork/IdeaProposalReview.tsx` | `server/src/routes/my-work.routes.ts` (`/my-ideas/:id/map/ai-suggestions`, `/my-ideas/:id/activity`) | `tests/unit/mywork/aiProposalRuntime.test.ts`, `tests/unit/backend/services/ideaAIGeneratorService.whiteboardFormatters.test.ts` | pass |
| Menu 3-only AI placement dla Whiteboard wymaga pelnej zgodnosci runtime | `src/routes/AppRoutes.tsx` | `src/components/MyWork/IdeaWorkspaceToolbar.tsx`, `src/components/MyWork/IdeaWhiteboardTool.tsx` | n/a | brak dedykowanego UI placement testu | partial (`ui_alignment_audit_needed`) |

## Confirmed Automated Evidence (As-Is)

- `src/components/MyWork/table/__tests__/TablePlatformFrontend.test.tsx`
- `tests/components/MyWork/IdeaTableTool.honesty.test.tsx`
- `tests/unit/table/useTableSchema.test.ts`
- `tests/unit/table/useTableRows.test.ts`
- `tests/unit/table/useTableViews.test.ts`
- `tests/unit/table/tableTypes.test.ts`
- `tests/unit/table/AITableProposal.test.tsx`
- `tests/unit/table/AITableAssistant.test.tsx`
- `tests/unit/table/conversion.test.ts`
- `tests/unit/mywork/crossToolTransform.test.ts`
- `tests/unit/mywork/whiteboardIntegration.test.ts`
- `tests/unit/mywork/whiteboardInteractionGrammar.test.ts`
- `tests/unit/mywork/whiteboardNodes.test.ts`
- `tests/components/MyWork/HomeView.outputs.test.tsx`
- `tests/integration/p06-radar-triage.contract.test.ts`
- `server/src/routes/v8/__tests__/p13-whiteboard-canon.test.ts`

## Known Gaps / Blockers

- `code_gap`: no dedicated integration tests for My Work tab switching and command-row actions.
- `code_gap`: no dedicated end-to-end notebook hierarchy test for `Notatki -> folder list table -> folder note-card workspace`.
- `doc_gap`: no module-local UI recording links currently embedded in this file.
- `code_gap`: no single end-to-end acceptance suite validating all 12 documented My Work functions in one regression pack.
- `code_gap`: no end-to-end Radar journey test proving full path `load -> triage -> handoff -> owner-module read-back`.
- `code_gap`: no dedicated UI/e2e test validating true circular radar geometry and interactive icon points.
- `code_gap`: no dedicated UI/e2e test validating "click signal -> highlight -> right preview update" without route change.
- `code_gap`: no dedicated UI/e2e test validating "right panel is not chat surface" and "Talk to Teresa opens separate conversation surface".
- `doc_gap`: Menu 3-only AI placement is contractually required, but Home Radar currently includes inline AI controls that need runtime alignment.
- `code_gap`: target readability reset (top-block removal + literal radar map) is not yet validated by runtime/UI tests.
- `doc_gap`: brak dedykowanego, osobnego katalogu semantyki node/edge dla `MW_IDEAS_MINDMAP` (taxonomy + required evidence fields).
- `code_gap`: brak pojedynczego end-to-end testu spinajacego caly lancuch Mind Map: `proposal -> explicit approval -> convert -> owner read-back`.
- `doc_gap`: brak osobnego template catalog dla trybow `MW_IDEAS_TABLE` (idea register, risk register, decision table, hypothesis table, prioritization matrix, action list).
- `code_gap`: brak jednego end-to-end testu spinajacego caly lancuch Table: `proposal -> approval -> convert -> owner-module read-back`.
- `code_gap`: Menu 3-only AI placement dla wszystkich Table AI actions wymaga runtime/UI audytu po tym doc-only cyklu.
- `doc_gap`: brak dedykowanego katalogu semantyki `nodes/edges/conditions` dla `MW_IDEAS_PROCESS_FLOW` per archetyp procesu.
- `code_gap`: brak pojedynczego e2e testu spinajacego caly lancuch Flow: `proposal -> approval -> convert -> owner read-back`.
- `doc_gap`: brak osobnego mini-katalogu wymaganych pol evidence/provenance dla outcome types w `MW_IDEAS_WHITEBOARD`.
- `code_gap`: brak jednego dedykowanego e2e testu spinajacego caly lancuch Whiteboard: `facilitation -> outcome approval -> convert -> owner-module read-back`.
- `code_gap`: Menu 3-only AI placement dla Whiteboard wymaga dedykowanego runtime/UI audytu.

## Gate Vocabulary (Used For Reporting)

- `PASS`, `PASS_WITH_P2`, `BLOCKED_P1`, `INCONCLUSIVE`.
