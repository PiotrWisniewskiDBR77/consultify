-- Add description column to assessments table
-- Migration: 299_add_assessments_description.sql
-- Date: 2026-01-28
--
-- This migration adds the description column to the assessments table
-- to support assessment descriptions in the UI
--
-- PostgreSQL supports IF NOT EXISTS for ADD COLUMN (since 9.6).
-- SQLite doesn't support IF NOT EXISTS, but the migration runner handles duplicate column errors gracefully.

-- Add description column
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS description TEXT;

-- Add index for description searches (optional, but useful for filtering)
CREATE INDEX IF NOT EXISTS idx_assessments_description ON assessments(description) WHERE description IS NOT NULL;
