-- Migration 334: Initiative Watchers
-- Minimal subscriber list for initiative notifications & collaboration

CREATE TABLE IF NOT EXISTS initiative_watchers (
  id TEXT PRIMARY KEY,
  initiative_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_initiative_watchers_unique ON initiative_watchers(initiative_id, user_id);
CREATE INDEX IF NOT EXISTS idx_initiative_watchers_initiative ON initiative_watchers(initiative_id);
CREATE INDEX IF NOT EXISTS idx_initiative_watchers_user ON initiative_watchers(user_id);

