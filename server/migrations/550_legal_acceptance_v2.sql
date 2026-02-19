-- ===========================================
-- 550_legal_acceptance_v2.sql
-- T093: Legal Agreements — schema alignment with V2 spec
-- Adds missing columns to legal_documents and legal_document_acceptances
-- ===========================================

-- Add content_md column (V2 canonical name for markdown content)
ALTER TABLE legal_documents ADD COLUMN IF NOT EXISTS content_md TEXT;

-- Copy existing content to content_md where not already set
UPDATE legal_documents SET content_md = content WHERE content_md IS NULL AND content IS NOT NULL;

-- Add V2 columns to legal_documents
ALTER TABLE legal_documents ADD COLUMN IF NOT EXISTS doc_type TEXT;
ALTER TABLE legal_documents ADD COLUMN IF NOT EXISTS effective_from TEXT;
ALTER TABLE legal_documents ADD COLUMN IF NOT EXISTS expires_at TEXT;
ALTER TABLE legal_documents ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT FALSE;
ALTER TABLE legal_documents ADD COLUMN IF NOT EXISTS change_summary TEXT;
ALTER TABLE legal_documents ADD COLUMN IF NOT EXISTS scope_type TEXT DEFAULT 'global';
ALTER TABLE legal_documents ADD COLUMN IF NOT EXISTS scope_value TEXT;
ALTER TABLE legal_documents ADD COLUMN IF NOT EXISTS previous_version_id TEXT;
ALTER TABLE legal_documents ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE legal_documents ADD COLUMN IF NOT EXISTS requires_reaccept_from TEXT;

-- Backfill doc_type from type
UPDATE legal_documents SET doc_type = UPPER(type) WHERE doc_type IS NULL AND type IS NOT NULL;

-- Backfill effective_from from effective_date
UPDATE legal_documents SET effective_from = effective_date WHERE effective_from IS NULL AND effective_date IS NOT NULL;

-- Backfill is_active from status
UPDATE legal_documents SET is_active = (status = 'active') WHERE is_active IS NULL OR is_active = FALSE;

-- Backfill title from name
UPDATE legal_documents SET title = name WHERE title IS NULL AND name IS NOT NULL;

-- Add organization_id to acceptances for ORG_ADMIN scope
ALTER TABLE legal_document_acceptances ADD COLUMN IF NOT EXISTS organization_id TEXT;
ALTER TABLE legal_document_acceptances ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'USER';

-- Indexes for V2 queries
CREATE INDEX IF NOT EXISTS idx_legal_docs_doc_type ON legal_documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_legal_docs_is_active ON legal_documents(is_active);
CREATE INDEX IF NOT EXISTS idx_legal_docs_doc_type_active ON legal_documents(doc_type, is_active);
CREATE INDEX IF NOT EXISTS idx_legal_acceptances_org ON legal_document_acceptances(organization_id);
CREATE INDEX IF NOT EXISTS idx_legal_acceptances_user_doc_type ON legal_document_acceptances(user_id, document_type);
