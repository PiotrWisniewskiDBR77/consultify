-- Migration: Knowledge Hub and Web Search Cache
-- Central repository for organization facts, cross-project insights, and web search caching

-- ==========================================
-- KNOWLEDGE FACTS
-- ==========================================

CREATE TABLE IF NOT EXISTS ai_knowledge_facts (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    category TEXT NOT NULL, -- 'company', 'market', 'technical', 'process', 'custom'
    subcategory TEXT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    source_type TEXT, -- 'manual', 'extracted', 'conversation', 'document'
    source_id TEXT, -- Reference to source conversation/document
    confidence REAL DEFAULT 1.0,
    is_verified INTEGER DEFAULT 0,
    verified_by TEXT,
    verified_at TIMESTAMP,
    metadata JSON DEFAULT '{}',
    embedding_vector BLOB, -- For semantic search
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- CROSS-PROJECT INSIGHTS
-- ==========================================

CREATE TABLE IF NOT EXISTS ai_cross_project_insights (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    insight_type TEXT NOT NULL, -- 'pattern', 'risk', 'opportunity', 'lesson'
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    source_projects JSON DEFAULT '[]', -- Array of project IDs
    applicability TEXT, -- 'all', 'similar', 'specific'
    impact_level TEXT DEFAULT 'medium', -- 'low', 'medium', 'high'
    confidence REAL DEFAULT 0.8,
    supporting_data JSON DEFAULT '{}',
    recommendations JSON DEFAULT '[]',
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- KNOWLEDGE RELATIONSHIPS
-- ==========================================

CREATE TABLE IF NOT EXISTS ai_knowledge_relationships (
    id TEXT PRIMARY KEY,
    source_fact_id TEXT NOT NULL REFERENCES ai_knowledge_facts(id) ON DELETE CASCADE,
    target_fact_id TEXT NOT NULL REFERENCES ai_knowledge_facts(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL, -- 'related', 'contradicts', 'supports', 'supersedes'
    strength REAL DEFAULT 0.5,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source_fact_id, target_fact_id, relationship_type)
);

-- ==========================================
-- EXTRACTION LOG
-- ==========================================

CREATE TABLE IF NOT EXISTS ai_knowledge_extraction_log (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    facts_extracted INTEGER DEFAULT 0,
    insights_extracted INTEGER DEFAULT 0,
    status TEXT DEFAULT 'completed',
    error_message TEXT,
    processing_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- KNOWLEDGE CATEGORIES
-- ==========================================

CREATE TABLE IF NOT EXISTS ai_knowledge_categories (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    parent_id TEXT REFERENCES ai_knowledge_categories(id),
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    color TEXT,
    sort_order INTEGER DEFAULT 0,
    is_system INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default categories
INSERT OR IGNORE INTO ai_knowledge_categories (id, name, description, icon, is_system) VALUES
('cat-company', 'Company Information', 'Facts about the organization', 'building', 1),
('cat-market', 'Market & Industry', 'Market trends and industry insights', 'trending-up', 1),
('cat-technical', 'Technical Knowledge', 'Technical specifications and standards', 'code', 1),
('cat-process', 'Processes & Procedures', 'Business processes and workflows', 'git-branch', 1),
('cat-stakeholder', 'Stakeholders', 'Information about key people and roles', 'users', 1),
('cat-competitor', 'Competitive Landscape', 'Competitor information and analysis', 'target', 1);

-- ==========================================
-- WEB SEARCH CACHE
-- ==========================================

CREATE TABLE IF NOT EXISTS ai_web_search_cache (
    id TEXT PRIMARY KEY,
    query_hash TEXT NOT NULL,
    query TEXT NOT NULL,
    results JSON NOT NULL,
    provider TEXT DEFAULT 'tavily',
    result_count INTEGER DEFAULT 0,
    search_options JSON DEFAULT '{}',
    expires_at TIMESTAMP NOT NULL,
    hit_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(query_hash, provider)
);

-- ==========================================
-- INDEXES
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_facts_org ON ai_knowledge_facts(organization_id);
CREATE INDEX IF NOT EXISTS idx_facts_category ON ai_knowledge_facts(category);
CREATE INDEX IF NOT EXISTS idx_facts_source ON ai_knowledge_facts(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_facts_verified ON ai_knowledge_facts(is_verified);

CREATE INDEX IF NOT EXISTS idx_insights_org ON ai_cross_project_insights(organization_id);
CREATE INDEX IF NOT EXISTS idx_insights_type ON ai_cross_project_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_insights_active ON ai_cross_project_insights(is_active);

CREATE INDEX IF NOT EXISTS idx_relationships_source ON ai_knowledge_relationships(source_fact_id);
CREATE INDEX IF NOT EXISTS idx_relationships_target ON ai_knowledge_relationships(target_fact_id);

CREATE INDEX IF NOT EXISTS idx_extraction_org ON ai_knowledge_extraction_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_extraction_source ON ai_knowledge_extraction_log(source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_categories_org ON ai_knowledge_categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON ai_knowledge_categories(parent_id);

CREATE INDEX IF NOT EXISTS idx_search_cache_hash ON ai_web_search_cache(query_hash);
CREATE INDEX IF NOT EXISTS idx_search_cache_expires ON ai_web_search_cache(expires_at);

-- ==========================================
-- ALTER EXISTING TABLES
-- ==========================================

-- Add knowledge context fields to ai_org_memory if not exists
-- Note: SQLite doesn't support IF NOT EXISTS for ALTER TABLE
-- This will fail silently if columns already exist
