-- Agent Planner: Multi-step task execution with persisted plans
-- Final MVP integration: promoted from never-ran because numeric MW-11
-- migration 941 consumes ai_agent_plans before dated baseline migrations run.
-- The definition is the repository's existing canonical producer, not a new
-- inferred schema.
-- Supports plan-execute-observe loops, checkpoints, and background agents

CREATE TABLE IF NOT EXISTS ai_agent_plans (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    conversation_id TEXT,
    user_id TEXT NOT NULL,
    title TEXT,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'planning',
    total_steps INTEGER DEFAULT 0,
    completed_steps INTEGER DEFAULT 0,
    current_step_index INTEGER DEFAULT 0,
    plan_json TEXT NOT NULL DEFAULT '[]',
    result_summary TEXT,
    error_message TEXT,
    is_background BOOLEAN DEFAULT FALSE,
    scheduled_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_plans_org
    ON ai_agent_plans(organization_id, user_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_plans_conv
    ON ai_agent_plans(conversation_id);

CREATE TABLE IF NOT EXISTS ai_agent_plan_steps (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL REFERENCES ai_agent_plans(id) ON DELETE CASCADE,
    step_index INTEGER NOT NULL,
    tool_name TEXT NOT NULL,
    tool_input_json TEXT DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending',
    result_json TEXT,
    error_message TEXT,
    requires_approval BOOLEAN DEFAULT FALSE,
    approved_by TEXT,
    approved_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    duration_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_plan_steps_plan
    ON ai_agent_plan_steps(plan_id, step_index);

-- Retrieval feedback for RAG improvement loop
CREATE TABLE IF NOT EXISTS rag_retrieval_feedback (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    conversation_id TEXT,
    user_id TEXT,
    chunk_id TEXT,
    document_id TEXT,
    feedback_type TEXT NOT NULL DEFAULT 'implicit',
    signal TEXT NOT NULL DEFAULT 'unused',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rag_feedback_org
    ON rag_retrieval_feedback(organization_id, created_at DESC);

-- Conversation branching support
CREATE TABLE IF NOT EXISTS conversation_branches (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    parent_branch_id TEXT,
    fork_message_id TEXT NOT NULL,
    branch_name TEXT,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_conv_branches
    ON conversation_branches(conversation_id);

-- Pinned insights
CREATE TABLE IF NOT EXISTS pinned_insights (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    conversation_id TEXT,
    message_id TEXT,
    content TEXT NOT NULL,
    tags TEXT DEFAULT '[]',
    is_shared BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pinned_insights_user
    ON pinned_insights(user_id, organization_id, created_at DESC);

-- Prompt library
CREATE TABLE IF NOT EXISTS prompt_library (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    user_id TEXT,
    scope TEXT NOT NULL DEFAULT 'personal',
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT,
    tags TEXT DEFAULT '[]',
    usage_count INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prompt_library_scope
    ON prompt_library(scope, organization_id, user_id);
