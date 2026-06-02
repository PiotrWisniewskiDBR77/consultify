-- Enterprise Compliance Hardening
-- SOC2 audit trail, advanced DLP, data residency, retention automation, org AI policies

-- Immutable SOC2 audit trail (no UPDATE/DELETE)
CREATE TABLE IF NOT EXISTS ai_soc2_audit_trail (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT,
    conversation_id TEXT,
    message_id TEXT,
    event_type TEXT NOT NULL,
    request_hash TEXT,
    response_hash TEXT,
    model_id TEXT,
    tokens_input INTEGER DEFAULT 0,
    tokens_output INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0,
    latency_ms INTEGER DEFAULT 0,
    policy_decisions_json TEXT DEFAULT '[]',
    metadata_json TEXT DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_soc2_audit_org_date
    ON ai_soc2_audit_trail(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_soc2_audit_user
    ON ai_soc2_audit_trail(user_id, created_at DESC);

-- Advanced DLP rules per org
CREATE TABLE IF NOT EXISTS ai_dlp_rules (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    rule_name TEXT NOT NULL,
    rule_type TEXT NOT NULL DEFAULT 'regex',
    pattern TEXT NOT NULL,
    action TEXT NOT NULL DEFAULT 'block',
    applies_to TEXT NOT NULL DEFAULT 'both',
    severity TEXT NOT NULL DEFAULT 'high',
    is_active BOOLEAN DEFAULT TRUE,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dlp_rules_org
    ON ai_dlp_rules(organization_id, is_active);

-- Organization AI policy configuration
CREATE TABLE IF NOT EXISTS organization_ai_config (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL UNIQUE,
    allowed_topics TEXT DEFAULT '[]',
    blocked_topics TEXT DEFAULT '[]',
    max_tokens_per_conversation INTEGER DEFAULT 50000,
    max_tokens_per_message INTEGER DEFAULT 8000,
    mandatory_disclaimers TEXT DEFAULT '[]',
    required_citation_mode TEXT DEFAULT 'recommended',
    blocked_tools TEXT DEFAULT '[]',
    allowed_models TEXT DEFAULT '[]',
    data_residency_region TEXT,
    enforce_eu_only BOOLEAN DEFAULT FALSE,
    custom_safety_rules TEXT DEFAULT '[]',
    updated_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_org_ai_config
    ON organization_ai_config(organization_id);

-- Retention schedule tracking
CREATE TABLE IF NOT EXISTS ai_retention_schedule (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    data_type TEXT NOT NULL,
    retention_days INTEGER NOT NULL DEFAULT 90,
    next_cleanup_at TIMESTAMP,
    last_cleanup_at TIMESTAMP,
    items_deleted_total INTEGER DEFAULT 0,
    notification_sent BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_retention_schedule_org
    ON ai_retention_schedule(organization_id, is_active);

-- Preserved conversations (exempt from retention)
CREATE TABLE IF NOT EXISTS preserved_conversations (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    preserved_by TEXT NOT NULL,
    reason TEXT,
    preserved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_preserved_conv
    ON preserved_conversations(conversation_id);

-- Conversation participants for multi-user sessions
CREATE TABLE IF NOT EXISTS conversation_participants (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_participants
    ON conversation_participants(conversation_id);
