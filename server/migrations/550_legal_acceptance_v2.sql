-- ===========================================
-- 550_legal_acceptance_v2.sql
-- T093: Legal Agreements — schema alignment with V2 spec (PostgreSQL)
-- Adds missing columns to legal_documents and legal_document_acceptances
-- ===========================================

DO $$
BEGIN
    -- Add content_md column (V2 canonical name for markdown content)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'legal_documents' AND column_name = 'content_md'
    ) THEN
        ALTER TABLE legal_documents ADD COLUMN content_md TEXT;
    END IF;

    -- Add doc_type column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'legal_documents' AND column_name = 'doc_type'
    ) THEN
        ALTER TABLE legal_documents ADD COLUMN doc_type TEXT;
    END IF;

    -- Add effective_from column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'legal_documents' AND column_name = 'effective_from'
    ) THEN
        ALTER TABLE legal_documents ADD COLUMN effective_from TEXT;
    END IF;

    -- Add expires_at column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'legal_documents' AND column_name = 'expires_at'
    ) THEN
        ALTER TABLE legal_documents ADD COLUMN expires_at TEXT;
    END IF;

    -- Add is_active column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'legal_documents' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE legal_documents ADD COLUMN is_active BOOLEAN DEFAULT FALSE;
    END IF;

    -- Add change_summary column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'legal_documents' AND column_name = 'change_summary'
    ) THEN
        ALTER TABLE legal_documents ADD COLUMN change_summary TEXT;
    END IF;

    -- Add scope_type column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'legal_documents' AND column_name = 'scope_type'
    ) THEN
        ALTER TABLE legal_documents ADD COLUMN scope_type TEXT DEFAULT 'global';
    END IF;

    -- Add scope_value column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'legal_documents' AND column_name = 'scope_value'
    ) THEN
        ALTER TABLE legal_documents ADD COLUMN scope_value TEXT;
    END IF;

    -- Add previous_version_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'legal_documents' AND column_name = 'previous_version_id'
    ) THEN
        ALTER TABLE legal_documents ADD COLUMN previous_version_id TEXT;
    END IF;

    -- Add title column (may already exist from original schema)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'legal_documents' AND column_name = 'title'
    ) THEN
        ALTER TABLE legal_documents ADD COLUMN title TEXT;
    END IF;

    -- Add requires_reaccept_from column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'legal_documents' AND column_name = 'requires_reaccept_from'
    ) THEN
        ALTER TABLE legal_documents ADD COLUMN requires_reaccept_from TEXT;
    END IF;

    -- Add organization_id to acceptances for ORG_ADMIN scope
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'legal_document_acceptances' AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE legal_document_acceptances ADD COLUMN organization_id TEXT;
    END IF;

    -- Add scope to acceptances
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'legal_document_acceptances' AND column_name = 'scope'
    ) THEN
        ALTER TABLE legal_document_acceptances ADD COLUMN scope TEXT DEFAULT 'USER';
    END IF;
END $$;

-- Backfill: copy content to content_md
UPDATE legal_documents SET content_md = content WHERE content_md IS NULL AND content IS NOT NULL;

-- Backfill: doc_type from type
UPDATE legal_documents SET doc_type = UPPER(type) WHERE doc_type IS NULL AND type IS NOT NULL;

-- Backfill: effective_from from effective_date
UPDATE legal_documents SET effective_from = effective_date WHERE effective_from IS NULL AND effective_date IS NOT NULL;

-- Backfill: is_active from status
UPDATE legal_documents SET is_active = (status = 'active') WHERE is_active IS NULL OR is_active = FALSE;

-- Backfill: title from name
UPDATE legal_documents SET title = name WHERE title IS NULL AND name IS NOT NULL;

-- Indexes for V2 queries
CREATE INDEX IF NOT EXISTS idx_legal_docs_doc_type ON legal_documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_legal_docs_is_active ON legal_documents(is_active);
CREATE INDEX IF NOT EXISTS idx_legal_docs_doc_type_active ON legal_documents(doc_type, is_active);
CREATE INDEX IF NOT EXISTS idx_legal_acceptances_org ON legal_document_acceptances(organization_id);
CREATE INDEX IF NOT EXISTS idx_legal_acceptances_user_doc_type ON legal_document_acceptances(user_id, document_type);
