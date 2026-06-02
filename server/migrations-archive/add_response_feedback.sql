-- Migration: Add AI Response Feedback System
-- Version: 1.0.0
-- Date: 2026-01-01

-- =====================================================
-- Table: ai_response_feedback
-- Stores user feedback on AI responses for learning
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_response_feedback (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    conversation_id TEXT,
    
    -- Core feedback
    rating TEXT CHECK(rating IN ('positive', 'negative', 'neutral')),
    
    -- Length assessment
    length_feedback TEXT CHECK(length_feedback IN ('too_short', 'just_right', 'too_long')),
    
    -- Detail assessment
    detail_feedback TEXT CHECK(detail_feedback IN ('needs_more_detail', 'good_detail', 'too_detailed')),
    
    -- Format assessment
    format_feedback TEXT CHECK(format_feedback IN ('needs_structure', 'good_format', 'too_complex')),
    
    -- What user wanted
    wanted_mode TEXT CHECK(wanted_mode IN ('quick', 'standard', 'deepStudy')),
    
    -- Free-form feedback
    custom_feedback TEXT,
    
    -- Context
    response_mode_used TEXT CHECK(response_mode_used IN ('quick', 'standard', 'deepStudy')),
    response_length_actual INTEGER,
    capability_used TEXT,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_response_feedback_user ON ai_response_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_response_feedback_rating ON ai_response_feedback(rating);
CREATE INDEX IF NOT EXISTS idx_response_feedback_created ON ai_response_feedback(created_at);

-- =====================================================
-- Create user_ai_profiles table (if not exists)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_ai_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    
    -- Response mode preferences
    response_mode_preference TEXT DEFAULT 'standard' 
        CHECK(response_mode_preference IN ('quick', 'standard', 'deepStudy')),
    
    -- Length preferences per mode
    quick_length_preference TEXT DEFAULT 'short'
        CHECK(quick_length_preference IN ('ultra_short', 'short', 'medium')),
    standard_length_preference TEXT DEFAULT 'medium'
        CHECK(standard_length_preference IN ('short', 'medium', 'long')),
    deep_study_length_preference TEXT DEFAULT 'long'
        CHECK(deep_study_length_preference IN ('medium', 'long', 'comprehensive')),
    
    -- Auto-detect intent toggle
    auto_detect_intent INTEGER DEFAULT 1,
    
    -- Formatting preferences
    prefer_bullet_points INTEGER DEFAULT 1,
    prefer_tables INTEGER DEFAULT 0,
    prefer_action_items INTEGER DEFAULT 1,
    include_examples TEXT DEFAULT 'minimal'
        CHECK(include_examples IN ('none', 'minimal', 'detailed')),
    
    -- Feedback tracking
    feedback_count INTEGER DEFAULT 0,
    positive_feedback_count INTEGER DEFAULT 0,
    satisfaction_score REAL DEFAULT 0.0,
    last_feedback_at DATETIME,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_user_ai_profiles_user ON user_ai_profiles(user_id);

-- =====================================================
-- View: User satisfaction metrics
-- =====================================================
CREATE VIEW IF NOT EXISTS v_user_satisfaction AS
SELECT 
    user_id,
    COUNT(*) as total_feedback,
    SUM(CASE WHEN rating = 'positive' THEN 1 ELSE 0 END) as positive_count,
    SUM(CASE WHEN rating = 'negative' THEN 1 ELSE 0 END) as negative_count,
    SUM(CASE WHEN length_feedback = 'too_long' THEN 1 ELSE 0 END) as too_long_count,
    SUM(CASE WHEN length_feedback = 'too_short' THEN 1 ELSE 0 END) as too_short_count,
    ROUND(
        CAST(SUM(CASE WHEN rating = 'positive' THEN 1 ELSE 0 END) AS REAL) / 
        NULLIF(COUNT(*), 0) * 100, 1
    ) as satisfaction_rate,
    MAX(created_at) as last_feedback_at
FROM ai_response_feedback
GROUP BY user_id;

-- =====================================================
-- Trigger: Update user satisfaction score on feedback
-- =====================================================
CREATE TRIGGER IF NOT EXISTS trg_update_satisfaction_on_feedback
AFTER INSERT ON ai_response_feedback
BEGIN
    UPDATE user_ai_profiles
    SET 
        feedback_count = feedback_count + 1,
        positive_feedback_count = positive_feedback_count + 
            CASE WHEN NEW.rating = 'positive' THEN 1 ELSE 0 END,
        satisfaction_score = (
            SELECT ROUND(
                CAST(SUM(CASE WHEN rating = 'positive' THEN 1 ELSE 0 END) AS REAL) / 
                NULLIF(COUNT(*), 0), 2
            )
            FROM ai_response_feedback
            WHERE user_id = NEW.user_id
        ),
        last_feedback_at = NEW.created_at
    WHERE user_id = NEW.user_id;
END;

