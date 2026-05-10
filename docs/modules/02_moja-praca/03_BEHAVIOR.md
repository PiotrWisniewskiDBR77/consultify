---
module_id: MODULE_MY_WORK
doc_kind: BEHAVIOR
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Behavior — Moja Praca / My Work

## Runtime Behavior (As-Is)

- `/my-work/*` opens `MyWorkView`, which mounts `MyWorkHub` inside `SplitLayout`.
- `MyWorkHub` manages module tabs for personal execution surfaces (home, ideas, notebook, inbox, calendar, tasks, decisions, manager).
- Hub runtime integrates context-aware chat opening and cross-module links (for example outputs/library paths and artifact links).
- Heavy detail surfaces are lazy-loaded in hub code (task/decision/detail/calendar/workspace views).

### Function Runtime Breakdown (As-Is)

- Core functions: `MW_HOME_RADAR`, `MW_NOTEBOOK`, `MW_INBOX`, `MW_CALENDAR`, `MW_TASKS`, `MW_DECISIONS`, `MW_MANAGER` are routed and controlled by tab/runtime state in `MyWorkHub`.
- Ideas parent function: `MW_IDEAS` owns idea list + idea workspace entry.
- Ideas subfunctions (tool modes): `MW_IDEAS_MINDMAP`, `MW_IDEAS_TABLE`, `MW_IDEAS_PROCESS_FLOW`, `MW_IDEAS_WHITEBOARD` run inside the shared idea workspace and switch through `IdeaWorkspaceToolbar`.

## State Handling (As-Is)

- Module state is controlled in-hub (active tab, filters, view modes, open documents, selection state).
- Runtime handles pilot-access and feature-flag conditional behavior through explicit utility checks/hooks.
- Hub stores/reads persistent UI preferences and open-document state for continuity.
- Ideas workspace manages multi-tool local state (active tool, active panel, selection, graph/runtime context) and explicit cross-tool transforms.

## Security / Tenant / Governance (As-Is)

- Access rules are consumed from shared role/policy hooks (`useUserCan`, pilot access guards, app store identity).
- No hidden write route is defined in `MyWorkView`; data mutations are initiated via explicit UI actions and shared API/services.
- Cross-module handoff keeps routing explicit (no hidden background navigation branch in route config).
- Manager function is explicitly role-restricted in hub runtime and presents a denied-access state instead of silent fallback.
