# FEEDBACK-1 / 1d — owner-only role management

**Verdict: READY FOR CTO REVIEW.** Tenant ADMIN no longer sees or mounts the OWNER-only Roles & Permissions screen, so normal Admin navigation produces no forbidden `/api/security/roles` request.

- Base: `9ec5a9f32b`
- Branch: `codex/feedback-1-1d-admin-roles-20260916`
- Decision marker: `[ODMROZENIE 14_ADMIN DEC-575]`

## Behavior and authority

- DEC-2026-08-25-17 in `effectiveAccessService` explicitly reserves `admin.project_roles.manage` for OWNER; the server capability guard remains unchanged.
- ADMIN navigation filters the `roles-permissions` destination without mutating the shared navigation registry.
- An ADMIN direct link renders the existing owner-only state before `AdminRolesPermissionsPanel` mounts, so its mount-time GET does not run.
- OWNER and tenant-authorized SUPERADMIN retain the navigation destination and panel.
- The panel's own 403 handling remains as defense in depth.

## Evidence

- UI, panel, effective-access, and route families: `4 files / 124 tests PASS`, RC 0.
- ADMIN test proves the navigation button is absent and the panel is not mounted on a direct link.
- OWNER test proves the exact navigation button is present and the panel mounts.
- Backend tests preserve ADMIN deny and OWNER allow for `admin.project_roles.manage`.
- Front TypeScript on the same `node_modules`: line `RC=2, 169`; candidate `RC=2, 169`; delta 0.
- Server TypeScript on the same `node_modules`: line `RC=0, 0`; candidate `RC=0, 0`; delta 0; output logs contain completion markers.
- Prettier and `git diff --check`: PASS.
- Independent review: ACCEPT, `0 x P0`, `0 x P1`, `0 x P2`.

No staging write, deployment, Railway change, screenshot, or protected-ref push was performed.
