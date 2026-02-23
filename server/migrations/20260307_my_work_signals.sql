-- T012 (V2) — My Work — Contextual Intelligence Feed (signals)

CREATE TABLE IF NOT EXISTS my_work_signal_prefs (
  user_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  muted_types_json TEXT NOT NULL DEFAULT '[]',
  quiet_hours_json TEXT NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS my_work_signal_snoozes (
  user_id TEXT NOT NULL,
  signal_key TEXT NOT NULL,
  snoozed_until TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, signal_key)
);

CREATE INDEX IF NOT EXISTS idx_my_work_signal_snoozes_until ON my_work_signal_snoozes(snoozed_until);

CREATE TABLE IF NOT EXISTS my_work_signal_dismissals (
  user_id TEXT NOT NULL,
  signal_key TEXT NOT NULL,
  dismissed_at TEXT NOT NULL,
  PRIMARY KEY (user_id, signal_key)
);

CREATE INDEX IF NOT EXISTS idx_my_work_signal_dismissals_at ON my_work_signal_dismissals(dismissed_at);

