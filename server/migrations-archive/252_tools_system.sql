-- FLOW-TOOLS-001: Tools & Process Flow
-- Migration: 252_tools_system.sql

-- ==========================================
-- TOOLS REGISTRY
-- ==========================================

CREATE TABLE IF NOT EXISTS tools (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    category TEXT NOT NULL, -- 'assessment', 'process', 'ai', 'analysis'
    description TEXT,
    description_translations TEXT, -- JSON for i18n
    icon TEXT,
    is_licensed INTEGER DEFAULT 0,
    license_holder TEXT,
    is_active INTEGER DEFAULT 1,
    is_coming_soon INTEGER DEFAULT 0,
    config_schema TEXT, -- JSON schema for tool config
    help_url TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed tools
INSERT INTO tools (id, name, display_name, category, description, is_licensed, sort_order) VALUES
    ('tool-drd', 'drd', 'DRD Assessment', 'assessment', 'Digital Readiness Diagnosis - comprehensive digital transformation assessment', FALSE, 1),
    ('tool-siri', 'siri', 'SIRI Assessment', 'assessment', 'Smart Industry Readiness Index for Industry 4.0', TRUE, 2),
    ('tool-adma', 'adma', 'ADMA Assessment', 'assessment', 'Advanced Manufacturing Assessment', TRUE, 3),
    ('tool-lean40', 'lean40', 'Lean 4.0 Assessment', 'assessment', 'Lean principles adapted for digital age', FALSE, 4),
    ('tool-cmmi', 'cmmi', 'CMMI Assessment', 'assessment', 'Capability Maturity Model Integration', FALSE, 5),
    ('tool-process-flow', 'process-flow', 'Process Flow Automation', 'process', 'Map, measure, optimize and automate business processes', FALSE, 10),
    ('tool-a3-pdca', 'a3-pdca', 'A3 + PDCA', 'process', 'Lean problem-solving worksheet with PDCA cycle', FALSE, 11),
    ('tool-economic-eval', 'economic-eval', 'Economic Evaluation', 'analysis', 'ROI and business case calculator', FALSE, 12),
    ('tool-ai-adviser', 'ai-adviser', 'AI Adviser', 'ai', 'AI-powered brainstorming and recommendations', FALSE, 20),
    ('tool-studio', 'studio', 'Studio', 'ai', 'Create diagrams, flowcharts and visualizations', FALSE, 21)
ON CONFLICT (id) DO NOTHING;

-- Mark coming soon tools
UPDATE tools SET is_coming_soon = TRUE WHERE name IN ('studio', 'economic-eval');

-- ==========================================
-- TOOL WORKS (user work items)
-- ==========================================

CREATE TABLE IF NOT EXISTS tool_works (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    tool_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    
    -- Assignment (can be null for sandbox)
    project_id TEXT,
    initiative_id TEXT,
    task_id TEXT,
    
    -- Content
    work_data TEXT NOT NULL DEFAULT '{}', -- JSON with tool-specific data
    
    -- Status
    status TEXT DEFAULT 'draft', -- 'draft', 'in_progress', 'completed', 'archived'
    progress INTEGER DEFAULT 0, -- 0-100
    
    -- Collaboration
    shared_with TEXT DEFAULT '[]', -- JSON array of user IDs
    
    -- Audit
    created_by TEXT NOT NULL,
    last_edited_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (tool_id) REFERENCES tools(id)
);

CREATE INDEX IF NOT EXISTS idx_tool_works_org ON tool_works(organization_id);
CREATE INDEX IF NOT EXISTS idx_tool_works_tool ON tool_works(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_works_project ON tool_works(project_id);
CREATE INDEX IF NOT EXISTS idx_tool_works_status ON tool_works(status);

-- ==========================================
-- PROCESS FLOWS (Process Flow Automation tool)
-- ==========================================

CREATE TABLE IF NOT EXISTS process_flows (
    id TEXT PRIMARY KEY,
    tool_work_id TEXT NOT NULL UNIQUE,
    organization_id TEXT NOT NULL,
    
    -- Process definition
    name TEXT NOT NULL,
    description TEXT,
    
    -- Flow diagram data (React Flow format)
    nodes TEXT DEFAULT '[]', -- JSON array of nodes
    edges TEXT DEFAULT '[]', -- JSON array of edges
    
    -- Stages
    current_stage TEXT DEFAULT 'map', -- 'map', 'classify', 'measure', 'optimize', 'automate'
    stage_completion TEXT DEFAULT '{}', -- JSON: {map: true, classify: false, ...}
    
    -- Metrics (calculated)
    total_steps INTEGER DEFAULT 0,
    decision_steps INTEGER DEFAULT 0,
    action_steps INTEGER DEFAULT 0,
    value_add_steps INTEGER DEFAULT 0,
    non_value_add_steps INTEGER DEFAULT 0,
    estimated_time_minutes INTEGER,
    estimated_cost REAL,
    
    -- Measurements (from measure stage)
    measurements TEXT DEFAULT '{}', -- JSON: {stepId: {time, cost, errors, volume}}
    
    -- Optimization (from optimize stage)
    optimization_suggestions TEXT, -- JSON from AI
    selected_optimizations TEXT DEFAULT '[]', -- JSON array of selected suggestions
    
    -- Automation (from automate stage)
    automation_candidates TEXT DEFAULT '[]', -- JSON array
    tool_recommendations TEXT, -- JSON from AI
    
    -- ROI Analysis
    roi_analysis TEXT, -- JSON
    
    -- Output
    generated_initiative_id TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (tool_work_id) REFERENCES tool_works(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_process_flows_org ON process_flows(organization_id);
CREATE INDEX IF NOT EXISTS idx_process_flows_stage ON process_flows(current_stage);

-- ==========================================
-- A3 DOCUMENTS (A3 + PDCA tool)
-- ==========================================

CREATE TABLE IF NOT EXISTS a3_documents (
    id TEXT PRIMARY KEY,
    tool_work_id TEXT NOT NULL UNIQUE,
    organization_id TEXT NOT NULL,
    
    -- A3 Header
    title TEXT NOT NULL,
    owner_id TEXT,
    team_members TEXT DEFAULT '[]', -- JSON array of user IDs
    
    -- Left Side (Problem Understanding)
    background TEXT,
    current_state TEXT,
    current_state_attachments TEXT DEFAULT '[]', -- JSON array of file IDs
    goal_target TEXT,
    target_metrics TEXT, -- JSON: {metric: value}
    root_cause_analysis TEXT DEFAULT '{}', -- JSON with fishbone data
    five_whys TEXT DEFAULT '[]', -- JSON array of why questions
    
    -- Right Side (Solution)
    countermeasures TEXT DEFAULT '[]', -- JSON array of actions
    implementation_plan TEXT DEFAULT '[]', -- JSON: [{who, what, when, status}]
    follow_up_plan TEXT,
    verification_results TEXT,
    
    -- PDCA Tracking
    pdca_cycles TEXT DEFAULT '[]', -- JSON array of cycles
    current_pdca_phase TEXT DEFAULT 'plan', -- 'plan', 'do', 'check', 'act'
    cycle_count INTEGER DEFAULT 1,
    
    -- Status
    a3_status TEXT DEFAULT 'draft', -- 'draft', 'in_review', 'approved', 'closed'
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (tool_work_id) REFERENCES tool_works(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_a3_documents_org ON a3_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_a3_documents_status ON a3_documents(a3_status);

-- ==========================================
-- AI ADVISER SESSIONS
-- ==========================================

CREATE TABLE IF NOT EXISTS ai_adviser_sessions (
    id TEXT PRIMARY KEY,
    tool_work_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    
    -- Session context
    topic TEXT NOT NULL,
    challenge_description TEXT,
    project_id TEXT,
    
    -- AI outputs
    recommended_tools TEXT DEFAULT '[]', -- JSON array: [{toolId, reason, confidence}]
    brainstorm_ideas TEXT DEFAULT '[]', -- JSON array
    next_steps TEXT DEFAULT '[]', -- JSON array
    
    -- Conversation
    messages TEXT DEFAULT '[]', -- JSON array of conversation messages
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (tool_work_id) REFERENCES tool_works(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_adviser_org ON ai_adviser_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_adviser_user ON ai_adviser_sessions(user_id);

-- ==========================================
-- SANDBOX PROJECTS
-- ==========================================

-- Sandbox is a special project per organization
INSERT INTO projects (id, organization_id, name, description, status, created_at)
SELECT 
    'sandbox-' || id,
    id,
    'Sandbox',
    'Practice area for learning tools without affecting real projects',
    'active',
    CURRENT_TIMESTAMP
FROM organizations
WHERE NOT EXISTS (
    SELECT 1 FROM projects WHERE id = 'sandbox-' || organizations.id
)
ON CONFLICT (id) DO NOTHING;
