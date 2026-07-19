-- V4-ENT-02: SCIM provisioning/deprovisioning, group sync, conflict handling

ALTER TABLE users ADD COLUMN IF NOT EXISTS scim_external_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS scim_provisioned BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS scim_last_sync_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_scim_external_id ON users(scim_external_id) WHERE scim_external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS scim_group_mappings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  external_group_id TEXT NOT NULL,
  external_group_name TEXT NOT NULL,
  internal_role TEXT NOT NULL,
  custom_role_id TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, external_group_id)
);

CREATE INDEX IF NOT EXISTS idx_scim_group_mappings_org ON scim_group_mappings(organization_id);
CREATE INDEX IF NOT EXISTS idx_scim_group_mappings_external ON scim_group_mappings(external_group_id);

ALTER TABLE scim_group_mappings ADD COLUMN IF NOT EXISTS auto_sync BOOLEAN DEFAULT TRUE;
ALTER TABLE scim_group_mappings ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
ALTER TABLE scim_group_mappings ADD COLUMN IF NOT EXISTS member_count INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS scim_conflict_log (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  organization_id TEXT NOT NULL,
  conflict_type TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  external_id TEXT,
  internal_id TEXT,
  details_json TEXT,
  resolution TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scim_conflicts_org ON scim_conflict_log(organization_id);
