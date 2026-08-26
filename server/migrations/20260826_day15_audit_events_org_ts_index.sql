CREATE INDEX IF NOT EXISTS idx_audit_events_org_ts
  ON audit_events (org_id, ts DESC);
