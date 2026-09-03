-- Day 298: additive, session-owned input required by the accepted DRD report.
-- Kept outside the frozen MethodSession contract; one row per session and tenant.
CREATE TABLE IF NOT EXISTS method_session_report_metadata (
  session_id TEXT PRIMARY KEY REFERENCES method_sessions(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  advisory_team JSONB NOT NULL DEFAULT '[]'::jsonb,
  client_team JSONB NOT NULL DEFAULT '[]'::jsonb,
  study_period TEXT NOT NULL DEFAULT '',
  study_scope TEXT NOT NULL DEFAULT '',
  exclusions JSONB NOT NULL DEFAULT '[]'::jsonb,
  calendar_entries JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_ceiling_rationales JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, session_id)
);

CREATE INDEX IF NOT EXISTS ix_method_session_report_metadata_org
  ON method_session_report_metadata(organization_id);
