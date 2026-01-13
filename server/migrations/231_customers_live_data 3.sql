-- Customers module live data and safety fallbacks
-- Seeds minimal data for security events, lifecycle, support/CS to avoid empty states in demo

-- Security events table (used by SuperAdmin Security Events)
CREATE TABLE IF NOT EXISTS security_events (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    user_id TEXT,
    event_type TEXT,
    severity TEXT DEFAULT 'low',
    ip_address TEXT,
    location_city TEXT,
    location_country TEXT,
    user_agent TEXT,
    resolved INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_resolved ON security_events(resolved);

-- Seed a couple of security events mapped to existing org/user if available
WITH org AS (
    SELECT id FROM organizations LIMIT 1
),
usr AS (
    SELECT id FROM users LIMIT 1
)
INSERT OR IGNORE INTO security_events (id, organization_id, user_id, event_type, severity, ip_address, location_city, location_country, resolved, created_at)
SELECT
    'sec-evt-1',
    o.id,
    u.id,
    'LOGIN_SUCCESS',
    'low',
    '192.168.0.10',
    'Warsaw',
    'PL',
    1,
    datetime('now', '-1 hour')
FROM org o LEFT JOIN usr u ON 1=1
WHERE NOT EXISTS (SELECT 1 FROM security_events WHERE id = 'sec-evt-1');

WITH org AS (
    SELECT id FROM organizations LIMIT 1 OFFSET 1
),
usr AS (
    SELECT id FROM users LIMIT 1 OFFSET 1
)
INSERT OR IGNORE INTO security_events (id, organization_id, user_id, event_type, severity, ip_address, location_city, location_country, resolved, created_at)
SELECT
    'sec-evt-2',
    o.id,
    u.id,
    'LOGIN_FAILED',
    'medium',
    '10.0.0.5',
    'Krakow',
    'PL',
    0,
    datetime('now', '-2 hours')
FROM org o LEFT JOIN usr u ON 1=1
WHERE NOT EXISTS (SELECT 1 FROM security_events WHERE id = 'sec-evt-2');

-- Customer lifecycle: create a transition so pipeline is not empty
WITH org AS (SELECT id FROM organizations LIMIT 1),
stage_to AS (SELECT id FROM customer_lifecycle_stages WHERE id = 'stage-onboarding' LIMIT 1),
stage_from AS (SELECT id FROM customer_lifecycle_stages WHERE id = 'stage-trial' LIMIT 1)
INSERT OR IGNORE INTO customer_lifecycle_transitions (id, organization_id, from_stage_id, to_stage_id, notes, transitioned_at)
SELECT
    'lifecycle-transition-1',
    o.id,
    sf.id,
    st.id,
    'Auto-transition to Onboarding for demo',
    datetime('now', '-3 days')
FROM org o
LEFT JOIN stage_from sf ON 1=1
LEFT JOIN stage_to st ON 1=1
WHERE NOT EXISTS (SELECT 1 FROM customer_lifecycle_transitions WHERE id = 'lifecycle-transition-1');

-- CS Notes seed
WITH org AS (SELECT id FROM organizations LIMIT 1),
usr AS (SELECT id FROM users LIMIT 1)
INSERT OR IGNORE INTO cs_notes (id, organization_id, author_id, note_type, content, is_private, created_at)
SELECT
    'cs-note-1',
    o.id,
    u.id,
    'touchpoint',
    'Quarterly review scheduled with customer success.',
    0,
    datetime('now', '-5 days')
FROM org o LEFT JOIN usr u ON 1=1
WHERE NOT EXISTS (SELECT 1 FROM cs_notes WHERE id = 'cs-note-1');

-- Support ticket seed (additional to existing)
WITH org AS (SELECT id FROM organizations LIMIT 1 OFFSET 1)
INSERT OR IGNORE INTO support_tickets (id, organization_id, subject, description, priority, status, category, created_at)
SELECT
    'ticket-demo-003',
    o.id,
    'SLA breach investigation',
    'Customer reported delayed responses; review SLA metrics.',
    'high',
    'open',
    'support',
    datetime('now', '-1 day')
FROM org o
WHERE NOT EXISTS (SELECT 1 FROM support_tickets WHERE id = 'ticket-demo-003');

-- Customer health score fallback for any orgs missing entries
INSERT OR IGNORE INTO customer_health_scores (id, organization_id, score, usage_score, engagement_score, support_score, calculated_at)
SELECT
    'health-fallback-' || substr(o.id, 1, 8),
    o.id,
    78,
    80,
    75,
    77,
    datetime('now', '-2 days')
FROM organizations o
WHERE NOT EXISTS (SELECT 1 FROM customer_health_scores WHERE organization_id = o.id);
