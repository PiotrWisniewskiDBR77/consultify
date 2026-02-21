-- Migration: 547_initiatives_created_updated_by.sql
-- Adds created_by and updated_by columns to initiatives table
-- Required by InitiativeController, initiatives.routes, and PMO initiatives
-- Date: 2026-02-17

-- Add created_by to initiatives (nullable for existing rows)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'initiatives' AND column_name = 'created_by'
    ) THEN
        ALTER TABLE initiatives ADD COLUMN created_by TEXT;
    END IF;
END $$;

-- Add updated_by to initiatives (nullable for existing rows)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'initiatives' AND column_name = 'updated_by'
    ) THEN
        ALTER TABLE initiatives ADD COLUMN updated_by TEXT;
    END IF;
END $$;
