---
module_id: MODULE_SETTINGS
doc_kind: BEHAVIOR
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Behavior — Ustawienia

## As-Is Runtime Behavior (Audited 2026-05-11)

- `/settings/*` is mounted and protected by auth guard (`requireAuth=true`).
- `/admin/*` and `/superadmin/*` are mounted as separate route trees with explicit role guards (`ADMIN`, `SUPERADMIN`).
- Sidebar launcher for settings resolves to `SETTINGS_PROFILE_MODULE` and nested settings sections stay under `/settings/*`.
- Settings includes explicit tenant/admin boundary cards (`tenant-defaults`, `tenant-branding`, `tenant-security`, `module-preferences`) with read-only provenance and handoff actions.

## Function Runtime Breakdown

- `SET_SETTINGS_WORKSPACE`: canonical settings runtime function on `/settings/*`.
- `SET_POLICY_BOUNDARY_LINKS`: explicit ownership boundary function for admin/policy-locked controls.

## Critical Claims (source -> decision -> evidence)

| Source | Decision | Evidence / NOT_DONE |
| --- | --- | --- |
| `AppRoutes.tsx` + `ProtectedRoute.tsx` | KEEP: settings is protected user surface | `/settings/*` wrapped in `ProtectedRoute requireAuth`; PASS |
| `AppRoutes.tsx` | KEEP: admin and superadmin are separate governance surfaces | `/admin/*` requires `ADMIN`; `/superadmin/*` requires `SUPERADMIN`; PASS |
| `routeConfig.ts` + `menuConfig.ts` | KEEP: launcher mapping remains consistent | `SETTINGS_PROFILE_MODULE` launcher and `/settings/*` app view mapping; PASS |
| `SettingsOwnershipPanels.tsx` | ENHANCE: admin handoff is explicit, superadmin handoff doctrine needs explicit contract text | admin handoff exists (`Open Admin Security`), superadmin handoff pattern NOT_DONE |
| `USER_AND_ADMIN_MEMORY_CONTROLS_V8.md` + `AIMemorySettings.tsx` | ENHANCE: current memory UX is partial against V8 controls | no explicit `private_mode` and per-item review/delete flow; NOT_DONE |
| `STAGE_1_5_ULTRA_DEEP_GAP_AUDIT_2026-05-11.md` | ENHANCE: API-wired AI privacy/prompt/voice must not be mislabeled as pure local stubs | FE+BE API evidence exists; E2E persistence proof NOT_DONE |

## Must

- MUST keep route/appview/sidebar mapping aligned across `menuConfig.ts`, `routeConfig.ts`, and `AppRoutes.tsx`.
- MUST preserve module ownership boundaries defined in global operating docs.
- MUST expose blocked/placeholder state honestly when runtime is not yet mounted.
- MUST keep settings as preference hub and not a second admin root.
- MUST preserve explicit admin/superadmin boundaries without ownership leaks.

## Must Not

- MUST NOT treat target-state RAW assumptions as current behavior.
- MUST NOT move ownership from canonical module boundaries documented in As-Is global docs.
- MUST NOT hide route aliasing or legacy surfaces from module contract narrative.
- MUST NOT implement hidden policy writes from settings for admin/superadmin-owned controls.

## Acceptance Criteria (Behavior)

- [x] Direct navigation to settings route resolves to documented runtime (`/settings/*`, auth-protected).
- [x] AppView-to-route mapping resolves to the settings owner module.
- [x] Admin and superadmin remain role-gated separate surfaces.
- [x] Stage 1.5 status taxonomy distinguishes `API_WIRED_NOT_E2E_PROVEN` from pure `stub`.
- [ ] Superadmin handoff doctrine from settings is explicit in runtime UX (docs-only gap, NOT_DONE).
- [ ] V8 memory control semantics are fully represented in runtime (NOT_DONE).
