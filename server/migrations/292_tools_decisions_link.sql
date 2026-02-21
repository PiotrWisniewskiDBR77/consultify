-- FLOW-TOOLS-INITIATIVES-002: Link tool decisions to decisions table
-- Migration: 292_tools_decisions_link.sql

-- PostgreSQL supports IF NOT EXISTS for ADD COLUMN (since 9.6)
-- SQLite doesn't support IF NOT EXISTS, but the migration runner handles this gracefully
ALTER TABLE tool_decisions ADD COLUMN IF NOT EXISTS decision_id TEXT;

CREATE INDEX IF NOT EXISTS idx_tool_decisions_decision ON tool_decisions(decision_id);
