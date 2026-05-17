# Function Card — SET_POLICY_BOUNDARY_LINKS

## Identity

- Function ID: `SET_POLICY_BOUNDARY_LINKS`
- Boundary: settings user writes vs admin/superadmin policy ownership
- Runtime anchors: `SettingsOwnershipPanels`, route guards
- Feature state: `partial`

## Job

Make ownership boundaries explicit in settings through read-only policy views and handoff links; prevent hidden permission or ownership leaks.

## Boundaries

- In:
  - read-only policy visibility
  - explicit handoff links to owner surfaces
  - safe ownership messaging
- Out:
  - direct policy writes for admin/superadmin domains
  - hidden capability disclosure

## Critical Claim Chain

| Source | Decision | Evidence / NOT_DONE |
| --- | --- | --- |
| `SettingsOwnershipPanels.tsx` | keep explicit handoff to organization/admin owner surfaces | PASS |
| `AppRoutes.tsx` + `ProtectedRoute.tsx` | keep admin/superadmin role-gated ownership routes | PASS |
| `server/src/routes/settings.routes.ts` | keep legacy settings root restricted to platform scope | PASS |
| hard rule + deep audit | add explicit superadmin handoff doctrine in settings contract | NOT_DONE |
| Stage 1.5 audit | no direct admin/superadmin policy writes through settings | PASS_WITH_NOT_DONE for E2E proof |

## Acceptance

- [x] Admin handoff exists for tenant-security ownership boundary.
- [x] Route-level admin/superadmin segregation is enforced.
- [x] Legacy system settings root is not a normal user settings path.
- [ ] Superadmin handoff pattern in settings UX is explicit and role-safe (`NOT_DONE`).
- [ ] E2E evidence verifies no hidden policy mutation through settings (`NOT_DONE`).
