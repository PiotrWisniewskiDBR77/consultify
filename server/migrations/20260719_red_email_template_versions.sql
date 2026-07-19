-- RED-MISSING-TABLES (2026-07-19): email_template_versions — re-express in Postgres dialect.
--
-- ROOT CAUSE: the live migration runner (/^(7\d{2}|\d{8})_.*\.sql$/) never created this
-- table (its defining migration was outside the executed range / SQLite dialect). Result
-- on demo/parity:
--   * email_template_versions — table missing -> 42P01 on email template create/update
--     versioning and version-history read
--     (server/src/routes/content/email-templates.routes.ts).
--
-- ADDITIVE + IDEMPOTENT. Columns mirror the route SQL:
--   INSERT (id, template_id, version, template_key, name, subject, html_content,
--           text_content, variables_schema, changed_by, change_type,
--           status_at_version, created_at);
--   version-history SELECT additionally reads change_notes.

CREATE TABLE IF NOT EXISTS email_template_versions (
  id                TEXT PRIMARY KEY,
  template_id       TEXT NOT NULL,
  version           INTEGER NOT NULL,
  template_key      TEXT,
  name              TEXT,
  subject           TEXT,
  html_content      TEXT,
  text_content      TEXT,
  variables_schema  TEXT,
  changed_by        TEXT,
  change_type       TEXT,
  change_notes      TEXT,
  status_at_version TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_template_versions_template
  ON email_template_versions(template_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_template_versions_tpl_ver
  ON email_template_versions(template_id, version);
