-- Migration: 039_initiative_report_tracking
-- Description: Add report_id column to initiatives for proper traceability
-- Date: 2025-12-26

-- Add report_id column to initiatives for linking to assessment_reports
ALTER TABLE initiatives ADD COLUMN report_id TEXT REFERENCES assessment_reports(id) ON DELETE SET NULL;

-- Create index for performance on report_id
CREATE INDEX IF NOT EXISTS idx_initiatives_report_id ON initiatives(report_id);

-- Update existing initiatives with source_assessment_id to link to reports
-- This links initiatives to the most recent report from their source assessment
UPDATE initiatives 
SET report_id = (
    SELECT ar.id 
    FROM assessment_reports ar 
    WHERE ar.assessment_id = initiatives.source_assessment_id 
    ORDER BY ar.created_at DESC 
    LIMIT 1
)
WHERE source_assessment_id IS NOT NULL AND report_id IS NULL;



