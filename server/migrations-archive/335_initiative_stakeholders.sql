-- Migration 335: Initiative Stakeholders (RACI + Roles)
-- Safe, minimal schema (non-destructive).
-- If a richer schema already exists, this migration is a no-op.

CREATE TABLE IF NOT EXISTS initiative_stakeholders (
  id TEXT PRIMARY KEY,
  initiative_id TEXT NOT NULL,
  user_id TEXT,
  external_name TEXT,
  external_email TEXT,
  role TEXT,
  raci_type TEXT CHECK(raci_type IN ('R', 'A', 'C', 'I')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT,
  FOREIGN KEY (initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_initiative_stakeholders_initiative ON initiative_stakeholders(initiative_id);
CREATE INDEX IF NOT EXISTS idx_initiative_stakeholders_user ON initiative_stakeholders(user_id);
CREATE INDEX IF NOT EXISTS idx_initiative_stakeholders_raci ON initiative_stakeholders(raci_type);

