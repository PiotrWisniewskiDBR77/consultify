-- =============================================
-- CONSULTINITY STUDIO - Visual AI Workspace
-- Migration: 081_studio_tables.sql
-- =============================================

-- Core Studio Documents Table
CREATE TABLE IF NOT EXISTS studio_documents (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'process_flow', -- process_flow, org_chart, mindmap, raci, swimlane, custom
    
    -- Visual State (React Flow data)
    nodes_json TEXT DEFAULT '[]',
    edges_json TEXT DEFAULT '[]',
    viewport_json TEXT DEFAULT '{"x": 0, "y": 0, "zoom": 1}',
    
    -- AI Context
    conversation_id TEXT,
    ai_context_json TEXT DEFAULT '{}', -- Stores intent, entities, last prompt
    
    -- PMO Linking
    linked_task_id TEXT,
    linked_project_id TEXT,
    linked_initiative_id TEXT,
    
    -- Sharing
    is_public BOOLEAN DEFAULT 0,
    share_token TEXT UNIQUE,
    
    -- Metadata
    thumbnail_url TEXT,
    tags_json TEXT DEFAULT '[]',
    
    -- Audit
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(linked_task_id) REFERENCES tasks(id) ON DELETE SET NULL,
    FOREIGN KEY(linked_project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY(linked_initiative_id) REFERENCES initiatives(id) ON DELETE SET NULL,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Studio Document Snapshots (Version History)
CREATE TABLE IF NOT EXISTS studio_snapshots (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    name TEXT, -- Optional version name like "v1.0 - Initial"
    
    -- Snapshot Data
    nodes_json TEXT NOT NULL,
    edges_json TEXT NOT NULL,
    viewport_json TEXT,
    
    -- Reason for snapshot
    snapshot_reason TEXT, -- manual, auto_save, before_ai_edit, export
    
    -- Audit
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(document_id) REFERENCES studio_documents(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Studio Node Comments
CREATE TABLE IF NOT EXISTS studio_comments (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    node_id TEXT NOT NULL, -- The React Flow node ID
    
    -- Comment Content
    text TEXT NOT NULL,
    
    -- AI Response (if AI processed this comment)
    ai_response TEXT,
    ai_action_taken TEXT, -- created_node, modified_node, deleted_node, none
    
    -- Status
    resolved BOOLEAN DEFAULT 0,
    resolved_at DATETIME,
    resolved_by TEXT,
    
    -- Audit
    author_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(document_id) REFERENCES studio_documents(id) ON DELETE CASCADE,
    FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY(resolved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Studio Templates
CREATE TABLE IF NOT EXISTS studio_templates (
    id TEXT PRIMARY KEY,
    organization_id TEXT, -- NULL means global/system template
    
    -- Template Info
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL, -- process_flow, org_chart, mindmap, raci, pmo, custom
    icon TEXT DEFAULT 'file-diagram', -- Lucide icon name
    
    -- Template Content
    nodes_json TEXT NOT NULL DEFAULT '[]',
    edges_json TEXT NOT NULL DEFAULT '[]',
    default_viewport_json TEXT DEFAULT '{"x": 0, "y": 0, "zoom": 1}',
    
    -- Metadata
    thumbnail_url TEXT,
    tags_json TEXT DEFAULT '[]',
    
    -- Visibility
    is_public BOOLEAN DEFAULT 0, -- System templates are public
    is_featured BOOLEAN DEFAULT 0,
    
    -- Usage Stats
    usage_count INTEGER DEFAULT 0,
    
    -- Audit
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Studio AI Sessions (for conversation context)
CREATE TABLE IF NOT EXISTS studio_ai_sessions (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    
    -- Conversation
    messages_json TEXT DEFAULT '[]', -- Array of {role, content, timestamp}
    
    -- Context
    intent_history_json TEXT DEFAULT '[]', -- Array of classified intents
    entities_json TEXT DEFAULT '{}', -- Extracted entities
    
    -- Stats
    total_generations INTEGER DEFAULT 0,
    total_modifications INTEGER DEFAULT 0,
    
    -- Audit
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(document_id) REFERENCES studio_documents(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_studio_documents_org ON studio_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_studio_documents_type ON studio_documents(type);
CREATE INDEX IF NOT EXISTS idx_studio_documents_created_by ON studio_documents(created_by);
CREATE INDEX IF NOT EXISTS idx_studio_documents_linked_task ON studio_documents(linked_task_id);
CREATE INDEX IF NOT EXISTS idx_studio_documents_linked_project ON studio_documents(linked_project_id);
CREATE INDEX IF NOT EXISTS idx_studio_documents_linked_initiative ON studio_documents(linked_initiative_id);
CREATE INDEX IF NOT EXISTS idx_studio_documents_share_token ON studio_documents(share_token);

CREATE INDEX IF NOT EXISTS idx_studio_snapshots_document ON studio_snapshots(document_id);
CREATE INDEX IF NOT EXISTS idx_studio_snapshots_version ON studio_snapshots(document_id, version);

CREATE INDEX IF NOT EXISTS idx_studio_comments_document ON studio_comments(document_id);
CREATE INDEX IF NOT EXISTS idx_studio_comments_node ON studio_comments(document_id, node_id);

CREATE INDEX IF NOT EXISTS idx_studio_templates_org ON studio_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_studio_templates_category ON studio_templates(category);
CREATE INDEX IF NOT EXISTS idx_studio_templates_public ON studio_templates(is_public);

CREATE INDEX IF NOT EXISTS idx_studio_ai_sessions_document ON studio_ai_sessions(document_id);




















