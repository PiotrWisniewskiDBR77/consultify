-- Project Intelligence Hub Database Schema
-- Stores interview sessions, insights, and messages for AI-powered project knowledge capture

-- Interview Sessions - Tracks structured conversations with AI
CREATE TABLE IF NOT EXISTS interview_sessions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    topic TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'paused')),
    progress TEXT DEFAULT '{"completed":[],"current":null,"remaining":[]}',
    started_at TEXT DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT,
    duration_minutes INTEGER,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Project Insights - Knowledge extracted from conversations
CREATE TABLE IF NOT EXISTS project_insights (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    session_id TEXT,
    category TEXT NOT NULL CHECK(category IN (
        'objective', 'stakeholder', 'risk', 'assumption', 
        'constraint', 'decision', 'dependency', 'success_criteria'
    )),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    source TEXT,
    confidence TEXT DEFAULT 'medium' CHECK(confidence IN ('high', 'medium', 'low')),
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'confirmed', 'archived')),
    related_insights TEXT,
    pmo_domain TEXT,
    created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES interview_sessions(id) ON DELETE SET NULL
);

-- Interview Messages - Chat history for sessions
CREATE TABLE IF NOT EXISTS interview_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'ai', 'system')),
    content TEXT NOT NULL,
    detected_insights TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES interview_sessions(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_insights_project ON project_insights(project_id);
CREATE INDEX IF NOT EXISTS idx_insights_category ON project_insights(category);
CREATE INDEX IF NOT EXISTS idx_insights_status ON project_insights(status);
CREATE INDEX IF NOT EXISTS idx_sessions_project ON interview_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_messages_session ON interview_messages(session_id);
