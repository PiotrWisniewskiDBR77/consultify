---
module_id: MODULE_MEETING
doc_kind: CODEMAP
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Codemap — Meeting

## Route / AppView / Sidebar (As-Is evidence)

- Sidebar entry: `MODULE_MEETING` (label `Meeting`, badge `soon`)
- Launch AppView: `AppView.MEETING`
- Launch route: `/meeting`
- Evidence files: `src/components/navigation/Sidebar/menuConfig.ts`, `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx`
- Canonical ownership note: As-Is route and menu are active; current runtime is placeholder.

## Routed Components

- `src/routes/AppRoutes.tsx` -> `ROUTES.MEETING` renders `V4ComingSoonView`
- `src/components/Meeting/MeetingHub.tsx` exists and is imported but not mounted on route

## Function Map (As-Is)

| Function | Runtime anchor | Notes |
| --- | --- | --- |
| `ME_MEETING_PLACEHOLDER` | `V4ComingSoonView` on `/meeting` | active placeholder runtime. |
| `ME_MEETING_RUNTIME_TARGET` | `MeetingHub` (imported only) | target runtime contract, not mounted. |

## Relevant Services / Types

- `src/store/useAppStore.ts` (navigation/session state)
- `src/types/core.ts` (`AppView.MEETING`)
- `src/types/core.ts` keeps enum identity for `AppView.MEETING`.

## Current Runtime Status

- Classification: `soon + code_gap`
- This codemap is As-Is only and reflects currently mounted route behavior.
