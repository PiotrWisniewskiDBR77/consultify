-- Help Feedback System Migration
-- Version: 070
-- Description: Tables for help feedback collection and analytics

-- Help Feedback Table
-- Stores user feedback on help content (was this helpful, ratings, comments)
CREATE TABLE IF NOT EXISTS help_feedback (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    organization_id TEXT,
    content_type TEXT NOT NULL CHECK (content_type IN ('module', 'card', 'faq', 'video')),
    content_id TEXT NOT NULL,
    is_helpful BOOLEAN,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    metadata TEXT, -- JSON: additional context
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);

-- Indexes for feedback queries
CREATE INDEX IF NOT EXISTS idx_help_feedback_content ON help_feedback(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_help_feedback_user ON help_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_help_feedback_org ON help_feedback(organization_id);
CREATE INDEX IF NOT EXISTS idx_help_feedback_created ON help_feedback(created_at);

-- Help Analytics Table
-- Stores events for help content interaction (views, searches, clicks, completions)
CREATE TABLE IF NOT EXISTS help_analytics (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    organization_id TEXT,
    session_id TEXT,
    event_type TEXT NOT NULL CHECK (event_type IN ('view', 'search', 'click', 'complete', 'video_progress', 'tour_step', 'tour_complete', 'feedback_submit')),
    content_type TEXT CHECK (content_type IN ('module', 'card', 'faq', 'video', 'tour', 'search')),
    content_id TEXT,
    metadata TEXT, -- JSON: search query, progress percentage, etc.
    duration_ms INTEGER, -- Time spent on content
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_help_analytics_event ON help_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_help_analytics_content ON help_analytics(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_help_analytics_user ON help_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_help_analytics_org ON help_analytics(organization_id);
CREATE INDEX IF NOT EXISTS idx_help_analytics_session ON help_analytics(session_id);
CREATE INDEX IF NOT EXISTS idx_help_analytics_created ON help_analytics(created_at);

-- Help Search Queries Table
-- Stores search queries for analytics and improvement
CREATE TABLE IF NOT EXISTS help_search_queries (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    organization_id TEXT,
    query TEXT NOT NULL,
    results_count INTEGER DEFAULT 0,
    selected_result_type TEXT,
    selected_result_id TEXT,
    language TEXT DEFAULT 'en',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);

-- Indexes for search queries
CREATE INDEX IF NOT EXISTS idx_help_search_query ON help_search_queries(query);
CREATE INDEX IF NOT EXISTS idx_help_search_user ON help_search_queries(user_id);
CREATE INDEX IF NOT EXISTS idx_help_search_created ON help_search_queries(created_at);

-- Video Watch Progress Table
-- Persistent storage of video progress (complements localStorage)
CREATE TABLE IF NOT EXISTS help_video_progress (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    video_id TEXT NOT NULL,
    progress_percent REAL DEFAULT 0,
    is_completed BOOLEAN DEFAULT FALSE,
    watch_time_seconds INTEGER DEFAULT 0,
    last_position_seconds INTEGER DEFAULT 0,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, video_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for video progress
CREATE INDEX IF NOT EXISTS idx_help_video_user ON help_video_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_help_video_id ON help_video_progress(video_id);
CREATE INDEX IF NOT EXISTS idx_help_video_completed ON help_video_progress(is_completed);

-- Tour Progress Table
-- Tracks onboarding tour completion status
CREATE TABLE IF NOT EXISTS help_tour_progress (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    tour_id TEXT NOT NULL,
    current_step INTEGER DEFAULT 0,
    is_completed BOOLEAN DEFAULT FALSE,
    is_skipped BOOLEAN DEFAULT FALSE,
    completed_at DATETIME,
    skipped_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, tour_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for tour progress
CREATE INDEX IF NOT EXISTS idx_help_tour_user ON help_tour_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_help_tour_id ON help_tour_progress(tour_id);

-- Help Content Ratings Summary (Materialized View alternative)
-- Stores aggregated ratings per content item for quick retrieval
CREATE TABLE IF NOT EXISTS help_content_ratings (
    content_type TEXT NOT NULL,
    content_id TEXT NOT NULL,
    total_ratings INTEGER DEFAULT 0,
    helpful_count INTEGER DEFAULT 0,
    not_helpful_count INTEGER DEFAULT 0,
    avg_rating REAL DEFAULT 0,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (content_type, content_id)
);

-- Trigger to update ratings summary on feedback insert
CREATE TRIGGER IF NOT EXISTS update_help_ratings_on_insert
AFTER INSERT ON help_feedback
BEGIN
    INSERT INTO help_content_ratings (content_type, content_id, total_ratings, helpful_count, not_helpful_count, avg_rating, last_updated)
    VALUES (NEW.content_type, NEW.content_id, 1, 
            CASE WHEN NEW.is_helpful = 1 THEN 1 ELSE 0 END,
            CASE WHEN NEW.is_helpful = 0 THEN 1 ELSE 0 END,
            COALESCE(NEW.rating, 0),
            CURRENT_TIMESTAMP)
    ON CONFLICT(content_type, content_id) DO UPDATE SET
        total_ratings = help_content_ratings.total_ratings + 1,
        helpful_count = help_content_ratings.helpful_count + CASE WHEN NEW.is_helpful = 1 THEN 1 ELSE 0 END,
        not_helpful_count = help_content_ratings.not_helpful_count + CASE WHEN NEW.is_helpful = 0 THEN 1 ELSE 0 END,
        avg_rating = (help_content_ratings.avg_rating * help_content_ratings.total_ratings + COALESCE(NEW.rating, 0)) / (help_content_ratings.total_ratings + 1),
        last_updated = CURRENT_TIMESTAMP;
END;

-- Comments for documentation
-- This migration creates the following tables:
-- 1. help_feedback: Stores user feedback on help content
-- 2. help_analytics: Stores interaction events for analytics
-- 3. help_search_queries: Stores search queries for analysis
-- 4. help_video_progress: Persistent video watch progress
-- 5. help_tour_progress: Tour completion tracking
-- 6. help_content_ratings: Aggregated ratings summary


