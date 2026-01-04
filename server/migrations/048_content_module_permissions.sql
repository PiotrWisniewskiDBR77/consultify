-- Content Module Permissions Migration
-- Adds granular permissions for Email Templates and Playbook Templates management

-- ==========================================
-- NEW PERMISSIONS FOR CONTENT MODULE
-- ==========================================

-- Email Template Permissions
INSERT OR IGNORE INTO permissions (key, description, category) VALUES 
    ('EMAIL_TEMPLATE_VIEW', 'View email templates', 'CONTENT'),
    ('EMAIL_TEMPLATE_CREATE', 'Create email templates', 'CONTENT'),
    ('EMAIL_TEMPLATE_EDIT', 'Edit email templates', 'CONTENT'),
    ('EMAIL_TEMPLATE_DELETE', 'Delete email templates', 'CONTENT'),
    ('EMAIL_TEMPLATE_PUBLISH', 'Publish email templates', 'CONTENT'),
    ('EMAIL_TEMPLATE_DEPRECATE', 'Deprecate email templates', 'CONTENT'),
    ('EMAIL_TEMPLATE_CLONE', 'Clone email templates', 'CONTENT'),
    ('EMAIL_TEMPLATE_PREVIEW', 'Preview email templates', 'CONTENT'),
    ('EMAIL_TEMPLATE_TEST_SEND', 'Send test emails', 'CONTENT'),
    ('EMAIL_TEMPLATE_RESTORE', 'Restore email template versions', 'CONTENT'),
    ('EMAIL_TEMPLATE_ANALYTICS', 'View email template analytics', 'CONTENT');

-- Playbook Template Permissions
INSERT OR IGNORE INTO permissions (key, description, category) VALUES 
    ('PLAYBOOK_TEMPLATE_VIEW', 'View playbook templates', 'CONTENT'),
    ('PLAYBOOK_TEMPLATE_CREATE', 'Create playbook templates', 'CONTENT'),
    ('PLAYBOOK_TEMPLATE_EDIT', 'Edit playbook templates', 'CONTENT'),
    ('PLAYBOOK_TEMPLATE_DELETE', 'Delete playbook templates', 'CONTENT'),
    ('PLAYBOOK_TEMPLATE_PUBLISH', 'Publish playbook templates', 'CONTENT'),
    ('PLAYBOOK_TEMPLATE_DEPRECATE', 'Deprecate playbook templates', 'CONTENT'),
    ('PLAYBOOK_TEMPLATE_CLONE', 'Clone playbook templates', 'CONTENT'),
    ('PLAYBOOK_TEMPLATE_RESTORE', 'Restore playbook template versions', 'CONTENT'),
    ('PLAYBOOK_TEMPLATE_ANALYTICS', 'View playbook template analytics', 'CONTENT');

-- Content Management Permissions (shared)
INSERT OR IGNORE INTO permissions (key, description, category) VALUES 
    ('CONTENT_CATEGORY_VIEW', 'View content categories', 'CONTENT'),
    ('CONTENT_CATEGORY_CREATE', 'Create content categories', 'CONTENT'),
    ('CONTENT_CATEGORY_EDIT', 'Edit content categories', 'CONTENT'),
    ('CONTENT_CATEGORY_DELETE', 'Delete content categories', 'CONTENT'),
    ('CONTENT_TAG_VIEW', 'View content tags', 'CONTENT'),
    ('CONTENT_TAG_CREATE', 'Create content tags', 'CONTENT'),
    ('CONTENT_TAG_EDIT', 'Edit content tags', 'CONTENT'),
    ('CONTENT_TAG_DELETE', 'Delete content tags', 'CONTENT'),
    ('CONTENT_COMMENT_CREATE', 'Create comments on content', 'CONTENT'),
    ('CONTENT_COMMENT_EDIT', 'Edit comments on content', 'CONTENT'),
    ('CONTENT_COMMENT_DELETE', 'Delete comments on content', 'CONTENT'),
    ('CONTENT_COMMENT_RESOLVE', 'Resolve comments on content', 'CONTENT'),
    ('CONTENT_REVIEW_REQUEST', 'Request content reviews', 'CONTENT'),
    ('CONTENT_REVIEW_APPROVE', 'Approve content reviews', 'CONTENT'),
    ('CONTENT_REVIEW_REJECT', 'Reject content reviews', 'CONTENT'),
    ('CONTENT_FAVORITE_ADD', 'Add content to favorites', 'CONTENT'),
    ('CONTENT_SEARCH', 'Search all content', 'CONTENT'),
    ('CONTENT_BULK_ACTIONS', 'Perform bulk actions on content', 'CONTENT'),
    ('CONTENT_ANALYTICS_VIEW', 'View content analytics dashboard', 'CONTENT');

-- ==========================================
-- ROLE PERMISSION MAPPINGS
-- ==========================================

-- SUPERADMIN gets all content permissions (handled by service bypass)

-- ADMIN permissions
INSERT OR IGNORE INTO role_permissions (role, permission_key) VALUES 
    -- Email Templates (full access)
    ('ADMIN', 'EMAIL_TEMPLATE_VIEW'),
    ('ADMIN', 'EMAIL_TEMPLATE_CREATE'),
    ('ADMIN', 'EMAIL_TEMPLATE_EDIT'),
    ('ADMIN', 'EMAIL_TEMPLATE_DELETE'),
    ('ADMIN', 'EMAIL_TEMPLATE_PUBLISH'),
    ('ADMIN', 'EMAIL_TEMPLATE_DEPRECATE'),
    ('ADMIN', 'EMAIL_TEMPLATE_CLONE'),
    ('ADMIN', 'EMAIL_TEMPLATE_PREVIEW'),
    ('ADMIN', 'EMAIL_TEMPLATE_TEST_SEND'),
    ('ADMIN', 'EMAIL_TEMPLATE_RESTORE'),
    ('ADMIN', 'EMAIL_TEMPLATE_ANALYTICS'),
    -- Playbook Templates (full access)
    ('ADMIN', 'PLAYBOOK_TEMPLATE_VIEW'),
    ('ADMIN', 'PLAYBOOK_TEMPLATE_CREATE'),
    ('ADMIN', 'PLAYBOOK_TEMPLATE_EDIT'),
    ('ADMIN', 'PLAYBOOK_TEMPLATE_DELETE'),
    ('ADMIN', 'PLAYBOOK_TEMPLATE_PUBLISH'),
    ('ADMIN', 'PLAYBOOK_TEMPLATE_DEPRECATE'),
    ('ADMIN', 'PLAYBOOK_TEMPLATE_CLONE'),
    ('ADMIN', 'PLAYBOOK_TEMPLATE_RESTORE'),
    ('ADMIN', 'PLAYBOOK_TEMPLATE_ANALYTICS'),
    -- Categories & Tags (full access)
    ('ADMIN', 'CONTENT_CATEGORY_VIEW'),
    ('ADMIN', 'CONTENT_CATEGORY_CREATE'),
    ('ADMIN', 'CONTENT_CATEGORY_EDIT'),
    ('ADMIN', 'CONTENT_CATEGORY_DELETE'),
    ('ADMIN', 'CONTENT_TAG_VIEW'),
    ('ADMIN', 'CONTENT_TAG_CREATE'),
    ('ADMIN', 'CONTENT_TAG_EDIT'),
    ('ADMIN', 'CONTENT_TAG_DELETE'),
    -- Comments & Reviews (full access)
    ('ADMIN', 'CONTENT_COMMENT_CREATE'),
    ('ADMIN', 'CONTENT_COMMENT_EDIT'),
    ('ADMIN', 'CONTENT_COMMENT_DELETE'),
    ('ADMIN', 'CONTENT_COMMENT_RESOLVE'),
    ('ADMIN', 'CONTENT_REVIEW_REQUEST'),
    ('ADMIN', 'CONTENT_REVIEW_APPROVE'),
    ('ADMIN', 'CONTENT_REVIEW_REJECT'),
    -- Other
    ('ADMIN', 'CONTENT_FAVORITE_ADD'),
    ('ADMIN', 'CONTENT_SEARCH'),
    ('ADMIN', 'CONTENT_BULK_ACTIONS'),
    ('ADMIN', 'CONTENT_ANALYTICS_VIEW');

-- PROJECT_MANAGER permissions (limited content access)
INSERT OR IGNORE INTO role_permissions (role, permission_key) VALUES 
    -- Email Templates (view, use, limited edit)
    ('PROJECT_MANAGER', 'EMAIL_TEMPLATE_VIEW'),
    ('PROJECT_MANAGER', 'EMAIL_TEMPLATE_PREVIEW'),
    ('PROJECT_MANAGER', 'EMAIL_TEMPLATE_ANALYTICS'),
    -- Playbook Templates (full usage, limited edit)
    ('PROJECT_MANAGER', 'PLAYBOOK_TEMPLATE_VIEW'),
    ('PROJECT_MANAGER', 'PLAYBOOK_TEMPLATE_CREATE'),
    ('PROJECT_MANAGER', 'PLAYBOOK_TEMPLATE_EDIT'),
    ('PROJECT_MANAGER', 'PLAYBOOK_TEMPLATE_CLONE'),
    ('PROJECT_MANAGER', 'PLAYBOOK_TEMPLATE_ANALYTICS'),
    -- Categories & Tags (view only)
    ('PROJECT_MANAGER', 'CONTENT_CATEGORY_VIEW'),
    ('PROJECT_MANAGER', 'CONTENT_TAG_VIEW'),
    -- Comments (can create and edit own)
    ('PROJECT_MANAGER', 'CONTENT_COMMENT_CREATE'),
    ('PROJECT_MANAGER', 'CONTENT_COMMENT_EDIT'),
    -- Reviews (can request, cannot approve/reject)
    ('PROJECT_MANAGER', 'CONTENT_REVIEW_REQUEST'),
    -- Other
    ('PROJECT_MANAGER', 'CONTENT_FAVORITE_ADD'),
    ('PROJECT_MANAGER', 'CONTENT_SEARCH');

-- TEAM_MEMBER permissions (basic content access)
INSERT OR IGNORE INTO role_permissions (role, permission_key) VALUES 
    -- Email Templates (view only)
    ('TEAM_MEMBER', 'EMAIL_TEMPLATE_VIEW'),
    ('TEAM_MEMBER', 'EMAIL_TEMPLATE_PREVIEW'),
    -- Playbook Templates (view only)
    ('TEAM_MEMBER', 'PLAYBOOK_TEMPLATE_VIEW'),
    -- Categories & Tags (view only)
    ('TEAM_MEMBER', 'CONTENT_CATEGORY_VIEW'),
    ('TEAM_MEMBER', 'CONTENT_TAG_VIEW'),
    -- Comments (can create)
    ('TEAM_MEMBER', 'CONTENT_COMMENT_CREATE'),
    -- Other
    ('TEAM_MEMBER', 'CONTENT_FAVORITE_ADD'),
    ('TEAM_MEMBER', 'CONTENT_SEARCH');

-- VIEWER permissions (read-only)
INSERT OR IGNORE INTO role_permissions (role, permission_key) VALUES 
    ('VIEWER', 'EMAIL_TEMPLATE_VIEW'),
    ('VIEWER', 'EMAIL_TEMPLATE_PREVIEW'),
    ('VIEWER', 'PLAYBOOK_TEMPLATE_VIEW'),
    ('VIEWER', 'CONTENT_CATEGORY_VIEW'),
    ('VIEWER', 'CONTENT_TAG_VIEW'),
    ('VIEWER', 'CONTENT_SEARCH');

-- ==========================================
-- CONTENT-SPECIFIC PERMISSION TABLE
-- For granular per-content permissions (e.g., specific template access)
-- ==========================================

CREATE TABLE IF NOT EXISTS content_permissions (
    id TEXT PRIMARY KEY,
    content_id TEXT NOT NULL,
    content_type TEXT NOT NULL CHECK(content_type IN ('PLAYBOOK_TEMPLATE', 'EMAIL_TEMPLATE', 'CATEGORY', 'TAG')),
    user_id TEXT,
    role TEXT,
    permission_key TEXT NOT NULL,
    grant_type TEXT NOT NULL DEFAULT 'GRANT' CHECK(grant_type IN ('GRANT', 'REVOKE')),
    granted_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    UNIQUE(content_id, content_type, user_id, permission_key),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(granted_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_content_permissions_content ON content_permissions(content_id, content_type);
CREATE INDEX IF NOT EXISTS idx_content_permissions_user ON content_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_content_permissions_role ON content_permissions(role);








