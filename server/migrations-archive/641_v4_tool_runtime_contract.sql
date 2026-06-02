-- V4-TOOL-02: Framework runtime contract with typed I/O, DoD gates, and deterministic export
-- Adds runtime_contract_json (stores ToolRuntimeContract as JSON) and dod_status to tool_sessions.

ALTER TABLE tool_sessions ADD COLUMN IF NOT EXISTS runtime_contract_json TEXT;
ALTER TABLE tool_sessions ADD COLUMN IF NOT EXISTS dod_status TEXT DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_tool_sessions_dod ON tool_sessions(dod_status);
