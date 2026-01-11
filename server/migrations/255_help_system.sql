-- FLOW-HELP-001: Help & Education System
-- Migration: 255_help_system.sql

-- ==========================================
-- HELP ARTICLES
-- ==========================================

CREATE TABLE IF NOT EXISTS help_articles (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL, -- 'getting_started', 'assessments', 'projects', 'tools', 'reports', 'ai', 'settings', 'faq'
    subcategory TEXT,
    title TEXT NOT NULL,
    title_translations TEXT, -- JSON for i18n
    slug TEXT NOT NULL UNIQUE,
    content TEXT NOT NULL, -- Markdown
    content_translations TEXT, -- JSON for i18n
    excerpt TEXT,
    video_url TEXT,
    video_duration_seconds INTEGER,
    related_module TEXT, -- Which module this helps with
    tags TEXT DEFAULT '[]', -- JSON array
    sort_order INTEGER DEFAULT 0,
    is_published INTEGER DEFAULT 1,
    is_featured INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    helpful_count INTEGER DEFAULT 0,
    not_helpful_count INTEGER DEFAULT 0,
    last_updated_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_help_articles_category ON help_articles(category);
CREATE INDEX IF NOT EXISTS idx_help_articles_slug ON help_articles(slug);
CREATE INDEX IF NOT EXISTS idx_help_articles_module ON help_articles(related_module);
CREATE INDEX IF NOT EXISTS idx_help_articles_published ON help_articles(is_published);

-- Seed some basic articles
INSERT OR IGNORE INTO help_articles (id, category, title, slug, content, excerpt, sort_order) VALUES
    ('help-getting-started', 'getting_started', 'Quick Start Guide', 'quick-start-guide', 
     '# Quick Start Guide\n\nWelcome to Consultinity! This guide will help you get started.\n\n## Step 1: Set Up Your Profile\n...',
     'Get up and running with Consultinity in minutes', 1),
    
    ('help-first-project', 'getting_started', 'Creating Your First Project', 'first-project',
     '# Creating Your First Project\n\nProjects are containers for your transformation initiatives...',
     'Learn how to create and configure your first project', 2),
    
    ('help-drd-assessment', 'assessments', 'DRD Assessment Guide', 'drd-assessment-guide',
     '# DRD Assessment Guide\n\nThe Digital Readiness Diagnosis (DRD) helps you understand your digital maturity...',
     'Complete guide to the DRD assessment', 1),
    
    ('help-ai-assistant', 'ai', 'Using the AI Assistant', 'ai-assistant-guide',
     '# Using the AI Assistant\n\nThe AI assistant is available throughout the application to help you...',
     'Learn how to get the most from AI features', 1);

-- ==========================================
-- MODULE HELP (for ? button)
-- ==========================================

CREATE TABLE IF NOT EXISTS module_help (
    id TEXT PRIMARY KEY,
    module_key TEXT NOT NULL UNIQUE, -- e.g., 'initiatives', 'assessments.drd', 'tools.process-flow'
    title TEXT NOT NULL,
    title_translations TEXT, -- JSON
    short_description TEXT NOT NULL,
    short_description_translations TEXT, -- JSON
    video_url TEXT,
    video_duration_seconds INTEGER,
    article_id TEXT, -- Link to full article
    tips TEXT DEFAULT '[]', -- JSON array of quick tips
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES help_articles(id)
);

CREATE INDEX IF NOT EXISTS idx_module_help_key ON module_help(module_key);

-- Seed module help
INSERT OR IGNORE INTO module_help (id, module_key, title, short_description, tips) VALUES
    ('mh-initiatives', 'initiatives', 'Initiatives', 
     'Initiatives are the building blocks of your transformation roadmap. Create them from assessment results or manually.',
     '["Start with assessment-generated initiatives","Use status workflow: Draft → Planning → Review → Approved","Assign owners for accountability"]'),
    
    ('mh-assessments', 'assessments', 'Assessments',
     'Assess your organization''s digital maturity using standardized frameworks like DRD, SIRI, or Lean 4.0.',
     '["Answer honestly for accurate results","Provide evidence where possible","Review results with your team"]'),
    
    ('mh-projects', 'projects', 'Projects',
     'Projects organize your transformation work. Each project can contain multiple initiatives and assessments.',
     '["Create one project per major transformation effort","Use Sandbox for experimentation","Set clear project goals"]'),
    
    ('mh-mywork', 'mywork', 'My Work',
     'Your personal dashboard showing all tasks, decisions, and AI suggestions assigned to you.',
     '["Check daily for overdue items","Use Focus view for priorities","Review AI suggestions regularly"]'),
    
    ('mh-decisions', 'decisions', 'Decisions',
     'Track decisions that need to be made. Tasks can be blocked until decisions are resolved.',
     '["Set clear deadlines","Provide context and options","Escalate if needed"]');

-- ==========================================
-- USER HELP INTERACTIONS
-- ==========================================

CREATE TABLE IF NOT EXISTS user_help_interactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    interaction_type TEXT NOT NULL, -- 'article_view', 'video_watch', 'search', 'feedback', 'tooltip_dismiss'
    target_id TEXT, -- Article ID, video ID, etc.
    target_type TEXT, -- 'article', 'video', 'module_help'
    search_query TEXT, -- For search interactions
    feedback_value INTEGER, -- 1 for helpful, -1 for not helpful
    feedback_comment TEXT,
    duration_seconds INTEGER, -- Time spent
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_help_interactions_user ON user_help_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_help_interactions_type ON user_help_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_help_interactions_target ON user_help_interactions(target_type, target_id);

-- ==========================================
-- TOOLTIP DISMISSALS
-- ==========================================

CREATE TABLE IF NOT EXISTS tooltip_dismissals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    tooltip_id TEXT NOT NULL,
    tooltip_type TEXT DEFAULT 'standard', -- 'standard', 'module_help', 'onboarding'
    dismissed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    dismiss_duration TEXT NOT NULL, -- '15_days', '30_days', '60_days', 'forever'
    show_again_at TIMESTAMP,
    UNIQUE(user_id, tooltip_id)
);

CREATE INDEX IF NOT EXISTS idx_tooltip_dismissals_user ON tooltip_dismissals(user_id);
CREATE INDEX IF NOT EXISTS idx_tooltip_dismissals_show ON tooltip_dismissals(show_again_at);

-- ==========================================
-- SUPPORT TICKETS
-- ==========================================

CREATE TABLE IF NOT EXISTS support_tickets (
    id TEXT PRIMARY KEY,
    ticket_number TEXT NOT NULL UNIQUE, -- Human-readable ticket number
    organization_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    
    -- Ticket details
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT DEFAULT 'general', -- 'general', 'billing', 'technical', 'feature_request', 'bug'
    priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
    
    -- Status
    status TEXT DEFAULT 'open', -- 'open', 'in_progress', 'waiting_customer', 'resolved', 'closed'
    
    -- Assignment
    assigned_to TEXT,
    assigned_at TIMESTAMP,
    
    -- Context
    related_module TEXT, -- Where the issue occurred
    browser_info TEXT,
    screenshots TEXT DEFAULT '[]', -- JSON array of file IDs
    
    -- Resolution
    resolution TEXT,
    resolved_at TIMESTAMP,
    resolved_by TEXT,
    
    -- Feedback
    satisfaction_rating INTEGER, -- 1-5
    feedback_comment TEXT,
    feedback_at TIMESTAMP,
    
    -- SLA tracking
    first_response_at TIMESTAMP,
    sla_first_response_hours INTEGER DEFAULT 24,
    sla_resolution_hours INTEGER DEFAULT 72,
    is_sla_breached INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_org ON support_tickets(organization_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_number ON support_tickets(ticket_number);

-- ==========================================
-- TICKET MESSAGES
-- ==========================================

CREATE TABLE IF NOT EXISTS ticket_messages (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL,
    sender_type TEXT NOT NULL, -- 'user', 'support', 'system', 'ai'
    sender_id TEXT,
    sender_name TEXT,
    message TEXT NOT NULL,
    attachments TEXT DEFAULT '[]', -- JSON array of file IDs
    is_internal INTEGER DEFAULT 0, -- Internal notes for support team
    is_solution INTEGER DEFAULT 0, -- Mark as solution message
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_internal ON ticket_messages(is_internal);

-- ==========================================
-- HELP SEARCH INDEX
-- ==========================================

-- FTS virtual table for full-text search (SQLite)
CREATE VIRTUAL TABLE IF NOT EXISTS help_search USING fts5(
    article_id,
    title,
    content,
    tags,
    content='help_articles',
    content_rowid='rowid'
);
