-- 704_forms.sql — Form builder for Table Platform
-- Creates public-facing forms linked to tp_tables

CREATE TABLE IF NOT EXISTS tp_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES tp_tables(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  slug TEXT NOT NULL UNIQUE,
  is_published BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}',
  submit_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tp_forms_table ON tp_forms(table_id);
CREATE INDEX IF NOT EXISTS idx_tp_forms_slug ON tp_forms(slug);

-- =====================================================================
-- FRESH-DB PARITY (2026-07-14)
-- 20260513_block_d_form_intake.sql sorts BEFORE this file on a fresh replay,
-- so its DDL is skipped (guarded on table existence). Re-apply it here
-- idempotently so the final schema matches staging/prod. No-op wherever the
-- objects already exist; this file is never re-run on already-migrated DBs.
-- =====================================================================

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
