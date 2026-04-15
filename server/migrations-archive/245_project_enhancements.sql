-- FLOW-PROJECT-001: Project Lifecycle Enhancements
-- Migration: 245_project_enhancements.sql

-- ==========================================
-- PMO STANDARDS
-- ==========================================

-- PMO standards reference table
CREATE TABLE IF NOT EXISTS pmo_standards (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed PMO standards
INSERT OR IGNORE INTO pmo_standards (id, name, display_name, description) VALUES
    ('prince2', 'PRINCE2', 'PRINCE2', 'Projects IN Controlled Environments'),
    ('pmbok', 'PMBOK', 'PMI PMBOK', 'Project Management Body of Knowledge'),
    ('agile', 'AGILE', 'Agile/Scrum', 'Agile methodology with Scrum framework'),
    ('safe', 'SAFE', 'SAFe', 'Scaled Agile Framework'),
    ('custom', 'CUSTOM', 'Custom', 'Organization-defined roles');

-- PMO role definitions per standard
CREATE TABLE IF NOT EXISTS pmo_role_definitions (
    id TEXT PRIMARY KEY,
    standard_id TEXT NOT NULL,
    role_key TEXT NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    permissions TEXT DEFAULT '[]', -- JSON array of permission keys
    level INTEGER DEFAULT 0, -- Hierarchy level (0=highest)
    is_required INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (standard_id) REFERENCES pmo_standards(id),
    UNIQUE(standard_id, role_key)
);

-- Seed PRINCE2 roles
INSERT OR IGNORE INTO pmo_role_definitions (id, standard_id, role_key, display_name, description, level, is_required) VALUES
    ('prince2-exec', 'prince2', 'EXECUTIVE', 'Executive', 'Ultimate decision maker', 0, 1),
    ('prince2-senior-user', 'prince2', 'SENIOR_USER', 'Senior User', 'Represents user interests', 1, 1),
    ('prince2-senior-supplier', 'prince2', 'SENIOR_SUPPLIER', 'Senior Supplier', 'Represents supplier interests', 1, 0),
    ('prince2-pm', 'prince2', 'PROJECT_MANAGER', 'Project Manager', 'Day-to-day management', 2, 1),
    ('prince2-team-mgr', 'prince2', 'TEAM_MANAGER', 'Team Manager', 'Manages team delivery', 3, 0),
    ('prince2-team', 'prince2', 'TEAM_MEMBER', 'Team Member', 'Executes work packages', 4, 0);

-- Seed PMBOK roles
INSERT OR IGNORE INTO pmo_role_definitions (id, standard_id, role_key, display_name, description, level, is_required) VALUES
    ('pmbok-sponsor', 'pmbok', 'SPONSOR', 'Sponsor', 'Provides resources and support', 0, 1),
    ('pmbok-pm', 'pmbok', 'PROJECT_MANAGER', 'Project Manager', 'Leads the project', 1, 1),
    ('pmbok-lead', 'pmbok', 'TEAM_LEAD', 'Team Lead', 'Leads functional team', 2, 0),
    ('pmbok-member', 'pmbok', 'TEAM_MEMBER', 'Team Member', 'Executes tasks', 3, 0),
    ('pmbok-stakeholder', 'pmbok', 'STAKEHOLDER', 'Stakeholder', 'Interested party', 4, 0);

-- Seed Agile roles
INSERT OR IGNORE INTO pmo_role_definitions (id, standard_id, role_key, display_name, description, level, is_required) VALUES
    ('agile-po', 'agile', 'PRODUCT_OWNER', 'Product Owner', 'Owns product backlog', 0, 1),
    ('agile-sm', 'agile', 'SCRUM_MASTER', 'Scrum Master', 'Facilitates process', 1, 1),
    ('agile-dev', 'agile', 'DEVELOPMENT_TEAM', 'Development Team', 'Delivers increment', 2, 1);

-- Seed SAFe roles
INSERT OR IGNORE INTO pmo_role_definitions (id, standard_id, role_key, display_name, description, level, is_required) VALUES
    ('safe-rte', 'safe', 'RTE', 'Release Train Engineer', 'Facilitates ART', 0, 1),
    ('safe-pm', 'safe', 'PRODUCT_MANAGER', 'Product Manager', 'Owns program backlog', 1, 1),
    ('safe-arch', 'safe', 'SYSTEM_ARCHITECT', 'System Architect', 'Technical guidance', 2, 0),
    ('safe-po', 'safe', 'PRODUCT_OWNER', 'Product Owner', 'Team-level PO', 3, 0),
    ('safe-team', 'safe', 'TEAM_MEMBER', 'Team Member', 'Agile team member', 4, 0);

-- ==========================================
-- LOCATIONS
-- ==========================================

-- Locations table
CREATE TABLE IF NOT EXISTS locations (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'geographic', -- 'geographic' or 'business_unit'
    description TEXT,
    address TEXT,
    city TEXT,
    country TEXT,
    timezone TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_locations_org ON locations(organization_id);

-- ==========================================
-- PROJECT ENHANCEMENTS
-- ==========================================

-- Add new columns to projects table (if not exists)
-- Note: SQLite doesn't have IF NOT EXISTS for ALTER TABLE, so we check in app code

-- PMO standard for project
-- ALTER TABLE projects ADD COLUMN pmo_standard TEXT DEFAULT 'pmbok';

-- Location reference
-- ALTER TABLE projects ADD COLUMN location_id TEXT REFERENCES locations(id);

-- Project timeline
-- ALTER TABLE projects ADD COLUMN start_date DATE;
-- ALTER TABLE projects ADD COLUMN target_end_date DATE;
-- ALTER TABLE projects ADD COLUMN actual_end_date DATE;

-- Budget tracking
-- ALTER TABLE projects ADD COLUMN budget_amount DECIMAL(15,2);
-- ALTER TABLE projects ADD COLUMN budget_currency TEXT DEFAULT 'EUR';

-- Archive timestamp
-- ALTER TABLE projects ADD COLUMN archived_at TIMESTAMP;
-- ALTER TABLE projects ADD COLUMN archived_by TEXT;

-- ==========================================
-- PROJECT ROLE ASSIGNMENTS
-- ==========================================

-- Project members with PMO roles
CREATE TABLE IF NOT EXISTS project_role_assignments (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    pmo_role_key TEXT NOT NULL, -- e.g., 'PROJECT_MANAGER', 'SPONSOR'
    assigned_by TEXT,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    UNIQUE(project_id, user_id, pmo_role_key)
);

CREATE INDEX IF NOT EXISTS idx_project_roles_project ON project_role_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_roles_user ON project_role_assignments(user_id);

-- ==========================================
-- DECISION SYSTEM (FLOW-DECISION-001)
-- ==========================================

-- Decisions table
CREATE TABLE IF NOT EXISTS decisions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    project_id TEXT,
    initiative_id TEXT,
    task_id TEXT,
    
    -- Decision details
    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL, -- 'GO_NO_GO', 'APPROVAL', 'RESOURCE_ALLOCATION', 'OTHER'
    
    -- Decision maker
    decision_maker_id TEXT NOT NULL,
    
    -- Options (JSON array)
    options TEXT DEFAULT '[]',
    
    -- Criteria for decision (JSON)
    criteria TEXT,
    
    -- Timeline
    deadline TIMESTAMP,
    escalation_deadline TIMESTAMP,
    
    -- Status
    status TEXT DEFAULT 'pending', -- 'pending', 'made', 'escalated', 'expired', 'cancelled'
    
    -- Result
    selected_option TEXT,
    decision_rationale TEXT,
    decided_at TIMESTAMP,
    
    -- Audit
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_decisions_org ON decisions(organization_id);
CREATE INDEX IF NOT EXISTS idx_decisions_project ON decisions(project_id);
CREATE INDEX IF NOT EXISTS idx_decisions_initiative ON decisions(initiative_id);
CREATE INDEX IF NOT EXISTS idx_decisions_task ON decisions(task_id);
CREATE INDEX IF NOT EXISTS idx_decisions_maker ON decisions(decision_maker_id);
CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(status);
CREATE INDEX IF NOT EXISTS idx_decisions_deadline ON decisions(deadline);

-- Decision stakeholders (who should be informed)
CREATE TABLE IF NOT EXISTS decision_stakeholders (
    id TEXT PRIMARY KEY,
    decision_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT DEFAULT 'informed', -- 'informed', 'consulted', 'voter'
    notified_at TIMESTAMP,
    viewed_at TIMESTAMP,
    FOREIGN KEY (decision_id) REFERENCES decisions(id) ON DELETE CASCADE,
    UNIQUE(decision_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_decision_stakeholders_decision ON decision_stakeholders(decision_id);
CREATE INDEX IF NOT EXISTS idx_decision_stakeholders_user ON decision_stakeholders(user_id);

-- Decision votes (for committee voting)
CREATE TABLE IF NOT EXISTS decision_votes (
    id TEXT PRIMARY KEY,
    decision_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    vote TEXT NOT NULL, -- 'approve', 'reject', 'abstain'
    comment TEXT,
    voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (decision_id) REFERENCES decisions(id) ON DELETE CASCADE,
    UNIQUE(decision_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_decision_votes_decision ON decision_votes(decision_id);

-- Decision history (audit trail)
CREATE TABLE IF NOT EXISTS decision_history (
    id TEXT PRIMARY KEY,
    decision_id TEXT NOT NULL,
    action TEXT NOT NULL, -- 'created', 'updated', 'escalated', 'decided', 'cancelled'
    old_status TEXT,
    new_status TEXT,
    changed_by TEXT NOT NULL,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    details TEXT, -- JSON with additional info
    FOREIGN KEY (decision_id) REFERENCES decisions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_decision_history_decision ON decision_history(decision_id);

-- ==========================================
-- AI INSTRUCTIONS DATABASE (FLOW-AIINSTRUCTIONS-001)
-- ==========================================

-- System-level AI instructions (managed by SuperAdmin)
CREATE TABLE IF NOT EXISTS ai_instructions_system (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL, -- 'general', 'assessment', 'initiative', 'reporting', 'consulting'
    name TEXT NOT NULL,
    instruction TEXT NOT NULL,
    priority INTEGER DEFAULT 0, -- Higher = more important
    is_active INTEGER DEFAULT 1,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(category, name)
);

CREATE INDEX IF NOT EXISTS idx_ai_instructions_system_category ON ai_instructions_system(category);

-- Organization-level AI instructions (managed by Admin)
CREATE TABLE IF NOT EXISTS ai_instructions_org (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    instruction TEXT NOT NULL,
    priority INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, category, name)
);

CREATE INDEX IF NOT EXISTS idx_ai_instructions_org_org ON ai_instructions_org(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_instructions_org_category ON ai_instructions_org(category);

-- AI feedback from users
CREATE TABLE IF NOT EXISTS ai_feedback (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    user_id TEXT NOT NULL,
    conversation_id TEXT,
    message_id TEXT,
    
    -- Feedback type
    feedback_type TEXT NOT NULL, -- 'like', 'dislike', 'correction', 'suggestion'
    
    -- Details
    rating INTEGER, -- 1-5 for ratings
    comment TEXT,
    correction TEXT, -- What the correct response should have been
    
    -- Context
    ai_response_snippet TEXT,
    context_type TEXT, -- 'chat', 'report', 'tool', 'suggestion'
    
    -- Review status
    reviewed_by TEXT,
    reviewed_at TIMESTAMP,
    action_taken TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_feedback_org ON ai_feedback(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_user ON ai_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_type ON ai_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_reviewed ON ai_feedback(reviewed_at);

-- Seed some system instructions
INSERT OR IGNORE INTO ai_instructions_system (id, category, name, instruction, priority, created_by) VALUES
    ('sys-general-1', 'general', 'Consultinity Identity', 'You are an AI consultant assistant in the Consultinity platform. You help organizations with digital transformation, process optimization, and change management. Be professional, supportive, and practical.', 100, 'system'),
    ('sys-general-2', 'general', 'Language Adaptation', 'Always respond in the same language the user writes to you. If they write in Polish, respond in Polish. If in English, respond in English.', 90, 'system'),
    ('sys-assessment-1', 'assessment', 'Assessment Guidance', 'When helping with assessments (SIRI, ADMA, DRD, Lean 4.0), guide users through each question, explain the scoring criteria, and help them accurately assess their organization maturity level.', 80, 'system'),
    ('sys-initiative-1', 'initiative', 'Initiative Creation', 'When helping create initiatives from assessment results, focus on actionable, measurable initiatives. Consider dependencies, resources needed, and realistic timelines.', 80, 'system'),
    ('sys-reporting-1', 'reporting', 'Report Generation', 'Generate reports that are executive-friendly: clear summaries, key insights first, actionable recommendations. Use data visualization suggestions where appropriate.', 80, 'system'),
    ('sys-decision-1', 'consulting', 'Decision Support', 'When a decision is needed, present options clearly with pros and cons. Make a recommendation when you have enough context, but always defer to human judgment for final decisions.', 85, 'system');
