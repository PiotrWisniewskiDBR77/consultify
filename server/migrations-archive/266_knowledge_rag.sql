-- FLOW-KNOWLEDGE-001: Knowledge Base & RAG
-- Migration: 266_knowledge_rag.sql

-- ==========================================
-- KNOWLEDGE DOCUMENTS
-- ==========================================

CREATE TABLE IF NOT EXISTS knowledge_documents (
    id TEXT PRIMARY KEY,
    organization_id TEXT, -- NULL for system-wide docs
    project_id TEXT,
    
    -- Document identification
    title TEXT NOT NULL,
    description TEXT,
    slug TEXT,
    
    -- Type & source
    document_type TEXT NOT NULL, -- 'pdf', 'docx', 'md', 'txt', 'html', 'url', 'notion', 'confluence'
    source_type TEXT DEFAULT 'upload', -- 'upload', 'url', 'integration', 'generated', 'scraped'
    source_url TEXT,
    source_integration TEXT, -- Integration ID if synced
    
    -- File info
    original_filename TEXT,
    storage_path TEXT,
    storage_provider TEXT DEFAULT 'local',
    file_size INTEGER,
    file_hash TEXT, -- For deduplication
    mime_type TEXT,
    
    -- Content
    raw_content TEXT, -- Extracted text
    content_length INTEGER,
    word_count INTEGER,
    
    -- Metadata
    author TEXT,
    author_email TEXT,
    language TEXT DEFAULT 'en',
    tags TEXT DEFAULT '[]', -- JSON array
    category TEXT,
    custom_metadata TEXT DEFAULT '{}', -- JSON
    
    -- Processing
    processing_status TEXT DEFAULT 'pending', -- 'pending', 'queued', 'processing', 'completed', 'failed', 'needs_reprocess'
    processing_started_at TIMESTAMP,
    processing_completed_at TIMESTAMP,
    processing_error TEXT,
    chunk_count INTEGER DEFAULT 0,
    last_processed_version INTEGER DEFAULT 0,
    
    -- Scope & visibility
    scope TEXT DEFAULT 'organization', -- 'system', 'organization', 'project', 'tool', 'user'
    visibility TEXT DEFAULT 'organization', -- 'public', 'organization', 'project', 'private'
    
    -- Access control
    allowed_roles TEXT DEFAULT '[]', -- JSON: specific roles
    
    -- Versioning
    version INTEGER DEFAULT 1,
    parent_version_id TEXT,
    is_latest_version BOOLEAN DEFAULT TRUE,
    
    -- Quality
    quality_score REAL, -- Auto-calculated content quality
    relevance_boost REAL DEFAULT 1.0, -- Manual relevance adjustment
    
    -- Usage stats
    retrieval_count INTEGER DEFAULT 0,
    helpful_count INTEGER DEFAULT 0,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_archived BOOLEAN DEFAULT FALSE,
    archived_at TIMESTAMP,
    
    -- Audit
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id),
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_docs_org ON knowledge_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_project ON knowledge_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_scope ON knowledge_documents(scope);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_status ON knowledge_documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_active ON knowledge_documents(is_active, scope);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_hash ON knowledge_documents(file_hash);

-- ==========================================
-- KNOWLEDGE CHUNKS
-- ==========================================

CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    organization_id TEXT,
    
    -- Chunk position
    chunk_index INTEGER NOT NULL,
    chunk_type TEXT DEFAULT 'text', -- 'text', 'heading', 'list', 'table', 'code'
    
    -- Content
    content TEXT NOT NULL,
    content_clean TEXT, -- Normalized for search
    token_count INTEGER,
    char_count INTEGER,
    
    -- Embedding
    embedding BYTEA, -- Serialized vector
    embedding_model TEXT DEFAULT 'text-embedding-3-small',
    embedding_dimensions INTEGER DEFAULT 1536,
    
    -- Source location
    page_number INTEGER,
    section_title TEXT,
    section_hierarchy TEXT, -- JSON: ["Chapter 1", "Section 1.2"]
    start_char INTEGER,
    end_char INTEGER,
    
    -- Metadata
    metadata TEXT DEFAULT '{}', -- JSON: extracted entities, keywords
    
    -- Search optimization
    content_hash TEXT,
    keywords TEXT DEFAULT '[]', -- JSON: extracted keywords
    entities TEXT DEFAULT '[]', -- JSON: named entities
    
    -- Quality
    chunk_quality_score REAL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (document_id) REFERENCES knowledge_documents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_doc ON knowledge_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_org ON knowledge_chunks(organization_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_hash ON knowledge_chunks(content_hash);

-- ==========================================
-- KNOWLEDGE QUERIES LOG
-- ==========================================

CREATE TABLE IF NOT EXISTS knowledge_queries (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT,
    project_id TEXT,
    
    -- Query
    query_text TEXT NOT NULL,
    query_type TEXT DEFAULT 'semantic', -- 'semantic', 'keyword', 'hybrid'
    
    -- Filters applied
    filters TEXT DEFAULT '{}', -- JSON: scope, tags, date range
    
    -- Results
    chunks_searched INTEGER,
    chunks_retrieved INTEGER,
    chunks_used INTEGER,
    top_chunk_ids TEXT, -- JSON array
    top_document_ids TEXT, -- JSON array
    
    -- Scores
    top_similarity_score REAL,
    avg_similarity_score REAL,
    
    -- Context
    source_context TEXT, -- 'chat', 'report', 'assessment', 'tool', 'search'
    conversation_id TEXT,
    
    -- Performance
    search_duration_ms INTEGER,
    
    -- Feedback
    was_helpful BOOLEAN,
    feedback_text TEXT,
    feedback_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_queries_user ON knowledge_queries(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_queries_org ON knowledge_queries(organization_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_queries_context ON knowledge_queries(source_context);
CREATE INDEX IF NOT EXISTS idx_knowledge_queries_date ON knowledge_queries(created_at);

-- ==========================================
-- KNOWLEDGE COLLECTIONS
-- ==========================================

CREATE TABLE IF NOT EXISTS knowledge_collections (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    
    name TEXT NOT NULL,
    description TEXT,
    
    -- Type
    collection_type TEXT DEFAULT 'manual', -- 'manual', 'smart', 'auto'
    
    -- Smart collection rules
    filter_rules TEXT, -- JSON: auto-include rules
    
    -- Documents
    document_ids TEXT DEFAULT '[]', -- JSON array (for manual)
    document_count INTEGER DEFAULT 0,
    
    -- Visibility
    is_public BOOLEAN DEFAULT FALSE,
    
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_knowledge_collections_org ON knowledge_collections(organization_id);

-- ==========================================
-- KNOWLEDGE SYNC JOBS
-- ==========================================

CREATE TABLE IF NOT EXISTS knowledge_sync_jobs (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    
    -- Source
    source_type TEXT NOT NULL, -- 'url', 'notion', 'confluence', 'google_drive', 'sharepoint'
    source_config TEXT NOT NULL, -- JSON: connection details
    
    -- Schedule
    sync_frequency TEXT DEFAULT 'daily', -- 'manual', 'hourly', 'daily', 'weekly'
    last_sync_at TIMESTAMP,
    next_sync_at TIMESTAMP,
    
    -- Status
    status TEXT DEFAULT 'active', -- 'active', 'paused', 'failed'
    last_error TEXT,
    
    -- Stats
    documents_synced INTEGER DEFAULT 0,
    documents_failed INTEGER DEFAULT 0,
    
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_knowledge_sync_org ON knowledge_sync_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_sync_next ON knowledge_sync_jobs(next_sync_at);
