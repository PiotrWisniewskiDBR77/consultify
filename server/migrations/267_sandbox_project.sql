-- FLOW-SANDBOX-001: Sandbox Project
-- Migration: 267_sandbox_project.sql

-- ==========================================
-- SANDBOX PROJECTS
-- ==========================================

CREATE TABLE IF NOT EXISTS sandbox_projects (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL UNIQUE,
    project_id TEXT NOT NULL, -- Reference to actual project record
    
    -- Status
    is_active INTEGER DEFAULT 1,
    is_initialized INTEGER DEFAULT 0, -- Has initial setup been done
    
    -- Sample data
    sample_data_loaded INTEGER DEFAULT 0,
    sample_data_version TEXT,
    sample_data_loaded_at TIMESTAMP,
    
    -- Resource limits
    ai_tokens_limit INTEGER DEFAULT 10000, -- Monthly sandbox AI limit
    ai_tokens_used_this_month INTEGER DEFAULT 0,
    ai_tokens_reset_at TIMESTAMP,
    storage_limit_mb INTEGER DEFAULT 100,
    storage_used_mb INTEGER DEFAULT 0,
    
    -- Reset functionality
    last_reset_at TIMESTAMP,
    reset_count INTEGER DEFAULT 0,
    auto_reset_days INTEGER, -- Auto-reset after N days of inactivity
    
    -- Export tracking
    exports_to_real_count INTEGER DEFAULT 0,
    last_export_at TIMESTAMP,
    
    -- Usage tracking
    total_tools_used INTEGER DEFAULT 0,
    total_time_spent_minutes INTEGER DEFAULT 0,
    last_activity_at TIMESTAMP,
    
    -- Settings
    show_tutorial_tips INTEGER DEFAULT 1,
    preferred_templates TEXT DEFAULT '[]', -- JSON: favorite template IDs
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX IF NOT EXISTS idx_sandbox_org ON sandbox_projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_sandbox_project ON sandbox_projects(project_id);

-- ==========================================
-- SANDBOX TEMPLATES
-- ==========================================

CREATE TABLE IF NOT EXISTS sandbox_templates (
    id TEXT PRIMARY KEY,
    
    -- Basic info
    name TEXT NOT NULL,
    description TEXT,
    template_type TEXT NOT NULL, -- 'process_flow', 'a3', 'assessment', 'initiative', 'economic_eval', 'ai_session'
    
    -- Content
    template_data TEXT NOT NULL, -- JSON: full template content
    preview_data TEXT, -- JSON: simplified preview
    
    -- Metadata
    category TEXT,
    industry TEXT, -- 'manufacturing', 'services', 'healthcare', 'general'
    difficulty TEXT DEFAULT 'beginner', -- 'beginner', 'intermediate', 'advanced'
    estimated_time_minutes INTEGER,
    
    -- Tutorial
    has_tutorial INTEGER DEFAULT 0,
    tutorial_steps TEXT, -- JSON: step-by-step guide
    
    -- Display
    thumbnail_url TEXT,
    icon TEXT,
    color TEXT,
    
    -- Tags
    tags TEXT DEFAULT '[]', -- JSON array
    
    -- Stats
    usage_count INTEGER DEFAULT 0,
    avg_rating REAL,
    
    is_featured INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sandbox_templates_type ON sandbox_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_sandbox_templates_category ON sandbox_templates(category);
CREATE INDEX IF NOT EXISTS idx_sandbox_templates_active ON sandbox_templates(is_active, is_featured);

-- Seed comprehensive templates
INSERT OR IGNORE INTO sandbox_templates (id, name, description, template_type, template_data, category, industry, difficulty, estimated_time_minutes, has_tutorial) VALUES
    -- Process Flow templates
    ('tmpl-pf-manufacturing', 'Manufacturing Process', 'Complete manufacturing workflow from order to shipping', 'process_flow', 
     '{"name":"Manufacturing Process","steps":[{"id":"s1","name":"Order Receipt","type":"activity","duration":5},{"id":"s2","name":"Material Available?","type":"decision","yes":"s3","no":"s4"},{"id":"s3","name":"Start Production","type":"activity","duration":120},{"id":"s4","name":"Order Materials","type":"activity","duration":1440},{"id":"s5","name":"Quality Check","type":"decision","yes":"s6","no":"s7"},{"id":"s6","name":"Ship to Customer","type":"activity","duration":30},{"id":"s7","name":"Rework","type":"activity","duration":60}],"metrics":{"cycle_time":180,"value_added_time":120}}', 
     'process', 'manufacturing', 'beginner', 30, 1),
    
    ('tmpl-pf-service', 'Service Request Process', 'Customer service request handling workflow', 'process_flow',
     '{"name":"Service Request","steps":[{"id":"s1","name":"Receive Request","type":"activity"},{"id":"s2","name":"Categorize","type":"activity"},{"id":"s3","name":"Urgent?","type":"decision"},{"id":"s4","name":"Assign Agent","type":"activity"},{"id":"s5","name":"Resolve","type":"activity"},{"id":"s6","name":"Customer Confirmation","type":"activity"}]}',
     'process', 'services', 'beginner', 20, 0),
    
    -- A3 templates
    ('tmpl-a3-quality', 'Quality Problem A3', 'A3 for solving quality/defect issues', 'a3',
     '{"title":"Quality Improvement A3","sections":{"background":"High defect rate impacting customer satisfaction","current_state":"5% defect rate, 100 returns/month","target_state":"1% defect rate, 20 returns/month","analysis":{"root_causes":["Insufficient training","Worn tooling","Process variation"]},"countermeasures":[{"action":"Implement SPC","owner":"Quality","due":"Q1"}],"follow_up":[]}}',
     'problem_solving', 'general', 'beginner', 45, 1),
    
    ('tmpl-a3-cost', 'Cost Reduction A3', 'A3 for cost reduction initiatives', 'a3',
     '{"title":"Cost Reduction A3","sections":{"background":"Operating costs exceeding budget","current_state":"$500K monthly operating cost","target_state":"$400K monthly (-20%)","analysis":{"root_causes":[]},"countermeasures":[]}}',
     'problem_solving', 'general', 'intermediate', 60, 0),
    
    -- Initiative templates
    ('tmpl-init-digital', 'Digital Transformation', 'Sample digital transformation initiative', 'initiative',
     '{"name":"Process Digitalization","description":"Convert manual paper-based processes to digital workflows","objectives":["Reduce processing time by 50%","Eliminate paper waste","Improve data accuracy"],"estimated_value":50000,"currency":"USD","timeline_months":6}',
     'transformation', 'general', 'intermediate', 15, 0),
    
    ('tmpl-init-lean', 'Lean Implementation', 'Lean manufacturing initiative template', 'initiative',
     '{"name":"Lean Production Cell","description":"Implement lean manufacturing cell for product line","objectives":["Reduce WIP inventory","Improve flow","Implement pull system"],"estimated_value":75000,"currency":"USD"}',
     'lean', 'manufacturing', 'advanced', 20, 0),
    
    -- Economic Evaluation
    ('tmpl-econ-automation', 'Automation ROI', 'Calculate ROI for automation project', 'economic_eval',
     '{"name":"Automation Business Case","investment":{"equipment":100000,"installation":20000,"training":10000},"annual_savings":{"labor":50000,"quality":15000,"throughput":20000},"payback_months":18}',
     'evaluation', 'manufacturing', 'intermediate', 30, 1);

-- ==========================================
-- SANDBOX EXPORTS LOG
-- ==========================================

CREATE TABLE IF NOT EXISTS sandbox_exports (
    id TEXT PRIMARY KEY,
    sandbox_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    
    -- Source
    source_type TEXT NOT NULL, -- 'process_flow', 'a3', 'initiative', 'tool_work'
    source_id TEXT NOT NULL,
    source_name TEXT,
    
    -- Destination
    destination_project_id TEXT NOT NULL,
    destination_type TEXT, -- 'initiative', 'task', 'document'
    destination_id TEXT, -- Created entity ID
    
    -- Export details
    export_options TEXT, -- JSON: what was included
    
    -- Status
    status TEXT DEFAULT 'completed', -- 'pending', 'completed', 'failed'
    error_message TEXT,
    
    exported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (sandbox_id) REFERENCES sandbox_projects(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (destination_project_id) REFERENCES projects(id)
);

CREATE INDEX IF NOT EXISTS idx_sandbox_exports_sandbox ON sandbox_exports(sandbox_id);
CREATE INDEX IF NOT EXISTS idx_sandbox_exports_user ON sandbox_exports(user_id);

-- ==========================================
-- SANDBOX ACTIVITY LOG
-- ==========================================

CREATE TABLE IF NOT EXISTS sandbox_activity (
    id TEXT PRIMARY KEY,
    sandbox_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    
    activity_type TEXT NOT NULL, -- 'template_loaded', 'tool_used', 'reset', 'export', 'ai_used'
    activity_data TEXT, -- JSON: details
    
    duration_seconds INTEGER,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (sandbox_id) REFERENCES sandbox_projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sandbox_activity_sandbox ON sandbox_activity(sandbox_id);
CREATE INDEX IF NOT EXISTS idx_sandbox_activity_type ON sandbox_activity(activity_type);
CREATE INDEX IF NOT EXISTS idx_sandbox_activity_date ON sandbox_activity(created_at);
