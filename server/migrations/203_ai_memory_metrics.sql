-- Migration: 203_ai_memory_metrics.sql
-- AI Memory Metrics table for Enterprise Dashboard
-- Part of the Enterprise AI Readiness initiative

-- Table for tracking AI memory usage and performance metrics
CREATE TABLE IF NOT EXISTS ai_memory_metrics (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    project_id TEXT,
    user_id TEXT,
    
    -- Memory Layer Metrics
    session_memory_tokens INTEGER DEFAULT 0,
    project_memory_tokens INTEGER DEFAULT 0,
    org_memory_tokens INTEGER DEFAULT 0,
    user_pref_tokens INTEGER DEFAULT 0,
    total_memory_tokens INTEGER DEFAULT 0,
    
    -- Memory Operation Metrics
    memory_reads INTEGER DEFAULT 0,
    memory_writes INTEGER DEFAULT 0,
    memory_trims INTEGER DEFAULT 0,
    memory_cleanups INTEGER DEFAULT 0,
    
    -- Relevance Metrics
    relevance_score_avg REAL DEFAULT 0,
    relevance_hits INTEGER DEFAULT 0,
    relevance_misses INTEGER DEFAULT 0,
    
    -- Cost Metrics
    tokens_saved_by_trim INTEGER DEFAULT 0,
    estimated_cost_saved REAL DEFAULT 0,
    
    -- Time Metrics
    avg_retrieval_time_ms INTEGER DEFAULT 0,
    p95_retrieval_time_ms INTEGER DEFAULT 0,
    
    -- Period Information
    period_type TEXT DEFAULT 'HOURLY', -- HOURLY, DAILY, WEEKLY, MONTHLY
    period_start DATETIME NOT NULL,
    period_end DATETIME NOT NULL,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_ai_memory_metrics_org ON ai_memory_metrics (organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_memory_metrics_project ON ai_memory_metrics (project_id);
CREATE INDEX IF NOT EXISTS idx_ai_memory_metrics_period ON ai_memory_metrics (period_type, period_start);
CREATE INDEX IF NOT EXISTS idx_ai_memory_metrics_created ON ai_memory_metrics (created_at);

-- Aggregated daily summary view (for dashboard)
CREATE TABLE IF NOT EXISTS ai_memory_metrics_daily (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    date TEXT NOT NULL, -- YYYY-MM-DD
    
    -- Totals
    total_memory_tokens INTEGER DEFAULT 0,
    peak_memory_tokens INTEGER DEFAULT 0,
    avg_memory_tokens INTEGER DEFAULT 0,
    
    -- Operations
    total_reads INTEGER DEFAULT 0,
    total_writes INTEGER DEFAULT 0,
    total_trims INTEGER DEFAULT 0,
    
    -- Efficiency
    tokens_saved INTEGER DEFAULT 0,
    cost_saved REAL DEFAULT 0,
    
    -- Performance
    avg_latency_ms INTEGER DEFAULT 0,
    p95_latency_ms INTEGER DEFAULT 0,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(organization_id, date)
);

CREATE INDEX IF NOT EXISTS idx_ai_memory_daily_org ON ai_memory_metrics_daily (organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_memory_daily_date ON ai_memory_metrics_daily (date);












