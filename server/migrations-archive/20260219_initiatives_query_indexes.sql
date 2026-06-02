-- Speed up initiatives list queries (common pattern: org filter + newest first)
-- Safe for both SQLite and Postgres.

CREATE INDEX IF NOT EXISTS idx_initiatives_org_created_at_desc
  ON initiatives(organization_id, created_at DESC);

