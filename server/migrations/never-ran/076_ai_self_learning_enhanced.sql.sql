-- Migration: Enhanced AI Self-Learning System
-- Adds new tables and columns for advanced learning, pattern extraction, and global strategies
-- Note: SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we use separate error-tolerant approach

-- ============================================================================
-- 1. CREATE NEW TABLES FIRST
-- ============================================================================

-- AI Global Strategies Table
CREATE TABLE IF NOT EXISTS ai_global_strategies (
    id TEXT PRIMARY KEY,
    strategy_type TEXT NOT NULL,
    capability TEXT,
    strategy_content TEXT NOT NULL,
    source_organizations TEXT,
    sample_size INTEGER DEFAULT 0,
    confidence_score REAL DEFAULT 0,
    effectiveness_score REAL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_global_strategies_type ON ai_global_strategies(strategy_type);
CREATE INDEX IF NOT EXISTS idx_global_strategies_capability ON ai_global_strategies(capability);
CREATE INDEX IF NOT EXISTS idx_global_strategies_active ON ai_global_strategies(is_active);
CREATE INDEX IF NOT EXISTS idx_global_strategies_confidence ON ai_global_strategies(confidence_score);

-- AI Learning Jobs Table
CREATE TABLE IF NOT EXISTS ai_learning_jobs (
    id TEXT PRIMARY KEY,
    job_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    duration_ms INTEGER,
    records_processed INTEGER DEFAULT 0,
    patterns_extracted INTEGER DEFAULT 0,
    strategies_created INTEGER DEFAULT 0,
    error_message TEXT,
    metadata TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_learning_jobs_type ON ai_learning_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_learning_jobs_status ON ai_learning_jobs(status);
CREATE INDEX IF NOT EXISTS idx_learning_jobs_created ON ai_learning_jobs(created_at);

-- AI Self-Reflection Log Table
CREATE TABLE IF NOT EXISTS ai_self_reflection_log (
    id TEXT PRIMARY KEY,
    interaction_id TEXT,
    reflection_type TEXT NOT NULL,
    original_response TEXT,
    reflection_content TEXT NOT NULL,
    improvement_applied BOOLEAN DEFAULT false,
    improved_response TEXT,
    quality_delta REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reflection_interaction ON ai_self_reflection_log(interaction_id);
CREATE INDEX IF NOT EXISTS idx_reflection_type ON ai_self_reflection_log(reflection_type);
CREATE INDEX IF NOT EXISTS idx_reflection_improved ON ai_self_reflection_log(improvement_applied);

-- AI Pattern Feedback Table
CREATE TABLE IF NOT EXISTS ai_pattern_feedback (
    id TEXT PRIMARY KEY,
    pattern_id TEXT NOT NULL,
    interaction_id TEXT,
    was_helpful BOOLEAN,
    quality_impact REAL,
    user_feedback TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pattern_feedback_pattern ON ai_pattern_feedback(pattern_id);
CREATE INDEX IF NOT EXISTS idx_pattern_feedback_helpful ON ai_pattern_feedback(was_helpful);

-- AI Learning Metrics Table
CREATE TABLE IF NOT EXISTS ai_learning_metrics (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    organization_id TEXT,
    total_interactions INTEGER DEFAULT 0,
    avg_quality_score REAL,
    avg_auto_feedback_score REAL,
    patterns_extracted INTEGER DEFAULT 0,
    patterns_applied INTEGER DEFAULT 0,
    successful_patterns INTEGER DEFAULT 0,
    failed_patterns INTEGER DEFAULT 0,
    learning_rate REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_learning_metrics_date ON ai_learning_metrics(date);
CREATE INDEX IF NOT EXISTS idx_learning_metrics_org ON ai_learning_metrics(organization_id);
