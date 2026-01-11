-- Customer Communications
-- Migration: 241_customer_communications.sql

-- Communications table
CREATE TABLE IF NOT EXISTS customer_communications (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    type TEXT NOT NULL CHECK(type IN ('email', 'announcement', 'broadcast')),
    subject TEXT NOT NULL,
    content TEXT,
    recipients_filter TEXT DEFAULT '{}',
    recipient_count INTEGER DEFAULT 0,
    sent_at TIMESTAMP,
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'scheduled', 'sending', 'sent', 'failed')),
    open_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    created_by TEXT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_communications_status ON customer_communications(status);
CREATE INDEX IF NOT EXISTS idx_communications_type ON customer_communications(type);
CREATE INDEX IF NOT EXISTS idx_communications_sent ON customer_communications(sent_at DESC);

-- Sample Communications
INSERT OR IGNORE INTO customer_communications (id, type, subject, content, recipients_filter, recipient_count, sent_at, status, open_count) VALUES
    ('comm-1', 'email', 'Platform Update: New AI Features', 'We are excited to announce new AI capabilities in the platform...', '{"audience":"all_active"}', 156, datetime('now', '-2 days'), 'sent', 65),
    ('comm-2', 'announcement', 'Scheduled Maintenance Notice', 'Please be advised that scheduled maintenance will occur...', '{"audience":"all"}', 200, datetime('now', '-5 days'), 'sent', 156),
    ('comm-3', 'broadcast', 'Welcome to Q1 2026!', 'As we begin the new quarter, we wanted to share our roadmap...', '{"audience":"enterprise"}', 45, datetime('now', '-7 days'), 'sent', 29);
