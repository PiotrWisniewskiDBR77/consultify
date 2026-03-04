-- V3-E10: Assessment evidence per dimension (Postgres compatibility upgrade)
-- Migration: 621_assessment_evidence.sql
-- Date: 2026-03-04
--
-- NOTE:
-- In some environments (e.g. older Railway DBs) `assessment_evidence` already exists with a
-- legacy schema. V3 needs additional dimension-level evidence fields. This migration is
-- intentionally additive and idempotent: it preserves legacy columns and adds the V3 fields.

-- Ensure the table exists (minimal shape). If it already exists, this is a no-op.
CREATE TABLE IF NOT EXISTS assessment_evidence (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  assessment_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Ensure new inserts can omit `id` even on legacy schemas.
ALTER TABLE assessment_evidence
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

-- Dimension-level evidence fields (V3)
ALTER TABLE assessment_evidence ADD COLUMN IF NOT EXISTS framework_id VARCHAR(20);
ALTER TABLE assessment_evidence ADD COLUMN IF NOT EXISTS dimension_id VARCHAR(100);
ALTER TABLE assessment_evidence ADD COLUMN IF NOT EXISTS current_score NUMERIC(3,1);
ALTER TABLE assessment_evidence ADD COLUMN IF NOT EXISTS target_score NUMERIC(3,1);
ALTER TABLE assessment_evidence ADD COLUMN IF NOT EXISTS evidence_text TEXT;
ALTER TABLE assessment_evidence ADD COLUMN IF NOT EXISTS evidence_status VARCHAR(20) DEFAULT 'missing';
ALTER TABLE assessment_evidence ADD COLUMN IF NOT EXISTS attachments_json TEXT DEFAULT '[]';
ALTER TABLE assessment_evidence ADD COLUMN IF NOT EXISTS last_score_change TIMESTAMPTZ;
ALTER TABLE assessment_evidence ADD COLUMN IF NOT EXISTS last_evidence_update TIMESTAMPTZ;
ALTER TABLE assessment_evidence ADD COLUMN IF NOT EXISTS reviewed_by TEXT;

-- Indexes used by list/get endpoints and typical filtering.
CREATE INDEX IF NOT EXISTS idx_assessment_evidence_assessment ON assessment_evidence(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_evidence_framework ON assessment_evidence(framework_id);
CREATE INDEX IF NOT EXISTS idx_assessment_evidence_assessment_dimension
  ON assessment_evidence(assessment_id, framework_id, dimension_id);
