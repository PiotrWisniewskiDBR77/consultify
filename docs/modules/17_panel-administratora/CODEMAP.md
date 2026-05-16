---
module_id: MODULE_ADMIN_PANEL
doc_kind: CODEMAP
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Codemap — Panel Administratora

## Route / AppView / Entry component

Źródło routingowe: `DRD/consultify/docs/modules/MODULE_ROUTING_ARCHITECTURE.md`.

- **Admin route root**: `/admin/*`
  - **Entry**: `AdminView` → `AdminSettingsModule` (`src/views/admin/AdminView.tsx`, `src/views/admin/AdminSettingsModule.tsx`)
- **SuperAdmin route root**: `/superadmin/*`
  - **Entry**: `SuperAdminView` (`src/views/superadmin/SuperAdminView.tsx`)
- **Route config**: `src/routes/routeConfig.ts` (ROUTES.ADMIN, ROUTES.SUPERADMIN)
- **Router mount**: `src/routes/AppRoutes.tsx`
- **AppView enum**: `src/types/core.ts` (ADMIN_* i SUPERADMIN_*)

## Implementation notes

Kanoniczna mapa mounted surfaces + API truth: `docs/modules/ADMIN_SETTINGS_SUPERADMIN_CONTRACT_INVENTORY.md`.

