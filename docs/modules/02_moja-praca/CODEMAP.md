---
module_id: MODULE_MY_WORK
doc_kind: CODEMAP
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Codemap — Moja Praca / My Work

## Route / AppView / Sidebar (As-Is)

- Sidebar entry: `MY_WORK` with `viewId: AppView.MY_WORK` in `src/components/navigation/Sidebar/menuConfig.ts`.
- Canonical route in `src/routes/routeConfig.ts`: `/my-work`.
- Route render map in `src/routes/AppRoutes.tsx`: `/my-work/*` -> `MyWorkView` (`src/views/MyWorkView.tsx`).

## Main Component Paths (As-Is)

- `src/views/MyWorkView.tsx` — route container with `SplitLayout` and `MyWorkHub`.
- `src/components/MyWork/MyWorkHub.tsx` — module runtime with tabs (home, ideas, notebook, inbox, calendar, tasks, decisions, manager), context-aware chat open, and workspace panel strip.
- `src/components/MyWork/table/*` — table workspace and related utilities used by My Work flows.

## API / Services / Models (Confirmable)

- Shared API entry used across My Work runtime: `src/services/api.ts`.
- Workspace and app types consumed by My Work: `src/types/workspace.ts`, `src/types/index.ts`, `src/types/myWork.ts`.
- My Work hub links to outputs routing helpers: `src/components/ReportsAndPresentations/outputsLibraryTabQuery.ts`.

## Test / Evidence References (Confirmable)

- `src/components/MyWork/table/__tests__/TablePlatformFrontend.test.tsx`

## Known Gaps (As-Is)

- No dedicated test file for `MyWorkView` route shell.
- No dedicated module-level automated test for core `MyWorkHub` tab switching and menu action behavior.
