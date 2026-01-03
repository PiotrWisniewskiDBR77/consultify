-- Migration: AI User Memory
-- Stores user preferences and context learned by AI

CREATE TABLE IF NOT EXISTS ai_user_memory (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT,
    key TEXT NOT NULL,
    value TEXT,
    source TEXT DEFAULT 'explicit' CHECK(source IN ('explicit', 'inferred')),
    confidence REAL DEFAULT 1.0,
    context TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, key)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_ai_memory_user ON ai_user_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_memory_user_key ON ai_user_memory(user_id, key);
CREATE INDEX IF NOT EXISTS idx_ai_memory_org ON ai_user_memory(organization_id);

-- Common memory keys:
-- preferred_language: pl/en
-- communication_style: formal/casual
-- role_context: user's role description
-- project_focus: current project priorities
-- timezone: user's timezone
-- response_length: short/detailed
-- expertise_level: beginner/intermediate/expert









