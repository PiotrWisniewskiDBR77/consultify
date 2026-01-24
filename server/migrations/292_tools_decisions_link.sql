-- FLOW-TOOLS-INITIATIVES-002: Link tool decisions to decisions table
-- Migration: 292_tools_decisions_link.sql

ALTER TABLE tool_decisions ADD COLUMN decision_id TEXT;

CREATE INDEX IF NOT EXISTS idx_tool_decisions_decision ON tool_decisions(decision_id);
