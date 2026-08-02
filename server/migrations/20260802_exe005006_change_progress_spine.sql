-- EXE-05/06 change + progress spine — canonical lifecycle for progress
-- updates, reforecast (with reason/actor/org), and change/decision
-- create-or-link, all audited into the existing `initiative_history`
-- table and made retry-safe via idempotency_key.
--
-- Reconciliation note (same reasoning as 20260801_exe002004_idempotency_keys.sql):
-- a fresh acceptance database can be missing `initiative_history` entirely
-- because its historical DDL lives in baseline/never-ran migrations. Keep
-- this additive, replay-safe, and self-contained.

CREATE TABLE IF NOT EXISTS initiative_history (
  id TEXT PRIMARY KEY,
  initiative_id TEXT NOT NULL,
  action TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by TEXT NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_initiative_history_initiative ON initiative_history(initiative_id);
CREATE INDEX IF NOT EXISTS idx_initiative_history_action ON initiative_history(action);

-- Defensive reconciliation for columns EXE-06 reads/writes on `initiatives`
-- (already present on an up-to-date DB; additive no-op there).
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS forecast_start_date DATE;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS forecast_end_date DATE;

-- Idempotent-retry support, reusing the same client-supplied-key pattern
-- as 20260801_exe002004_idempotency_keys.sql. Each table's uniqueness is
-- scoped to what actually needs de-duplication:
--   initiative_history: (initiative_id, action, idempotency_key) — several
--     distinct action types (progress_updated, reforecast, change_created,
--     change_linked) share this one audit table; scope by action too so a
--     progress-update key can never collide with a same-request change-link key.
--   decisions: (initiative_id, idempotency_key) — EXE-05 create-path only;
--     the frozen DecisionController.ts writer does not use this column.
--   execution_audit_log: (initiative_id, field_changed, idempotency_key) —
--     guards the pre-existing `replan` intervention against duplicate
--     audit rows on retry.
ALTER TABLE initiative_history ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_initiative_history_idempotency
  ON initiative_history(initiative_id, action, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE decisions ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_decisions_idempotency
  ON decisions(initiative_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE execution_audit_log ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_execution_audit_log_idempotency
  ON execution_audit_log(initiative_id, field_changed, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
