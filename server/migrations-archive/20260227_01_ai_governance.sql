-- Migration: 20260227_01_ai_governance.sql
-- T119-T121: AI Governance schema extensions
-- Date: 2026-02-27

DO $$
BEGIN
    -- T119: context_policy_json on organization_ai_settings
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organization_ai_settings') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organization_ai_settings' AND column_name = 'context_policy_json') THEN
            ALTER TABLE organization_ai_settings ADD COLUMN context_policy_json TEXT;
        END IF;
    END IF;

    -- T120: Privacy columns on ai_user_preferences
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ai_user_preferences') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ai_user_preferences' AND column_name = 'memory_enabled') THEN
            ALTER TABLE ai_user_preferences ADD COLUMN memory_enabled INTEGER DEFAULT 1;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ai_user_preferences' AND column_name = 'memory_write_enabled') THEN
            ALTER TABLE ai_user_preferences ADD COLUMN memory_write_enabled INTEGER DEFAULT 1;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ai_user_preferences' AND column_name = 'private_mode_default') THEN
            ALTER TABLE ai_user_preferences ADD COLUMN private_mode_default INTEGER DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ai_user_preferences' AND column_name = 'retention_mode') THEN
            ALTER TABLE ai_user_preferences ADD COLUMN retention_mode TEXT DEFAULT 'session';
        END IF;
    END IF;

    -- T121: ai_visibility + sensitivity on knowledge_documents
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'knowledge_documents') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'knowledge_documents' AND column_name = 'ai_visibility') THEN
            ALTER TABLE knowledge_documents ADD COLUMN ai_visibility TEXT DEFAULT 'allowed';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'knowledge_documents' AND column_name = 'sensitivity') THEN
            ALTER TABLE knowledge_documents ADD COLUMN sensitivity TEXT DEFAULT 'internal';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'knowledge_documents' AND column_name = 'retention_class') THEN
            ALTER TABLE knowledge_documents ADD COLUMN retention_class TEXT DEFAULT 'standard';
        END IF;
    END IF;
END $$;

-- T121: Doc usage audit log
CREATE TABLE IF NOT EXISTS ai_doc_usage_log (
    id TEXT PRIMARY KEY,
    chat_run_id TEXT,
    organization_id TEXT,
    project_id TEXT,
    user_id TEXT,
    used_document_ids_json TEXT,
    blocked_document_ids_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_doc_usage_org ON ai_doc_usage_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_doc_usage_project ON ai_doc_usage_log(project_id);
