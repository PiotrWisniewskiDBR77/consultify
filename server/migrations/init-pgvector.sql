-- =====================================================
-- Consultify AI - PostgreSQL with pgvector initialization
-- =====================================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- AI Audit Logs - Track all AI interactions
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_audit_logs (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    user_id VARCHAR(255),
    organization_id VARCHAR(255),
    capability VARCHAR(100),
    model VARCHAR(100),
    latency_ms INTEGER,
    has_screen_context BOOLEAN DEFAULT FALSE,
    screen_context_hash VARCHAR(64),
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    tokens_used INTEGER DEFAULT 0,
    cost_usd DECIMAL(10, 6) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_audit_logs_user ON ai_audit_logs(user_id);
CREATE INDEX idx_ai_audit_logs_org ON ai_audit_logs(organization_id);
CREATE INDEX idx_ai_audit_logs_timestamp ON ai_audit_logs(timestamp);
CREATE INDEX idx_ai_audit_logs_capability ON ai_audit_logs(capability);

-- =====================================================
-- AI System Prompts - DB-managed prompts for AI Hub
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_system_prompts (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    content TEXT NOT NULL,
    context_config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default prompts
INSERT INTO ai_system_prompts (key, description, content, is_active) VALUES
('system_chat', 'Main AI Chat System Prompt', 'You are a senior digital transformation consultant specializing in PMO methodologies (ISO 21500, PMBOK 7, PRINCE2). Provide strategic, actionable advice based on the user''s context.', TRUE),
('system_magic_wand', 'Magic Wand Field Suggestions', 'You help users fill form fields by suggesting relevant content based on their project context. Be concise and directly applicable.', TRUE),
('system_reports', 'Report Generation System Prompt', 'You are an expert report writer. Generate professional, structured reports for digital transformation assessments. Use data provided to create insightful analysis.', TRUE),
('system_initiative', 'Initiative Analysis Prompt', 'Analyze and score initiatives based on strategic alignment, feasibility, ROI potential, and resource requirements. Provide structured recommendations.', TRUE),
('system_max_reasoner', 'MAX Mode Deep Reasoning', 'You are in MAX Mode - use chain-of-thought reasoning to solve complex strategic problems. Think step by step and consider multiple perspectives.', TRUE),
('system_coach', 'PMO Coach System Prompt', 'You are a PMO coach helping users understand and apply best practices from ISO 21500, PMBOK, and PRINCE2. Provide educational, supportive guidance.', TRUE)
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- AI Knowledge Embeddings - Vector storage for RAG
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_knowledge_embeddings (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(255),
    chunk_index INTEGER DEFAULT 0,
    chunk_text TEXT NOT NULL,
    embedding vector(1536),  -- OpenAI text-embedding-3-small dimension
    metadata JSONB DEFAULT '{}',
    source_type VARCHAR(50),  -- 'methodology', 'project', 'organization'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_embeddings_doc ON ai_knowledge_embeddings(document_id);
CREATE INDEX idx_ai_embeddings_source ON ai_knowledge_embeddings(source_type);

-- Create HNSW index for fast similarity search (requires pgvector 0.5.0+)
CREATE INDEX idx_ai_embeddings_vector ON ai_knowledge_embeddings 
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- =====================================================
-- AI Feature Control - Control Plane for AI capabilities
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_feature_control (
    id SERIAL PRIMARY KEY,
    feature_key VARCHAR(50) UNIQUE NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    min_role VARCHAR(20) DEFAULT 'USER',
    allowed_models TEXT[] DEFAULT ARRAY['gpt-4o-mini'],
    max_tokens_per_req INTEGER,
    requires_approval BOOLEAN DEFAULT FALSE,
    emergency_disable BOOLEAN DEFAULT FALSE,
    disable_reason TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default feature controls
INSERT INTO ai_feature_control (feature_key, is_enabled, min_role, allowed_models) VALUES
('chat', TRUE, 'USER', ARRAY['gpt-4o-mini', 'gpt-4o']),
('magic_wand', TRUE, 'USER', ARRAY['gpt-4o-mini']),
('reports', TRUE, 'USER', ARRAY['gpt-4o', 'claude-3-5-sonnet-20241022']),
('max_mode', TRUE, 'PREMIUM', ARRAY['o1-mini', 'o1-preview']),
('tools', TRUE, 'USER', ARRAY['gpt-4o'])
ON CONFLICT (feature_key) DO NOTHING;

-- =====================================================
-- AI Conversations - Chat history storage
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_conversations (
    id SERIAL PRIMARY KEY,
    conversation_id VARCHAR(255) UNIQUE NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    organization_id VARCHAR(255),
    project_id VARCHAR(255),
    title VARCHAR(255),
    messages JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_conversations_user ON ai_conversations(user_id);
CREATE INDEX idx_ai_conversations_project ON ai_conversations(project_id);

-- =====================================================
-- AI Cost Tracking - Budget management per organization
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_cost_tracking (
    id SERIAL PRIMARY KEY,
    organization_id VARCHAR(255) NOT NULL,
    month VARCHAR(7) NOT NULL,  -- Format: YYYY-MM
    total_tokens INTEGER DEFAULT 0,
    total_cost_usd DECIMAL(10, 4) DEFAULT 0,
    budget_limit_usd DECIMAL(10, 2),
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, month)
);

CREATE INDEX idx_ai_cost_tracking_org_month ON ai_cost_tracking(organization_id, month);

-- =====================================================
-- Helper function for vector similarity search
-- =====================================================
CREATE OR REPLACE FUNCTION search_knowledge_embeddings(
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 5,
    filter_source_type VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    id INT,
    document_id VARCHAR,
    chunk_text TEXT,
    metadata JSONB,
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id,
        e.document_id,
        e.chunk_text,
        e.metadata,
        1 - (e.embedding <=> query_embedding) as similarity
    FROM ai_knowledge_embeddings e
    WHERE 
        (filter_source_type IS NULL OR e.source_type = filter_source_type)
        AND 1 - (e.embedding <=> query_embedding) > match_threshold
    ORDER BY e.embedding <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Grant permissions
-- =====================================================
GRANT ALL ON ALL TABLES IN SCHEMA public TO consultify;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO consultify;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO consultify;










