-- Migration: 031_prompt_versioning.sql
-- Prompt Versioning System for AI Governance
-- Created: 2025-12-21

-- Prompt versions table
CREATE TABLE IF NOT EXISTS prompt_versions (
    id TEXT PRIMARY KEY,
    prompt_key TEXT NOT NULL, -- Unique identifier for the prompt (e.g., 'system.diagnosis', 'role.advisor')
    version INTEGER NOT NULL,
    
    -- Content
    content TEXT NOT NULL, -- The actual prompt text
    description TEXT, -- Human-readable description of changes
    
    -- Status
    is_active BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    
    -- Authoring
    created_by TEXT, -- user_id
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activated_at TIMESTAMP,
    deactivated_at TIMESTAMP,
    
    -- Performance metrics (updated async)
    total_uses INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    avg_tokens_used REAL,
    avg_latency_ms REAL,
    avg_quality_score REAL, -- 0-1 based on feedback
    
    -- Metadata
    tags TEXT, -- JSON array of tags
    metadata TEXT, -- JSON for additional data
    
    UNIQUE(prompt_key, version)
);

CREATE INDEX IF NOT EXISTS idx_prompt_versions_key ON prompt_versions(prompt_key);
-- Drop index if it exists (may have been created with old INTEGER column type)
DROP INDEX IF EXISTS idx_prompt_versions_active;
-- Recreate index - handle boolean check in a way compatible with both DBs
CREATE INDEX idx_prompt_versions_active ON prompt_versions(prompt_key, is_active) WHERE is_active = 1 OR is_active = TRUE;

-- Prompt usage log (for A/B testing and metrics)
CREATE TABLE IF NOT EXISTS prompt_usage_log (
    id TEXT PRIMARY KEY,
    prompt_version_id TEXT NOT NULL,
    prompt_key TEXT NOT NULL,
    version INTEGER NOT NULL,
    
    -- Usage context
    user_id TEXT,
    organization_id TEXT,
    action TEXT, -- AI action type
    correlation_id TEXT,
    
    -- Performance
    tokens_used INTEGER,
    latency_ms INTEGER,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    
    -- Quality (optional, from feedback)
    quality_score REAL,
    feedback TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (prompt_version_id) REFERENCES prompt_versions(id)
);

CREATE INDEX IF NOT EXISTS idx_prompt_usage_version ON prompt_usage_log(prompt_version_id);
CREATE INDEX IF NOT EXISTS idx_prompt_usage_key ON prompt_usage_log(prompt_key, created_at);

-- Prompt A/B tests
CREATE TABLE IF NOT EXISTS prompt_ab_tests (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    prompt_key TEXT NOT NULL,
    
    -- Variants (JSON array of version IDs with traffic allocation)
    variants TEXT NOT NULL, -- [{"version_id": "...", "allocation": 50}, ...]
    
    -- Status
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'running', 'completed', 'cancelled')),
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    
    -- Results
    winner_version_id TEXT,
    results TEXT, -- JSON with detailed results
    
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prompt_ab_tests_key ON prompt_ab_tests(prompt_key);
CREATE INDEX IF NOT EXISTS idx_prompt_ab_tests_status ON prompt_ab_tests(status);
