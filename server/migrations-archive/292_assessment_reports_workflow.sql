-- Migration 292: Assessment reports workflow columns

ALTER TABLE assessment_reports ADD COLUMN name TEXT;
ALTER TABLE assessment_reports ADD COLUMN status TEXT DEFAULT 'DRAFT';
ALTER TABLE assessment_reports ADD COLUMN created_by TEXT;
ALTER TABLE assessment_reports ADD COLUMN approved_by TEXT;
ALTER TABLE assessment_reports ADD COLUMN approved_at TIMESTAMP;
ALTER TABLE assessment_reports ADD COLUMN project_id TEXT;
