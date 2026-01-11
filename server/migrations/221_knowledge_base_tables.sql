-- Migration: 221_knowledge_base_tables.sql
-- Purpose: Create knowledge base tables for ideas and strategies
-- Date: 2025-01-01

-- ============================================
-- KNOWLEDGE CANDIDATES (Ideas Inbox)
-- ============================================
CREATE TABLE IF NOT EXISTS knowledge_candidates (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    reasoning TEXT,
    source TEXT DEFAULT 'user_feedback',
    status TEXT DEFAULT 'pending', -- pending, approved, rejected, implemented, archived
    origin_context TEXT,
    related_axis TEXT,
    category TEXT,
    tags TEXT, -- JSON array
    implementation_notes TEXT,
    impact_score REAL,
    related_project_ids TEXT, -- JSON array
    admin_comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_knowledge_candidates_status ON knowledge_candidates(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_candidates_category ON knowledge_candidates(category);

-- ============================================
-- GLOBAL STRATEGIES (Strategic Directions)
-- ============================================
CREATE TABLE IF NOT EXISTS global_strategies (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    created_by TEXT,
    success_metrics TEXT, -- JSON array
    priority TEXT DEFAULT 'medium', -- low, medium, high, urgent
    target_date TEXT,
    progress_percentage INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    related_document_ids TEXT, -- JSON array
    related_idea_ids TEXT, -- JSON array
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_global_strategies_active ON global_strategies(is_active);
CREATE INDEX IF NOT EXISTS idx_global_strategies_priority ON global_strategies(priority);

-- ============================================
-- KNOWLEDGE DOCS (RAG Documents)
-- ============================================
-- Note: knowledge_docs table is created in PostgresDatabase.ts
-- This ensures compatibility

ALTER TABLE knowledge_docs ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE knowledge_docs ADD COLUMN IF NOT EXISTS tags TEXT;
ALTER TABLE knowledge_docs ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE knowledge_docs ADD COLUMN IF NOT EXISTS parent_doc_id TEXT;

CREATE INDEX IF NOT EXISTS idx_knowledge_docs_category ON knowledge_docs(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_org ON knowledge_docs(organization_id);
