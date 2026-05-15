-- My Work (V2) — Decisions state tables (snooze + preferences)
-- Canonical API:
-- - server/src/routes/my-work.routes.ts  (queue, snooze, prefs)
-- - server/src/routes/pmo/decisions.routes.ts (remind)
--
-- Notes:
-- - These tables store per-user UI state and must exist before runtime.
-- - Use simple TEXT columns for cross-DB compatibility (SQLite/Postgres).
-- - Keep schema intentionally small; business data remains in `decisions`.

-- Per-user snooze state: hides a decision from queue/list until a timestamp.
CREATE TABLE IF NOT EXISTS my_work_decision_snoozes (
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  decision_id TEXT NOT NULL,
  snoozed_until TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, organization_id, decision_id)
);

CREATE INDEX IF NOT EXISTS idx_my_work_decision_snoozes_user_org_until
  ON my_work_decision_snoozes(user_id, organization_id, snoozed_until);
CREATE INDEX IF NOT EXISTS idx_my_work_decision_snoozes_decision_id
  ON my_work_decision_snoozes(decision_id);

-- Per-user preferences for Decisions UI (saved views, defaults, columns).
CREATE TABLE IF NOT EXISTS my_work_decision_prefs (
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  prefs_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_my_work_decision_prefs_user_org
  ON my_work_decision_prefs(user_id, organization_id);

