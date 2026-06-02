-- My Work (V2) — State tables for Inbox triage + Focus board
-- Canonical API: server/src/routes/my-work.routes.ts
--
-- Notes:
-- - These tables store per-user UI state and should exist before runtime.
-- - Use simple TEXT columns for cross-DB compatibility (SQLite/Postgres).

-- Inbox triage state: hides already-processed inbox items per user
CREATE TABLE IF NOT EXISTS my_work_inbox_triage (
  user_id TEXT NOT NULL,
  item_key TEXT NOT NULL,
  action TEXT NOT NULL,
  params_json TEXT,
  triaged_at TEXT NOT NULL,
  PRIMARY KEY (user_id, item_key)
);

CREATE INDEX IF NOT EXISTS idx_my_work_inbox_triage_user_id ON my_work_inbox_triage(user_id);
CREATE INDEX IF NOT EXISTS idx_my_work_inbox_triage_item_key ON my_work_inbox_triage(item_key);
CREATE INDEX IF NOT EXISTS idx_my_work_inbox_triage_triaged_at ON my_work_inbox_triage(triaged_at);

-- Focus state: stores manual column/position for focus items per user+date
CREATE TABLE IF NOT EXISTS my_work_focus_state (
  user_id TEXT NOT NULL,
  focus_date TEXT NOT NULL,
  item_key TEXT NOT NULL,
  column_name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, focus_date, item_key)
);

CREATE INDEX IF NOT EXISTS idx_my_work_focus_state_user_date ON my_work_focus_state(user_id, focus_date);
CREATE INDEX IF NOT EXISTS idx_my_work_focus_state_user_date_column ON my_work_focus_state(user_id, focus_date, column_name);
CREATE INDEX IF NOT EXISTS idx_my_work_focus_state_updated_at ON my_work_focus_state(updated_at);

