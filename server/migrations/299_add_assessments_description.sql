-- Add description column to assessments table
-- Migration: 299_add_assessments_description.sql
-- Date: 2026-01-28
--
-- This migration adds the description column to the assessments table
-- to support assessment descriptions in the UI
--
-- Note: SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN.
-- The migration system should handle errors gracefully if the column already exists.
-- In practice, if the column exists, this will fail but the migration can be marked as applied.

-- Add description column
-- This will fail if the column already exists, but that's okay - it means the migration was already run
ALTER TABLE assessments ADD COLUMN description TEXT;

-- Add index for description searches (optional, but useful for filtering)
CREATE INDEX IF NOT EXISTS idx_assessments_description ON assessments(description) WHERE description IS NOT NULL;
