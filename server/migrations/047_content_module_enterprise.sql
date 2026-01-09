-- Migration: 047_content_module_enterprise.sql
-- Content Module Enterprise Extension
-- Created: 2026-01-02
-- Description: Full enterprise content management system with email templates, 
--              versioning, categories, tags, comments, reviews, analytics, and permissions

-- ==========================================
-- 1. EXTEND EMAIL TEMPLATES TABLE
-- ==========================================

-- Add enterprise columns to email_templates if not exists
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'DRAFT';
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS category_id TEXT;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS language_code TEXT DEFAULT 'en';
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS parent_template_id TEXT;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS variables_schema TEXT DEFAULT '{}';
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS published_at TEXT;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS published_by TEXT;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;

-- ==========================================
-- 2. EMAIL TEMPLATE VERSIONS (Audit Trail)
-- ==========================================

CREATE TABLE IF NOT EXISTS email_template_versions (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    
    -- Snapshot of template at this version
    template_key TEXT,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    html_content TEXT NOT NULL,
    text_content TEXT,
    variables_schema TEXT DEFAULT '{}',
    
    -- Change metadata
    changed_by TEXT,
    change_notes TEXT,
    change_type TEXT DEFAULT 'UPDATE', -- 'CREATE', 'UPDATE', 'PUBLISH', 'RESTORE'
    
    -- Status at time of version
    status_at_version TEXT,
    
    created_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (template_id) REFERENCES email_templates(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_email_template_versions_template ON email_template_versions(template_id);
CREATE INDEX IF NOT EXISTS idx_email_template_versions_version ON email_template_versions(template_id, version);

-- ==========================================
-- 3. EMAIL SENDS (Tracking)
-- ==========================================

CREATE TABLE IF NOT EXISTS email_sends (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL,
    organization_id TEXT,
    
    -- Recipient info
    recipient_email TEXT NOT NULL,
    recipient_user_id TEXT,
    
    -- Email content (resolved)
    subject TEXT NOT NULL,
    
    -- Tracking
    status TEXT DEFAULT 'PENDING', -- 'PENDING', 'SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'BOUNCED', 'FAILED'
    sent_at TEXT,
    delivered_at TEXT,
    opened_at TEXT,
    clicked_at TEXT,
    bounced_at TEXT,
    failed_at TEXT,
    
    -- Error handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Analytics
    open_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    first_click_url TEXT,
    
    -- Metadata
    metadata TEXT DEFAULT '{}', -- JSON with additional tracking data
    
    created_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (template_id) REFERENCES email_templates(id) ON DELETE SET NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_email_sends_template ON email_sends(template_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_org ON email_sends(organization_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_recipient ON email_sends(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_sends_status ON email_sends(status);
CREATE INDEX IF NOT EXISTS idx_email_sends_created ON email_sends(created_at);

-- ==========================================
-- 4. CONTENT CATEGORIES
-- ==========================================

CREATE TABLE IF NOT EXISTS content_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    
    -- Type: 'PLAYBOOK', 'EMAIL', 'ALL'
    content_type TEXT NOT NULL DEFAULT 'ALL',
    
    -- Hierarchy
    parent_id TEXT,
    sort_order INTEGER DEFAULT 0,
    
    -- Styling
    color TEXT DEFAULT '#6366F1',
    icon TEXT DEFAULT 'folder',
    
    -- Ownership
    organization_id TEXT, -- NULL for global/system categories
    
    -- Metadata
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    created_by TEXT,
    
    FOREIGN KEY (parent_id) REFERENCES content_categories(id) ON DELETE SET NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_content_categories_slug ON content_categories(slug, organization_id);
CREATE INDEX IF NOT EXISTS idx_content_categories_type ON content_categories(content_type);
CREATE INDEX IF NOT EXISTS idx_content_categories_parent ON content_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_content_categories_org ON content_categories(organization_id);

-- ==========================================
-- 5. CONTENT TAGS
-- ==========================================

CREATE TABLE IF NOT EXISTS content_tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    
    -- Type: 'PLAYBOOK', 'EMAIL', 'ALL'
    content_type TEXT NOT NULL DEFAULT 'ALL',
    
    -- Styling
    color TEXT DEFAULT '#10B981',
    
    -- Ownership
    organization_id TEXT, -- NULL for global/system tags
    
    -- Usage tracking
    usage_count INTEGER DEFAULT 0,
    
    -- Metadata
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    created_by TEXT,
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_content_tags_slug ON content_tags(slug, organization_id);
CREATE INDEX IF NOT EXISTS idx_content_tags_type ON content_tags(content_type);
CREATE INDEX IF NOT EXISTS idx_content_tags_org ON content_tags(organization_id);

-- ==========================================
-- 6. CONTENT TAG MAPPINGS
-- ==========================================

CREATE TABLE IF NOT EXISTS content_tag_mappings (
    id TEXT PRIMARY KEY,
    content_id TEXT NOT NULL,
    content_type TEXT NOT NULL, -- 'PLAYBOOK_TEMPLATE', 'EMAIL_TEMPLATE'
    tag_id TEXT NOT NULL,
    
    created_at TEXT DEFAULT (datetime('now')),
    created_by TEXT,
    
    FOREIGN KEY (tag_id) REFERENCES content_tags(id) ON DELETE CASCADE,
    UNIQUE(content_id, content_type, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_content_tag_mappings_content ON content_tag_mappings(content_id, content_type);
CREATE INDEX IF NOT EXISTS idx_content_tag_mappings_tag ON content_tag_mappings(tag_id);

-- ==========================================
-- 7. CONTENT COMMENTS
-- ==========================================

CREATE TABLE IF NOT EXISTS content_comments (
    id TEXT PRIMARY KEY,
    content_id TEXT NOT NULL,
    content_type TEXT NOT NULL, -- 'PLAYBOOK_TEMPLATE', 'EMAIL_TEMPLATE'
    
    -- Author
    user_id TEXT NOT NULL,
    
    -- Comment content
    comment_text TEXT NOT NULL,
    
    -- Threading
    parent_comment_id TEXT,
    thread_id TEXT, -- Root comment ID for the thread
    
    -- Position (for inline comments on specific elements)
    position_ref TEXT, -- e.g., 'step:step-id' or 'line:15'
    
    -- Status
    is_resolved INTEGER DEFAULT 0,
    resolved_by TEXT,
    resolved_at TEXT,
    
    -- Mentions
    mentioned_user_ids TEXT DEFAULT '[]', -- JSON array
    
    -- Edit tracking
    is_edited INTEGER DEFAULT 0,
    edited_at TEXT,
    
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_comment_id) REFERENCES content_comments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_content_comments_content ON content_comments(content_id, content_type);
CREATE INDEX IF NOT EXISTS idx_content_comments_user ON content_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_content_comments_thread ON content_comments(thread_id);
CREATE INDEX IF NOT EXISTS idx_content_comments_parent ON content_comments(parent_comment_id);

-- ==========================================
-- 8. CONTENT REVIEWS
-- ==========================================

CREATE TABLE IF NOT EXISTS content_reviews (
    id TEXT PRIMARY KEY,
    content_id TEXT NOT NULL,
    content_type TEXT NOT NULL, -- 'PLAYBOOK_TEMPLATE', 'EMAIL_TEMPLATE'
    
    -- Review request
    requested_by TEXT NOT NULL,
    requested_at TEXT DEFAULT (datetime('now')),
    
    -- Reviewer
    reviewer_id TEXT NOT NULL,
    
    -- Review status
    status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED'
    
    -- Review content
    review_notes TEXT,
    checklist_items TEXT DEFAULT '[]', -- JSON array of checklist items
    
    -- Resolution
    reviewed_at TEXT,
    
    -- Version being reviewed
    version_at_review INTEGER,
    
    -- Priority
    priority TEXT DEFAULT 'NORMAL', -- 'LOW', 'NORMAL', 'HIGH', 'URGENT'
    due_date TEXT,
    
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_content_reviews_content ON content_reviews(content_id, content_type);
CREATE INDEX IF NOT EXISTS idx_content_reviews_reviewer ON content_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_content_reviews_status ON content_reviews(status);
CREATE INDEX IF NOT EXISTS idx_content_reviews_requested_by ON content_reviews(requested_by);

-- ==========================================
-- 9. CONTENT ANALYTICS
-- ==========================================

CREATE TABLE IF NOT EXISTS content_analytics (
    id TEXT PRIMARY KEY,
    content_id TEXT NOT NULL,
    content_type TEXT NOT NULL, -- 'PLAYBOOK_TEMPLATE', 'EMAIL_TEMPLATE'
    
    -- Event info
    event_type TEXT NOT NULL, -- 'VIEW', 'EDIT', 'USE', 'EXPORT', 'CLONE', 'PUBLISH', 'TEST_SEND', 'PREVIEW'
    
    -- Actor
    user_id TEXT,
    organization_id TEXT,
    
    -- Context
    metadata TEXT DEFAULT '{}', -- JSON with additional event data
    
    -- Session tracking
    session_id TEXT,
    
    -- Timing
    duration_ms INTEGER,
    
    created_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_content_analytics_content ON content_analytics(content_id, content_type);
CREATE INDEX IF NOT EXISTS idx_content_analytics_event ON content_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_content_analytics_user ON content_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_content_analytics_org ON content_analytics(organization_id);
CREATE INDEX IF NOT EXISTS idx_content_analytics_created ON content_analytics(created_at);

-- ==========================================
-- 10. CONTENT FAVORITES
-- ==========================================

CREATE TABLE IF NOT EXISTS content_favorites (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    content_id TEXT NOT NULL,
    content_type TEXT NOT NULL, -- 'PLAYBOOK_TEMPLATE', 'EMAIL_TEMPLATE'
    
    -- Notes
    notes TEXT,
    
    -- Folder (for organizing favorites)
    folder_name TEXT DEFAULT 'Default',
    
    created_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, content_id, content_type)
);

CREATE INDEX IF NOT EXISTS idx_content_favorites_user ON content_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_content_favorites_content ON content_favorites(content_id, content_type);

-- ==========================================
-- 11. CONTENT PERMISSIONS (Granular)
-- ==========================================

CREATE TABLE IF NOT EXISTS content_permissions (
    id TEXT PRIMARY KEY,
    content_id TEXT NOT NULL,
    content_type TEXT NOT NULL, -- 'PLAYBOOK_TEMPLATE', 'EMAIL_TEMPLATE', 'CATEGORY'
    
    -- Permission target (either user or role)
    user_id TEXT, -- NULL for role-based
    role TEXT, -- NULL for user-based
    
    -- Permission
    permission TEXT NOT NULL, -- 'VIEW', 'EDIT', 'DELETE', 'PUBLISH', 'REVIEW', 'ADMIN'
    grant_type TEXT DEFAULT 'GRANT', -- 'GRANT' or 'DENY'
    
    -- Scope
    organization_id TEXT,
    
    -- Granted by
    granted_by TEXT,
    
    -- Expiry
    expires_at TEXT,
    
    created_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_content_permissions_content ON content_permissions(content_id, content_type);
CREATE INDEX IF NOT EXISTS idx_content_permissions_user ON content_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_content_permissions_role ON content_permissions(role);
CREATE INDEX IF NOT EXISTS idx_content_permissions_org ON content_permissions(organization_id);

-- ==========================================
-- 12. EXTEND AI PLAYBOOK TEMPLATES
-- ==========================================

-- Add enterprise columns
ALTER TABLE ai_playbook_templates ADD COLUMN IF NOT EXISTS category_id TEXT;
ALTER TABLE ai_playbook_templates ADD COLUMN IF NOT EXISTS updated_at TEXT DEFAULT (datetime('now'));
ALTER TABLE ai_playbook_templates ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;
ALTER TABLE ai_playbook_templates ADD COLUMN IF NOT EXISTS last_used_at TEXT;
ALTER TABLE ai_playbook_templates ADD COLUMN IF NOT EXISTS avg_execution_time_mins INTEGER;
ALTER TABLE ai_playbook_templates ADD COLUMN IF NOT EXISTS success_rate REAL;
ALTER TABLE ai_playbook_templates ADD COLUMN IF NOT EXISTS organization_id TEXT;

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_ai_playbook_templates_category ON ai_playbook_templates(category_id);
CREATE INDEX IF NOT EXISTS idx_ai_playbook_templates_org ON ai_playbook_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_playbook_templates_usage ON ai_playbook_templates(usage_count DESC);

-- ==========================================
-- 13. AI PLAYBOOK TEMPLATE VERSIONS
-- ==========================================

CREATE TABLE IF NOT EXISTS ai_playbook_template_versions (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    
    -- Snapshot
    title TEXT NOT NULL,
    description TEXT,
    trigger_signal TEXT,
    template_graph TEXT,
    estimated_duration_mins INTEGER,
    
    -- Change metadata
    changed_by TEXT,
    change_notes TEXT,
    change_type TEXT DEFAULT 'UPDATE',
    
    -- Status at version
    status_at_version TEXT,
    
    created_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (template_id) REFERENCES ai_playbook_templates(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_playbook_template_versions_template ON ai_playbook_template_versions(template_id);
CREATE INDEX IF NOT EXISTS idx_playbook_template_versions_version ON ai_playbook_template_versions(template_id, version);

-- ==========================================
-- 14. SEED DEFAULT CATEGORIES
-- ==========================================

INSERT OR IGNORE INTO content_categories (id, name, slug, description, content_type, sort_order, color, icon)
VALUES 
    ('cat_playbook_operations', 'Operations', 'operations', 'Operational playbooks for daily tasks', 'PLAYBOOK', 1, '#3B82F6', 'settings'),
    ('cat_playbook_compliance', 'Compliance', 'compliance', 'Compliance and audit playbooks', 'PLAYBOOK', 2, '#EF4444', 'shield'),
    ('cat_playbook_risk', 'Risk Management', 'risk-management', 'Risk assessment and mitigation playbooks', 'PLAYBOOK', 3, '#F59E0B', 'alert-triangle'),
    ('cat_playbook_change', 'Change Management', 'change-management', 'Change management and adoption playbooks', 'PLAYBOOK', 4, '#8B5CF6', 'refresh-cw'),
    ('cat_playbook_performance', 'Performance', 'performance', 'Performance review and improvement playbooks', 'PLAYBOOK', 5, '#10B981', 'trending-up'),
    ('cat_playbook_onboarding', 'Onboarding', 'onboarding', 'Team and project onboarding playbooks', 'PLAYBOOK', 6, '#06B6D4', 'users'),
    
    ('cat_email_welcome', 'Welcome', 'welcome', 'Welcome and onboarding emails', 'EMAIL', 1, '#10B981', 'mail'),
    ('cat_email_notifications', 'Notifications', 'notifications', 'System notifications and alerts', 'EMAIL', 2, '#6366F1', 'bell'),
    ('cat_email_reports', 'Reports', 'reports', 'Report delivery emails', 'EMAIL', 3, '#F59E0B', 'file-text'),
    ('cat_email_security', 'Security', 'security', 'Security and access related emails', 'EMAIL', 4, '#EF4444', 'lock'),
    ('cat_email_marketing', 'Marketing', 'marketing', 'Marketing and promotional emails', 'EMAIL', 5, '#EC4899', 'megaphone'),
    ('cat_email_transactional', 'Transactional', 'transactional', 'Transaction confirmations and receipts', 'EMAIL', 6, '#8B5CF6', 'credit-card');

-- ==========================================
-- 15. SEED DEFAULT TAGS
-- ==========================================

INSERT OR IGNORE INTO content_tags (id, name, slug, content_type, color)
VALUES 
    ('tag_critical', 'Critical', 'critical', 'ALL', '#EF4444'),
    ('tag_high_priority', 'High Priority', 'high-priority', 'ALL', '#F59E0B'),
    ('tag_automated', 'Automated', 'automated', 'ALL', '#3B82F6'),
    ('tag_manual', 'Manual Review', 'manual-review', 'ALL', '#6366F1'),
    ('tag_draft', 'Draft', 'draft', 'ALL', '#9CA3AF'),
    ('tag_production', 'Production', 'production', 'ALL', '#10B981'),
    ('tag_deprecated', 'Deprecated', 'deprecated', 'ALL', '#DC2626'),
    ('tag_ai_generated', 'AI Generated', 'ai-generated', 'ALL', '#8B5CF6'),
    ('tag_template', 'Template', 'template', 'ALL', '#06B6D4'),
    ('tag_multi_language', 'Multi-Language', 'multi-language', 'EMAIL', '#EC4899');

-- ==========================================
-- 16. ADD ROLE PERMISSIONS FOR CONTENT
-- ==========================================

INSERT OR IGNORE INTO role_permissions (id, role, permission_key, description, created_at)
VALUES 
    -- Content View
    ('rp_content_view_admin', 'ADMIN', 'CONTENT_VIEW', 'View content templates', datetime('now')),
    ('rp_content_view_pm', 'PROJECT_MANAGER', 'CONTENT_VIEW', 'View content templates', datetime('now')),
    ('rp_content_view_superadmin', 'SUPERADMIN', 'CONTENT_VIEW', 'View content templates', datetime('now')),
    
    -- Content Edit
    ('rp_content_edit_admin', 'ADMIN', 'CONTENT_EDIT', 'Edit content templates', datetime('now')),
    ('rp_content_edit_superadmin', 'SUPERADMIN', 'CONTENT_EDIT', 'Edit content templates', datetime('now')),
    
    -- Content Publish
    ('rp_content_publish_admin', 'ADMIN', 'CONTENT_PUBLISH', 'Publish content templates', datetime('now')),
    ('rp_content_publish_superadmin', 'SUPERADMIN', 'CONTENT_PUBLISH', 'Publish content templates', datetime('now')),
    
    -- Content Delete
    ('rp_content_delete_superadmin', 'SUPERADMIN', 'CONTENT_DELETE', 'Delete content templates', datetime('now')),
    
    -- Content Review
    ('rp_content_review_admin', 'ADMIN', 'CONTENT_REVIEW', 'Review content templates', datetime('now')),
    ('rp_content_review_superadmin', 'SUPERADMIN', 'CONTENT_REVIEW', 'Review content templates', datetime('now')),
    ('rp_content_review_pm', 'PROJECT_MANAGER', 'CONTENT_REVIEW', 'Review content templates', datetime('now')),
    
    -- Email Templates Specific
    ('rp_email_send_test_admin', 'ADMIN', 'EMAIL_SEND_TEST', 'Send test emails', datetime('now')),
    ('rp_email_send_test_superadmin', 'SUPERADMIN', 'EMAIL_SEND_TEST', 'Send test emails', datetime('now')),
    
    -- Content Analytics
    ('rp_content_analytics_admin', 'ADMIN', 'CONTENT_ANALYTICS', 'View content analytics', datetime('now')),
    ('rp_content_analytics_superadmin', 'SUPERADMIN', 'CONTENT_ANALYTICS', 'View content analytics', datetime('now'));

-- ==========================================
-- 17. CREATE VIEWS FOR ANALYTICS
-- ==========================================

-- Drop existing views if they exist
DROP VIEW IF EXISTS v_email_template_stats;
DROP VIEW IF EXISTS v_playbook_template_stats;
DROP VIEW IF EXISTS v_content_engagement;

-- Email Template Statistics View
CREATE VIEW IF NOT EXISTS v_email_template_stats AS
SELECT 
    et.id,
    et.template_key,
    et.name,
    et.status,
    et.version,
    et.usage_count,
    COUNT(DISTINCT es.id) as total_sends,
    SUM(CASE WHEN es.status = 'DELIVERED' THEN 1 ELSE 0 END) as delivered_count,
    SUM(CASE WHEN es.status = 'OPENED' THEN 1 ELSE 0 END) as opened_count,
    SUM(CASE WHEN es.status = 'CLICKED' THEN 1 ELSE 0 END) as clicked_count,
    SUM(CASE WHEN es.status = 'BOUNCED' THEN 1 ELSE 0 END) as bounced_count,
    ROUND(AVG(CASE WHEN es.opened_at IS NOT NULL THEN 1.0 ELSE 0.0 END) * 100, 2) as open_rate,
    ROUND(AVG(CASE WHEN es.clicked_at IS NOT NULL THEN 1.0 ELSE 0.0 END) * 100, 2) as click_rate
FROM email_templates et
LEFT JOIN email_sends es ON et.id = es.template_id
GROUP BY et.id;

-- Playbook Template Statistics View  
CREATE VIEW IF NOT EXISTS v_playbook_template_stats AS
SELECT 
    apt.id,
    apt.key,
    apt.title,
    apt.status,
    apt.version,
    apt.usage_count,
    apt.success_rate,
    apt.avg_execution_time_mins,
    COUNT(DISTINCT apr.id) as total_runs,
    SUM(CASE WHEN apr.status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_runs,
    SUM(CASE WHEN apr.status = 'FAILED' THEN 1 ELSE 0 END) as failed_runs,
    SUM(CASE WHEN apr.status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled_runs
FROM ai_playbook_templates apt
LEFT JOIN ai_playbook_runs apr ON apt.id = apr.template_id
GROUP BY apt.id;

-- Content Engagement View
CREATE VIEW IF NOT EXISTS v_content_engagement AS
SELECT 
    ca.content_id,
    ca.content_type,
    COUNT(*) as total_events,
    COUNT(DISTINCT ca.user_id) as unique_users,
    COUNT(DISTINCT ca.organization_id) as unique_orgs,
    SUM(CASE WHEN ca.event_type = 'VIEW' THEN 1 ELSE 0 END) as views,
    SUM(CASE WHEN ca.event_type = 'EDIT' THEN 1 ELSE 0 END) as edits,
    SUM(CASE WHEN ca.event_type = 'USE' THEN 1 ELSE 0 END) as uses,
    SUM(CASE WHEN ca.event_type = 'EXPORT' THEN 1 ELSE 0 END) as exports,
    SUM(CASE WHEN ca.event_type = 'CLONE' THEN 1 ELSE 0 END) as clones,
    MIN(ca.created_at) as first_interaction,
    MAX(ca.created_at) as last_interaction
FROM content_analytics ca
GROUP BY ca.content_id, ca.content_type;


















