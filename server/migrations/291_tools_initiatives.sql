-- FLOW-TOOLS-INITIATIVES-001: Tools -> Initiatives
-- Migration: 291_tools_initiatives.sql

-- ==========================================
-- TOOL SESSIONS (Discovery Tools)
-- ==========================================

CREATE TABLE IF NOT EXISTS tool_sessions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    project_id TEXT,
    tool_type TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'DRAFT', -- DRAFT | REVIEW | APPROVED
    completion_percent INTEGER DEFAULT 0,
    confidence_avg REAL DEFAULT 0,
    answers_json TEXT DEFAULT '{}',
    context_snapshot TEXT DEFAULT '{}',
    review_requested_at TIMESTAMP,
    approved_at TIMESTAMP,
    created_by TEXT NOT NULL,
    updated_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tool_sessions_org ON tool_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_tool_sessions_status ON tool_sessions(status);
CREATE INDEX IF NOT EXISTS idx_tool_sessions_tool ON tool_sessions(tool_type);

-- ==========================================
-- TOOL DECISIONS (Gates)
-- ==========================================

CREATE TABLE IF NOT EXISTS tool_decisions (
    id TEXT PRIMARY KEY,
    tool_session_id TEXT NOT NULL,
    decision_type TEXT NOT NULL, -- REQUEST_REVIEW | APPROVE_TOOL | GENERATE_INITIATIVES
    status TEXT DEFAULT 'APPROVED', -- PENDING | APPROVED | REJECTED
    owner_id TEXT,
    due_date TIMESTAMP,
    comment TEXT,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tool_session_id) REFERENCES tool_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tool_decisions_session ON tool_decisions(tool_session_id);
CREATE INDEX IF NOT EXISTS idx_tool_decisions_type ON tool_decisions(decision_type);

-- ==========================================
-- INITIATIVE GENERATION BATCHES
-- ==========================================

CREATE TABLE IF NOT EXISTS tool_initiative_batches (
    id TEXT PRIMARY KEY,
    tool_session_id TEXT NOT NULL,
    methodology_id TEXT NOT NULL,
    initiatives_count INTEGER NOT NULL,
    include_chat_context INTEGER DEFAULT 1,
    generated_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tool_session_id) REFERENCES tool_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tool_batches_session ON tool_initiative_batches(tool_session_id);

-- ==========================================
-- TOOL -> INITIATIVE LINKS
-- ==========================================

CREATE TABLE IF NOT EXISTS tool_initiative_links (
    id TEXT PRIMARY KEY,
    tool_session_id TEXT NOT NULL,
    batch_id TEXT NOT NULL,
    initiative_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tool_session_id) REFERENCES tool_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (batch_id) REFERENCES tool_initiative_batches(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tool_links_session ON tool_initiative_links(tool_session_id);
CREATE INDEX IF NOT EXISTS idx_tool_links_batch ON tool_initiative_links(batch_id);

-- ==========================================
-- PERMISSIONS (Admin-configurable)
-- ==========================================
-- Note: PostgreSQL permissions table may not have 'name' and 'icon' columns
-- Using only: key, description, category

INSERT OR IGNORE INTO permissions (key, description, category) VALUES
('TOOLS_REQUEST_REVIEW', 'Request review for tool session', 'TOOLS'),
('TOOLS_APPROVE', 'Approve tool session', 'TOOLS'),
('TOOLS_GENERATE_INITIATIVES', 'Generate initiatives from tool', 'TOOLS');

INSERT OR IGNORE INTO role_permissions (id, role, permission_key, description) VALUES
('rp_tools_request_review_admin', 'ADMIN', 'TOOLS_REQUEST_REVIEW', 'Request review for tools'),
('rp_tools_request_review_pm', 'PROJECT_MANAGER', 'TOOLS_REQUEST_REVIEW', 'Request review for tools'),
('rp_tools_request_review_super', 'SUPERADMIN', 'TOOLS_REQUEST_REVIEW', 'Request review for tools'),
('rp_tools_approve_admin', 'ADMIN', 'TOOLS_APPROVE', 'Approve tools'),
('rp_tools_approve_super', 'SUPERADMIN', 'TOOLS_APPROVE', 'Approve tools'),
('rp_tools_generate_admin', 'ADMIN', 'TOOLS_GENERATE_INITIATIVES', 'Generate initiatives from tools'),
('rp_tools_generate_pm', 'PROJECT_MANAGER', 'TOOLS_GENERATE_INITIATIVES', 'Generate initiatives from tools'),
('rp_tools_generate_super', 'SUPERADMIN', 'TOOLS_GENERATE_INITIATIVES', 'Generate initiatives from tools');
