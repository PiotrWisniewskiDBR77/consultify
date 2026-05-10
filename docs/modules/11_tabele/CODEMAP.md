---
module_id: MODULE_TABLES
doc_kind: CODEMAP
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Codemap — Tabele / Excele

## Route / AppView / Sidebar (As-Is evidence)

- Sidebar entry: `MODULE_EXCELE` (label `Tables`, badge `soon`)
- Launch AppView: `AppView.EXCELE`
- Launch route: `/excele`
- Evidence files: `src/components/navigation/Sidebar/menuConfig.ts`, `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx`
- Canonical ownership note: As-Is route is active in router and sidebar, with placeholder runtime.

## Routed Components

- `src/routes/AppRoutes.tsx` -> route `ROUTES.EXCELE` renders `V4ComingSoonView`
- `src/components/AIChat/KimiWorkspace/ExceleView.tsx` is imported but not mounted on current route

## Relevant Services / Types

- `src/services/api.ts` (shared API client)
- `src/store/useAppStore.ts` (cross-module state and route transitions)
- `src/types/core.ts` keeps enum identity for `AppView.EXCELE`.

## Current Runtime Status

- Classification: `soon + code_gap`
- This codemap is As-Is only and reflects currently mounted route behavior.
