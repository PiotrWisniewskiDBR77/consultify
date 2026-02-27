-- Migration: 575_interview_sendback_missing_items.sql
-- Purpose: Persist send-back checklist for Interview sufficiency contract (V3-D01)

ALTER TABLE interview_assignments
  ADD COLUMN missing_items_json TEXT;
