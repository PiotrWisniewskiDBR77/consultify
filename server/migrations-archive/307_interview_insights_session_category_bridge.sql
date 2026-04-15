-- INTERVIEW-INSIGHTS-003: Bridge legacy vs AI insight schemas
-- Migration: 307_interview_insights_session_category_bridge.sql
-- Purpose:
--  - Some environments have the AI/V2 schema (305) without legacy columns like `session_id` and `category`.
--  - Other environments have the legacy schema (295) where `session_id` and `category` are NOT NULL.
--  - To allow a single INSERT path, ensure these legacy columns exist (nullable) everywhere.

ALTER TABLE interview_insights ADD COLUMN session_id TEXT;
ALTER TABLE interview_insights ADD COLUMN category TEXT DEFAULT 'general';

