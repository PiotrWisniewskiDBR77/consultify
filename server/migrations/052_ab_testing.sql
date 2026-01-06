-- Migration: A/B Testing Framework and Prompt Versioning
-- Creates tables for A/B testing, prompt versions, feedback, and quality tracking

-- Prompt versions history
CREATE TABLE IF NOT EXISTS ai_prompt_versions (
    id TEXT PRIMARY KEY,
    prompt_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    template TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    FOREIGN KEY (prompt_id) REFERENCES ai_system_prompts(id)
);

CREATE INDEX IF NOT EXISTS idx_prompt_versions_prompt_id ON ai_prompt_versions(prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_version ON ai_prompt_versions(prompt_id, version);

-- A/B Testing experiments
CREATE TABLE IF NOT EXISTS ai_ab_experiments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    prompt_id TEXT NOT NULL,
    variants TEXT NOT NULL, -- JSON array of variant configurations
    traffic_split TEXT NOT NULL, -- JSON array of percentages [50, 50]
    min_sample_size INTEGER DEFAULT 100,
    confidence_level REAL DEFAULT 0.95,
    primary_metric TEXT DEFAULT 'user_satisfaction',
    status TEXT DEFAULT 'draft', -- draft, running, stopped, completed
    stop_reason TEXT,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    FOREIGN KEY (prompt_id) REFERENCES ai_system_prompts(id)
);

CREATE INDEX IF NOT EXISTS idx_ab_experiments_prompt_id ON ai_ab_experiments(prompt_id);
CREATE INDEX IF NOT EXISTS idx_ab_experiments_status ON ai_ab_experiments(status);

-- A/B Testing variant assignments
CREATE TABLE IF NOT EXISTS ai_ab_assignments (
    id TEXT PRIMARY KEY,
    experiment_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    variant_index INTEGER NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(experiment_id, user_id),
    FOREIGN KEY (experiment_id) REFERENCES ai_ab_experiments(id)
);

CREATE INDEX IF NOT EXISTS idx_ab_assignments_experiment ON ai_ab_assignments(experiment_id);
CREATE INDEX IF NOT EXISTS idx_ab_assignments_user ON ai_ab_assignments(user_id);

-- A/B Testing outcomes
CREATE TABLE IF NOT EXISTS ai_ab_outcomes (
    id TEXT PRIMARY KEY,
    experiment_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    variant_index INTEGER NOT NULL,
    metric TEXT NOT NULL,
    value REAL NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (experiment_id) REFERENCES ai_ab_experiments(id)
);

CREATE INDEX IF NOT EXISTS idx_ab_outcomes_experiment ON ai_ab_outcomes(experiment_id);
CREATE INDEX IF NOT EXISTS idx_ab_outcomes_metric ON ai_ab_outcomes(experiment_id, metric);

-- User feedback on AI responses
CREATE TABLE IF NOT EXISTS ai_feedback (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT,
    request_id TEXT, -- Reference to AI request
    response_id TEXT, -- Reference to AI response
    rating INTEGER, -- 1-5 or thumbs up/down (-1, 1)
    feedback_type TEXT, -- 'rating', 'thumbs', 'text', 'correction'
    feedback_text TEXT,
    context TEXT, -- JSON with additional context
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_feedback_user ON ai_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_org ON ai_feedback(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_request ON ai_feedback(request_id);

-- AI Quality metrics log
CREATE TABLE IF NOT EXISTS ai_quality_metrics (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    response_id TEXT,
    overall_score REAL,
    hallucination_risk REAL,
    relevance_score REAL,
    citation_score REAL,
    structure_score REAL,
    passed BOOLEAN DEFAULT true,
    warnings TEXT, -- JSON array
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quality_metrics_request ON ai_quality_metrics(request_id);
CREATE INDEX IF NOT EXISTS idx_quality_metrics_score ON ai_quality_metrics(overall_score);

-- AI Cost tracking (detailed)
CREATE TABLE IF NOT EXISTS ai_cost_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT,
    project_id TEXT,
    request_type TEXT, -- chat, report, initiative, etc.
    model TEXT NOT NULL,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0,
    cached BOOLEAN DEFAULT false,
    duration_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cost_log_user ON ai_cost_log(user_id);
CREATE INDEX IF NOT EXISTS idx_cost_log_org ON ai_cost_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_cost_log_date ON ai_cost_log(created_at);
CREATE INDEX IF NOT EXISTS idx_cost_log_model ON ai_cost_log(model);

-- Add version column to ai_system_prompts if not exists
-- (This is a safe operation - will be ignored if column exists)
-- ALTER TABLE ai_system_prompts ADD COLUMN version INTEGER DEFAULT 1;

-- Create performance metrics table
CREATE TABLE IF NOT EXISTS ai_performance_metrics (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    period TEXT, -- 'hourly', 'daily', 'weekly'
    total_requests INTEGER DEFAULT 0,
    successful_requests INTEGER DEFAULT 0,
    cached_requests INTEGER DEFAULT 0,
    avg_response_time_ms REAL,
    p95_response_time_ms REAL,
    avg_tokens_used REAL,
    total_cost_usd REAL,
    error_rate REAL
);

CREATE INDEX IF NOT EXISTS idx_perf_metrics_period ON ai_performance_metrics(period, timestamp);


















