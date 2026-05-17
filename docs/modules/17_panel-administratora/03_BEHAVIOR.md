---
module_id: MODULE_ADMIN_PANEL
doc_kind: BEHAVIOR
version: 2.0
owner: user
status: canonical
last_updated: 2026-05-11
---

# Behavior — Panel Administratora

## As-Is Runtime Behavior

- `/admin/*` is mounted and rendered through `AdminView` -> `AdminSettingsModule` in `MainLayout`.
- `/settings/*` is mounted separately and renders `SettingsView`.
- `/superadmin/*` is mounted separately and renders `SuperAdminView` (dedicated shell).
- Role guard is hierarchical in `ProtectedRoute`: `SUPERADMIN` level is higher than `ADMIN`; this means superadmin can satisfy admin guard today.

## Function Runtime Breakdown

- `ADM_ADMIN_WORKSPACE`: canonical admin runtime function on `/admin/*`.
- `ADM_SUPERADMIN_BOUNDARY`: boundary function between tenant admin and platform superadmin planes.

## Must

- MUST keep route/appview/sidebar mapping aligned across `menuConfig.ts`, `routeConfig.ts`, and `AppRoutes.tsx`.
- MUST preserve hard ownership split:
  - module 17 = tenant admin ownership
  - module 18 = user preferences ownership
  - superadmin = platform ownership
- MUST expose unresolved boundary contradictions as `NOT_DONE` or `NEEDS_OWNER_DECISION` (no silent PASS).

## Must Not

- MUST NOT treat target-state RAW assumptions as current behavior.
- MUST NOT move ownership from canonical module boundaries documented in As-Is global docs.
- MUST NOT hide route aliasing or guard hierarchy side effects from contract narrative.
- MUST NOT claim role-boundary closure while `ADM-RAW-P0-001` remains open.

## Critical Chain Ledger (source -> decision -> evidence)

| Claim | Source | Decision | Evidence / Status |
| --- | --- | --- | --- |
| Admin workspace is mounted on `/admin/*` | route tree and admin view | `KEEP` | `AppRoutes.tsx`, `AdminView.tsx`, `AdminSettingsModule.tsx` |
| Settings is separate from Admin | route tree and settings view | `KEEP` | `AppRoutes.tsx`, `SettingsView.tsx` |
| Superadmin is a separate platform route root | route tree + superadmin view | `KEEP` | `AppRoutes.tsx`, `SuperAdminView.tsx` |
| Hard plane split is currently enforced by guards | security doctrine | `DEFER` | `NOT_DONE` due `ProtectedRoute` hierarchy (`SUPERADMIN >= ADMIN`) |
| Admin aliases are explicit and documented | route config mappings | `ENHANCE` | `routeConfig.ts` admin appview mappings (`ADMIN_WORKSPACE` aliases) |

## Acceptance Criteria (Behavior)

- [x] Direct navigation to launch route resolves to documented current runtime (`/admin/*` -> admin module).
- [x] AppView-to-route mapping remains aligned for launcher and aliases.
- [x] Cross-module ownership statements are explicit across admin/settings/superadmin docs.
- [ ] Boundary enforcement claim is closed by runtime proof (`NOT_DONE` while `ADM-RAW-P0-001` is open).
