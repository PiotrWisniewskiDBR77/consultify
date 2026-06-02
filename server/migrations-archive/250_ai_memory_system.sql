-- FLOW-AI-001: AI Chat & Assistance - Memory System
-- Migration: 250_ai_memory_system.sql

-- ==========================================
-- AI USER MEMORY
-- ==========================================

CREATE TABLE IF NOT EXISTS ai_user_memory (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    
    -- Preferences
    preferences TEXT, -- JSON: {language, detailLevel, communicationStyle}
    
    -- Context
    expertise TEXT, -- JSON array of expertise areas
    recent_topics TEXT, -- JSON array of recent conversation topics
    assigned_projects TEXT, -- JSON array of project IDs
    
    -- Interaction stats
    interaction_count INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0,
    avg_response_rating REAL,
    
    -- Timestamps
    last_interaction_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_user_memory_user ON ai_user_memory(user_id);

-- ==========================================
-- AI ORGANIZATION MEMORY
-- ==========================================

CREATE TABLE IF NOT EXISTS ai_org_memory (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL UNIQUE,
    
    -- Company context
    industry TEXT,
    company_size TEXT,
    company_context TEXT, -- JSON with strategic context
    
    -- Terminology
    terminology TEXT, -- JSON: {term: definition}
    
    -- Learning
    decision_patterns TEXT, -- JSON array of learned patterns
    common_queries TEXT, -- JSON array of frequent query types
    
    -- Assessment history
    assessment_summary TEXT, -- JSON with assessment findings
    
    -- AI Maturity stage
    ai_maturity_stage TEXT DEFAULT 'sceptic', -- 'sceptic', 'partner', 'autonomy'
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_org_memory_org ON ai_org_memory(organization_id);

-- ==========================================
-- AI ACTIONS CONFIGURATION
-- ==========================================

CREATE TABLE IF NOT EXISTS ai_actions_config (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    project_id TEXT, -- NULL for org-wide config
    
    -- Allowed actions (JSON)
    allowed_actions TEXT DEFAULT '{"suggestInitiatives":true,"createDraftInitiatives":false,"createTasks":false,"assignTasks":false,"updateTaskStatus":false,"createDecisionRequests":false,"makeRecommendations":true,"sendNotifications":false,"modifyBudgets":false,"approveItems":false}',
    
    -- Approval requirements (JSON)
    approval_required TEXT DEFAULT '{"createInitiatives":true,"createTasks":true,"assignTasks":true}',
    
    -- Autonomy level
    autonomy_level TEXT DEFAULT 'advisory', -- 'advisory', 'assisted', 'autonomous'
    
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(organization_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_actions_config_org ON ai_actions_config(organization_id);

-- ==========================================
-- AI ACTIONS LOG
-- ==========================================

CREATE TABLE IF NOT EXISTS ai_actions_log (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    conversation_id TEXT,
    
    -- Action details
    action_type TEXT NOT NULL, -- 'suggestion', 'draft_initiative', 'draft_task', 'recommendation', etc.
    action_data TEXT NOT NULL, -- JSON with action parameters
    action_description TEXT, -- Human-readable description
    
    -- Related entities
    target_type TEXT, -- 'initiative', 'task', 'decision', 'project'
    target_id TEXT,
    
    -- Approval workflow
    requires_approval INTEGER DEFAULT 0,
    approval_status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'auto_approved'
    approved_by TEXT,
    approved_at TIMESTAMP,
    rejection_reason TEXT,
    
    -- Execution
    executed INTEGER DEFAULT 0,
    executed_at TIMESTAMP,
    execution_result TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_actions_log_org ON ai_actions_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_actions_log_user ON ai_actions_log(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_actions_log_status ON ai_actions_log(approval_status);
CREATE INDEX IF NOT EXISTS idx_ai_actions_log_type ON ai_actions_log(action_type);

-- ==========================================
-- AI CONVERSATION CONTEXT
-- ==========================================

CREATE TABLE IF NOT EXISTS ai_conversation_context (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    
    -- Context type
    context_type TEXT NOT NULL, -- 'project', 'initiative', 'assessment', 'tool', 'decision'
    context_id TEXT, -- ID of the related entity
    context_data TEXT, -- JSON with context details
    
    -- Active during conversation
    is_active INTEGER DEFAULT 1,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_conv_context_conv ON ai_conversation_context(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_conv_context_type ON ai_conversation_context(context_type);

-- ==========================================
-- SEED DEFAULT ACTIONS CONFIG
-- ==========================================

-- This will be created per-organization when needed
