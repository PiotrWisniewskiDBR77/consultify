-- V4-INIT-05: Staffing plans with roles, allocations, skills, and capacity model

CREATE TABLE IF NOT EXISTS staffing_plans (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  initiative_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  planned_start DATE,
  planned_end DATE,
  total_fte_required REAL DEFAULT 0,
  total_fte_allocated REAL DEFAULT 0,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_staffing_plans_init ON staffing_plans(initiative_id);
CREATE INDEX IF NOT EXISTS idx_staffing_plans_org ON staffing_plans(organization_id);

CREATE TABLE IF NOT EXISTS staffing_plan_roles (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  staffing_plan_id TEXT NOT NULL REFERENCES staffing_plans(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  required_skills TEXT,
  fte_required REAL NOT NULL DEFAULT 1.0,
  fte_allocated REAL DEFAULT 0,
  assigned_user_id TEXT,
  start_date DATE,
  end_date DATE,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_staffing_roles_plan ON staffing_plan_roles(staffing_plan_id);
CREATE INDEX IF NOT EXISTS idx_staffing_roles_user ON staffing_plan_roles(assigned_user_id);

ALTER TABLE initiative_resources ADD COLUMN IF NOT EXISTS skills TEXT;
ALTER TABLE initiative_resources ADD COLUMN IF NOT EXISTS staffing_plan_role_id TEXT;
