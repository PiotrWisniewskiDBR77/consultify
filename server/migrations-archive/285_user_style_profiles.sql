-- FLOW-AI-ADAPTIVE-001: AI Adaptive Style System - User Style Profiles
-- Migration: 285_user_style_profiles.sql
-- Description: Stores user communication preferences and automatically detected style patterns

-- ==========================================
-- AI USER STYLE PROFILES
-- ==========================================

CREATE TABLE IF NOT EXISTS ai_user_style_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    organization_id TEXT,
    
    -- Communication Preferences (user-configurable)
    preferred_depth TEXT DEFAULT 'balanced' CHECK(preferred_depth IN ('executive_summary', 'balanced', 'deep_dive')),
    preferred_format TEXT DEFAULT 'structured' CHECK(preferred_format IN ('bullets', 'paragraphs', 'structured', 'conversational')),
    technical_level TEXT DEFAULT 'intermediate' CHECK(technical_level IN ('beginner', 'intermediate', 'expert')),
    response_length TEXT DEFAULT 'medium' CHECK(response_length IN ('concise', 'medium', 'comprehensive')),
    
    -- Automatically detected patterns (JSON arrays)
    detected_expertise_areas TEXT DEFAULT '[]',
    common_question_types TEXT DEFAULT '[]',
    peak_activity_hours TEXT DEFAULT '[]',
    preferred_focus_modes TEXT DEFAULT '[]',
    
    -- Context-specific preferences (JSON object)
    context_preferences TEXT DEFAULT '{}',
    
    -- Learning metrics
    total_interactions INTEGER DEFAULT 0,
    positive_feedback_count INTEGER DEFAULT 0,
    negative_feedback_count INTEGER DEFAULT 0,
    last_profile_update TEXT,
    confidence_score REAL DEFAULT 0.5,
    
    -- Auto-learning flags
    auto_adapt_enabled INTEGER DEFAULT 1,
    manual_overrides TEXT DEFAULT '{}',
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_style_profiles_user ON ai_user_style_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_style_profiles_org ON ai_user_style_profiles(organization_id);

-- ==========================================
-- AI FEEDBACK EXTENDED
-- Add new columns to existing ai_feedback table
-- ==========================================

-- Add new feedback columns if they don't exist
ALTER TABLE ai_feedback ADD COLUMN IF NOT EXISTS actionability INTEGER;
ALTER TABLE ai_feedback ADD COLUMN IF NOT EXISTS accuracy INTEGER;
ALTER TABLE ai_feedback ADD COLUMN IF NOT EXISTS expected_format TEXT;
ALTER TABLE ai_feedback ADD COLUMN IF NOT EXISTS missing_info TEXT;
ALTER TABLE ai_feedback ADD COLUMN IF NOT EXISTS screen_context TEXT;
ALTER TABLE ai_feedback ADD COLUMN IF NOT EXISTS focus_mode TEXT;
ALTER TABLE ai_feedback ADD COLUMN IF NOT EXISTS response_length INTEGER;

-- ==========================================
-- AI STYLE LEARNING PATTERNS
-- Stores detected patterns from feedback analysis
-- ==========================================

CREATE TABLE IF NOT EXISTS ai_style_learning_patterns (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    organization_id TEXT,
    
    -- Pattern details
    pattern_type TEXT NOT NULL, -- 'length_preference', 'format_preference', 'depth_preference', 'context_specific'
    pattern_key TEXT NOT NULL,
    pattern_value TEXT NOT NULL,
    
    -- Confidence and frequency
    occurrence_count INTEGER DEFAULT 1,
    confidence_score REAL DEFAULT 0.5,
    
    -- Context where pattern was detected
    detected_in_context TEXT,
    
    -- Status
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'applied', 'rejected', 'expired')),
    applied_at TEXT,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_style_patterns_user ON ai_style_learning_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_style_patterns_type ON ai_style_learning_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_style_patterns_status ON ai_style_learning_patterns(status);
