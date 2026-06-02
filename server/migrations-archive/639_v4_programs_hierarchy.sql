-- V4-INIT-02: Programs hierarchy for portfolio management
CREATE TABLE IF NOT EXISTS programs (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  parent_program_id TEXT REFERENCES programs(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  owner_user_id TEXT,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS parent_program_id TEXT REFERENCES programs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_programs_org ON programs(organization_id);
CREATE INDEX IF NOT EXISTS idx_programs_parent ON programs(parent_program_id);
CREATE INDEX IF NOT EXISTS idx_programs_status ON programs(status);
