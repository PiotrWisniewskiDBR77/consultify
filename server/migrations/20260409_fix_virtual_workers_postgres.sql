-- Fix: create virtual_workers tables for PostgreSQL
-- Original 737_virtual_workers.sql uses SQLite datetime('now') which fails on Postgres

CREATE TABLE IF NOT EXISTS virtual_workers (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'custom',
    status TEXT NOT NULL DEFAULT 'draft',
    surface TEXT NOT NULL DEFAULT 'landing_page',
    voice_enabled INTEGER NOT NULL DEFAULT 0,
    voice_name TEXT,
    locale_default TEXT NOT NULL DEFAULT 'pl',
    avatar_url TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_virtual_workers_slug ON virtual_workers(slug);
CREATE INDEX IF NOT EXISTS idx_virtual_workers_status ON virtual_workers(status);

CREATE TABLE IF NOT EXISTS virtual_worker_profiles (
    id TEXT PRIMARY KEY,
    worker_id TEXT NOT NULL REFERENCES virtual_workers(id) ON DELETE CASCADE,
    version INTEGER NOT NULL DEFAULT 1,
    persona_description TEXT,
    tone_description TEXT,
    system_prompt TEXT NOT NULL DEFAULT '',
    priority_rules TEXT,
    boundaries TEXT,
    is_active INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    activated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_vw_profiles_worker ON virtual_worker_profiles(worker_id);
CREATE INDEX IF NOT EXISTS idx_vw_profiles_active ON virtual_worker_profiles(worker_id, is_active);

CREATE TABLE IF NOT EXISTS virtual_worker_knowledge_assignments (
    id TEXT PRIMARY KEY,
    worker_id TEXT NOT NULL REFERENCES virtual_workers(id) ON DELETE CASCADE,
    knowledge_source_type TEXT NOT NULL DEFAULT 'product_pill',
    knowledge_doc_id TEXT,
    product_slug TEXT,
    priority_weight REAL NOT NULL DEFAULT 1.0,
    assigned_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vw_knowledge_worker ON virtual_worker_knowledge_assignments(worker_id);
CREATE INDEX IF NOT EXISTS idx_vw_knowledge_doc ON virtual_worker_knowledge_assignments(knowledge_doc_id);

CREATE TABLE IF NOT EXISTS virtual_worker_conversations (
    id TEXT PRIMARY KEY,
    worker_id TEXT NOT NULL REFERENCES virtual_workers(id) ON DELETE CASCADE,
    session_id TEXT,
    channel TEXT NOT NULL DEFAULT 'text_chat',
    locale TEXT,
    visitor_fingerprint TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    message_count INTEGER NOT NULL DEFAULT 0,
    duration_seconds INTEGER,
    outcome TEXT DEFAULT 'unknown',
    metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_vw_conv_worker ON virtual_worker_conversations(worker_id);
CREATE INDEX IF NOT EXISTS idx_vw_conv_session ON virtual_worker_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_vw_conv_started ON virtual_worker_conversations(started_at);
CREATE INDEX IF NOT EXISTS idx_vw_conv_outcome ON virtual_worker_conversations(outcome);

CREATE TABLE IF NOT EXISTS virtual_worker_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES virtual_worker_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    knowledge_sources_used TEXT,
    matched_products TEXT,
    token_count INTEGER,
    latency_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vw_msg_conv ON virtual_worker_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_vw_msg_created ON virtual_worker_messages(created_at);

CREATE TABLE IF NOT EXISTS virtual_worker_insights (
    id TEXT PRIMARY KEY,
    worker_id TEXT NOT NULL REFERENCES virtual_workers(id) ON DELETE CASCADE,
    insight_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    evidence TEXT,
    priority TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'new',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_vw_insights_worker ON virtual_worker_insights(worker_id);
CREATE INDEX IF NOT EXISTS idx_vw_insights_status ON virtual_worker_insights(status);
CREATE INDEX IF NOT EXISTS idx_vw_insights_type ON virtual_worker_insights(insight_type);

-- Seed Anna worker if not exists
INSERT INTO virtual_workers (id, slug, name, role, status, surface, voice_enabled, locale_default, description)
VALUES (
    'anna-default-001',
    'anna',
    'Anna',
    'sales_assistant',
    'active',
    'landing_page',
    1,
    'pl',
    'Public-facing sales assistant for landing pages'
)
ON CONFLICT (slug) DO NOTHING;

-- Seed Anna's default profile by resolving the worker via slug (the worker row
-- may already exist under a different id on drifted DBs, where the literal
-- 'anna-default-001' was never inserted — that caused an FK violation). Only
-- seed when the worker has no profile yet, so existing profiles are preserved.
-- is_active is INTEGER NOT NULL in the canonical schema (see CREATE above), so
-- seed it as 1 (active). The earlier TRUE was staging-only where the column had
-- drifted to boolean; prod and fresh DBs use the integer column.
INSERT INTO virtual_worker_profiles (id, worker_id, version, system_prompt, is_active)
SELECT 'anna-profile-001', vw.id, 1,
       'You are Anna, a knowledgeable and friendly AI sales assistant.', 1
FROM virtual_workers vw
WHERE vw.slug = 'anna'
  AND NOT EXISTS (
    SELECT 1 FROM virtual_worker_profiles p WHERE p.worker_id = vw.id
  )
ON CONFLICT (id) DO NOTHING;
