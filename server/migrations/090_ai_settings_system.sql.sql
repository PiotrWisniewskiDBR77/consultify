-- =====================================================
-- AI Settings 3-Tier System Migration
-- SuperAdmin → Admin/Org → User settings hierarchy
-- =====================================================

-- SuperAdmin AI Settings (singleton - global platform settings)
CREATE TABLE IF NOT EXISTS superadmin_ai_settings (
    id TEXT PRIMARY KEY DEFAULT 'global',
    
    -- Provider Management
    default_provider TEXT,
    fallback_chain TEXT DEFAULT '[]', -- JSON array of provider IDs
    circuit_breaker_config TEXT DEFAULT '{"failureThreshold": 5, "cooldownSeconds": 60}', -- JSON
    
    -- Global Limits
    global_token_limit INTEGER DEFAULT 10000000,
    global_rate_limit TEXT DEFAULT '{"requestsPerMinute": 60, "requestsPerHour": 1000}', -- JSON
    max_context_window_size INTEGER DEFAULT 128000,
    max_tokens_per_request INTEGER DEFAULT 8192,
    
    -- Security & PII
    pii_detection_sensitivity TEXT DEFAULT 'medium' CHECK (pii_detection_sensitivity IN ('low', 'medium', 'high')),
    require_encryption INTEGER DEFAULT 1,
    data_residency TEXT DEFAULT NULL,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT
);

-- Organization AI Settings (per-org configuration)
CREATE TABLE IF NOT EXISTS organization_ai_settings (
    organization_id TEXT PRIMARY KEY,
    
    -- Policy Configuration
    policy_level TEXT DEFAULT 'ADVISORY' CHECK (policy_level IN ('ADVISORY', 'ASSISTED', 'PROACTIVE', 'AUTOPILOT')),
    max_policy_level TEXT DEFAULT 'ASSISTED' CHECK (max_policy_level IN ('ADVISORY', 'ASSISTED', 'PROACTIVE', 'AUTOPILOT')),
    default_proactivity_mode TEXT DEFAULT 'BALANCED' CHECK (default_proactivity_mode IN ('REACTIVE', 'BALANCED', 'PROACTIVE')),
    
    -- AI Roles Configuration
    active_roles TEXT DEFAULT '["ADVISOR"]', -- JSON array
    default_role TEXT DEFAULT 'ADVISOR',
    
    -- Model Selection (subset of SuperAdmin providers)
    enabled_model_ids TEXT DEFAULT '[]', -- JSON array of provider IDs
    
    -- Limits & Budget
    max_ai_calls_per_day INTEGER DEFAULT 100,
    max_tokens_per_month INTEGER DEFAULT 500000,
    monthly_budget_usd REAL DEFAULT 0,
    hard_limit_usd REAL DEFAULT 0,
    freeze_on_limit INTEGER DEFAULT 0,
    
    -- Feature Toggles
    web_search_enabled INTEGER DEFAULT 1,
    artifacts_enabled INTEGER DEFAULT 1,
    thinking_steps_enabled INTEGER DEFAULT 1,
    focus_modes_enabled INTEGER DEFAULT 1,
    voice_enabled INTEGER DEFAULT 0,
    
    -- Audit Configuration
    audit_all_requests INTEGER DEFAULT 0,
    audit_policy_changes INTEGER DEFAULT 1,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT,
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- User AI Settings (per-user preferences)
CREATE TABLE IF NOT EXISTS user_ai_settings (
    user_id TEXT PRIMARY KEY,
    
    -- Response Behavior
    response_style TEXT DEFAULT 'balanced' CHECK (response_style IN ('concise', 'balanced', 'detailed')),
    writing_tone TEXT DEFAULT 'professional' CHECK (writing_tone IN ('professional', 'casual', 'technical', 'friendly')),
    preferred_language TEXT DEFAULT 'auto',
    code_explanations INTEGER DEFAULT 1,
    show_sources INTEGER DEFAULT 1,
    
    -- Proactivity Mode
    proactivity_mode TEXT DEFAULT 'BALANCED' CHECK (proactivity_mode IN ('REACTIVE', 'BALANCED', 'PROACTIVE')),
    
    -- Model Parameters
    model_temperature REAL DEFAULT 0.7 CHECK (model_temperature >= 0 AND model_temperature <= 2),
    max_tokens INTEGER DEFAULT 4096,
    top_p REAL DEFAULT 1.0 CHECK (top_p >= 0 AND top_p <= 1),
    frequency_penalty REAL DEFAULT 0.0 CHECK (frequency_penalty >= -2 AND frequency_penalty <= 2),
    presence_penalty REAL DEFAULT 0.0 CHECK (presence_penalty >= -2 AND presence_penalty <= 2),
    system_instructions TEXT DEFAULT '',
    
    -- Model Selection
    visible_model_ids TEXT DEFAULT '[]', -- JSON array
    preferred_model_id TEXT DEFAULT NULL,
    
    -- Privacy Settings
    enable_pii_redaction INTEGER DEFAULT 0,
    data_retention_policy TEXT DEFAULT 'standard' CHECK (data_retention_policy IN ('minimal', 'standard', 'extended')),
    share_usage_analytics INTEGER DEFAULT 1,
    
    -- Context Settings
    context_retention TEXT DEFAULT 'session' CHECK (context_retention IN ('session', 'day', 'week', 'month', 'permanent')),
    auto_suggestions INTEGER DEFAULT 1,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- AI Settings Audit Log (tracks all setting changes)
CREATE TABLE IF NOT EXISTS ai_settings_audit (
    id TEXT PRIMARY KEY,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Level & Actor
    level TEXT NOT NULL CHECK (level IN ('superadmin', 'admin', 'user')),
    actor_id TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    
    -- Target & Change
    target_id TEXT NOT NULL, -- orgId or userId or 'global'
    setting_key TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    
    -- Request Metadata
    ip_address TEXT,
    user_agent TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_settings_audit_level ON ai_settings_audit(level);
CREATE INDEX IF NOT EXISTS idx_ai_settings_audit_timestamp ON ai_settings_audit(timestamp);
CREATE INDEX IF NOT EXISTS idx_ai_settings_audit_target ON ai_settings_audit(target_id);
CREATE INDEX IF NOT EXISTS idx_ai_settings_audit_actor ON ai_settings_audit(actor_id);

-- Insert default SuperAdmin settings if not exists
INSERT OR IGNORE INTO superadmin_ai_settings (id) VALUES ('global');

