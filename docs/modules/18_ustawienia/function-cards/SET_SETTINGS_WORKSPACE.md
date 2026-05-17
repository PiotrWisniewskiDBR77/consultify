# Function Card — SET_SETTINGS_WORKSPACE

## Identity

- Function ID: `SET_SETTINGS_WORKSPACE`
- Route: `/settings/*`
- Runtime owner: `SettingsView`
- Module owner: `MODULE_SETTINGS`

## Job

Provide one user/workspace preference hub with explicit provenance and clear save/read-back feedback.

## Boundaries

- In:
  - user preferences
  - profile
  - user-level AI/notifications/integrations/security preferences
- Out:
  - tenant policy writes owned by admin/superadmin
  - hidden governance mutations

## Critical Claim Chain

| Source | Decision | Evidence / NOT_DONE |
| --- | --- | --- |
| `AppRoutes.tsx` + `ProtectedRoute.tsx` | keep settings auth-protected and user-scoped | PASS |
| `routeConfig.ts` + `menuConfig.ts` | keep launcher and route mapping coherent | PASS |
| `settings.api.ts` + `settings.routes.ts` | AI privacy/prompt/voice are API-wired but still require persistence proof | PASS_WITH_NOT_DONE |
| `USER_AND_ADMIN_MEMORY_CONTROLS_V8.md` + runtime components | memory semantics currently partial vs target | NOT_DONE |
| Stage 1.5 audit | use `APPROVED_FOR_DOCS_WITH_RUNTIME_NOT_DONE` until runtime evidence closes | PASS |

## Acceptance

- [x] Route mounted and protected.
- [x] Settings remains separate from admin/superadmin surfaces.
- [x] API-wired settings rows are distinguished from pure local stubs.
- [ ] E2E persistence evidence for API-wired AI settings (`NOT_DONE`).
- [ ] Full V8 user memory control semantics mapped in runtime (`NOT_DONE`).
