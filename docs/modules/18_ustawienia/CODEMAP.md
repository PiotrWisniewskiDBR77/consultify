---
module_id: MODULE_SETTINGS
doc_kind: CODEMAP
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Codemap — Ustawienia

## Route / AppView / Sidebar (As-Is evidence)

- Sidebar entry: `SETTINGS` global menu item
- Launch AppView: `AppView.SETTINGS_PROFILE_MODULE`
- Launch route: `/settings/*`
- Evidence files: `src/components/navigation/Sidebar/menuConfig.ts`, `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx`
- Canonical ownership note: Canonical user/workspace preference surface is `/settings/*`.

## Routed Components

- `src/routes/AppRoutes.tsx` -> `ROUTES.SETTINGS.ROOT` renders `SettingsView` under `ProtectedRoute`
- `src/views/SettingsView.tsx` is active settings UI root
- `routeConfig.ts` maps detailed settings AppViews to nested `/settings/...` paths

## Function Map (As-Is)

| Function | Runtime anchor | Notes |
| --- | --- | --- |
| `SET_SETTINGS_WORKSPACE` | `SettingsView` on `/settings/*` | canonical settings runtime. |
| `SET_POLICY_BOUNDARY_LINKS` | settings-to-admin policy boundary | user-owned settings vs admin-owned controls separation. |

## Relevant Services / Types

- `src/store/useAppStore.ts` (theme/user session state integration)
- `src/types/core.ts` (settings AppView family + module launcher view)
- `src/types/core.ts` keeps enum identity for `AppView.SETTINGS_PROFILE_MODULE`.

## Current Runtime Status

- Classification: `real`
- This codemap is As-Is only and reflects currently mounted route behavior.
