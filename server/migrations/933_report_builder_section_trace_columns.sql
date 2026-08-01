-- Report Builder quality/export compatibility for older PostgreSQL schemas.
-- These columns are read by reportQualityGatesService and populated when a
-- finalized consulting-tool session is promoted to a durable report.

ALTER TABLE report_builder_sections
  ADD COLUMN IF NOT EXISTS source_refs_json TEXT;

ALTER TABLE report_builder_sections
  ADD COLUMN IF NOT EXISTS rag TEXT;
