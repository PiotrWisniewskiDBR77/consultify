-- V4-EXEC-07: RAID scoring — appetite thresholds per org
CREATE TABLE IF NOT EXISTS raid_appetite_thresholds (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  organization_id TEXT NOT NULL,
  initiative_id TEXT,
  risk_appetite_level TEXT NOT NULL DEFAULT 'moderate',
  green_max INTEGER NOT NULL DEFAULT 4,
  amber_max INTEGER NOT NULL DEFAULT 9,
  red_min INTEGER NOT NULL DEFAULT 10,
  auto_escalate_above INTEGER DEFAULT 12,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_raid_appetite_org ON raid_appetite_thresholds(organization_id) WHERE initiative_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_raid_appetite_init ON raid_appetite_thresholds(organization_id, initiative_id) WHERE initiative_id IS NOT NULL;

-- Ensure scoring columns exist on raid_items
ALTER TABLE raid_items ADD COLUMN IF NOT EXISTS risk_score INTEGER;
ALTER TABLE raid_items ADD COLUMN IF NOT EXISTS score_category TEXT;
