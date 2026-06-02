-- Migration: 300_add_assessments_framework_columns.sql
-- Adds framework_type and framework_data columns to assessments table if they don't exist
-- Created: 2026-02-08

-- ==========================================
-- Add framework_type and framework_data columns to assessments table
-- ==========================================
DO $$
BEGIN
    -- Add framework_type column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'assessments' AND column_name = 'framework_type'
    ) THEN
        ALTER TABLE assessments ADD COLUMN framework_type TEXT DEFAULT 'DRD';
        CREATE INDEX IF NOT EXISTS idx_assessments_framework_type ON assessments(framework_type);
    END IF;
    
    -- Add framework_data column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'assessments' AND column_name = 'framework_data'
    ) THEN
        ALTER TABLE assessments ADD COLUMN framework_data JSONB;
    END IF;
END $$;
