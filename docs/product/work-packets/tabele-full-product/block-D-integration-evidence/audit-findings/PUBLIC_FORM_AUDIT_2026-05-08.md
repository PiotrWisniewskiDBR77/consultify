# Public Form Audit — Block D / D-S0

**Date:** 2026-05-08
**Scope:** existing `/public/*` surface, JWT patterns, `FormService` public path, rate limits.

## What already exists

- **Slug-based public form router** (`publicFormRouter` in `table-platform.routes.ts`):
  - `GET  /api/table-platform/public/forms/:slug`
  - `POST /api/table-platform/public/forms/:slug/submit`
- **`FormService.submitForm(formId, data)`** — handles public submissions today; submission lands as `tp_records` rows.
- **`tp_forms` table** (`704_forms.sql`): `id`, `table_id`, `name`, `description`, `slug`, `is_published`, `config JSONB`, `submit_count`, `created_by`, timestamps.
- **JWT** (`jsonwebtoken`) is used elsewhere (e.g. `report-builder-public.routes.ts`) with `config.JWT_SECRET`.
- **Rate limiting** via `express-rate-limit` is mounted on `/api` globally; `tablePlatformLimiter` covers authenticated table-platform routes; `publicFormRouter` is **NOT** explicitly behind a stricter limiter today.
- **Frontend public form pages**: `/forms/:slug` → `PublicFormPage`. No JWT route yet.

## Gaps Block D must close

1. **No JWT-tokenized intake.** Slugs are guessable / discoverable; consultants need the option of a per-recipient signed link with hard expiry.
2. **No field-allow-list.** Today's submission accepts whatever fields the form config exposes. Block D adds an explicit allow-list in `tp_forms.field_allow_list` to prevent over-collection.
3. **No public rate limit** specifically on form submission. Block D wires `expressRateLimit` with conservative defaults (10 submissions / IP / minute, 100 / hour).
4. **No provenance tag on form submissions** linking back to the form. Block D ensures `tp_record_sources` (Block B) gets a `{ type: 'form_submission', source_ref: form_id }` row on every public submit.

## CTO decision: parallel JWT route, not a slug-replacement

| Option | Decision |
|---|---|
| Replace slug-based router with JWT-only. | **Rejected** — breaks existing share links. |
| **Add a parallel JWT route alongside the slug route.** | **Accepted** — `POST /api/table-platform/public/forms/jwt/:token/submit`. Slug router stays as-is for backward compatibility; new consultants get the JWT URL by default. |

## Migration

```sql
-- 20260513_block_d_form_intake.sql
ALTER TABLE tp_forms
  ADD COLUMN IF NOT EXISTS embed_target_table_id UUID NULL REFERENCES tp_tables(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS public_jwt_secret TEXT NULL,
  ADD COLUMN IF NOT EXISTS field_allow_list JSONB NULL,
  ADD COLUMN IF NOT EXISTS public_link_expires_at TIMESTAMPTZ NULL;
```

`embed_target_table_id` is intentionally optional; existing forms keep using `table_id`. Block D's intake-form workflow uses `embed_target_table_id` so the curator can decouple "where the form lives" from "where submissions land".

## Verdict

`GO`. Block D's form-intake stack is a thin wrapper over what already exists.
