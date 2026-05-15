-- Migration: 754_interview_ai_review_memory.sql
-- Purpose: Persist AI review snapshot and manager-vs-AI decision memory for Interview assignments

ALTER TABLE interview_assignments
  ADD COLUMN IF NOT EXISTS ai_review_snapshot_json TEXT;

ALTER TABLE interview_assignments
  ADD COLUMN IF NOT EXISTS ai_reviewed_at TIMESTAMP;

ALTER TABLE interview_assignments
  ADD COLUMN IF NOT EXISTS review_decision_memory_json TEXT;
