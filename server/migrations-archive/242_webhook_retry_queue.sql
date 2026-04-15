-- GAP-BILLING-002: Webhook retry queue
-- Migration: 242_webhook_retry_queue.sql

CREATE TABLE IF NOT EXISTS webhook_retry_queue (
    id TEXT PRIMARY KEY,
    webhook_type TEXT NOT NULL, -- 'stripe', 'partner', etc.
    event_type TEXT NOT NULL, -- e.g., 'invoice.paid', 'subscription.updated'
    event_id TEXT, -- Original event ID from provider
    payload TEXT NOT NULL, -- JSON payload
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 5,
    next_retry_at TIMESTAMP,
    last_error TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_webhook_retry_status ON webhook_retry_queue(status);
CREATE INDEX IF NOT EXISTS idx_webhook_retry_next ON webhook_retry_queue(next_retry_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_webhook_retry_event ON webhook_retry_queue(event_id);
