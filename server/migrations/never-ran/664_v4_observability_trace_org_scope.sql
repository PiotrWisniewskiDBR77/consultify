-- V4-ENT-08: scope observability traces by organization

ALTER TABLE observability_traces
  ADD COLUMN IF NOT EXISTS organization_id TEXT;

CREATE INDEX IF NOT EXISTS idx_obs_traces_org_trace
  ON observability_traces(organization_id, trace_id);
