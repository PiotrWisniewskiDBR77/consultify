-- Schema Alignment Migration
-- Adds missing columns, tables, and constraints that code expects but DB lacks.
-- All statements are idempotent (IF NOT EXISTS / safe ALTER TABLE patterns).

-- ==========================================
-- 1. users: add updated_at
-- ==========================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        UPDATE users SET updated_at = created_at WHERE updated_at IS NULL;
    END IF;
END $$;

-- ==========================================
-- 2. security_events: add description, details columns
-- ==========================================
CREATE TABLE IF NOT EXISTS security_events (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    organization_id TEXT,
    user_id TEXT,
    event_type TEXT,
    severity TEXT DEFAULT 'info',
    ip_address TEXT,
    location_city TEXT,
    location_country TEXT,
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_security_events_org ON security_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'security_events' AND column_name = 'description'
    ) THEN
        ALTER TABLE security_events ADD COLUMN description TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'security_events' AND column_name = 'details'
    ) THEN
        ALTER TABLE security_events ADD COLUMN details TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'security_events' AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE security_events ADD COLUMN organization_id TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'security_events' AND column_name = 'event_type'
    ) THEN
        ALTER TABLE security_events ADD COLUMN event_type TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'security_events' AND column_name = 'user_agent'
    ) THEN
        ALTER TABLE security_events ADD COLUMN user_agent TEXT;
    END IF;
END $$;

-- ==========================================
-- 3. usage_counters: add counter_date, ai_calls_count + unique constraint
-- ==========================================
CREATE TABLE IF NOT EXISTS usage_counters (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    counter_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'usage_counters' AND column_name = 'counter_date'
    ) THEN
        ALTER TABLE usage_counters ADD COLUMN counter_date DATE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'usage_counters' AND column_name = 'ai_calls_count'
    ) THEN
        ALTER TABLE usage_counters ADD COLUMN ai_calls_count INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'usage_counters' AND column_name = 'projects_count'
    ) THEN
        ALTER TABLE usage_counters ADD COLUMN projects_count INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'usage_counters' AND column_name = 'users_count'
    ) THEN
        ALTER TABLE usage_counters ADD COLUMN users_count INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'usage_counters' AND column_name = 'initiatives_count'
    ) THEN
        ALTER TABLE usage_counters ADD COLUMN initiatives_count INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'usage_counters' AND column_name = 'storage_used_mb'
    ) THEN
        ALTER TABLE usage_counters ADD COLUMN storage_used_mb INTEGER DEFAULT 0;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_counters_org_date
    ON usage_counters(organization_id, counter_date);

-- ==========================================
-- 4. ai_long_term_memory: create table
-- ==========================================
CREATE TABLE IF NOT EXISTS ai_long_term_memory (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    organization_id TEXT,
    key TEXT NOT NULL,
    value TEXT,
    active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, organization_id, key)
);

CREATE INDEX IF NOT EXISTS idx_ai_ltm_user ON ai_long_term_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_ltm_org ON ai_long_term_memory(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_ltm_active ON ai_long_term_memory(active);

-- ==========================================
-- 5. conversation_summaries: create table
-- ==========================================
CREATE TABLE IF NOT EXISTS conversation_summaries (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL UNIQUE,
    summary TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_conv_summaries_conv ON conversation_summaries(conversation_id);

-- ==========================================
-- 6. user_budgets: create table
-- ==========================================
CREATE TABLE IF NOT EXISTS user_budgets (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    monthly_token_budget INTEGER,
    monthly_storage_budget_gb REAL,
    monthly_cost_budget_usd REAL,
    budget_alert_80 INTEGER DEFAULT 0,
    budget_alert_90 INTEGER DEFAULT 0,
    budget_alert_100 INTEGER DEFAULT 0,
    hard_limit_enabled INTEGER DEFAULT 0,
    auto_upgrade_on_limit INTEGER DEFAULT 0,
    reset_day_of_month INTEGER DEFAULT 1,
    tokens_used_this_month INTEGER DEFAULT 0,
    storage_used_this_month_gb REAL DEFAULT 0,
    cost_this_month_usd REAL DEFAULT 0,
    last_reset_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_budgets_org ON user_budgets(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_budgets_user ON user_budgets(user_id);

-- ==========================================
-- 7. knowledge_documents: add file_path, last_indexed_at
-- ==========================================
CREATE TABLE IF NOT EXISTS knowledge_documents (
    id TEXT PRIMARY KEY,
    organization_id TEXT REFERENCES organizations(id),
    project_id TEXT REFERENCES projects(id),
    title TEXT NOT NULL,
    document_type TEXT NOT NULL DEFAULT 'markdown',
    source_type TEXT DEFAULT 'upload',
    source_url TEXT,
    original_filename TEXT,
    storage_path TEXT,
    file_hash TEXT,
    raw_content TEXT,
    processing_status TEXT DEFAULT 'pending',
    scope TEXT DEFAULT 'organization',
    visibility TEXT DEFAULT 'organization',
    is_active BOOLEAN DEFAULT TRUE,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- FRESH-DB PARITY (2026-07-14): 20260227_01_ai_governance.sql sorts BEFORE this
-- file on a fresh replay, so its guarded knowledge_documents governance columns
-- are skipped (the table did not exist yet). Re-add them here idempotently.
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS ai_visibility TEXT DEFAULT 'allowed';
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS sensitivity TEXT DEFAULT 'internal';
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS retention_class TEXT DEFAULT 'standard';

CREATE INDEX IF NOT EXISTS idx_knowledge_docs_org ON knowledge_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_project ON knowledge_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_scope ON knowledge_documents(scope);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_status ON knowledge_documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_active ON knowledge_documents(is_active, scope);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_hash ON knowledge_documents(file_hash);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'knowledge_documents' AND column_name = 'file_path'
    ) THEN
        ALTER TABLE knowledge_documents ADD COLUMN file_path TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'knowledge_documents' AND column_name = 'last_indexed_at'
    ) THEN
        ALTER TABLE knowledge_documents ADD COLUMN last_indexed_at TIMESTAMP;
    END IF;
END $$;

-- ==========================================
-- 8. knowledge_chunks: add scope, is_active
-- ==========================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'knowledge_chunks' AND column_name = 'scope'
    ) THEN
        ALTER TABLE knowledge_chunks ADD COLUMN scope TEXT DEFAULT 'organization';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'knowledge_chunks' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE knowledge_chunks ADD COLUMN is_active INTEGER DEFAULT 1;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_active ON knowledge_chunks(is_active);

-- ==========================================
-- 9. ai_instruction_suggestions: ensure both schema variants have all needed columns
-- ==========================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_instruction_suggestions') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'ai_instruction_suggestions' AND column_name = 'organization_id'
        ) THEN
            ALTER TABLE ai_instruction_suggestions ADD COLUMN organization_id TEXT;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'ai_instruction_suggestions' AND column_name = 'instruction'
        ) THEN
            ALTER TABLE ai_instruction_suggestions ADD COLUMN instruction TEXT;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'ai_instruction_suggestions' AND column_name = 'suggested_instruction'
        ) THEN
            ALTER TABLE ai_instruction_suggestions ADD COLUMN suggested_instruction TEXT;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'ai_instruction_suggestions' AND column_name = 'confidence'
        ) THEN
            ALTER TABLE ai_instruction_suggestions ADD COLUMN confidence REAL DEFAULT 0.5;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'ai_instruction_suggestions' AND column_name = 'confidence_score'
        ) THEN
            ALTER TABLE ai_instruction_suggestions ADD COLUMN confidence_score REAL DEFAULT 0.5;
        END IF;
    END IF;
END $$;

-- ==========================================
-- 10. initiatives: add estimated_duration_weeks for code compatibility
-- ==========================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'initiatives' AND column_name = 'estimated_duration_weeks'
    ) THEN
        ALTER TABLE initiatives ADD COLUMN estimated_duration_weeks INTEGER;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'initiatives' AND column_name = 'drd_axis'
    ) THEN
        ALTER TABLE initiatives ADD COLUMN drd_axis TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'initiatives' AND column_name = 'drd_area'
    ) THEN
        ALTER TABLE initiatives ADD COLUMN drd_area TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'initiatives' AND column_name = 'description'
    ) THEN
        ALTER TABLE initiatives ADD COLUMN description TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'initiatives' AND column_name = 'priority'
    ) THEN
        ALTER TABLE initiatives ADD COLUMN priority TEXT;
    END IF;
END $$;

-- Backfill drd_axis/drd_area from axis/area if they exist
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'initiatives' AND column_name = 'axis'
    ) THEN
        UPDATE initiatives SET drd_axis = axis WHERE drd_axis IS NULL AND axis IS NOT NULL;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'initiatives' AND column_name = 'area'
    ) THEN
        UPDATE initiatives SET drd_area = area WHERE drd_area IS NULL AND area IS NOT NULL;
    END IF;
END $$;

-- ==========================================
-- 11. ai_user_memory: ensure key/value columns exist (075 schema)
-- ==========================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_user_memory') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'ai_user_memory' AND column_name = 'key'
        ) THEN
            ALTER TABLE ai_user_memory ADD COLUMN key TEXT;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'ai_user_memory' AND column_name = 'value'
        ) THEN
            ALTER TABLE ai_user_memory ADD COLUMN value TEXT;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'ai_user_memory' AND column_name = 'preferences'
        ) THEN
            ALTER TABLE ai_user_memory ADD COLUMN preferences TEXT;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'ai_user_memory' AND column_name = 'expertise'
        ) THEN
            ALTER TABLE ai_user_memory ADD COLUMN expertise TEXT;
        END IF;
    END IF;
END $$;

-- ==========================================
-- 12. organizations: add updated_at if missing
-- ==========================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'organizations' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE organizations ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;
