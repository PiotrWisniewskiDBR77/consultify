---
module_id: MODULE_ADMIN_PANEL
doc_kind: TESTS
version: 2.0
owner: user
status: canonical
last_updated: 2026-05-11
---

# Acceptance & Tests — Panel Administratora

## Scope Of Verification (As-Is)

- Verify sidebar -> AppView -> route -> rendered component chain.
- Verify ownership/alias statements against `menuConfig.ts`, `routeConfig.ts`, `AppRoutes.tsx`.
- Verify role/guard behavior where module is protected.

## Required Checks

- [x] Route opens documented runtime exactly as specified (`/admin/*` -> `AdminView`).
- [x] AppView enum and route mapping are consistent for launcher and aliases.
- [x] Ownership split statements are aligned with cross-SOT decisions and inventory.
- [ ] Role-boundary hard split is runtime-proven (`NOT_DONE` while `ADM-RAW-P0-001` remains open).
- [ ] High-risk write audit evidence is captured in module-local runtime packet (`NOT_DONE`).
- [ ] ACL regression packet exists for owner/admin/member/guest denied paths (`NOT_DONE`).

## Current Gate Expectation

- Expected gate result today: `NEEDS_OWNER_DECISION`.
- Reason: P0 boundary contradiction (`ADM-RAW-P0-001`) blocks docs verdict upgrade.

## Function-Level Acceptance Matrix

| Function | Acceptance focus | Runtime/code evidence | Status |
| --- | --- | --- | --- |
| `ADM_ADMIN_WORKSPACE` | Protected admin runtime is mounted and aliases are explicit | `AppRoutes.tsx` + `AdminView` + `AdminSettingsModule` + `routeConfig.ts` | `PASS_WITH_P1` |
| `ADM_SUPERADMIN_BOUNDARY` | Admin vs superadmin boundary is explicit and enforced | `/admin/*` vs `/superadmin/*` route guards + `ProtectedRoute.tsx` hierarchy | `BLOCKED_P0` (`ADM-RAW-P0-001`) |

## Evidence Ledger (source -> decision -> evidence/NOT_DONE)

| Claim ID | Claim | Source | Decision | Evidence |
| --- | --- | --- | --- | --- |
| `ADM-EV-001` | admin route entrypoint is real | route tree | `KEEP` | `AppRoutes.tsx`, `menuConfig.ts`, `routeConfig.ts` |
| `ADM-EV-002` | settings is separate ownership plane | cross-SOT + runtime | `KEEP` | `FINAL_IMPLEMENTATION_PLAN_32_ADMIN_2026-03-29.md`, `SettingsView.tsx` |
| `ADM-EV-003` | superadmin is separate platform plane | superadmin SSOT + runtime | `KEEP` | `SUPERADMIN_V8_SSOT.md`, `SuperAdminView.tsx` |
| `ADM-EV-004` | no role escalation between admin and superadmin | security doctrine | `DEFER` | `NOT_DONE` (`ProtectedRoute` hierarchy permits superadmin on admin guard) |
| `ADM-EV-005` | all high-risk writes have runtime audit proof | P32 contract requirement | `ENHANCE` | `NOT_DONE` (module-local evidence missing) |

## Evidence Pointers

- `src/components/navigation/Sidebar/menuConfig.ts`
- `src/routes/routeConfig.ts`
- `src/routes/AppRoutes.tsx`
- `src/types/core.ts`
- `src/components/ProtectedRoute.tsx`
- `src/views/admin/AdminSettingsModule.tsx`
- `src/views/SettingsView.tsx`
- `src/views/superadmin/SuperAdminView.tsx`
