-- V4-EXEC-08: Stakeholder communication enhancements
-- Adds steerco packs, distribution tracking, and plan enhancements

ALTER TABLE communication_plans ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'general';
ALTER TABLE communication_plans ADD COLUMN IF NOT EXISTS stakeholder_registry_json TEXT;
ALTER TABLE communication_plans ADD COLUMN IF NOT EXISTS governance_level TEXT DEFAULT 'standard';

CREATE TABLE IF NOT EXISTS steerco_packs (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  organization_id TEXT NOT NULL,
  initiative_id TEXT,
  title TEXT NOT NULL,
  pack_type TEXT NOT NULL DEFAULT 'status_update',
  content_json TEXT NOT NULL DEFAULT '{}',
  status TEXT DEFAULT 'draft',
  scheduled_date DATE,
  distributed_at TIMESTAMPTZ,
  distribution_channels TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_steerco_packs_org ON steerco_packs(organization_id);
CREATE INDEX IF NOT EXISTS idx_steerco_packs_init ON steerco_packs(initiative_id);

CREATE TABLE IF NOT EXISTS steerco_pack_recipients (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  pack_id TEXT NOT NULL REFERENCES steerco_packs(id) ON DELETE CASCADE,
  user_id TEXT,
  segment_id TEXT,
  channel TEXT DEFAULT 'in_app',
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_steerco_recipients_pack ON steerco_pack_recipients(pack_id);
