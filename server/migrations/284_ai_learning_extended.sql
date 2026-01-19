-- Migration: AI Learning Extended System
-- Tables for extended feedback, patterns, and improvement suggestions

-- ==========================================
-- AI LEARNING INTERACTIONS
-- ==========================================

CREATE TABLE IF NOT EXISTS ai_learning_interactions (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    
    -- Context
    query TEXT,
    response TEXT,
    focus_mode TEXT,
    workspace_context TEXT,
    
    -- Basic feedback
    rating TEXT NOT NULL CHECK(rating IN ('positive', 'negative', 'neutral')),
    
    -- Extended feedback
    length_feedback TEXT CHECK(length_feedback IN ('too-short', 'just-right', 'too-long')),
    detail_feedback TEXT CHECK(detail_feedback IN ('too-little', 'just-right', 'too-much')),
    style_feedback TEXT CHECK(style_feedback IN ('too-formal', 'just-right', 'too-casual')),
    accuracy_feedback TEXT CHECK(accuracy_feedback IN ('accurate', 'partially-accurate', 'inaccurate')),
    helpfulness_feedback TEXT CHECK(helpfulness_feedback IN ('very-helpful', 'somewhat-helpful', 'not-helpful')),
    comment TEXT,
    
    -- Metadata
    response_length INTEGER DEFAULT 0,
    response_time INTEGER, -- ms
    model_used TEXT,
    instructions_used TEXT, -- JSON array
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- AI LEARNING PATTERNS
-- ==========================================

CREATE TABLE IF NOT EXISTS ai_learning_patterns (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    
    pattern_type TEXT NOT NULL CHECK(pattern_type IN ('preference', 'issue', 'success', 'failure')),
    category TEXT NOT NULL, -- 'length', 'style', 'accuracy', 'topic', etc.
    pattern TEXT NOT NULL,
    
    occurrence_count INTEGER DEFAULT 1,
    confidence REAL DEFAULT 0.5,
    impact TEXT DEFAULT 'neutral' CHECK(impact IN ('positive', 'negative', 'neutral')),
    
    suggested_action TEXT,
    metadata TEXT, -- JSON
    
    last_occurrence TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(organization_id, category, pattern)
);

-- ==========================================
-- AI IMPROVEMENT SUGGESTIONS
-- ==========================================

CREATE TABLE IF NOT EXISTS ai_improvement_suggestions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    
    suggestion_type TEXT NOT NULL CHECK(suggestion_type IN ('instruction', 'configuration', 'training')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    
    based_on_patterns TEXT, -- JSON array of pattern IDs
    priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high')),
    estimated_impact REAL DEFAULT 0.1,
    
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'applied', 'dismissed')),
    applied_at TIMESTAMP,
    applied_by TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- AI INSTRUCTION EFFECTIVENESS
-- ==========================================

CREATE TABLE IF NOT EXISTS ai_instruction_effectiveness (
    id TEXT PRIMARY KEY,
    instruction_id TEXT NOT NULL UNIQUE,
    
    positive_feedback_count INTEGER DEFAULT 0,
    negative_feedback_count INTEGER DEFAULT 0,
    effectiveness_score REAL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- AI INSTRUCTIONS - USER LEVEL
-- ==========================================

CREATE TABLE IF NOT EXISTS ai_instructions_user (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    
    instruction_key TEXT NOT NULL,
    instruction_text TEXT NOT NULL,
    
    priority INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    applies_to TEXT DEFAULT 'all' CHECK(applies_to IN ('all', 'chat', 'assessment', 'report', 'initiative')),
    
    -- Effectiveness tracking
    usage_count INTEGER DEFAULT 0,
    positive_feedback_count INTEGER DEFAULT 0,
    negative_feedback_count INTEGER DEFAULT 0,
    effectiveness_score REAL,
    
    metadata TEXT DEFAULT '{}', -- JSON
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, instruction_key)
);

-- ==========================================
-- AI INSTRUCTIONS - PROJECT LEVEL
-- ==========================================

CREATE TABLE IF NOT EXISTS ai_instructions_project (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    
    instruction_key TEXT NOT NULL,
    instruction_text TEXT NOT NULL,
    
    priority INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    applies_to TEXT DEFAULT 'all' CHECK(applies_to IN ('all', 'chat', 'assessment', 'report', 'initiative')),
    
    -- Effectiveness tracking
    usage_count INTEGER DEFAULT 0,
    positive_feedback_count INTEGER DEFAULT 0,
    negative_feedback_count INTEGER DEFAULT 0,
    effectiveness_score REAL,
    
    metadata TEXT DEFAULT '{}', -- JSON
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(project_id, instruction_key)
);

-- ==========================================
-- INDEXES
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_learning_interactions_user ON ai_learning_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_interactions_org ON ai_learning_interactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_learning_interactions_rating ON ai_learning_interactions(rating);
CREATE INDEX IF NOT EXISTS idx_learning_interactions_created ON ai_learning_interactions(created_at);

CREATE INDEX IF NOT EXISTS idx_learning_patterns_org ON ai_learning_patterns(organization_id);
CREATE INDEX IF NOT EXISTS idx_learning_patterns_type ON ai_learning_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_learning_patterns_impact ON ai_learning_patterns(impact);

CREATE INDEX IF NOT EXISTS idx_improvement_suggestions_org ON ai_improvement_suggestions(organization_id);
CREATE INDEX IF NOT EXISTS idx_improvement_suggestions_status ON ai_improvement_suggestions(status);

CREATE INDEX IF NOT EXISTS idx_instructions_user_user ON ai_instructions_user(user_id);
CREATE INDEX IF NOT EXISTS idx_instructions_user_active ON ai_instructions_user(is_active);

CREATE INDEX IF NOT EXISTS idx_instructions_project_project ON ai_instructions_project(project_id);
CREATE INDEX IF NOT EXISTS idx_instructions_project_active ON ai_instructions_project(is_active);

-- ==========================================
-- ADD COLUMNS TO EXISTING TABLES IF NOT EXISTS
-- ==========================================

-- Add effectiveness tracking columns to ai_instructions_system if not exists
-- SQLite doesn't have IF NOT EXISTS for ALTER TABLE, so we wrap in try/catch style
-- These will fail silently if columns already exist

-- Add effectiveness tracking to ai_instructions_org if needed
-- (These tables should already exist from previous migrations)
