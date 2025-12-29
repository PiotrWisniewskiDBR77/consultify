-- Migration: Learning System and Proactive Nudges
-- Creates tables for AI learning, nudges, and analytics

-- AI Learning Interactions
CREATE TABLE IF NOT EXISTS ai_learning_interactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT,
    request_type TEXT NOT NULL,
    prompt_hash TEXT,
    response_quality REAL,
    feedback_score INTEGER,
    metadata TEXT, -- JSON
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_learning_org ON ai_learning_interactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_learning_type ON ai_learning_interactions(request_type);
CREATE INDEX IF NOT EXISTS idx_learning_hash ON ai_learning_interactions(prompt_hash);
CREATE INDEX IF NOT EXISTS idx_learning_quality ON ai_learning_interactions(response_quality);

-- AI Learned Patterns
CREATE TABLE IF NOT EXISTS ai_learned_patterns (
    id TEXT PRIMARY KEY, -- organization_id:request_type
    organization_id TEXT NOT NULL,
    request_type TEXT NOT NULL,
    successful_patterns TEXT, -- JSON array
    failed_patterns TEXT, -- JSON array
    sample_count INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_patterns_org ON ai_learned_patterns(organization_id);

-- AI Nudge Log
CREATE TABLE IF NOT EXISTS ai_nudge_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT,
    nudge_id TEXT NOT NULL,
    shown_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acted_upon BOOLEAN DEFAULT false,
    action TEXT,
    acted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_nudge_log_user ON ai_nudge_log(user_id);
CREATE INDEX IF NOT EXISTS idx_nudge_log_nudge ON ai_nudge_log(nudge_id);

-- AI Nudge Dismissals
CREATE TABLE IF NOT EXISTS ai_nudge_dismissals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    nudge_id TEXT NOT NULL,
    dismissed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_nudge_dismiss_user ON ai_nudge_dismissals(user_id, nudge_id);

-- Enterprise Audit Log for AI
CREATE TABLE IF NOT EXISTS ai_audit_log (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id TEXT NOT NULL,
    organization_id TEXT,
    action TEXT NOT NULL, -- 'ai_request', 'ai_response', 'tool_use', 'data_access', etc.
    resource_type TEXT, -- 'assessment', 'report', 'initiative', etc.
    resource_id TEXT,
    request_summary TEXT,
    response_summary TEXT,
    model_used TEXT,
    tokens_used INTEGER,
    cost_usd REAL,
    ip_address TEXT,
    user_agent TEXT,
    risk_level TEXT DEFAULT 'LOW', -- LOW, MEDIUM, HIGH
    flagged BOOLEAN DEFAULT false,
    flag_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON ai_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_org ON ai_audit_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON ai_audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_flagged ON ai_audit_log(flagged);
CREATE INDEX IF NOT EXISTS idx_audit_risk ON ai_audit_log(risk_level);

-- Data Access Tracking
CREATE TABLE IF NOT EXISTS ai_data_access_log (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id TEXT NOT NULL,
    organization_id TEXT,
    data_type TEXT NOT NULL, -- 'assessment', 'report', 'user_data', etc.
    data_id TEXT,
    access_type TEXT, -- 'read', 'include_in_context', 'summarize'
    purpose TEXT, -- Why the AI accessed this data
    ai_request_id TEXT -- Link to the AI request that triggered this
);

CREATE INDEX IF NOT EXISTS idx_data_access_user ON ai_data_access_log(user_id);
CREATE INDEX IF NOT EXISTS idx_data_access_org ON ai_data_access_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_data_access_type ON ai_data_access_log(data_type);

-- Rate Limiting Rules (per organization)
CREATE TABLE IF NOT EXISTS ai_rate_limits (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    rule_name TEXT NOT NULL,
    limit_type TEXT NOT NULL, -- 'per_minute', 'per_hour', 'per_day', 'per_month'
    limit_value INTEGER NOT NULL,
    applies_to TEXT, -- 'all', 'chat', 'report', 'initiative', etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, rule_name)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_org ON ai_rate_limits(organization_id);

-- Organization AI Settings
CREATE TABLE IF NOT EXISTS ai_organization_settings (
    organization_id TEXT PRIMARY KEY,
    enabled_features TEXT, -- JSON array of enabled features
    disabled_models TEXT, -- JSON array of disabled models
    max_tokens_per_request INTEGER DEFAULT 4000,
    allow_web_research BOOLEAN DEFAULT true,
    allow_tool_calling BOOLEAN DEFAULT true,
    data_retention_days INTEGER DEFAULT 90,
    require_approval_for TEXT, -- JSON array of actions requiring approval
    custom_system_prompt TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User AI Preferences
CREATE TABLE IF NOT EXISTS ai_user_preferences (
    user_id TEXT PRIMARY KEY,
    preferred_language TEXT DEFAULT 'pl',
    preferred_detail_level TEXT DEFAULT 'balanced', -- 'brief', 'balanced', 'detailed'
    enable_proactive_nudges BOOLEAN DEFAULT true,
    enable_max_mode BOOLEAN DEFAULT false,
    custom_instructions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

