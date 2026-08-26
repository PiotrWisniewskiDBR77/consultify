CREATE INDEX IF NOT EXISTS ix_ie_aggregate_state_org_type_updated
  ON ie_aggregate_state (organization_id, aggregate_type, updated_at DESC, aggregate_id DESC);
