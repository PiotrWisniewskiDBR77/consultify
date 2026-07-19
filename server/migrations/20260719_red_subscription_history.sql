-- RED-MISSING-TABLES (2026-07-19): subscription_history — re-express in Postgres dialect.
--
-- ROOT CAUSE: originally created by 029_dunning_system.sql.sql (double extension +
-- prefix 029) which the live runner (/^(7\d{2}|\d{8})_.*\.sql$/) never executes, and
-- it used SQLite-only DEFAULT (datetime('now')). Result on demo/parity:
--   * subscription_history — table missing -> 42P01 on plan-change logging
--     (server/src/services/dunningService.ts logSubscriptionHistory) and on churn
--     analytics (ChurnAnalyticsService.ts, SnapshotService.ts SELECT ... WHERE action).
--
-- ADDITIVE + IDEMPOTENT. Columns mirror the service INSERT
--   (id, organization_id, action, from_plan, to_plan, reason, performed_by) + the
--   legacy schema (metadata JSON text, created_at defaulted). FK omitted intentionally.

CREATE TABLE IF NOT EXISTS subscription_history (
  id               TEXT PRIMARY KEY,
  organization_id  TEXT NOT NULL,
  action           TEXT NOT NULL,
  from_plan        TEXT,
  to_plan          TEXT,
  reason           TEXT,
  performed_by     TEXT,
  metadata         TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_history_org
  ON subscription_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_action
  ON subscription_history(action);
