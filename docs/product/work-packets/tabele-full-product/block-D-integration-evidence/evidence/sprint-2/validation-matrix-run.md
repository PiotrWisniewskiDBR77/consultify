# D-S2 — Validation Matrix Run

**Date:** 2026-05-08
**Verdict:** `GO` — D-S3 may proceed.
**Feature flag posture:** `ENABLE_TABLE_FORM_INTAKE_JWT = false` (default off; existing slug-based public router is unaffected).

## Layered validation

| Layer | Check | Result | Evidence |
|---|---|---|---|
| L1 | TypeScript strict compile (`server/tsconfig.json`) | PASS | `npx tsc --noEmit -p server/tsconfig.json` — zero errors. |
| L1 | ESLint on new + modified files | PASS (warnings only) | `npx eslint --fix` left 14 conventional warnings (test-file `non-null-assertion` + a few `any` casts in mocks). |
| L2 | Backend unit tests (D-S2) | PASS — 21/21 | `FormIntakeService.test.ts` |
| L2 | Combined D-S1 + D-S2 | PASS — 40/40 | Same test run. |
| L2 | Block C regression | PASS — 51/51 | `npx vitest run … TableQaService SourcePackBuilderService AiUsageService` |
| L3 | Frontend component tests | N/A — no UI shipped in D-S2 (per sprint plan) | UI lands in D-S4. |
| L4 | Migration replay on staging | DEFERRED to D-S5 dogfood | Migration is additive (new columns + new table) and idempotent. |
| L5 | Cross-tenant ACL | PASS | `getFormForAdmin` refuses `TENANT_VIOLATION`; `setFieldAllowList` inherits ACL via the same helper. |
| L5 | JWT verification | PASS | Tests cover happy path, malformed token (`TOKEN_INVALID`), unpublished form (`FORM_NOT_PUBLISHED`), missing secret (`JWT_NOT_ENABLED`), past hard expiry (`TOKEN_EXPIRED`). |
| L5 | Public submission rate limit | PASS | Service-layer limiter tested via `__setRateLimiterForTesting`; route layer adds `express-rate-limit` (30/min/IP). |
| L5 | Field allow-list filter | PASS | Drops keys outside the allow-list before delegating to `FormService.submitForm`. Empty/invalid entries rejected. |
| L6 | DBR77 hex scan | N/A | No new UI in D-S2. |
| L7 | Audit ledger lifecycle (`accepted` / `rejected` / `rate_limited`) | PASS | Tested for happy path, `FormService` throw, rate-limit refusal. |
| L8 | Public path provenance | PASS | Every accepted submission writes a `tp_form_submissions` row regardless of intake kind (slug or jwt). |

## Test inventory

21 tests in `FormIntakeService.test.ts`:

1. `getFormForAdmin` rejects empty inputs (2 sub-cases).
2. `getFormForAdmin` returns 404 when the form is missing.
3. `getFormForAdmin` refuses cross-tenant forms.
4. `getFormForAdmin` returns intake context including `embed_target_table_id` when set.
5. `issueJwtLink` rejects empty subject / formId / org.
6. `issueJwtLink` issues a token and `verifyJwt` round-trip succeeds.
7. `verifyJwt` refuses tokens whose JWT decoding fails.
8. `verifyJwt` refuses tokens for unpublished forms.
9. `verifyJwt` refuses tokens whose form has no JWT secret.
10. `verifyJwt` refuses tokens once the form `public_link_expires_at` has passed.
11. `submitFromPublic` rejects empty inputs.
12. `submitFromPublic` captures rate-limit refusal as `status='rate_limited'`.
13. `submitFromPublic` applies the field allow-list before delegating to `FormService`.
14. `submitFromPublic` captures `FormService` errors as `status='rejected'` with reason.
15. `submitFromPublic` returns 403 when the form is not published.
16. `setFieldAllowList` rejects non-array values that are not null.
17. `setFieldAllowList` rejects allow lists with empty entries.
18. `setFieldAllowList` persists null to fall back to `form.config.fields`.
19. `setFieldAllowList` persists a deduplicated allow list.
20. `setFieldAllowList` refuses cross-tenant updates.
21. `hashClientIp` is deterministic and varies with input.

## Files shipped

### Created

- `server/migrations/20260513_block_d_form_intake.sql`
- `server/migrations/rollback/20260513_block_d_form_intake.down.sql`
- `server/src/services/tablePlatform/FormIntakeService.ts`
- `server/src/routes/table-platform.form-intake.routes.ts`
- `server/src/routes/table-platform.form-public.routes.ts`
- `server/src/services/tablePlatform/__tests__/FormIntakeService.test.ts`

### Modified

- `server/src/config/FeatureFlags.ts` — `ENABLE_TABLE_FORM_INTAKE_JWT` (default `false`).
- `server/src/routes/index.ts` — re-export `tablePlatformFormIntakeRoutes`, `tablePlatformFormPublicRoutes`.
- `server/src/Gateway.ts` — mount both new routers on `/api/table-platform`. Public router mounted before `publicFormRouter` so the slug-based path keeps its precedence on `/public/forms/:slug`.
- `server/src/services/tablePlatform/index.ts` — re-export `FormIntakeService` + types.

## Sprint Exit Gate

- [x] Public route mounted on `/api/table-platform/public/forms/jwt/:token` (no auth middleware).
- [x] All security tests green: JWT expiry, allow-list, rate limit, cross-tenant.
- [x] Cross-tenant 403 on admin endpoints.
- [x] Audit log on every public submission (accepted / rejected / rate-limited).
- [x] Recommendation: `GO` to D-S3.
