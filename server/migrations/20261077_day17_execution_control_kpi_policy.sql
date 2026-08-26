-- Day 17 X.4. Empty, tenant-scoped policy store. No default policy is seeded:
-- thresholds and weights remain an owner decision.
CREATE TABLE IF NOT EXISTS execution_control_kpi_policies (
  policy_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  row_version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_execution_control_kpi_policies_org
  ON execution_control_kpi_policies (organization_id, policy_id);
