---
module_id: MODULE_SETTINGS
doc_kind: CODEMAP
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Codemap — Ustawienia (Settings)

## Route / AppView / Entry component

Źródło routingowe: `DRD/consultify/docs/modules/MODULE_ROUTING_ARCHITECTURE.md`.

- **Route root**: `/settings/*`
- **Entry component**: `SettingsView` (`src/views/SettingsView.tsx`)
- **Route config**: `src/routes/routeConfig.ts` (`ROUTES.SETTINGS`)
- **Router mount**: `src/routes/AppRoutes.tsx`
- **AppView enum**: `src/types/core.ts` (`SETTINGS_*`, `SETTINGS_*_MODULE`)

## Implementation notes

Kanoniczny inventory sekcji + statusów (`real/partial/stub`): `docs/modules/ADMIN_SETTINGS_SUPERADMIN_CONTRACT_INVENTORY.md`.

