-- Migration: Add roadmap-related columns to initiatives table
-- Required for transfer-to-roadmap functionality

-- Target quarter (e.g., '2025-Q1')
ALTER TABLE initiatives ADD COLUMN target_quarter TEXT;

-- Notes for roadmap transfer
ALTER TABLE initiatives ADD COLUMN roadmap_notes TEXT;

-- Source report ID for traceability (from Assessment Module)
ALTER TABLE initiatives ADD COLUMN source_report_id TEXT REFERENCES assessment_reports(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_initiatives_target_quarter ON initiatives(target_quarter);
CREATE INDEX IF NOT EXISTS idx_initiatives_source_report ON initiatives(source_report_id);



