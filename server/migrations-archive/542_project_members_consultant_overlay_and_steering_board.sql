-- ============================================
-- Project membership canon + consultant overlay + Steering Board
-- ============================================
-- Date: 2026-02-15
--
-- Extends the canonical `project_members` table (created in 042_pmo_roles_workstreams)
-- and adds optional Steering Board tables.
--
-- NOTE:
-- - SQLite uses INTEGER (0/1) for boolean.
-- - `project_role` stays TEXT for backwards compatibility, but SHOULD contain
--   canonical roles defined in docs/product/PROJECT_ROLES_AND_GOVERNANCE.md.
-- ============================================

-- 1) Extend project_members with invoked roles + consultant overlay fields
ALTER TABLE project_members ADD COLUMN is_invoked INTEGER NOT NULL DEFAULT 0;

ALTER TABLE project_members ADD COLUMN consultant_profile TEXT NOT NULL DEFAULT 'NONE';
-- Values: NONE | EXTERNAL | PARTNER | INTERNAL

ALTER TABLE project_members ADD COLUMN engagement_type TEXT NOT NULL DEFAULT 'INTERNAL';
-- Values: INTERNAL | INVITED_BY_CLIENT | CONSULTANT_LED_ONBOARDING

ALTER TABLE project_members ADD COLUMN acting_org_id TEXT;
-- Reserved for partner multi-tenant scenarios (optional)

-- Backfill: legacy role CONSULTANT -> consultant overlay (v1 default)
UPDATE project_members
SET consultant_profile = 'EXTERNAL', engagement_type = 'INVITED_BY_CLIENT'
WHERE UPPER(project_role) = 'CONSULTANT';

CREATE INDEX IF NOT EXISTS idx_project_members_invoked ON project_members(is_invoked);
CREATE INDEX IF NOT EXISTS idx_project_members_consultant_profile ON project_members(consultant_profile);

-- 2) Optional Steering Board tables
CREATE TABLE IF NOT EXISTS project_steering_board (
  project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 0,

  -- quorum rules (simple text policy for v1; can be extended later)
  quorum_rule TEXT DEFAULT 'SIMPLE_MAJORITY',

  -- SLA for decision response time
  sla_hours INTEGER DEFAULT 72,

  created_by_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_project_steering_board_enabled ON project_steering_board(enabled);

CREATE TABLE IF NOT EXISTS project_steering_board_members (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- member_type: BOARD_MEMBER | CHAIR | OBSERVER
  member_type TEXT NOT NULL DEFAULT 'BOARD_MEMBER',

  -- notification preferences (v1)
  notify_decision_requests INTEGER NOT NULL DEFAULT 1,
  notify_escalations INTEGER NOT NULL DEFAULT 1,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_steering_board_members_project ON project_steering_board_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_steering_board_members_user ON project_steering_board_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_steering_board_members_type ON project_steering_board_members(member_type);

