-- FLOW-AILEARNING-001: AI Learning System
-- Migration: 251_ai_learning_system.sql

-- ==========================================
-- AI LEARNING PATTERNS
-- ==========================================

CREATE TABLE IF NOT EXISTS ai_learning_patterns (
    id TEXT PRIMARY KEY,
    
    -- Pattern classification
    pattern_type TEXT NOT NULL, -- 'decision', 'initiative', 'assessment', 'usage', 'error'
    pattern_category TEXT, -- More specific category within type
    
    -- Pattern data
    pattern_data TEXT NOT NULL, -- JSON with pattern details
    pattern_description TEXT, -- Human-readable description
    
    -- Statistics
    occurrence_count INTEGER DEFAULT 1,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    
    -- Confidence
    confidence_score REAL DEFAULT 0.5, -- 0-1
    
    -- Context
    organization_id TEXT, -- NULL for system-wide patterns
    
    -- Timestamps
    first_occurrence_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_occurrence_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_patterns_type ON ai_learning_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_ai_patterns_org ON ai_learning_patterns(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_patterns_confidence ON ai_learning_patterns(confidence_score);

-- ==========================================
-- AI INSTRUCTION EFFECTIVENESS
-- ==========================================

CREATE TABLE IF NOT EXISTS ai_instruction_effectiveness (
    id TEXT PRIMARY KEY,
    instruction_id TEXT NOT NULL,
    instruction_type TEXT NOT NULL, -- 'system' or 'org'
    
    -- Usage metrics
    usage_count INTEGER DEFAULT 0,
    
    -- Feedback metrics
    positive_feedback_count INTEGER DEFAULT 0,
    negative_feedback_count INTEGER DEFAULT 0,
    correction_count INTEGER DEFAULT 0,
    
    -- Calculated score
    effectiveness_score REAL DEFAULT 50.0, -- 0-100
    
    -- Trends
    previous_score REAL,
    score_trend TEXT, -- 'improving', 'stable', 'declining'
    
    -- Timestamps
    last_calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_effectiveness_instruction ON ai_instruction_effectiveness(instruction_id);
CREATE INDEX IF NOT EXISTS idx_effectiveness_score ON ai_instruction_effectiveness(effectiveness_score);

-- ==========================================
-- AI QUALITY METRICS (aggregated)
-- ==========================================

CREATE TABLE IF NOT EXISTS ai_quality_metrics (
    id TEXT PRIMARY KEY,
    organization_id TEXT, -- NULL for system-wide
    
    -- Date range
    metric_date DATE NOT NULL,
    
    -- Overall scores
    overall_score REAL,
    accuracy_score REAL,
    helpfulness_score REAL,
    relevance_score REAL,
    tone_score REAL,
    
    -- Volume metrics
    total_interactions INTEGER DEFAULT 0,
    total_feedback_count INTEGER DEFAULT 0,
    positive_feedback_count INTEGER DEFAULT 0,
    negative_feedback_count INTEGER DEFAULT 0,
    correction_count INTEGER DEFAULT 0,
    
    -- Trends
    score_change_from_yesterday REAL,
    trend TEXT, -- 'improving', 'stable', 'declining'
    
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(organization_id, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_quality_metrics_org ON ai_quality_metrics(organization_id);
CREATE INDEX IF NOT EXISTS idx_quality_metrics_date ON ai_quality_metrics(metric_date);

-- ==========================================
-- AI INSTRUCTION SUGGESTIONS
-- ==========================================

CREATE TABLE IF NOT EXISTS ai_instruction_suggestions (
    id TEXT PRIMARY KEY,
    
    -- Suggestion details
    suggested_instruction TEXT NOT NULL,
    category TEXT NOT NULL,
    reason TEXT, -- Why this suggestion was generated
    
    -- Source
    source_type TEXT NOT NULL, -- 'pattern', 'feedback', 'correction', 'manual'
    source_patterns TEXT, -- JSON array of pattern IDs that led to this
    source_feedback TEXT, -- JSON array of feedback IDs
    
    -- Confidence
    confidence_score REAL DEFAULT 0.5,
    
    -- Status
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'implemented'
    reviewed_by TEXT,
    reviewed_at TIMESTAMP,
    review_notes TEXT,
    
    -- If implemented
    implemented_instruction_id TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_suggestions_status ON ai_instruction_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_suggestions_confidence ON ai_instruction_suggestions(confidence_score);

-- ==========================================
-- ENHANCE EXISTING ai_feedback TABLE
-- ==========================================

-- Add columns for better tracking
ALTER TABLE ai_feedback ADD COLUMN category TEXT;
ALTER TABLE ai_feedback ADD COLUMN ai_instruction_ids TEXT; -- JSON array of instructions used
ALTER TABLE ai_feedback ADD COLUMN pattern_extracted INTEGER DEFAULT 0;
ALTER TABLE ai_feedback ADD COLUMN pattern_id TEXT;

CREATE INDEX IF NOT EXISTS idx_ai_feedback_pattern ON ai_feedback(pattern_extracted);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_category ON ai_feedback(category);

-- ==========================================
-- ENHANCE ai_instructions_system
-- ==========================================

ALTER TABLE ai_instructions_system ADD COLUMN usage_count INTEGER DEFAULT 0;
ALTER TABLE ai_instructions_system ADD COLUMN effectiveness_score REAL DEFAULT 50.0;
ALTER TABLE ai_instructions_system ADD COLUMN last_reviewed_at TIMESTAMP;
ALTER TABLE ai_instructions_system ADD COLUMN reviewed_by TEXT;

-- ==========================================
-- ENHANCE ai_instructions_org
-- ==========================================

ALTER TABLE ai_instructions_org ADD COLUMN usage_count INTEGER DEFAULT 0;
ALTER TABLE ai_instructions_org ADD COLUMN effectiveness_score REAL DEFAULT 50.0;
ALTER TABLE ai_instructions_org ADD COLUMN last_reviewed_at TIMESTAMP;
ALTER TABLE ai_instructions_org ADD COLUMN reviewed_by TEXT;
ALTER TABLE ai_instructions_org ADD COLUMN applies_to TEXT DEFAULT 'all'; -- 'all', 'chat', 'assessment', 'report'
ALTER TABLE ai_instructions_org ADD COLUMN project_ids TEXT; -- JSON array if applies to specific projects
