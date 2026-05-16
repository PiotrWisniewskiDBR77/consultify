-- V4-TOOL-02: Framework runtime contract with typed I/O, DoD gates, and deterministic export
-- Adds runtime_contract_json (stores ToolRuntimeContract as JSON) and dod_status to tool_sessions.

CREATE TABLE IF NOT EXISTS tool_sessions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    tool_type TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'DRAFT',
    completion_percent INTEGER DEFAULT 0,
    confidence_avg REAL DEFAULT 0,
    answers_json TEXT DEFAULT '{}',
    context_snapshot TEXT DEFAULT '{}',
    review_requested_at TIMESTAMP,
    approved_at TIMESTAMP,
    created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tool_sessions_org ON tool_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_tool_sessions_status ON tool_sessions(status);
CREATE INDEX IF NOT EXISTS idx_tool_sessions_tool ON tool_sessions(tool_type);

ALTER TABLE tool_sessions ADD COLUMN IF NOT EXISTS runtime_contract_json TEXT;
ALTER TABLE tool_sessions ADD COLUMN IF NOT EXISTS dod_status TEXT DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_tool_sessions_dod ON tool_sessions(dod_status);
