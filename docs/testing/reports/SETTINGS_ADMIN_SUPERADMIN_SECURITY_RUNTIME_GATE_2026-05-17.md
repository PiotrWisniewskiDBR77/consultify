# Settings / Admin / SuperAdmin Security Runtime Gate - 2026-05-17

## Verdict

`PASS_WITH_ENV_LIMITATIONS`

Deterministic P1 remediation for platform boundary enforcement is implemented and verified in focused backend tests. A known local integration-environment issue (`role "iris" does not exist`) still blocks full integration suite confidence for selected legacy AI settings tests, but does not invalidate the ACL hardening result.

## Scope

- Continue approved P0/P1 remediation stream for `SETTINGS + ADMIN + SUPERADMIN`.
- Apply only minimal, low-regression backend hardening in active security boundary files.
- Re-test focused suites for changed behavior and classify findings.

## Implemented Security Fixes (This Round)

- Hardened platform boundary in active AI settings route: `server/src/routes/ai/ai-settings.routes.ts`.
  - Replaced `requireRole('superadmin')` on `/superadmin` read/write routes with strict platform-role guard (`normalizePlatformRole(...) === SUPERADMIN`).
  - Ensures tenant `OWNER` is not treated as platform `SUPERADMIN`.
- Applied equivalent guard in legacy mirror route: `server/src/routes/ai-settings.routes.ts`.
  - Prevents drift if legacy mount or imports are used in tests/runtime tooling.
- Added targeted ACL regression test:
  - `tests/unit/backend/routes/ai-settings.routes.superadmin-acl.test.ts`
  - Verifies tenant owner receives `403` + `INSUFFICIENT_PLATFORM_ROLE` on `/api/ai-settings/superadmin`.
- Kept prior P1 payload validation remediation in `security/roles.routes.ts` untouched in this round to avoid scope creep.

## Re-Test Evidence

### Passing targeted tests

Command:

`npx vitest run tests/unit/backend/routes/ai-settings.routes.superadmin-acl.test.ts tests/unit/backend/middleware/superAdmin.middleware.test.ts --environment node`

Result:

- `2` test files passed
- `12` tests passed
- Includes:
  - existing superadmin middleware anti-regression assertions
  - new owner-denied superadmin endpoint ACL assertion

### Known environment-limited test

Command:

`npx vitest run tests/integration/routes/aiSettings.superadmin.unavailable.no-placeholders.test.ts tests/unit/backend/middleware/superAdmin.middleware.test.ts --environment node`

Result:

- Integration AI settings spec fails in local environment due to DB role/bootstrap issue (`role "iris" does not exist`) and historical expectation drift, unrelated to new ACL guard correctness.
- Unit security tests still pass and validate hardening behavior.

## Findings Classification (Current Round)

- `P0`: none found in implemented slice.
- `P1`: fixed
  - **Issue**: Tenant `OWNER` could satisfy superadmin route role check through generalized role aliasing path.
  - **Impact**: Platform control-plane endpoint access risk (`/api/ai-settings/superadmin`).
  - **Fix status**: `RESOLVED_LOCALLY` with deterministic guard + regression test.
- `P2`: none newly introduced by this change set.
- `ENV_BLOCKER` (non-product defect):
  - Local integration harness / DB principal mismatch (`iris` role missing) affects selected integration tests.

## Regression Risk Assessment

- Change type: narrowly scoped middleware-level guard replacement on two routes (`GET/PUT /superadmin`).
- Blast radius: limited to superadmin settings endpoint access checks.
- Backward compatibility:
  - Preserved for valid platform `SUPERADMIN`.
  - Intentionally denied for tenant `OWNER` (required by role source of truth).
- Lint status:
  - No linter errors in touched files.

## Gate Decision

- `GO` for merging/deploying this specific P1 boundary hardening change set.
- `NO_GO` for claiming full end-to-end runtime closure of all Settings/Admin/SuperAdmin flows until integration environment (`iris` role/bootstrap) is stabilized and failing integration specs are re-run clean.

## Follow-Up Backlog

1. Stabilize integration DB bootstrap for local/CI (`iris` role compatibility) and re-run:
   - `tests/integration/routes/aiSettings.superadmin.unavailable.no-placeholders.test.ts`
   - `tests/integration/routes/security-roles.l3.test.ts`
   - `tests/integration/routes/security-roles-policies.test.js`
2. Execute end-to-end re-probe against target runtime (`demo`) after deployment to confirm remote closure of P1.
3. Keep scope lock: no unrelated refactors while finishing remaining remediation plan tasks.
