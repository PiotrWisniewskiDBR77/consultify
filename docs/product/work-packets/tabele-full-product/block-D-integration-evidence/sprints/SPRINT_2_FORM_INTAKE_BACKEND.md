# Sprint 2 — Form Intake Backend (Block D)

**Sprint ID:** `D-S2`
**Owner:** Agent A
**Status:** `EXECUTED — GO`
**Estimate:** ~1.5 days
**Epic:** EPIC-T14
**Closed:** 2026-05-08

## Goal

Ship `FormIntakeService`, public-form route module, JWT issue/verify, field allow-list, rate-limit, audit. Migration extends `tp_forms`.

## Pre-sprint risk check

D-S1 (public form data leak), D-S2 (JWT secret leak), D-T5 (form abuse).

## Deliverables

- Migration extends `tp_forms`.
- `FormIntakeService.ts` with full CRUD and JWT lifecycle.
- Routes: `table-platform.form-intake.routes.ts` (admin-side), `table-platform.form-public.routes.ts` (mounted at `/api/public/forms/...`).
- `FormService.ts` extended with `submitFromPublic` path.
- Tests covering JWT expiry, field allow-list, rate limit, cross-tenant, malformed token.

## Files

### Created
- `consultify/server/src/services/tablePlatform/FormIntakeService.ts`
- `consultify/server/src/routes/table-platform.form-intake.routes.ts`
- `consultify/server/src/routes/table-platform.form-public.routes.ts`
- Migration `2026_05_block_d_form_intake.sql`
- Tests.

### Updated
- `consultify/server/src/services/tablePlatform/FormService.ts` (add public submit path)
- `consultify/server/src/services/tablePlatform/index.ts`
- `consultify/server/src/index.ts` (mount routes)

## CTO decisions applied

- **Q17**: parallel JWT route alongside slug router. Slug router untouched; new route lives at `/api/table-platform/public/forms/jwt/:token`.

## Sprint Exit Gate

- [x] Public route mounted under `/api/table-platform/public/forms/jwt/...` (no auth middleware).
- [x] All security tests green: JWT expiry, allow-list, rate limit.
- [x] Cross-tenant 403 on admin endpoints.
- [x] Audit log on every public submission (accepted / rejected / rate-limited).
- [x] Recommendation: `GO` to D-S3.

## Outcome

`GO` to D-S3. See `evidence/sprint-2/validation-matrix-run.md`.
