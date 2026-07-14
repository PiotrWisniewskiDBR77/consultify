-- Block D — Form Intake Hardening (EPIC-T14 · Sprint D-S2)
-- Adds:
--   * tp_forms.embed_target_table_id   — optional override of the submission
--                                        target table (Q17). When NULL, the
--                                        existing `table_id` is used so the
--                                        public router stays backward-compatible.
--   * tp_forms.public_jwt_secret       — per-form HMAC secret used to sign
--                                        per-recipient links. NULL means the
--                                        form has not been upgraded to JWT
--                                        intake; the slug router still works.
--   * tp_forms.field_allow_list        — JSONB array of field IDs the public
--                                        submission path is allowed to write.
--                                        NULL means "fall back to the form's
--                                        own config.fields" (existing behavior).
--   * tp_forms.public_link_expires_at  — optional hard expiry for the JWT
--                                        intake URL. Slug links are not
--                                        affected.
--   * tp_form_submissions              — append-only audit ledger for every
--                                        submission (slug OR jwt). The actual
--                                        record is stored in `tp_records` as
--                                        before; this row is the audit trail
--                                        the consulting team can replay.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT EXISTS.
-- Reversal:   server/migrations/rollback/20260513_block_d_form_intake.down.sql
--
-- CTO decisions:
--   - 00_CTO_DECISIONS.md Q17 (parallel JWT route alongside slug route; do
--     NOT replace the slug router; field allow-list + public rate limit
--     ship together).
--
-- Spec:
--   tabele-full-product/block-D-integration-evidence/audit-findings/
--     PUBLIC_FORM_AUDIT_2026-05-08.md

BEGIN;

-- FRESH-DB GUARD (2026-07-14): tp_forms is created by 704_forms.sql and
-- tp_tables by 700_table_platform_foundation.sql — both sort AFTER this file
-- on a fresh replay. The whole body is guarded on table existence; 704
-- re-applies this DDL idempotently, so the final schema is identical.
DO $mig20260513$
BEGIN
IF to_regclass('public.tp_forms') IS NOT NULL
   AND to_regclass('public.tp_tables') IS NOT NULL THEN

ALTER TABLE tp_forms
  ADD COLUMN IF NOT EXISTS embed_target_table_id  UUID         NULL
    REFERENCES tp_tables(id) ON DELETE SET NULL;
ALTER TABLE tp_forms
  ADD COLUMN IF NOT EXISTS public_jwt_secret      TEXT         NULL;
ALTER TABLE tp_forms
  ADD COLUMN IF NOT EXISTS field_allow_list       JSONB        NULL;
ALTER TABLE tp_forms
  ADD COLUMN IF NOT EXISTS public_link_expires_at TIMESTAMPTZ  NULL;

CREATE INDEX IF NOT EXISTS idx_tp_forms_embed_target
  ON tp_forms(embed_target_table_id) WHERE embed_target_table_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS tp_form_submissions (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id         UUID         NOT NULL REFERENCES tp_forms(id) ON DELETE CASCADE,
  table_id        UUID         NOT NULL REFERENCES tp_tables(id) ON DELETE CASCADE,
  record_id       UUID         NULL,
  submitted_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  intake_kind     TEXT         NOT NULL,
  jwt_subject     TEXT         NULL,
  client_ip_hash  TEXT         NULL,
  status          TEXT         NOT NULL,
  failure_reason  TEXT         NULL,

  CONSTRAINT tp_form_submissions_intake_kind_check
    CHECK (intake_kind IN ('slug','jwt')),
  CONSTRAINT tp_form_submissions_status_check
    CHECK (status IN ('accepted','rejected','rate_limited'))
);

CREATE INDEX IF NOT EXISTS idx_tp_form_submissions_form
  ON tp_form_submissions(form_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_tp_form_submissions_table
  ON tp_form_submissions(table_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_tp_form_submissions_jwt_subject
  ON tp_form_submissions(jwt_subject) WHERE jwt_subject IS NOT NULL;

END IF;
END
$mig20260513$;

COMMIT;
