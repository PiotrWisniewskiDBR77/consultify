-- Bundle 21 (T068) — Help onboarding playbooks + progress support
-- Notes:
-- - This repo runs both SQLite and Postgres; keep DDL compatible.
-- - help_events exists from baseline, but we extend it with playbook fields.

CREATE TABLE IF NOT EXISTS help_playbooks (
  id TEXT PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  title_key TEXT NOT NULL,
  description_key TEXT,
  target_role TEXT,
  target_org_type TEXT,
  priority INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS help_playbook_steps (
  id TEXT PRIMARY KEY,
  playbook_key TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  title_key TEXT NOT NULL,
  content_key TEXT NOT NULL,
  what_you_get_key TEXT,
  expected_time_minutes INTEGER,
  ui_target TEXT,
  action_type TEXT DEFAULT 'INFO',
  action_payload TEXT DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (playbook_key) REFERENCES help_playbooks(key) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_help_playbook_steps_playbook
  ON help_playbook_steps(playbook_key, step_order);

-- Ensure help_events exists (older DBs may not have baseline stub)
CREATE TABLE IF NOT EXISTS help_events (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  event_type TEXT,
  event_data TEXT DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Extend help_events for progress tracking (one-time migration)
ALTER TABLE help_events ADD COLUMN organization_id TEXT;
ALTER TABLE help_events ADD COLUMN playbook_key TEXT;
ALTER TABLE help_events ADD COLUMN step_id TEXT;
ALTER TABLE help_events ADD COLUMN route TEXT;

CREATE INDEX IF NOT EXISTS idx_help_events_user_playbook
  ON help_events(user_id, playbook_key, created_at);

