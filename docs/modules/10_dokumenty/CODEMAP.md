---
module_id: MODULE_DOCUMENTS
doc_kind: CODEMAP
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Codemap — Dokumenty / Wordy

## Route / AppView / Sidebar (As-Is evidence)

- Sidebar entry: `MODULE_WORDY` (label `Documents`, badge `soon`)
- Launch AppView: `AppView.WORDY`
- Launch route: `/wordy`
- Evidence files: `src/components/navigation/Sidebar/menuConfig.ts`, `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx`
- Canonical ownership note: As-Is route is active in router and sidebar, but current runtime is placeholder (coming-soon).

## Routed Components

- `src/routes/AppRoutes.tsx` -> route `ROUTES.WORDY` renders `V4ComingSoonView`
- `src/components/AIChat/KimiWorkspace/WordyView.tsx` is imported but not mounted on current route

## Relevant Services / Types

- `src/services/api.ts` (shared API client used by app shells)
- `src/store/useAppStore.ts` (global state and navigation state)
- `src/types/core.ts` keeps enum identity for `AppView.WORDY`.

## Current Runtime Status

- Classification: `soon + code_gap`
- This codemap is As-Is only and reflects currently mounted route behavior.
