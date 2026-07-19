-- RED-MISSING-TABLES (2026-07-19): dunning_notifications — re-express in Postgres dialect.
--
-- ROOT CAUSE: originally created by 029_dunning_system.sql.sql (double extension +
-- prefix 029) which the live runner (/^(7\d{2}|\d{8})_.*\.sql$/) never executes, and
-- it used SQLite-only DEFAULT (datetime('now')). Result on demo/parity:
--   * dunning_notifications — table missing -> 42P01 on dunning email logging
--     (server/src/services/dunningService.ts _sendDunningEmail).
--
-- ADDITIVE + IDEMPOTENT. Columns mirror the service INSERT
--   (id, organization_id, notification_type, email_to) + the legacy schema
--   (sent_at defaulted, metadata JSON text). FK omitted intentionally (additive/safe).

CREATE TABLE IF NOT EXISTS dunning_notifications (
  id                TEXT PRIMARY KEY,
  organization_id   TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  email_to          TEXT,
  metadata          TEXT
);

CREATE INDEX IF NOT EXISTS idx_dunning_notifications_org
  ON dunning_notifications(organization_id);
