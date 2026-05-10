---
module_id: MODULE_MY_WORK
doc_kind: TESTS
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
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

## Function-Level Acceptance Matrix

| Function | Acceptance focus | Runtime/code evidence | Status |
| --- | --- | --- | --- |
| `MW_HOME_RADAR` | home/radar orchestration and next-action routing | `MyWorkHub.tsx`, `HomeView.tsx` | pass |
| `MW_IDEAS` | ideas list + workspace entry | `MyWorkHub.tsx`, `MyIdeasListContent.tsx`, `IdeaMapWorkspace.tsx` | pass |
| `MW_IDEAS_MINDMAP` | recommendation-map mode | `IdeaMapWorkspace.tsx`, `IdeaRecommendationMap.tsx`, `IdeaWorkspaceToolbar.tsx` | pass |
| `MW_IDEAS_TABLE` | table-mode runtime and context bridge | `IdeaMapWorkspace.tsx`, `IdeaTableTool.tsx` | pass |
| `MW_IDEAS_PROCESS_FLOW` | process-flow tool mode | `IdeaMapWorkspace.tsx`, `IdeaProcessFlowTool.tsx`, `IdeaWorkspaceTools.tsx` | pass |
| `MW_IDEAS_WHITEBOARD` | whiteboard tool mode and facilitation context | `IdeaMapWorkspace.tsx`, `IdeaWhiteboardTool.tsx`, `IdeaWorkspaceTools.tsx` | pass |
| `MW_NOTEBOOK` | notebook panel behavior and context linkage | `MyWorkHub.tsx`, `NotebookContent.tsx` | pass |
| `MW_INBOX` | triage controls and source-item open behavior | `MyWorkHub.tsx`, `InboxContent.tsx`, `NotificationDetailView.tsx` | pass |
| `MW_CALENDAR` | calendar runtime and open-item handoff | `MyWorkHub.tsx`, `TasksCalendarView.tsx` | pass |
| `MW_TASKS` | list/kanban/calendar task modes + detail | `MyWorkHub.tsx`, `MyTasksListContent.tsx`, `TasksKanbanBoard.tsx`, `TasksCalendarView.tsx`, `TaskDetailView.tsx` | pass |
| `MW_DECISIONS` | table/kanban/timeline decision modes + detail | `MyWorkHub.tsx`, `DecisionsPanelContent.tsx`, `DecisionsKanbanBoard.tsx`, `DecisionsTimelineView.tsx`, `DecisionDetailView.tsx` | pass |
| `MW_MANAGER` | role-gated manager dashboard flow | `MyWorkHub.tsx`, `ExecutiveDashboard.tsx` | pass (role-restricted) |

## Confirmed Automated Evidence (As-Is)

- `src/components/MyWork/table/__tests__/TablePlatformFrontend.test.tsx`

## Known Gaps / Blockers

- `code_gap`: no dedicated integration tests for My Work tab switching and command-row actions.
- `doc_gap`: no module-local UI recording links currently embedded in this file.
- `code_gap`: no single end-to-end acceptance suite validating all 12 documented My Work functions in one regression pack.

## Gate Vocabulary (Used For Reporting)

- `PASS`, `PASS_WITH_P2`, `BLOCKED_P1`, `INCONCLUSIVE`.
