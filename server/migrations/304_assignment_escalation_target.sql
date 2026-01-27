-- INTERVIEW-ASSIGNMENTS-004: Escalation target for assignments
-- Migration: 304_assignment_escalation_target.sql
-- Purpose:
--  - Add escalate_to column to interview_assignments
--  - When NULL, defaults to created_by (the assigner)

-- ==========================================
-- ADD ESCALATION TARGET COLUMN
-- ==========================================

ALTER TABLE interview_assignments ADD COLUMN escalate_to TEXT;

-- Create index for escalation queries
CREATE INDEX IF NOT EXISTS idx_interview_assignments_escalate_to 
    ON interview_assignments(escalate_to);

-- ==========================================
-- UPDATE EXISTING RECORDS
-- ==========================================

-- Set escalate_to to created_by for existing assignments where NULL
UPDATE interview_assignments 
SET escalate_to = created_by 
WHERE escalate_to IS NULL AND created_by IS NOT NULL;
