-- Migration 129: AI Preferences Extensions
-- Adds advanced AI model selection and parameter controls

-- Rozszerzenie ai_user_preferences
ALTER TABLE ai_user_preferences ADD COLUMN model_selection TEXT; -- JSON array of enabled model IDs
ALTER TABLE ai_user_preferences ADD COLUMN temperature REAL DEFAULT 0.7;
ALTER TABLE ai_user_preferences ADD COLUMN max_tokens INTEGER DEFAULT 2000;
ALTER TABLE ai_user_preferences ADD COLUMN context_window_size INTEGER DEFAULT 4000;
ALTER TABLE ai_user_preferences ADD COLUMN auto_suggestions INTEGER DEFAULT 1;
ALTER TABLE ai_user_preferences ADD COLUMN response_speed TEXT DEFAULT 'balanced'; -- fast, balanced, detailed
ALTER TABLE ai_user_preferences ADD COLUMN code_formatting INTEGER DEFAULT 1;
ALTER TABLE ai_user_preferences ADD COLUMN personality_preset TEXT DEFAULT 'professional'; -- professional, casual, technical
ALTER TABLE ai_user_preferences ADD COLUMN auto_complete_sensitivity REAL DEFAULT 0.5;
ALTER TABLE ai_user_preferences ADD COLUMN suggestions_in_comments INTEGER DEFAULT 1;
ALTER TABLE ai_user_preferences ADD COLUMN task_prioritization INTEGER DEFAULT 0;
ALTER TABLE ai_user_preferences ADD COLUMN summary_length TEXT DEFAULT 'medium'; -- short, medium, long
ALTER TABLE ai_user_preferences ADD COLUMN summary_detail_level INTEGER DEFAULT 2; -- 1-5
ALTER TABLE ai_user_preferences ADD COLUMN translation_enabled INTEGER DEFAULT 0;
ALTER TABLE ai_user_preferences ADD COLUMN code_review_enabled INTEGER DEFAULT 1;

-- Indeksy dla wydajności
CREATE INDEX IF NOT EXISTS idx_ai_user_prefs_model ON ai_user_preferences(model_selection);
CREATE INDEX IF NOT EXISTS idx_ai_user_prefs_personality ON ai_user_preferences(personality_preset);














