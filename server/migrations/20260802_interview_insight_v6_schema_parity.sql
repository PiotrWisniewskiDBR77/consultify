-- INT-07: the V6 generator writes these fields, but the historical 670 migration
-- lived under never-ran and was absent from clean PostgreSQL installations.
BEGIN;

ALTER TABLE interview_insights ADD COLUMN IF NOT EXISTS executive_summary TEXT;
ALTER TABLE interview_insights ADD COLUMN IF NOT EXISTS themes_json TEXT;
ALTER TABLE interview_insights ADD COLUMN IF NOT EXISTS issues_json TEXT;
ALTER TABLE interview_insights ADD COLUMN IF NOT EXISTS opportunities_json TEXT;
ALTER TABLE interview_insights ADD COLUMN IF NOT EXISTS signals_json TEXT;
ALTER TABLE interview_insights ADD COLUMN IF NOT EXISTS evidence_map_json TEXT;
ALTER TABLE interview_insights ADD COLUMN IF NOT EXISTS missing_data_json TEXT;

COMMIT;
