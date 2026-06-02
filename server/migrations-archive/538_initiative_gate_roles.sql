-- Migration 538: Initiative Gate Roles
-- Maps gate governance roles (PMO, Steering Committee, Sponsor, etc.)
-- to actual users per initiative. This is the bridge between
-- GATE_PERMISSIONS (which roles can approve) and actual users.
--
-- Used by: Gates workflow, CTA bar filtering, notifications

CREATE TABLE IF NOT EXISTS initiative_gate_roles (
  id TEXT PRIMARY KEY,
  initiative_id TEXT NOT NULL,
  gate_role TEXT NOT NULL,  -- PMO, STEERING_COMMITTEE, INITIATIVE_OWNER, SPONSOR, etc.
  user_id TEXT NOT NULL,
  assigned_by TEXT,
  assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_initiative_gate_roles_unique
  ON initiative_gate_roles(initiative_id, gate_role, user_id);

CREATE INDEX IF NOT EXISTS idx_initiative_gate_roles_initiative
  ON initiative_gate_roles(initiative_id);

CREATE INDEX IF NOT EXISTS idx_initiative_gate_roles_user
  ON initiative_gate_roles(user_id);

CREATE INDEX IF NOT EXISTS idx_initiative_gate_roles_role
  ON initiative_gate_roles(gate_role);
