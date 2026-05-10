---
module_id: MODULE_ADMIN_PANEL
doc_kind: BEHAVIOR
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Behavior — Panel Administratora

## As-Is Runtime Behavior

- Only authenticated users with ADMIN role can access `/admin/*` route tree.
- Admin module runs inside `MainLayout` with dedicated view and internal navigation mapping.
- SuperAdmin remains separately guarded and routed, preserving ownership boundary.

## Function Runtime Breakdown

- `ADM_ADMIN_WORKSPACE`: canonical admin runtime function on `/admin/*`.
- `ADM_SUPERADMIN_BOUNDARY`: explicit boundary function between admin and superadmin planes.

## Must

- MUST keep route/appview/sidebar mapping aligned across `menuConfig.ts`, `routeConfig.ts`, and `AppRoutes.tsx`.
- MUST preserve module ownership boundaries defined in global operating docs.
- MUST expose blocked/placeholder state honestly when runtime is not yet mounted.

## Must Not

- MUST NOT treat target-state RAW assumptions as current behavior.
- MUST NOT move ownership from canonical module boundaries documented in As-Is global docs.
- MUST NOT hide route aliasing or legacy surfaces from module contract narrative.

## Acceptance Criteria (Behavior)

- [ ] Direct navigation to launch route resolves to documented current runtime.
- [ ] AppView-to-route mapping resolves to the same module owner.
- [ ] Cross-module ownership statements match global resolved decisions.
