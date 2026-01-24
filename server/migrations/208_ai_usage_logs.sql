-- AI Usage Logs Table
-- Tracks all AI/LLM API calls for analytics, monitoring, and billing

CREATE TABLE IF NOT EXISTS ai_usage_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    organization_id TEXT,
    provider TEXT NOT NULL,
    model TEXT,
    action TEXT,
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    latency_ms INTEGER DEFAULT 0,
    status TEXT DEFAULT 'success',
    error_message TEXT,
    metadata TEXT, -- JSON for additional context
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user ON ai_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_org ON ai_usage_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_provider ON ai_usage_logs(provider);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created ON ai_usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_status ON ai_usage_logs(status);

-- Composite index for analytics queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_analytics ON ai_usage_logs(organization_id, created_at, provider);
