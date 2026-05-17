-- Migration: 505_assessment_initiative_batches_report_id
-- Purpose: Link initiative generation batches to a specific assessment report (optional)
-- Date: 2026-02-01
--
-- Notes:
-- - SQLite doesn't support ADD COLUMN IF NOT EXISTS; this migration assumes it runs once.
-- - In environments where the column already exists, the migration runner should ignore the error.

CREATE TABLE IF NOT EXISTS assessment_initiative_batches (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    methodology_id TEXT NOT NULL DEFAULT 'impact-feasibility',
    initiatives_count INTEGER NOT NULL DEFAULT 0,
    include_chat_context INTEGER DEFAULT 1,
    generated_by TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE assessment_initiative_batches ADD COLUMN IF NOT EXISTS report_id TEXT REFERENCES assessment_reports(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_assessment_batches_report ON assessment_initiative_batches(report_id);

