-- Virtual Workers module: core tables for managing AI virtual workers
-- (Anna = sales LP, Teresa = internal consultant, future workers)

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
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_virtual_workers_slug ON virtual_workers(slug);
CREATE INDEX IF NOT EXISTS idx_virtual_workers_status ON virtual_workers(status);

CREATE TABLE IF NOT EXISTS virtual_worker_profiles (
    id TEXT PRIMARY KEY,
    worker_id TEXT NOT NULL REFERENCES virtual_workers(id) ON DELETE CASCADE,
    version INTEGER NOT NULL DEFAULT 1,
    persona_description TEXT,
    tone_description TEXT,
    system_prompt TEXT NOT NULL,
    priority_rules TEXT,
    boundaries TEXT,
    is_active INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    activated_at TEXT
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
    assigned_at TEXT DEFAULT CURRENT_TIMESTAMP
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
    started_at TEXT DEFAULT CURRENT_TIMESTAMP,
    ended_at TEXT,
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
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
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
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TEXT,
    reviewed_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_vw_insights_worker ON virtual_worker_insights(worker_id);
CREATE INDEX IF NOT EXISTS idx_vw_insights_status ON virtual_worker_insights(status);
CREATE INDEX IF NOT EXISTS idx_vw_insights_type ON virtual_worker_insights(insight_type);
