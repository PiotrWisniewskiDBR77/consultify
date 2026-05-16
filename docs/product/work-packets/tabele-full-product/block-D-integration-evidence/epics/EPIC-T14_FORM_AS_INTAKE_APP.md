# EPIC-T14 — Form-as-intake-app

**Block:** D
**Status:** `PLANNED`
**Spec source:** Consultify Table Studio specification, sections 5L, 7.
**Owner agent:** A (backend) + B (frontend)

---

## Goal

Any Tabele form becomes publishable as a JWT-tokenized public intake app. External users (no Consultify account) can submit; submissions land as `tp_records` rows with provenance source type `form_submission`.

## Acceptance criteria

- `Form` extended with `embed_target_table_id` (FK to `tp_tables`), `public_jwt_secret`, `field_allow_list TEXT[]`, `is_published BOOLEAN`.
- New endpoint `POST /api/table-platform/forms/:formId/publish` issues JWT secret, returns shareable URL with token.
- Public route `/public/forms/:token` renders form per `field_allow_list`; no auth required; CSRF-safe.
- Public submit endpoint `POST /api/public/forms/:token/submit`:
  - Verifies JWT (tenant_id, form_id, exp).
  - Validates submitted fields against `field_allow_list`.
  - Rate-limited 60 req/min per IP per token.
  - Creates record in `embed_target_table_id` with `tp_record_sources` row of type `form_submission`.
- Owner sees submitted records in their normal Tabele view, with source clearly labeled.
- "Create intake form" button in `TabeleView` opens dialog with field allow-list builder + publish.
- DBR77 styling for public form, organization branding.

## In scope

### Backend
- Migration: extend `tp_forms`.
- `FormIntakeService.ts` with `publishForm`, `unpublishForm`, `verifyToken`, `submitFromPublic`.
- Routes: `table-platform.form-intake.routes.ts` (admin-side), `table-platform.form-public.routes.ts` (public-side, mounted under `/api/public/forms/...` with no auth).
- Tests including JWT expiry, field allow-list, rate limit, cross-tenant.

### Frontend
- `CreateIntakeFormDialog.tsx` with field allow-list builder.
- `IntakeFormPreview.tsx`.
- `PublicIntakeForm.tsx` at `/public/forms/:token` (separate route bundle, no auth, no app shell).
- Wiring in `TabeleView` and `KimiWorkspaceShell`.

## Out of scope

- Multi-step forms (out of program).
- File upload in intake forms (separate program; needs storage policies).

## Security model

- Token claims: `{tenant_id, form_id, iat, exp, scope: 'public_submit'}`.
- Token rotation: re-publish issues new secret; old token invalidated.
- Field allow-list: server-side enforced; non-listed field in payload → 400.
- Rate limit: 60/min/IP/token; 1000/day/token; 429 on excess.
- CSRF: form fetches a one-shot CSRF token on load; submission must include it.
- Audit: every public submission writes audit row with anonymized IP + user agent.

## Estimated effort

- S2 (1 day): backend service + migration + routes + tests.
- S4 (1.5 days): frontend admin dialog + public form + preview + tests.
