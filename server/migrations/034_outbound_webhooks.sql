-- 034_outbound_webhooks.sql
-- Subscriptions for external systems to listen to Consultify events

CREATE TABLE webhook_subscriptions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    name TEXT NOT NULL,
    target_url TEXT NOT NULL,
    secret_key TEXT NOT NULL, -- For HMAC signature verification by receiver
    event_types TEXT NOT NULL, -- JSON array of events like ["initiative.created", "task.completed"]
    is_active BOOLEAN DEFAULT 1,
    failure_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE webhook_delivery_attempts (
    id TEXT PRIMARY KEY,
    subscription_id TEXT NOT NULL REFERENCES webhook_subscriptions(id),
    event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload TEXT NOT NULL, -- The JSON payload sent
    status TEXT NOT NULL, -- 'pending', 'success', 'failed'
    response_code INTEGER,
    response_body TEXT,
    attempt_number INTEGER DEFAULT 1,
    next_retry_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_webhook_subs_org ON webhook_subscriptions(organization_id);
CREATE INDEX idx_webhook_delivery_pending ON webhook_delivery_attempts(status, next_retry_at);
