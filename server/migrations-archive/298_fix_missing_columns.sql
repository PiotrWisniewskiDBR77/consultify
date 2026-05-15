-- Migration: 298_fix_missing_columns.sql
-- Fixes missing columns and tables causing runtime errors
-- Created: 2026-01-20

-- ==========================================
-- 1. Add is_closed column to projects table
-- ==========================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' AND column_name = 'is_closed'
    ) THEN
        ALTER TABLE projects ADD COLUMN is_closed INTEGER DEFAULT 0;
        CREATE INDEX IF NOT EXISTS idx_projects_is_closed ON projects(is_closed);
    END IF;
END $$;

-- ==========================================
-- 2. Add internet_enabled column to ai_policies table
-- ==========================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ai_policies' AND column_name = 'internet_enabled'
    ) THEN
        ALTER TABLE ai_policies ADD COLUMN internet_enabled INTEGER DEFAULT 0;
    END IF;
END $$;

-- Also ensure other expected columns exist in ai_policies
DO $$
BEGIN
    -- Add policy_level if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ai_policies' AND column_name = 'policy_level'
    ) THEN
        ALTER TABLE ai_policies ADD COLUMN policy_level TEXT DEFAULT 'ADVISORY';
    END IF;
    
    -- Add audit_required if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ai_policies' AND column_name = 'audit_required'
    ) THEN
        ALTER TABLE ai_policies ADD COLUMN audit_required INTEGER DEFAULT 1;
    END IF;
    
    -- Add active_roles if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ai_policies' AND column_name = 'active_roles'
    ) THEN
        ALTER TABLE ai_policies ADD COLUMN active_roles TEXT DEFAULT '["ADVISOR","PMO_MANAGER","EXECUTOR","EDUCATOR"]';
    END IF;
    
    -- Add max_policy_level if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ai_policies' AND column_name = 'max_policy_level'
    ) THEN
        ALTER TABLE ai_policies ADD COLUMN max_policy_level TEXT DEFAULT 'ASSISTED';
    END IF;
    
    -- Add default_ai_role if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ai_policies' AND column_name = 'default_ai_role'
    ) THEN
        ALTER TABLE ai_policies ADD COLUMN default_ai_role TEXT DEFAULT 'ADVISOR';
    END IF;
    
    -- Add proactive_notifications if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ai_policies' AND column_name = 'proactive_notifications'
    ) THEN
        ALTER TABLE ai_policies ADD COLUMN proactive_notifications INTEGER DEFAULT 1;
    END IF;
END $$;

-- ==========================================
-- 3. Ensure ai_user_style_profiles table exists
-- ==========================================
CREATE TABLE IF NOT EXISTS ai_user_style_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    organization_id TEXT,
    
    -- Communication Preferences (user-configurable)
    preferred_depth TEXT DEFAULT 'balanced',
    preferred_format TEXT DEFAULT 'structured',
    technical_level TEXT DEFAULT 'intermediate',
    response_length TEXT DEFAULT 'medium',
    
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
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_style_profiles_user ON ai_user_style_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_style_profiles_org ON ai_user_style_profiles(organization_id);

-- ==========================================
-- 4. Add session_id column to ai_partial_responses if missing
-- ==========================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ai_partial_responses' AND column_name = 'session_id'
    ) THEN
        -- Add session_id column
        ALTER TABLE ai_partial_responses ADD COLUMN session_id TEXT;
        
        -- Create unique index on session_id
        CREATE UNIQUE INDEX IF NOT EXISTS idx_partial_responses_session ON ai_partial_responses(session_id);
        
        -- If there are existing rows, we might want to populate session_id from id or another field
        -- For now, we'll leave it NULL for existing rows
    END IF;
END $$;

-- Ensure other expected columns exist in ai_partial_responses
DO $$
BEGIN
    -- Add content column if missing (migration 201 expects it)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ai_partial_responses' AND column_name = 'content'
    ) THEN
        ALTER TABLE ai_partial_responses ADD COLUMN content TEXT NOT NULL DEFAULT '';
    END IF;
    
    -- Add updated_at if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ai_partial_responses' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE ai_partial_responses ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;
