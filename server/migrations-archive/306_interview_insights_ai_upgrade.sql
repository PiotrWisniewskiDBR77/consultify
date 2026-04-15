-- INTERVIEW-INSIGHTS-002: Upgrade legacy interview_insights to support AI insights
-- Migration: 306_interview_insights_ai_upgrade.sql
-- Purpose:
--  - The legacy Interview module (migration 295) already creates `interview_insights` with a different schema.
--  - Migration 305 uses CREATE TABLE IF NOT EXISTS, so on existing DBs the AI columns are missing.
--  - This migration upgrades the existing table in-place by ADD COLUMN statements.
--  - The migration runner is tolerant to "duplicate column name" on SQLite, so this is safe/idempotent.

-- ==========================================
-- ADD AI/V2 COLUMNS (non-destructive)
-- ==========================================

ALTER TABLE interview_insights ADD COLUMN prompt_type TEXT DEFAULT 'summary';
ALTER TABLE interview_insights ADD COLUMN source_session_ids TEXT DEFAULT '[]'; -- JSON array of session IDs analyzed
ALTER TABLE interview_insights ADD COLUMN filters TEXT; -- JSON filters (and optional customPrompt)
ALTER TABLE interview_insights ADD COLUMN content TEXT; -- AI generated markdown
ALTER TABLE interview_insights ADD COLUMN error_message TEXT;
ALTER TABLE interview_insights ADD COLUMN source_session_count INTEGER DEFAULT 0;
ALTER TABLE interview_insights ADD COLUMN tokens_used INTEGER DEFAULT 0;
ALTER TABLE interview_insights ADD COLUMN generation_time_ms INTEGER;

-- Export flags (used by UI + controller). Present in legacy schema, but missing in AI schema.
ALTER TABLE interview_insights ADD COLUMN exported_to_tools INTEGER DEFAULT 0;
ALTER TABLE interview_insights ADD COLUMN exported_to_assessment INTEGER DEFAULT 0;

-- Optional: track original prompt (helps with debugging/regeneration).
ALTER TABLE interview_insights ADD COLUMN custom_prompt TEXT;

-- ==========================================
-- INDEXES (best-effort, idempotent)
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_interview_insights_org ON interview_insights(organization_id);
CREATE INDEX IF NOT EXISTS idx_interview_insights_status ON interview_insights(status);
CREATE INDEX IF NOT EXISTS idx_interview_insights_prompt_type ON interview_insights(prompt_type);
CREATE INDEX IF NOT EXISTS idx_interview_insights_created_at ON interview_insights(created_at DESC);

