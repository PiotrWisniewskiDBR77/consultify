-- Migration: 296_ai_actions_table.sql
-- Purpose: Create ai_actions table for AI action executor service
-- This table stores AI-generated actions that require approval/execution

CREATE TABLE IF NOT EXISTS ai_actions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    organization_id TEXT,
    project_id TEXT,
    action_type TEXT,
    payload TEXT,
    draft_content TEXT,
    required_policy_level TEXT,
    current_policy_level TEXT,
    requires_approval INTEGER DEFAULT 0,
    status TEXT DEFAULT 'PENDING',
    approved_at TIMESTAMP,
    approved_by TEXT,
    executed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_actions_user ON ai_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_actions_org ON ai_actions(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_actions_project ON ai_actions(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_actions_status ON ai_actions(status);
CREATE INDEX IF NOT EXISTS idx_ai_actions_type ON ai_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_ai_actions_created ON ai_actions(created_at);
