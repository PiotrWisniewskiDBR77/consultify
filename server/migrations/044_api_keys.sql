-- Migration: 044_api_keys.sql
-- API Keys Management for M2M Integration
-- Created: 2025-12-27

-- API keys for programmatic access
CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL, -- null for org-level keys
    
    -- Key info
    name TEXT NOT NULL,
    description TEXT,
    key_hash TEXT NOT NULL, -- bcrypt hash of the actual key
    key_prefix TEXT NOT NULL, -- first 8 chars for identification (e.g., "ck_live_")
    
    -- Type
    key_type TEXT DEFAULT 'org' CHECK(key_type IN ('org', 'user', 'service')),
    
    -- Permissions
    scopes TEXT NOT NULL DEFAULT '[]', -- JSON array: ['read:users', 'write:projects']
    
    -- Rate limiting
    rate_limit_per_minute INTEGER DEFAULT 60,
    rate_limit_per_day INTEGER DEFAULT 10000,
    
    -- IP restrictions (optional)
    allowed_ips TEXT, -- JSON array of allowed IPs/CIDRs
    
    -- Usage tracking
    last_used_at TEXT,
    usage_count INTEGER DEFAULT 0,
    
    -- Expiration
    expires_at TEXT, -- null = never expires
    
    -- Status
    is_active INTEGER DEFAULT 1,
    revoked_at TEXT,
    revoked_by TEXT REFERENCES users(id),
    revoke_reason TEXT,
    
    created_at TEXT DEFAULT (datetime('now')),
    created_by TEXT REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys(organization_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active) WHERE is_active = 1;

-- API key usage tracking
CREATE TABLE IF NOT EXISTS api_key_usage (
    id TEXT PRIMARY KEY,
    api_key_id TEXT NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    
    -- Request info
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    
    -- Request metadata
    ip_address TEXT,
    user_agent TEXT,
    
    -- Rate limit info
    requests_remaining INTEGER,
    
    -- Errors (if any)
    error_code TEXT,
    error_message TEXT,
    
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_api_key_usage_key ON api_key_usage(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_date ON api_key_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_endpoint ON api_key_usage(endpoint);

-- API key rate limit tracking (for sliding window)
CREATE TABLE IF NOT EXISTS api_key_rate_limits (
    id TEXT PRIMARY KEY,
    api_key_id TEXT NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    
    -- Time window
    window_start TEXT NOT NULL,
    window_type TEXT NOT NULL CHECK(window_type IN ('minute', 'day')),
    
    -- Count
    request_count INTEGER DEFAULT 0,
    
    UNIQUE(api_key_id, window_start, window_type)
);

CREATE INDEX IF NOT EXISTS idx_api_key_rate_limits_key ON api_key_rate_limits(api_key_id);

-- Webhooks for outbound events (tied to API keys)
CREATE TABLE IF NOT EXISTS api_webhooks (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    api_key_id TEXT REFERENCES api_keys(id) ON DELETE SET NULL,
    
    -- Webhook config
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    secret TEXT, -- For signature verification
    
    -- Events
    events TEXT NOT NULL DEFAULT '[]', -- JSON array of event types
    
    -- Status
    is_active INTEGER DEFAULT 1,
    
    -- Retry config
    max_retries INTEGER DEFAULT 3,
    retry_delay_seconds INTEGER DEFAULT 60,
    
    -- Stats
    last_triggered_at TEXT,
    total_deliveries INTEGER DEFAULT 0,
    successful_deliveries INTEGER DEFAULT 0,
    failed_deliveries INTEGER DEFAULT 0,
    
    created_at TEXT DEFAULT (datetime('now')),
    created_by TEXT REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_api_webhooks_org ON api_webhooks(organization_id);
CREATE INDEX IF NOT EXISTS idx_api_webhooks_active ON api_webhooks(is_active) WHERE is_active = 1;

-- Webhook delivery log
CREATE TABLE IF NOT EXISTS api_webhook_deliveries (
    id TEXT PRIMARY KEY,
    webhook_id TEXT NOT NULL REFERENCES api_webhooks(id) ON DELETE CASCADE,
    
    -- Event
    event_type TEXT NOT NULL,
    event_id TEXT,
    payload TEXT, -- JSON
    
    -- Delivery status
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'success', 'failed', 'retrying')),
    attempts INTEGER DEFAULT 0,
    
    -- Response
    response_code INTEGER,
    response_body TEXT,
    response_time_ms INTEGER,
    
    -- Error
    error_message TEXT,
    
    -- Timing
    created_at TEXT DEFAULT (datetime('now')),
    delivered_at TEXT,
    next_retry_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON api_webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON api_webhook_deliveries(status);
















