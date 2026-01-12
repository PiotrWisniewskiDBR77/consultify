-- Migration: 021_initiatives_created_from_plan_id.sql
-- Description: Adds created_from_plan_id and created_from columns to initiatives for Phase E->F linkage

-- Add created_from column to track initiative origin (MANUAL, AI_ONBOARDING, etc.)
ALTER TABLE initiatives ADD COLUMN created_from TEXT DEFAULT 'MANUAL';

-- Add created_from_plan_id column to link to onboarding plan
ALTER TABLE initiatives ADD COLUMN created_from_plan_id TEXT;

-- Index for efficient queries by plan linkage
CREATE INDEX IF NOT EXISTS idx_initiatives_created_from_plan ON initiatives(created_from_plan_id);
