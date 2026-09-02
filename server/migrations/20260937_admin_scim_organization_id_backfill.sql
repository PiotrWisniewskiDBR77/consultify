ALTER TABLE scim_group_mappings
  ADD COLUMN IF NOT EXISTS organization_id TEXT;

ALTER TABLE scim_sync_logs
  ADD COLUMN IF NOT EXISTS organization_id TEXT;

CREATE INDEX IF NOT EXISTS idx_scim_group_mappings_org
  ON scim_group_mappings(organization_id);

CREATE INDEX IF NOT EXISTS idx_scim_sync_logs_org
  ON scim_sync_logs(organization_id);
