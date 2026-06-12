-- V8 Results runtime (Wave 19): deviation resolution closure + analytics indexes
-- Note: ROI table is v8_roi_realization_entries (not v8_roi_realizations).

ALTER TABLE v8_deviation_records ADD COLUMN IF NOT EXISTS resolved_at TEXT;
ALTER TABLE v8_deviation_records ADD COLUMN IF NOT EXISTS resolved_by TEXT;
ALTER TABLE v8_deviation_records ADD COLUMN IF NOT EXISTS resolution TEXT;
ALTER TABLE v8_deviation_records ADD COLUMN IF NOT EXISTS observed_actual REAL;
ALTER TABLE v8_deviation_records ADD COLUMN IF NOT EXISTS observed_target REAL;

CREATE INDEX IF NOT EXISTS idx_v8_deviations_active
  ON v8_deviation_records(organization_id) WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_v8_roi_entries_org_created
  ON v8_roi_realization_entries(organization_id, created_at);

CREATE INDEX IF NOT EXISTS idx_v8_kpi_org_status
  ON v8_kpi_definitions(organization_id, status);
