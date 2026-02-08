-- INTERVIEW-CONTEXT-002: Interview Module - ClickUp-like Redesign
-- Migration: 295_interview_context.sql
-- Purpose: ClickUp-like Interview with 5 categories, task-list questions, evidence
-- Version: 2.0 - Full redesign according to new spec

-- ==========================================
-- ORGANIZATION CONTEXT (Company Facts - prawy panel)
-- ==========================================

CREATE TABLE IF NOT EXISTS organization_context (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL UNIQUE,
    -- Company Facts (prawy panel)
    company_name TEXT,
    industry TEXT,
    company_size TEXT,                           -- SME | Mid-Market | Enterprise
    location TEXT,
    employee_count INTEGER,
    annual_revenue TEXT,
    -- Key Metrics
    key_metrics TEXT DEFAULT '[]',               -- [{ name, value, unit }]
    -- Stakeholders
    stakeholders TEXT DEFAULT '[]',              -- [{ name, role, influence, notes }]
    -- Open Gaps (luki informacyjne)
    open_gaps TEXT DEFAULT '[]',                 -- [{ category, description, priority }]
    -- Metadata
    completeness_percent INTEGER DEFAULT 0,
    last_interview_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_org_context_org ON organization_context(organization_id);

-- ==========================================
-- INTERVIEW SESSIONS (ClickUp-like)
-- ==========================================

CREATE TABLE IF NOT EXISTS interview_sessions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    project_id TEXT,
    -- Session info (TOP BAR)
    name TEXT DEFAULT 'Discovery Interview',     -- nazwa sesji
    owner_id TEXT NOT NULL,                      -- właściciel sesji
    status TEXT DEFAULT 'in_progress',           -- in_progress | completed | archived
    -- Progress tracking (5 kategorii: Strategy, Operations, Digital, People, Finance)
    progress_json TEXT DEFAULT '{}',             -- { strategy: %, operations: %, digital: %, people: %, finance: % }
    total_questions INTEGER DEFAULT 0,
    answered_questions INTEGER DEFAULT 0,
    -- Summary (TYLKO FAKTY - bez rekomendacji)
    summary_facts TEXT DEFAULT '[]',             -- [{ category, fact }] - najważniejsze fakty as-is
    summary_gaps TEXT DEFAULT '[]',              -- [{ category, gap }] - luki informacyjne
    summary_constraints TEXT DEFAULT '[]',       -- [{ category, constraint }] - ograniczenia
    summary_pain_points TEXT DEFAULT '[]',       -- [{ category, pain_point }] - obecne problemy
    -- Timestamps
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_interview_sessions_org ON interview_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_owner ON interview_sessions(owner_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_status ON interview_sessions(status);

-- ==========================================
-- INTERVIEW QUESTIONS (Task-list style)
-- ==========================================

CREATE TABLE IF NOT EXISTS interview_questions (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    -- Category (5 kategorii)
    category TEXT NOT NULL,                      -- strategy | operations | digital | people | finance
    -- Question content
    question_text TEXT NOT NULL,
    answer_text TEXT,                            -- odpowiedź (inline edit)
    -- Status per pytanie
    status TEXT DEFAULT 'not_started',           -- not_started | in_progress | answered | needs_follow_up
    -- Confidence score (1-5)
    confidence_score INTEGER DEFAULT 0,          -- 0 = nie ustawiony, 1-5
    -- Owner (kto odpowiedział)
    answered_by TEXT,
    answered_at TIMESTAMP,
    -- Tags
    tags TEXT DEFAULT '[]',                      -- [risk, opportunity, constraint, etc.]
    -- Order
    sort_order INTEGER DEFAULT 0,
    -- Metadata
    is_template INTEGER DEFAULT 0,               -- czy to pytanie z szablonu
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES interview_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_interview_questions_session ON interview_questions(session_id);
CREATE INDEX IF NOT EXISTS idx_interview_questions_category ON interview_questions(category);
CREATE INDEX IF NOT EXISTS idx_interview_questions_status ON interview_questions(status);

-- ==========================================
-- INTERVIEW NOTES (Notes tab)
-- ==========================================

CREATE TABLE IF NOT EXISTS interview_notes (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    -- Note content
    category TEXT,                               -- opcjonalna kategoria
    title TEXT,
    content TEXT NOT NULL,
    -- Metadata
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES interview_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_interview_notes_session ON interview_notes(session_id);

-- ==========================================
-- INTERVIEW EVIDENCE (Evidence tab)
-- ==========================================

CREATE TABLE IF NOT EXISTS interview_evidence (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    question_id TEXT,                            -- opcjonalne powiązanie z pytaniem
    -- Evidence content
    evidence_type TEXT NOT NULL,                 -- file | link | screenshot | document
    title TEXT NOT NULL,
    description TEXT,
    -- File/Link data
    file_path TEXT,                              -- ścieżka do pliku
    file_name TEXT,
    file_size INTEGER,
    file_type TEXT,                              -- mime type
    url TEXT,                                    -- link zewnętrzny
    -- Metadata
    uploaded_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES interview_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES interview_questions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_interview_evidence_session ON interview_evidence(session_id);
CREATE INDEX IF NOT EXISTS idx_interview_evidence_question ON interview_evidence(question_id);

-- ==========================================
-- INTERVIEW QUESTION TEMPLATES (szablon pytań per kategoria)
-- ==========================================

CREATE TABLE IF NOT EXISTS interview_question_templates (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,                      -- strategy | operations | digital | people | finance
    question_text TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_required INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default question templates (5 kategorii)
INSERT OR IGNORE INTO interview_question_templates (id, category, question_text, sort_order, is_required) VALUES
-- STRATEGY (cele biznesowe, wizja, kierunki strategiczne)
('tpl_strategy_1', 'strategy', 'What are your main business objectives for the next 2-3 years?', 1, 1),
('tpl_strategy_2', 'strategy', 'What is your company''s vision for digital transformation?', 2, 1),
('tpl_strategy_3', 'strategy', 'What competitive advantages are you trying to build?', 3, 0),
('tpl_strategy_4', 'strategy', 'What are the key strategic priorities for this year?', 4, 1),
('tpl_strategy_5', 'strategy', 'What market trends are you responding to?', 5, 0),

-- OPERATIONS (procesy operacyjne, efektywność, bottlenecki)
('tpl_operations_1', 'operations', 'What are your main operational processes?', 1, 1),
('tpl_operations_2', 'operations', 'Where do you see the biggest inefficiencies?', 2, 1),
('tpl_operations_3', 'operations', 'What are the main bottlenecks in your operations?', 3, 1),
('tpl_operations_4', 'operations', 'How do you currently measure operational performance?', 4, 0),
('tpl_operations_5', 'operations', 'What manual processes take the most time?', 5, 0),

-- DIGITAL (dojrzałość cyfrowa, systemy IT, automatyzacja)
('tpl_digital_1', 'digital', 'What systems and tools do you currently use?', 1, 1),
('tpl_digital_2', 'digital', 'How would you rate your digital maturity (1-5)?', 2, 1),
('tpl_digital_3', 'digital', 'What is your current level of process automation?', 3, 1),
('tpl_digital_4', 'digital', 'What are the main pain points with your current IT systems?', 4, 0),
('tpl_digital_5', 'digital', 'Are you using any cloud services? Which ones?', 5, 0),

-- PEOPLE (kompetencje, kultura, gotowość na zmiany)
('tpl_people_1', 'people', 'How would you describe your team''s digital skills?', 1, 1),
('tpl_people_2', 'people', 'What is the organizational culture like regarding change?', 2, 1),
('tpl_people_3', 'people', 'Do you have dedicated IT/Digital team?', 3, 0),
('tpl_people_4', 'people', 'What training programs exist for employees?', 4, 0),
('tpl_people_5', 'people', 'How do employees typically react to new tools/processes?', 5, 1),

-- FINANCE (budżety, ograniczenia finansowe, ROI expectations)
('tpl_finance_1', 'finance', 'What is the available budget for transformation initiatives?', 1, 1),
('tpl_finance_2', 'finance', 'What ROI do you expect from digital investments?', 2, 1),
('tpl_finance_3', 'finance', 'Are there any financial constraints we should know about?', 3, 1),
('tpl_finance_4', 'finance', 'What is the typical payback period you accept?', 4, 0),
('tpl_finance_5', 'finance', 'How are IT/Digital investments currently funded?', 5, 0);

-- ==========================================
-- LEGACY TABLES (for backward compatibility)
-- ==========================================

-- Keep old tables for migration, will be deprecated
CREATE TABLE IF NOT EXISTS interview_answers (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    category TEXT NOT NULL,
    question_answers TEXT DEFAULT '[]',
    summary TEXT,
    confidence_score REAL DEFAULT 0,
    status TEXT DEFAULT 'draft',
    messages_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS interview_insights (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    source_quote TEXT,
    insight_type TEXT DEFAULT 'general',
    impact_level TEXT DEFAULT 'medium',
    confidence TEXT DEFAULT 'medium',
    pmo_domain TEXT,
    actionable INTEGER DEFAULT 0,
    status TEXT DEFAULT 'draft',
    exported_to_tools INTEGER DEFAULT 0,
    exported_to_assessment INTEGER DEFAULT 0,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS interview_context_exports (
    id TEXT PRIMARY KEY,
    interview_session_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    context_snapshot TEXT DEFAULT '{}',
    insights_exported TEXT DEFAULT '[]',
    exported_by TEXT,
    exported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- PERMISSIONS
-- ==========================================

-- Note: PostgreSQL permissions table may not have 'name' and 'icon' columns
INSERT OR IGNORE INTO permissions (key, description, category) VALUES
('INTERVIEW_START', 'Start interview session', 'INTERVIEW'),
('INTERVIEW_VIEW_ALL', 'View all interview sessions in organization', 'INTERVIEW'),
('INTERVIEW_EXPORT_CONTEXT', 'Export interview context to Tools/Assessment', 'INTERVIEW'),
('INTERVIEW_COMPLETE', 'Mark interview as complete', 'INTERVIEW');

INSERT OR IGNORE INTO role_permissions (id, role, permission_key, description) VALUES
('rp_interview_start_user', 'USER', 'INTERVIEW_START', 'Start interview session'),
('rp_interview_start_pm', 'PROJECT_MANAGER', 'INTERVIEW_START', 'Start interview session'),
('rp_interview_start_admin', 'ADMIN', 'INTERVIEW_START', 'Start interview session'),
('rp_interview_start_super', 'SUPERADMIN', 'INTERVIEW_START', 'Start interview session'),
('rp_interview_view_pm', 'PROJECT_MANAGER', 'INTERVIEW_VIEW_ALL', 'View all sessions'),
('rp_interview_view_admin', 'ADMIN', 'INTERVIEW_VIEW_ALL', 'View all sessions'),
('rp_interview_view_super', 'SUPERADMIN', 'INTERVIEW_VIEW_ALL', 'View all sessions'),
('rp_interview_export_pm', 'PROJECT_MANAGER', 'INTERVIEW_EXPORT_CONTEXT', 'Export context'),
('rp_interview_export_admin', 'ADMIN', 'INTERVIEW_EXPORT_CONTEXT', 'Export context'),
('rp_interview_export_super', 'SUPERADMIN', 'INTERVIEW_EXPORT_CONTEXT', 'Export context'),
('rp_interview_complete_pm', 'PROJECT_MANAGER', 'INTERVIEW_COMPLETE', 'Mark complete'),
('rp_interview_complete_admin', 'ADMIN', 'INTERVIEW_COMPLETE', 'Mark complete'),
('rp_interview_complete_super', 'SUPERADMIN', 'INTERVIEW_COMPLETE', 'Mark complete');
