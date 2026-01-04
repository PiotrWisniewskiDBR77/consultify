-- Migration 064: Execution Stages for Initiatives
-- Adds current_stage column to track progress within EXECUTING status

-- Add current_stage column if not exists
-- Valid stages: KICKOFF, IN_PROGRESS, REVIEW, DELIVERY
ALTER TABLE initiatives ADD COLUMN current_stage TEXT DEFAULT 'KICKOFF';

-- Create index for stage-based queries
CREATE INDEX IF NOT EXISTS idx_initiatives_stage ON initiatives(current_stage);

-- Update existing EXECUTING initiatives to have KICKOFF as default stage
UPDATE initiatives 
SET current_stage = 'KICKOFF' 
WHERE status = 'EXECUTING' AND current_stage IS NULL;














