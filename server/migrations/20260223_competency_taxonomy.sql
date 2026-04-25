-- T065: Competency Taxonomy + Initiative Requirements
-- Extends the existing capabilities model with categories, levels, and richer requirements.

-- 1. Competency categories (Strategy, Operations, Digital, Change, Finance, etc.)
CREATE TABLE IF NOT EXISTS competency_categories (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_pl TEXT,
  description TEXT,
  description_pl TEXT,
  icon TEXT DEFAULT 'Layers',
  color TEXT DEFAULT '#6366f1',
  sort_order INTEGER DEFAULT 0,
  is_system BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comp_categories_org ON competency_categories(organization_id);

-- 2. Competency levels (1-5 scale with labels per org)
CREATE TABLE IF NOT EXISTS competency_levels (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  level_value INTEGER NOT NULL CHECK (level_value BETWEEN 1 AND 10),
  label TEXT NOT NULL,
  label_pl TEXT,
  description TEXT,
  description_pl TEXT,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(organization_id, level_value)
);

CREATE INDEX IF NOT EXISTS idx_comp_levels_org ON competency_levels(organization_id);

-- Baseline Postgres migrations skip the legacy SQLite-first capabilities migration (<500).
-- Keep the competency taxonomy migration self-contained for fresh Postgres databases.
CREATE TABLE IF NOT EXISTS capabilities (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  domain TEXT NOT NULL DEFAULT 'general',
  tags JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_capabilities_org ON capabilities(organization_id);
CREATE INDEX IF NOT EXISTS idx_capabilities_org_domain ON capabilities(organization_id, domain);

CREATE TABLE IF NOT EXISTS user_capabilities (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  capability_id TEXT NOT NULL REFERENCES capabilities(id) ON DELETE CASCADE,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 10),
  certifications JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, capability_id)
);

CREATE INDEX IF NOT EXISTS idx_user_capabilities_user ON user_capabilities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_capabilities_org ON user_capabilities(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_capabilities_cap ON user_capabilities(capability_id);

CREATE TABLE IF NOT EXISTS capability_requirements (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL,
  initiative_id TEXT,
  task_id TEXT,
  capability_id TEXT NOT NULL REFERENCES capabilities(id) ON DELETE CASCADE,
  min_level INTEGER NOT NULL CHECK (min_level BETWEEN 1 AND 10),
  priority TEXT NOT NULL DEFAULT 'required' CHECK (priority IN ('required', 'nice_to_have')),
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cap_req_initiative ON capability_requirements(initiative_id);
CREATE INDEX IF NOT EXISTS idx_cap_req_task ON capability_requirements(task_id);
CREATE INDEX IF NOT EXISTS idx_cap_req_org ON capability_requirements(organization_id);

-- 3. Add category_id to existing capabilities table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'capabilities' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE capabilities ADD COLUMN category_id TEXT REFERENCES competency_categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4. Add headcount/FTE and justification to capability_requirements
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'capability_requirements' AND column_name = 'headcount'
  ) THEN
    ALTER TABLE capability_requirements ADD COLUMN headcount NUMERIC(5,1) DEFAULT NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'capability_requirements' AND column_name = 'justification'
  ) THEN
    ALTER TABLE capability_requirements ADD COLUMN justification TEXT DEFAULT NULL;
  END IF;
END $$;

-- 5. Usage view for competency (how many initiatives reference each capability)
CREATE OR REPLACE VIEW competency_usage_stats AS
SELECT
  c.id AS capability_id,
  c.organization_id,
  c.name,
  c.category_id,
  COUNT(DISTINCT cr.initiative_id) AS initiative_count,
  COUNT(DISTINCT uc.user_id) AS user_count
FROM capabilities c
LEFT JOIN capability_requirements cr ON cr.capability_id = c.id
LEFT JOIN user_capabilities uc ON uc.capability_id = c.id
WHERE c.is_active = TRUE
GROUP BY c.id, c.organization_id, c.name, c.category_id;
