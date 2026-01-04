-- Migration: 204_rag_quality_metrics.sql
-- RAG Quality Metrics table for tracking retrieval quality
-- Part of the Enterprise AI Readiness initiative

CREATE TABLE IF NOT EXISTS rag_quality_metrics (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    project_id TEXT,
    user_id TEXT,
    
    -- Query Info
    query_hash TEXT,
    query_length INTEGER,
    
    -- Retrieval Metrics
    docs_retrieved INTEGER DEFAULT 0,
    docs_used INTEGER DEFAULT 0,
    docs_relevant INTEGER DEFAULT 0,
    
    -- Quality Scores (0.0 - 1.0)
    retrieval_precision REAL DEFAULT 0,
    retrieval_recall REAL DEFAULT 0,
    context_relevance_score REAL DEFAULT 0,
    answer_groundedness REAL DEFAULT 0,
    
    -- Response Info
    response_length INTEGER DEFAULT 0,
    latency_ms INTEGER DEFAULT 0,
    
    -- User Feedback
    user_rating INTEGER, -- 1-5 stars
    user_feedback TEXT,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_rag_metrics_org ON rag_quality_metrics (organization_id);
CREATE INDEX IF NOT EXISTS idx_rag_metrics_project ON rag_quality_metrics (project_id);
CREATE INDEX IF NOT EXISTS idx_rag_metrics_created ON rag_quality_metrics (created_at);
CREATE INDEX IF NOT EXISTS idx_rag_metrics_quality ON rag_quality_metrics (retrieval_precision, context_relevance_score);
CREATE INDEX IF NOT EXISTS idx_rag_metrics_feedback ON rag_quality_metrics (user_rating);






