-- T065: Competency Taxonomy + Initiative Requirements
-- Extends the existing capabilities model with categories, levels, and richer requirements.

-- 1. Competency categories (Strategy, Operations, Digital, Change, Finance, etc.)
CREATE TABLE IF NOT EXISTS competency_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_pl TEXT,
  description TEXT,
  description_pl TEXT,
  icon TEXT DEFAULT 'Layers',
  color TEXT DEFAULT '#6366f1',
  sort_order INTEGER DEFAULT 0,
  is_system BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comp_categories_org ON competency_categories(organization_id);

-- 2. Competency levels (1-5 scale with labels per org)
CREATE TABLE IF NOT EXISTS competency_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
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

-- 3. Add category_id to existing capabilities table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'capabilities' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE capabilities ADD COLUMN category_id UUID REFERENCES competency_categories(id) ON DELETE SET NULL;
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
