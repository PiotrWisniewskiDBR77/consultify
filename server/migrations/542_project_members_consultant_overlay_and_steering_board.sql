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

CREATE TABLE IF NOT EXISTS workstreams (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  color TEXT DEFAULT '#3B82F6',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workstreams_project ON workstreams(project_id);
CREATE INDEX IF NOT EXISTS idx_workstreams_owner ON workstreams(owner_id);
CREATE INDEX IF NOT EXISTS idx_workstreams_status ON workstreams(status);

CREATE TABLE IF NOT EXISTS project_members (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_role TEXT NOT NULL DEFAULT 'TASK_ASSIGNEE',
  workstream_id TEXT REFERENCES workstreams(id) ON DELETE SET NULL,
  allocation_percent INTEGER NOT NULL DEFAULT 100 CHECK (allocation_percent >= 0 AND allocation_percent <= 100),
  permissions TEXT DEFAULT '{}',
  start_date TEXT,
  end_date TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  added_by_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_role ON project_members(project_role);
CREATE INDEX IF NOT EXISTS idx_project_members_workstream ON project_members(workstream_id);

-- 1) Extend project_members with invoked roles + consultant overlay fields
ALTER TABLE project_members ADD COLUMN IF NOT EXISTS is_invoked INTEGER NOT NULL DEFAULT 0;

ALTER TABLE project_members ADD COLUMN IF NOT EXISTS consultant_profile TEXT NOT NULL DEFAULT 'NONE';
-- Values: NONE | EXTERNAL | PARTNER | INTERNAL

ALTER TABLE project_members ADD COLUMN IF NOT EXISTS engagement_type TEXT NOT NULL DEFAULT 'INTERNAL';
-- Values: INTERNAL | INVITED_BY_CLIENT | CONSULTANT_LED_ONBOARDING

ALTER TABLE project_members ADD COLUMN IF NOT EXISTS acting_org_id TEXT;
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
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

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_steering_board_members_project ON project_steering_board_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_steering_board_members_user ON project_steering_board_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_steering_board_members_type ON project_steering_board_members(member_type);

