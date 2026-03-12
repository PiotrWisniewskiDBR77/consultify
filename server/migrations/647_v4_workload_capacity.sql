-- V4-TASK-06: Workload model + capacity

CREATE TABLE IF NOT EXISTS task_allocations (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  task_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  allocated_hours REAL NOT NULL DEFAULT 0,
  actual_hours REAL DEFAULT 0,
  week_start DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE task_allocations ADD COLUMN IF NOT EXISTS organization_id TEXT;
ALTER TABLE task_allocations ADD COLUMN IF NOT EXISTS task_id TEXT;
ALTER TABLE task_allocations ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE task_allocations ADD COLUMN IF NOT EXISTS week_start DATE;
CREATE INDEX IF NOT EXISTS idx_task_alloc_task ON task_allocations(task_id);
CREATE INDEX IF NOT EXISTS idx_task_alloc_user ON task_allocations(user_id);
CREATE INDEX IF NOT EXISTS idx_task_alloc_week ON task_allocations(week_start);
CREATE UNIQUE INDEX IF NOT EXISTS idx_task_alloc_unique ON task_allocations(task_id, user_id, week_start);

CREATE TABLE IF NOT EXISTS user_skills (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  skill_name TEXT NOT NULL,
  proficiency_level TEXT DEFAULT 'intermediate',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_skills ADD COLUMN IF NOT EXISTS organization_id TEXT;
ALTER TABLE user_skills ADD COLUMN IF NOT EXISTS skill_name TEXT;
CREATE INDEX IF NOT EXISTS idx_user_skills_user ON user_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_user_skills_org ON user_skills(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_skills_unique ON user_skills(user_id, skill_name);

CREATE TABLE IF NOT EXISTS time_entries (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  task_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  hours REAL NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS organization_id TEXT;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS task_id TEXT;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS date DATE;
CREATE INDEX IF NOT EXISTS idx_time_entries_task ON time_entries(task_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_date ON time_entries(date);

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS required_skills TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS effort_estimate_hours REAL;
