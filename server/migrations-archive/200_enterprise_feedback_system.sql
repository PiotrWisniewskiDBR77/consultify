-- Migration: 200_enterprise_feedback_system
-- Description: Enterprise SaaS Feedback System
-- Features: Quick Pulse, Feature Requests, AI Analysis, Trending Topics
-- Date: 2026-01-09

-- =====================================================
-- QUICK PULSE FEEDBACK
-- Fast 1-5 rating with optional comment
-- =====================================================

CREATE TABLE IF NOT EXISTS feedback_pulse (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    organization_id TEXT,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    context TEXT DEFAULT '/', -- Page/module context
    comment TEXT,
    metadata TEXT, -- JSON for additional context
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);

-- Indexes for pulse analytics
CREATE INDEX IF NOT EXISTS idx_feedback_pulse_user ON feedback_pulse(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_pulse_rating ON feedback_pulse(rating);
CREATE INDEX IF NOT EXISTS idx_feedback_pulse_context ON feedback_pulse(context);
CREATE INDEX IF NOT EXISTS idx_feedback_pulse_created ON feedback_pulse(created_at);

-- =====================================================
-- FEATURE REQUESTS
-- User-submitted feature requests with voting
-- =====================================================

CREATE TABLE IF NOT EXISTS feature_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    user_email TEXT,
    organization_id TEXT,
    category TEXT DEFAULT 'other' CHECK (category IN ('usability', 'performance', 'missing', 'improvement', 'integration', 'other')),
    feature_name TEXT NOT NULL,
    description TEXT NOT NULL,
    impact TEXT DEFAULT 'medium' CHECK (impact IN ('low', 'medium', 'high', 'critical')),
    context TEXT, -- Where the request originated
    status TEXT DEFAULT 'NEW' CHECK (status IN ('NEW', 'REVIEWING', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'DUPLICATE')),
    priority INTEGER DEFAULT 0,
    votes_count INTEGER DEFAULT 0,
    admin_notes TEXT,
    target_release TEXT, -- e.g., "Q2 2026"
    related_ticket_url TEXT, -- Link to Jira/Linear/etc
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);

-- Feature request indexes
CREATE INDEX IF NOT EXISTS idx_feature_requests_user ON feature_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_feature_requests_status ON feature_requests(status);
CREATE INDEX IF NOT EXISTS idx_feature_requests_category ON feature_requests(category);
CREATE INDEX IF NOT EXISTS idx_feature_requests_votes ON feature_requests(votes_count DESC);
CREATE INDEX IF NOT EXISTS idx_feature_requests_created ON feature_requests(created_at);

-- Feature votes (prevent duplicates)
CREATE TABLE IF NOT EXISTS feature_votes (
    id TEXT PRIMARY KEY,
    feature_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(feature_id, user_id),
    FOREIGN KEY (feature_id) REFERENCES feature_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_feature_votes_feature ON feature_votes(feature_id);
CREATE INDEX IF NOT EXISTS idx_feature_votes_user ON feature_votes(user_id);

-- =====================================================
-- AI FEEDBACK ANALYSIS
-- Stores AI-generated analysis of feedback
-- =====================================================

CREATE TABLE IF NOT EXISTS feedback_analysis (
    id TEXT PRIMARY KEY,
    feedback_id TEXT NOT NULL,
    sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral', 'mixed')),
    sentiment_score REAL, -- -1 to 1
    categories_json TEXT, -- JSON array of categories
    keywords_json TEXT, -- JSON array of extracted keywords
    priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    priority_score INTEGER, -- 0-100
    similar_feedback_ids_json TEXT, -- JSON array of similar feedback IDs
    suggested_actions_json TEXT, -- JSON array of suggested actions
    ai_summary TEXT, -- One-line summary
    model_used TEXT, -- Which AI model was used
    analyzed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (feedback_id) REFERENCES system_feedback(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_feedback_analysis_feedback ON feedback_analysis(feedback_id);
CREATE INDEX IF NOT EXISTS idx_feedback_analysis_sentiment ON feedback_analysis(sentiment);
CREATE INDEX IF NOT EXISTS idx_feedback_analysis_priority ON feedback_analysis(priority);
CREATE INDEX IF NOT EXISTS idx_feedback_analysis_analyzed ON feedback_analysis(analyzed_at);

-- =====================================================
-- TRENDING TOPICS CACHE
-- Cached trending topics for fast retrieval
-- =====================================================

CREATE TABLE IF NOT EXISTS feedback_trending_topics (
    id TEXT PRIMARY KEY,
    topic TEXT NOT NULL,
    topic_count INTEGER DEFAULT 0,
    sentiment TEXT,
    trend TEXT CHECK (trend IN ('rising', 'stable', 'falling')),
    sample_feedback_ids_json TEXT, -- JSON array of sample feedback IDs
    period TEXT DEFAULT '7d', -- '7d', '30d', '90d'
    calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_feedback_trending_topic ON feedback_trending_topics(topic);
CREATE INDEX IF NOT EXISTS idx_feedback_trending_period ON feedback_trending_topics(period);
CREATE INDEX IF NOT EXISTS idx_feedback_trending_count ON feedback_trending_topics(topic_count DESC);

-- =====================================================
-- FEEDBACK SESSIONS (for contextual feedback)
-- =====================================================

CREATE TABLE IF NOT EXISTS feedback_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    session_start DATETIME DEFAULT CURRENT_TIMESTAMP,
    session_end DATETIME,
    pages_visited_json TEXT, -- JSON array of visited pages
    actions_performed_json TEXT, -- JSON array of key actions
    pulse_ratings_json TEXT, -- JSON array of pulse ratings during session
    overall_satisfaction INTEGER, -- End-of-session rating if given
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_feedback_sessions_user ON feedback_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_sessions_start ON feedback_sessions(session_start);

-- =====================================================
-- FEEDBACK NOTIFICATIONS PREFERENCES
-- =====================================================

CREATE TABLE IF NOT EXISTS feedback_notification_prefs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    notify_on_response BOOLEAN DEFAULT TRUE,
    notify_on_status_change BOOLEAN DEFAULT TRUE,
    notify_on_similar_resolved BOOLEAN DEFAULT FALSE,
    email_digest_frequency TEXT DEFAULT 'never' CHECK (email_digest_frequency IN ('never', 'daily', 'weekly')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_feedback_notif_prefs_user ON feedback_notification_prefs(user_id);

-- =====================================================
-- ADMIN FEEDBACK DASHBOARD SETTINGS
-- =====================================================

CREATE TABLE IF NOT EXISTS feedback_admin_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    auto_analyze_feedback BOOLEAN DEFAULT TRUE,
    auto_categorize BOOLEAN DEFAULT TRUE,
    similar_threshold REAL DEFAULT 0.3, -- Similarity threshold for duplicates
    notify_on_critical BOOLEAN DEFAULT TRUE,
    notify_slack_webhook TEXT,
    notify_email TEXT,
    pulse_reminder_enabled BOOLEAN DEFAULT FALSE,
    pulse_reminder_frequency TEXT DEFAULT 'weekly',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT OR IGNORE INTO feedback_admin_settings (id) VALUES ('default');

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Auto-update updated_at for feature_requests
CREATE TRIGGER IF NOT EXISTS update_feature_requests_timestamp
AFTER UPDATE ON feature_requests
BEGIN
    UPDATE feature_requests SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Auto-update updated_at for feedback_notification_prefs
CREATE TRIGGER IF NOT EXISTS update_feedback_notif_prefs_timestamp
AFTER UPDATE ON feedback_notification_prefs
BEGIN
    UPDATE feedback_notification_prefs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- =====================================================
-- VIEWS
-- =====================================================

-- View: Feedback with analysis
CREATE VIEW IF NOT EXISTS v_feedback_with_analysis AS
SELECT 
    sf.id,
    sf.user_id,
    sf.user_email,
    sf.type,
    sf.message,
    sf.status,
    sf.created_at,
    fa.sentiment,
    fa.sentiment_score,
    fa.priority,
    fa.priority_score,
    fa.ai_summary,
    fa.categories_json,
    fa.keywords_json
FROM system_feedback sf
LEFT JOIN feedback_analysis fa ON sf.id = fa.feedback_id;

-- View: Pulse summary by day
CREATE VIEW IF NOT EXISTS v_pulse_daily_summary AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) as total_responses,
    AVG(rating) as avg_rating,
    SUM(CASE WHEN rating <= 2 THEN 1 ELSE 0 END) as detractors,
    SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as passives,
    SUM(CASE WHEN rating >= 4 THEN 1 ELSE 0 END) as promoters
FROM feedback_pulse
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- View: Feature requests leaderboard
CREATE VIEW IF NOT EXISTS v_feature_requests_leaderboard AS
SELECT 
    fr.id,
    fr.feature_name,
    fr.description,
    fr.category,
    fr.impact,
    fr.status,
    fr.votes_count,
    fr.created_at,
    COUNT(DISTINCT fv.user_id) as unique_voters
FROM feature_requests fr
LEFT JOIN feature_votes fv ON fr.id = fv.feature_id
WHERE fr.status NOT IN ('REJECTED', 'COMPLETED')
GROUP BY fr.id
ORDER BY fr.votes_count DESC, fr.created_at DESC;
