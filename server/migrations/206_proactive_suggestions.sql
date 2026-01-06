-- Migration 206: Proactive Suggestions and Response Quality
-- Part of UX Excellence - Phase 4

-- Proactive suggestion events tracking
CREATE TABLE IF NOT EXISTS ai_suggestion_events (
    id TEXT PRIMARY KEY,
    suggestion_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    event_type TEXT NOT NULL, -- 'shown', 'accepted', 'dismissed', 'clicked'
    context TEXT, -- JSON context data
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_suggestion_events_user_id ON ai_suggestion_events (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_suggestion_events_suggestion_id ON ai_suggestion_events (suggestion_id);
CREATE INDEX IF NOT EXISTS idx_ai_suggestion_events_event_type ON ai_suggestion_events (event_type);
CREATE INDEX IF NOT EXISTS idx_ai_suggestion_events_created_at ON ai_suggestion_events (created_at);

-- Response quality metrics logging
CREATE TABLE IF NOT EXISTS ai_quality_metrics (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    project_id TEXT,
    relevance REAL DEFAULT 0,
    groundedness REAL DEFAULT 0,
    completeness REAL DEFAULT 0,
    coherence REAL DEFAULT 0,
    overall REAL DEFAULT 0,
    quality_level TEXT, -- 'EXCELLENT', 'GOOD', 'FAIR', 'POOR'
    query_length INTEGER DEFAULT 0,
    response_time_ms INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_quality_metrics_org_id ON ai_quality_metrics (organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_quality_metrics_project_id ON ai_quality_metrics (project_id);
CREATE INDEX IF NOT EXISTS idx_ai_quality_metrics_quality_level ON ai_quality_metrics (quality_level);
CREATE INDEX IF NOT EXISTS idx_ai_quality_metrics_created_at ON ai_quality_metrics (created_at);

-- User suggestion preferences
CREATE TABLE IF NOT EXISTS ai_suggestion_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    suggestions_enabled BOOLEAN DEFAULT 1,
    suggestion_types TEXT DEFAULT '[]', -- JSON array of enabled types
    max_suggestions INTEGER DEFAULT 3,
    show_quality_indicator BOOLEAN DEFAULT 1,
    quality_indicator_expanded BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_suggestion_preferences_user_id ON ai_suggestion_preferences (user_id);














