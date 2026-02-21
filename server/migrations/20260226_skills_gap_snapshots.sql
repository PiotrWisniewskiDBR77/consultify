-- T066: Skills Gap Analysis — snapshot history for trend tracking
CREATE TABLE IF NOT EXISTS skills_gap_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  initiative_id UUID NOT NULL,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_requirements INTEGER NOT NULL DEFAULT 0,
  covered INTEGER NOT NULL DEFAULT 0,
  partial INTEGER NOT NULL DEFAULT 0,
  missing INTEGER NOT NULL DEFAULT 0,
  unknown INTEGER NOT NULL DEFAULT 0,
  team_size INTEGER NOT NULL DEFAULT 0,
  profiles_complete INTEGER NOT NULL DEFAULT 0,
  gap_details JSONB DEFAULT '[]',
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(organization_id, initiative_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_gap_snapshots_org_init
  ON skills_gap_snapshots(organization_id, initiative_id);
CREATE INDEX IF NOT EXISTS idx_gap_snapshots_date
  ON skills_gap_snapshots(snapshot_date);
