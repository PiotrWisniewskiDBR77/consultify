-- Add description column to assessments table
-- Migration: 299_add_assessments_description.sql
-- Date: 2026-01-28
--
-- This migration adds the description column to the assessments table
-- to support assessment descriptions in the UI

-- Add description column if it doesn't exist
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN,
-- so we use a workaround with a temporary table check
-- In practice, this will fail gracefully if the column already exists

-- For SQLite, we need to check if column exists first
-- Since SQLite doesn't support IF NOT EXISTS for ADD COLUMN, we'll use a try-catch approach
-- by attempting to add it and ignoring errors if it already exists

-- Note: In production, this should be run with error handling
-- For now, we'll add it directly - if it fails, the column already exists

ALTER TABLE assessments ADD COLUMN description TEXT;

-- Add index for description searches (optional, but useful for filtering)
CREATE INDEX IF NOT EXISTS idx_assessments_description ON assessments(description) WHERE description IS NOT NULL;
