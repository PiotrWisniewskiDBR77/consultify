---
module_id: MODULE_ADMIN_PANEL
doc_kind: CODEMAP
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Codemap — Panel Administratora

## Route / AppView / Sidebar (As-Is evidence)

- Sidebar entry: `ADMIN` global menu item
- Launch AppView: `AppView.ADMIN_DASHBOARD`
- Launch route: `/admin/*`
- Evidence files: `src/components/navigation/Sidebar/menuConfig.ts`, `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx`
- Canonical ownership note: Admin ownership is `/admin/*` tenant control plane; `/superadmin/*` is separate plane and not this module.

## Routed Components

- `src/routes/AppRoutes.tsx` -> `ROUTES.ADMIN.ROOT` renders `AdminView`
- `src/components/ProtectedRoute.tsx` enforces `requiredRole="ADMIN"` for admin route tree
- `src/views/admin/AdminView.tsx` is active admin UI root

## Relevant Services / Types

- `src/services/api.ts` (admin views consume backend APIs through shared client)
- `src/types/core.ts` (ADMIN AppView family)
- `src/types/core.ts` keeps enum identity for `AppView.ADMIN_DASHBOARD`.

## Current Runtime Status

- Classification: `real + security_critical`
- This codemap is As-Is only and reflects currently mounted route behavior.
