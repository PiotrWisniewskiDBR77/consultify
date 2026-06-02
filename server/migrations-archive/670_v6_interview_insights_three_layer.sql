-- V6-E02: Add three-layer truth model columns to interview_insights
-- Migration: 669_v6_interview_insights_three_layer.sql
-- Purpose:
--  - Layer 1 (Source): answers are already in interview_questions
--  - Layer 2 (AI Synthesis): themes, patterns, tensions
--  - Layer 3 (Consulting Interpretation): issues, opportunities, signals
--  - Plus executive_summary and evidence_map for traceability

ALTER TABLE interview_insights ADD COLUMN executive_summary TEXT;
ALTER TABLE interview_insights ADD COLUMN themes_json TEXT;        -- JSON array of theme objects
ALTER TABLE interview_insights ADD COLUMN issues_json TEXT;        -- JSON array of issue objects
ALTER TABLE interview_insights ADD COLUMN opportunities_json TEXT; -- JSON array of opportunity objects
ALTER TABLE interview_insights ADD COLUMN signals_json TEXT;       -- JSON array of signal objects
ALTER TABLE interview_insights ADD COLUMN evidence_map_json TEXT;  -- JSON array mapping answers to themes/issues
ALTER TABLE interview_insights ADD COLUMN missing_data_json TEXT;  -- JSON array of identified data gaps
