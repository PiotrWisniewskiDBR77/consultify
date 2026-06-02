-- Support Tickets Tables
-- Migration: 203_support_tickets.sql

-- Support Tickets
CREATE TABLE IF NOT EXISTS support_tickets (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    organization_id TEXT REFERENCES organizations(id),
    user_id TEXT REFERENCES users(id),
    subject TEXT NOT NULL,
    description TEXT,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'open',
    category TEXT DEFAULT 'general',
    assigned_to TEXT REFERENCES users(id),
    resolved_at TIMESTAMP,
    resolution_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CS Notes (Customer Success notes)
CREATE TABLE IF NOT EXISTS cs_notes (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    author_id TEXT REFERENCES users(id),
    note_type TEXT DEFAULT 'general',
    content TEXT NOT NULL,
    is_private INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customer Health Scores
CREATE TABLE IF NOT EXISTS customer_health_scores (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    organization_id TEXT NOT NULL REFERENCES organizations(id) UNIQUE,
    score INTEGER DEFAULT 100,
    usage_score INTEGER DEFAULT 100,
    engagement_score INTEGER DEFAULT 100,
    support_score INTEGER DEFAULT 100,
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_support_tickets_org ON support_tickets(organization_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_cs_notes_org ON cs_notes(organization_id);
CREATE INDEX IF NOT EXISTS idx_health_scores_org ON customer_health_scores(organization_id);

-- Sample tickets
INSERT OR IGNORE INTO support_tickets (id, organization_id, subject, description, priority, status, category) 
SELECT 
    'ticket-' || substr(o.id, 1, 8) || '-1',
    o.id,
    'Initial setup assistance',
    'Need help configuring AI features for our team',
    'medium',
    'resolved',
    'onboarding'
FROM organizations o LIMIT 1;

INSERT OR IGNORE INTO support_tickets (id, organization_id, subject, description, priority, status, category) 
SELECT 
    'ticket-' || substr(o.id, 1, 8) || '-2',
    o.id,
    'API integration question',
    'How do we integrate with our existing CRM?',
    'high',
    'open',
    'integration'
FROM organizations o LIMIT 1;

-- Sample health scores
INSERT OR IGNORE INTO customer_health_scores (id, organization_id, score, usage_score, engagement_score, support_score)
SELECT 
    'health-' || substr(o.id, 1, 8),
    o.id,
    85,
    90,
    80,
    85
FROM organizations o
WHERE NOT EXISTS (SELECT 1 FROM customer_health_scores WHERE organization_id = o.id);
