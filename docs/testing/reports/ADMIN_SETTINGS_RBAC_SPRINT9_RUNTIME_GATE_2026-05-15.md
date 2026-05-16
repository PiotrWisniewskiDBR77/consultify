# Admin / Settings / RBAC Sprint 9 Runtime Gate - 2026-05-15

## Verdict

`PASS_WITH_DOCS_CANON_FOLLOWUP`

Sprint 9 closes the developer-side Admin, Settings, RBAC denied-state UX, and governance controls gate. Backend RBAC/settings/admin routes pass, local L4 admin and role sweeps pass, and staging admin/settings routes render with protected APIs auth-gated.

Sprint 10 still owns documentation canon promotion and status-frontmatter cleanup.

## Scope

- Admin, Settings, Superadmin route readiness.
- RBAC middleware and permission middleware.
- Effective access capability checks.
- Settings registry and governed integration configuration continuity.
- Admin P32 governance controls.
- Non-admin denied-state API boundaries for decisions, PMO roles, security roles, access-control codes, IAM-protected routes, invalid tokens, and org isolation.

## Fixes Applied

The first Sprint 9 run exposed contract drift, not a runtime guard bypass:

- Jira governed settings config now requires `cloud_id`; the settings route test still expected only `site_url`, `client_id`, and `client_secret`.
- Test-support bootstrap now returns canonical `ADMINISTRATOR` for admin personas in some auth surfaces; the L4 role sweeps expected only `ADMIN`.
- The Role Builder admin positive/negative control needed to allow the current capability policy while still proving users/guests are denied and admin is authenticated.

The tests were updated to match the current source of truth without weakening non-admin denied-state assertions.

## Validation Evidence

- Sprint 9 backend pack -> `128/128 PASS`
  - `tests/unit/backend/middleware/rbac.middleware.test.ts`
  - `tests/unit/backend/middleware/permissionMiddleware.test.ts`
  - `tests/unit/backend/middleware/admin.middleware.test.ts`
  - `tests/unit/backend/middleware/superAdmin.middleware.test.ts`
  - `tests/unit/backend/services/effectiveAccessService.test.ts`
  - `server/src/routes/__tests__/settings.routes.test.ts`
  - `server/src/routes/v8/__tests__/admin.routes.test.ts`
  - `server/src/routes/__tests__/adminP32.routes.test.ts`
- Local L4 admin/RBAC UI and API gates -> `62/62 PASS`
  - `tests/e2e/smoke/admin-settings-superadmin-readiness.spec.ts`
  - `tests/e2e/smoke/role-workflow-admin-sweep.spec.ts`
  - `tests/e2e/smoke/non-admin-role-enforcement.spec.ts`
- `ReadLints` for changed test files -> no linter errors

## Staging Route/API Probe

Target: `https://demo.consultify.ai`

- `GET /settings/profile` -> `200`
- `GET /settings/security` -> `200`
- `GET /settings/auth-access` -> `200`
- `GET /settings/connected-apps` -> `200`
- `GET /settings/tenant-defaults` -> `200`
- `GET /admin/overview` -> `200`
- `GET /admin/security` -> `200`
- `GET /admin/audit` -> `200`
- `GET /superadmin/security` -> `200`
- `GET /api/settings/registry` unauthenticated -> `401 No token provided`
- `GET /api/settings/integrations` unauthenticated -> `401 No token provided`
- `GET /api/rbac/roles` unauthenticated -> `401 No token provided`
- `GET /api/security/roles` unauthenticated -> `401 No token provided`
- `GET /api/admin/p32/overview` unauthenticated -> `401 No token provided`
- `GET /api/v8/admin/flags` unauthenticated -> `401 No token provided`

The probe confirms admin/settings shells render and governance APIs remain protected.

## Remaining Risk

- Sprint 10 must still promote/canonicalize documentation and fix module status drift.
- The production build was started after Sprint 9 but manually backgrounded before a final result was captured. Sprint 9 changed test contracts and documentation evidence, not runtime source; the latest completed production build evidence remains from Sprint 8.
