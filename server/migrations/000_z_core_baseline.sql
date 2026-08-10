-- Core Baseline Schema
-- Extracted from legacy initDb & init-pgvector to bring baseline under migration control
-- Created: 2026-01-20

-- 1. Infrastructure
CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT,
    plan TEXT DEFAULT 'free',
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    valid_until DATETIME,
    industry TEXT DEFAULT 'General',
    active_llm_provider_id TEXT,
    discount_percent INTEGER DEFAULT 0,
    organization_type TEXT DEFAULT 'TRIAL',
    is_active INTEGER DEFAULT 1,
    trial_started_at DATETIME,
    trial_expires_at DATETIME,
    billing_status TEXT,
    token_balance INTEGER DEFAULT 0,
    billing_currency TEXT DEFAULT 'USD',
    billing_country TEXT,
    vat_number TEXT,
    tax_exempt BOOLEAN DEFAULT 0
);
-- Strict-schema repair (2026-08, auto-generated): "organizations" is ALSO created inline by PostgresDatabase.ts's initDb() (real app-boot bootstrap), with a different/smaller column set. If initDb() ran first (thin-bootstrap-then-migrate scenario), the CREATE TABLE IF NOT EXISTS above is a no-op and this file's extra columns (e.g. llm_providers.tier) would silently never be added. Guarded ADD COLUMN so this file is self-healing regardless of which producer created the table first. No-op wherever the columns already exist.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS created_at DATETIME DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS valid_until DATETIME;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS industry TEXT DEFAULT 'General';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS active_llm_provider_id TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS discount_percent INTEGER DEFAULT 0;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS organization_type TEXT DEFAULT 'TRIAL';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_active INTEGER DEFAULT 1;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_started_at DATETIME;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_expires_at DATETIME;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS billing_status TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS token_balance INTEGER DEFAULT 0;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS billing_currency TEXT DEFAULT 'USD';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS billing_country TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS vat_number TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS tax_exempt BOOLEAN DEFAULT 0;


CREATE TABLE IF NOT EXISTS organization_facilities (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    email TEXT UNIQUE,
    password TEXT,
    first_name TEXT,
    last_name TEXT,
    role TEXT, 
    status TEXT DEFAULT 'active',
    avatar_url TEXT,
    title TEXT,
    impersonator_id TEXT,
    token_limit INTEGER DEFAULT 100000,
    token_used INTEGER DEFAULT 0,
    trial_tokens_used INTEGER DEFAULT 0,
    token_reset_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    timezone TEXT DEFAULT 'UTC',
    locale TEXT DEFAULT 'en',
    date_format TEXT DEFAULT 'YYYY-MM-DD',
    time_format TEXT DEFAULT 'HH:mm',
    first_day_of_week INTEGER DEFAULT 1,
    accessibility_settings TEXT DEFAULT '{}',
    notification_preferences TEXT DEFAULT '{}',
    ui_preferences TEXT DEFAULT '{}',
    known_devices TEXT DEFAULT '[]',
    ai_assertiveness_level REAL DEFAULT 1.0,
    ai_autonomy_level REAL DEFAULT 1.0,
    attribution_data TEXT,
    FOREIGN KEY(organization_id) REFERENCES organizations(id)
);
-- Strict-schema repair (2026-08, auto-generated): "users" is ALSO created inline by PostgresDatabase.ts's initDb() (real app-boot bootstrap), with a different/smaller column set. If initDb() ran first (thin-bootstrap-then-migrate scenario), the CREATE TABLE IF NOT EXISTS above is a no-op and this file's extra columns (e.g. llm_providers.tier) would silently never be added. Guarded ADD COLUMN so this file is self-healing regardless of which producer created the table first. No-op wherever the columns already exist.
ALTER TABLE users ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS impersonator_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_limit INTEGER DEFAULT 100000;
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_used INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_tokens_used INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_reset_at DATETIME;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at DATETIME DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login DATETIME;
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';
ALTER TABLE users ADD COLUMN IF NOT EXISTS locale TEXT DEFAULT 'en';
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_format TEXT DEFAULT 'YYYY-MM-DD';
ALTER TABLE users ADD COLUMN IF NOT EXISTS time_format TEXT DEFAULT 'HH:mm';
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_day_of_week INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS accessibility_settings TEXT DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences TEXT DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS ui_preferences TEXT DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS known_devices TEXT DEFAULT '[]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_assertiveness_level REAL DEFAULT 1.0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_autonomy_level REAL DEFAULT 1.0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS attribution_data TEXT;


CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    project_id TEXT,
    type TEXT,
    data TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
);
-- Strict-schema repair (2026-08, auto-generated): "sessions" is ALSO created inline by PostgresDatabase.ts's initDb() (real app-boot bootstrap), with a different/smaller column set. If initDb() ran first (thin-bootstrap-then-migrate scenario), the CREATE TABLE IF NOT EXISTS above is a no-op and this file's extra columns (e.g. llm_providers.tier) would silently never be added. Guarded ADD COLUMN so this file is self-healing regardless of which producer created the table first. No-op wherever the columns already exist.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS data TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;


CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    category TEXT, -- added for 210
    description TEXT, -- added for 210
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
-- Strict-schema repair (2026-08, auto-generated): "settings" is ALSO created inline by PostgresDatabase.ts's initDb() (real app-boot bootstrap), with a different/smaller column set. If initDb() ran first (thin-bootstrap-then-migrate scenario), the CREATE TABLE IF NOT EXISTS above is a no-op and this file's extra columns (e.g. llm_providers.tier) would silently never be added. Guarded ADD COLUMN so this file is self-healing regardless of which producer created the table first. No-op wherever the columns already exist.
ALTER TABLE settings ADD COLUMN IF NOT EXISTS key TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS value TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS category TEXT;


-- 2. Projects & Tasks
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active',
    start_date TEXT,
    end_date TEXT,
    budget REAL,
    currency TEXT DEFAULT 'USD',
    lead_id TEXT,
    priority TEXT DEFAULT 'medium',
    phase TEXT DEFAULT 'planning',
    settings TEXT,
    metadata TEXT,
    context_data TEXT,
    owner_id TEXT,
    rag_enabled INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id)
);
-- Strict-schema repair (2026-08, auto-generated): "projects" is ALSO created inline by PostgresDatabase.ts's initDb() (real app-boot bootstrap), with a different/smaller column set. If initDb() ran first (thin-bootstrap-then-migrate scenario), the CREATE TABLE IF NOT EXISTS above is a no-op and this file's extra columns (e.g. llm_providers.tier) would silently never be added. Guarded ADD COLUMN so this file is self-healing regardless of which producer created the table first. No-op wherever the columns already exist.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS organization_id TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS start_date TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS end_date TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS budget REAL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS lead_id TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS phase TEXT DEFAULT 'planning';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS settings TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS metadata TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS context_data TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_id TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS rag_enabled INTEGER DEFAULT 1;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS created_at DATETIME DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;


CREATE TABLE IF NOT EXISTS custom_statuses (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6B7280',
    sort_order INTEGER DEFAULT 0,
    is_default INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);
-- Strict-schema repair (2026-08, auto-generated): "custom_statuses" is ALSO created inline by PostgresDatabase.ts's initDb() (real app-boot bootstrap), with a different/smaller column set. If initDb() ran first (thin-bootstrap-then-migrate scenario), the CREATE TABLE IF NOT EXISTS above is a no-op and this file's extra columns (e.g. llm_providers.tier) would silently never be added. Guarded ADD COLUMN so this file is self-healing regardless of which producer created the table first. No-op wherever the columns already exist.
ALTER TABLE custom_statuses ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE custom_statuses ADD COLUMN IF NOT EXISTS organization_id TEXT;
ALTER TABLE custom_statuses ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE custom_statuses ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#6B7280';
ALTER TABLE custom_statuses ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE custom_statuses ADD COLUMN IF NOT EXISTS is_default INTEGER DEFAULT 0;
ALTER TABLE custom_statuses ADD COLUMN IF NOT EXISTS created_at DATETIME DEFAULT CURRENT_TIMESTAMP;


CREATE TABLE IF NOT EXISTS initiatives (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    project_id TEXT,
    name TEXT NOT NULL,
    axis TEXT,
    area TEXT,
    summary TEXT,
    hypothesis TEXT,
    -- CLOSEOUT-08: 'step3' is not a canonical status (SSOT
    -- server/src/constants/initiativeStatuses.ts) and violates
    -- initiatives_status_check. Mirrors PostgresDatabase.ts initDb().
    status TEXT DEFAULT 'DRAFT',
    current_stage TEXT,
    business_value TEXT,
    competencies_required TEXT,
    cost_capex REAL,
    cost_opex REAL,
    expected_roi REAL,
    social_impact TEXT,
    start_date DATETIME,
    pilot_end_date DATETIME,
    end_date DATETIME,
    owner_business_id TEXT,
    owner_execution_id TEXT,
    sponsor_id TEXT,
    market_context TEXT,
    problem_statement TEXT,
    deliverables TEXT DEFAULT '[]',
    success_criteria TEXT DEFAULT '[]',
    scope_in TEXT DEFAULT '[]',
    scope_out TEXT DEFAULT '[]',
    key_risks TEXT DEFAULT '[]',
    report_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(owner_business_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY(owner_execution_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY(sponsor_id) REFERENCES users(id) ON DELETE SET NULL
);
-- Strict-schema repair (2026-08, auto-generated): "initiatives" is ALSO created inline by PostgresDatabase.ts's initDb() (real app-boot bootstrap), with a different/smaller column set. If initDb() ran first (thin-bootstrap-then-migrate scenario), the CREATE TABLE IF NOT EXISTS above is a no-op and this file's extra columns (e.g. llm_providers.tier) would silently never be added. Guarded ADD COLUMN so this file is self-healing regardless of which producer created the table first. No-op wherever the columns already exist.
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS organization_id TEXT;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS axis TEXT;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS area TEXT;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS hypothesis TEXT;
-- CLOSEOUT-08: DEFAULT 'DRAFT' (canonical), never 'step3' — see note above.
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'DRAFT';
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS current_stage TEXT;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS business_value TEXT;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS competencies_required TEXT;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS cost_capex REAL;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS cost_opex REAL;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS expected_roi REAL;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS social_impact TEXT;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS start_date DATETIME;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS pilot_end_date DATETIME;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS end_date DATETIME;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS owner_business_id TEXT;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS owner_execution_id TEXT;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS sponsor_id TEXT;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS market_context TEXT;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS problem_statement TEXT;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS deliverables TEXT DEFAULT '[]';
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS success_criteria TEXT DEFAULT '[]';
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS scope_in TEXT DEFAULT '[]';
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS scope_out TEXT DEFAULT '[]';
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS key_risks TEXT DEFAULT '[]';
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS report_id TEXT;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS created_at DATETIME DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;


CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    organization_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'todo',
    priority TEXT DEFAULT 'medium',
    assignee_id TEXT,
    reporter_id TEXT,
    due_date DATETIME,
    estimated_hours REAL,
    checklist TEXT DEFAULT '[]',
    attachments TEXT DEFAULT '[]',
    tags TEXT DEFAULT '[]',
    task_type TEXT DEFAULT 'task',
    initiative_id TEXT,
    why TEXT,
    expected_outcome TEXT,
    decision_impact TEXT,
    evidence_required TEXT,
    strategic_contribution TEXT,
    roadmap_initiative_id TEXT,
    kpi_id TEXT,
    raid_item_id TEXT,
    assignees TEXT DEFAULT '[]',
    progress INTEGER DEFAULT 0,
    blocked_reason TEXT,
    sla_hours INTEGER,
    sla_due_at TEXT,
    escalation_level INTEGER DEFAULT 0,
    escalated_to_id TEXT,
    last_escalated_at TEXT,
    custom_status_id TEXT,
    step_phase TEXT,
    budget_allocated REAL,
    budget_spent REAL,
    risk_rating TEXT,
    acceptance_criteria TEXT,
    blocking_issues TEXT,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(assignee_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY(reporter_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY(custom_status_id) REFERENCES custom_statuses(id) ON DELETE SET NULL
);
-- Strict-schema repair (2026-08, auto-generated): "tasks" is ALSO created inline by PostgresDatabase.ts's initDb() (real app-boot bootstrap), with a different/smaller column set. If initDb() ran first (thin-bootstrap-then-migrate scenario), the CREATE TABLE IF NOT EXISTS above is a no-op and this file's extra columns (e.g. llm_providers.tier) would silently never be added. Guarded ADD COLUMN so this file is self-healing regardless of which producer created the table first. No-op wherever the columns already exist.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS organization_id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'todo';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee_id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reporter_id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date DATETIME;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_hours REAL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS attachments TEXT DEFAULT '[]';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tags TEXT DEFAULT '[]';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_type TEXT DEFAULT 'task';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS initiative_id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS why TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS expected_outcome TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS decision_impact TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS evidence_required TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS strategic_contribution TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS roadmap_initiative_id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS kpi_id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS raid_item_id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignees TEXT DEFAULT '[]';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS blocked_reason TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sla_hours INTEGER;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sla_due_at TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS escalation_level INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS escalated_to_id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS last_escalated_at TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS custom_status_id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS step_phase TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS budget_allocated REAL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS budget_spent REAL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS risk_rating TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS acceptance_criteria TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS blocking_issues TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at DATETIME;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_at DATETIME DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;


CREATE TABLE IF NOT EXISTS task_dependencies (
    id TEXT PRIMARY KEY,
    from_task_id TEXT NOT NULL,
    to_task_id TEXT NOT NULL,
    type TEXT DEFAULT 'hard',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(from_task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY(to_task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
-- Strict-schema repair (2026-08, auto-generated): "task_dependencies" is ALSO created inline by PostgresDatabase.ts's initDb() (real app-boot bootstrap), with a different/smaller column set. If initDb() ran first (thin-bootstrap-then-migrate scenario), the CREATE TABLE IF NOT EXISTS above is a no-op and this file's extra columns (e.g. llm_providers.tier) would silently never be added. Guarded ADD COLUMN so this file is self-healing regardless of which producer created the table first. No-op wherever the columns already exist.
ALTER TABLE task_dependencies ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE task_dependencies ADD COLUMN IF NOT EXISTS from_task_id TEXT;
ALTER TABLE task_dependencies ADD COLUMN IF NOT EXISTS to_task_id TEXT;
ALTER TABLE task_dependencies ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'hard';
ALTER TABLE task_dependencies ADD COLUMN IF NOT EXISTS created_at DATETIME DEFAULT CURRENT_TIMESTAMP;


-- 3. Knowledge Base
CREATE TABLE IF NOT EXISTS knowledge_docs (
    id TEXT PRIMARY KEY,
    filename TEXT,
    filepath TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
-- Strict-schema repair (2026-08, auto-generated): "knowledge_docs" is ALSO created inline by PostgresDatabase.ts's initDb() (real app-boot bootstrap), with a different/smaller column set. If initDb() ran first (thin-bootstrap-then-migrate scenario), the CREATE TABLE IF NOT EXISTS above is a no-op and this file's extra columns (e.g. llm_providers.tier) would silently never be added. Guarded ADD COLUMN so this file is self-healing regardless of which producer created the table first. No-op wherever the columns already exist.
ALTER TABLE knowledge_docs ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE knowledge_docs ADD COLUMN IF NOT EXISTS filename TEXT;
ALTER TABLE knowledge_docs ADD COLUMN IF NOT EXISTS filepath TEXT;
ALTER TABLE knowledge_docs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE knowledge_docs ADD COLUMN IF NOT EXISTS created_at DATETIME DEFAULT CURRENT_TIMESTAMP;


CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id TEXT PRIMARY KEY,
    doc_id TEXT,
    content TEXT,
    chunk_index INTEGER,
    embedding TEXT,
    FOREIGN KEY(doc_id) REFERENCES knowledge_docs(id) ON DELETE CASCADE
);
-- Strict-schema repair (2026-08, auto-generated): "knowledge_chunks" is ALSO created inline by PostgresDatabase.ts's initDb() (real app-boot bootstrap), with a different/smaller column set. If initDb() ran first (thin-bootstrap-then-migrate scenario), the CREATE TABLE IF NOT EXISTS above is a no-op and this file's extra columns (e.g. llm_providers.tier) would silently never be added. Guarded ADD COLUMN so this file is self-healing regardless of which producer created the table first. No-op wherever the columns already exist.
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS doc_id TEXT;
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS chunk_index INTEGER;
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS embedding TEXT;


CREATE TABLE IF NOT EXISTS knowledge_candidates (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    reasoning TEXT,
    source TEXT,
    origin_context TEXT,
    related_axis TEXT,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'pending',
    admin_comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Teams & Roles
CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    lead_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(lead_id) REFERENCES users(id) ON DELETE SET NULL
);
-- Strict-schema repair (2026-08, auto-generated): "teams" is ALSO created inline by PostgresDatabase.ts's initDb() (real app-boot bootstrap), with a different/smaller column set. If initDb() ran first (thin-bootstrap-then-migrate scenario), the CREATE TABLE IF NOT EXISTS above is a no-op and this file's extra columns (e.g. llm_providers.tier) would silently never be added. Guarded ADD COLUMN so this file is self-healing regardless of which producer created the table first. No-op wherever the columns already exist.
ALTER TABLE teams ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS organization_id TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS lead_id TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS created_at DATETIME DEFAULT CURRENT_TIMESTAMP;


CREATE TABLE IF NOT EXISTS team_members (
    team_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT DEFAULT 'member',
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(team_id, user_id),
    FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
-- Strict-schema repair (2026-08, auto-generated): "team_members" is ALSO created inline by PostgresDatabase.ts's initDb() (real app-boot bootstrap), with a different/smaller column set. If initDb() ran first (thin-bootstrap-then-migrate scenario), the CREATE TABLE IF NOT EXISTS above is a no-op and this file's extra columns (e.g. llm_providers.tier) would silently never be added. Guarded ADD COLUMN so this file is self-healing regardless of which producer created the table first. No-op wherever the columns already exist.
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS team_id TEXT;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member';
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS joined_at DATETIME DEFAULT CURRENT_TIMESTAMP;


-- 5. Audit & Activity
CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    entity_name TEXT,
    old_value TEXT,
    new_value TEXT,
    ip_address TEXT,
    user_agent TEXT,
    correlation_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);
-- Strict-schema repair (2026-08, auto-generated): "activity_logs" is ALSO created inline by PostgresDatabase.ts's initDb() (real app-boot bootstrap), with a different/smaller column set. If initDb() ran first (thin-bootstrap-then-migrate scenario), the CREATE TABLE IF NOT EXISTS above is a no-op and this file's extra columns (e.g. llm_providers.tier) would silently never be added. Guarded ADD COLUMN so this file is self-healing regardless of which producer created the table first. No-op wherever the columns already exist.
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS organization_id TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS entity_id TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS entity_name TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS old_value TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS new_value TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS correlation_id TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS created_at DATETIME DEFAULT CURRENT_TIMESTAMP;


CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id TEXT,
    action_type TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    organization_id TEXT,
    details TEXT DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 6. AI & Communication
CREATE TABLE IF NOT EXISTS system_prompts (
    id TEXT PRIMARY KEY,
    key TEXT UNIQUE,
    content TEXT,
    description TEXT,
    updated_by TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
-- Strict-schema repair (2026-08, auto-generated): "system_prompts" is ALSO created inline by PostgresDatabase.ts's initDb() (real app-boot bootstrap), with a different/smaller column set. If initDb() ran first (thin-bootstrap-then-migrate scenario), the CREATE TABLE IF NOT EXISTS above is a no-op and this file's extra columns (e.g. llm_providers.tier) would silently never be added. Guarded ADD COLUMN so this file is self-healing regardless of which producer created the table first. No-op wherever the columns already exist.
ALTER TABLE system_prompts ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE system_prompts ADD COLUMN IF NOT EXISTS key TEXT UNIQUE;
ALTER TABLE system_prompts ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE system_prompts ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE system_prompts ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE system_prompts ADD COLUMN IF NOT EXISTS updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;


CREATE TABLE IF NOT EXISTS system_feedback (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 7. Auth & Access
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    token_family TEXT NOT NULL,
    device_info TEXT,
    ip_address TEXT,
    user_agent TEXT,
    expires_at DATETIME NOT NULL,
    revoked_at DATETIME,
    revoked_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used_at DATETIME,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
-- Strict-schema repair (2026-08, auto-generated): "refresh_tokens" is ALSO created inline by PostgresDatabase.ts's initDb() (real app-boot bootstrap), with a different/smaller column set. If initDb() ran first (thin-bootstrap-then-migrate scenario), the CREATE TABLE IF NOT EXISTS above is a no-op and this file's extra columns (e.g. llm_providers.tier) would silently never be added. Guarded ADD COLUMN so this file is self-healing regardless of which producer created the table first. No-op wherever the columns already exist.
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS token_hash TEXT;
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS token_family TEXT;
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS device_info TEXT;
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS expires_at DATETIME;
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS revoked_at DATETIME;
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS revoked_reason TEXT;
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS created_at DATETIME DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS last_used_at DATETIME;


CREATE TABLE IF NOT EXISTS revoked_tokens (
    jti TEXT PRIMARY KEY,
    user_id TEXT,
    expires_at DATETIME NOT NULL,
    revoked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reason TEXT DEFAULT 'logout',
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
-- Strict-schema repair (2026-08, auto-generated): "revoked_tokens" is ALSO created inline by PostgresDatabase.ts's initDb() (real app-boot bootstrap), with a different/smaller column set. If initDb() ran first (thin-bootstrap-then-migrate scenario), the CREATE TABLE IF NOT EXISTS above is a no-op and this file's extra columns (e.g. llm_providers.tier) would silently never be added. Guarded ADD COLUMN so this file is self-healing regardless of which producer created the table first. No-op wherever the columns already exist.
ALTER TABLE revoked_tokens ADD COLUMN IF NOT EXISTS jti TEXT;
ALTER TABLE revoked_tokens ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE revoked_tokens ADD COLUMN IF NOT EXISTS expires_at DATETIME;
ALTER TABLE revoked_tokens ADD COLUMN IF NOT EXISTS revoked_at DATETIME DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE revoked_tokens ADD COLUMN IF NOT EXISTS reason TEXT DEFAULT 'logout';


CREATE TABLE IF NOT EXISTS access_codes (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    created_by TEXT NOT NULL,
    role TEXT DEFAULT 'USER',
    max_uses INTEGER DEFAULT 1,
    current_uses INTEGER DEFAULT 0,
    expires_at DATETIME,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE
);
-- Strict-schema repair (2026-08, auto-generated): "access_codes" is ALSO created inline by PostgresDatabase.ts's initDb() (real app-boot bootstrap), with a different/smaller column set. If initDb() ran first (thin-bootstrap-then-migrate scenario), the CREATE TABLE IF NOT EXISTS above is a no-op and this file's extra columns (e.g. llm_providers.tier) would silently never be added. Guarded ADD COLUMN so this file is self-healing regardless of which producer created the table first. No-op wherever the columns already exist.
ALTER TABLE access_codes ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE access_codes ADD COLUMN IF NOT EXISTS organization_id TEXT;
ALTER TABLE access_codes ADD COLUMN IF NOT EXISTS code TEXT UNIQUE;
ALTER TABLE access_codes ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE access_codes ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'USER';
ALTER TABLE access_codes ADD COLUMN IF NOT EXISTS max_uses INTEGER DEFAULT 1;
ALTER TABLE access_codes ADD COLUMN IF NOT EXISTS current_uses INTEGER DEFAULT 0;
ALTER TABLE access_codes ADD COLUMN IF NOT EXISTS expires_at DATETIME;
ALTER TABLE access_codes ADD COLUMN IF NOT EXISTS is_active INTEGER DEFAULT 1;
ALTER TABLE access_codes ADD COLUMN IF NOT EXISTS created_at DATETIME DEFAULT CURRENT_TIMESTAMP;


CREATE TABLE IF NOT EXISTS access_code_usage (
    id TEXT PRIMARY KEY,
    code_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(code_id) REFERENCES access_codes(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
-- Strict-schema repair (2026-08, auto-generated): "access_code_usage" is ALSO created inline by PostgresDatabase.ts's initDb() (real app-boot bootstrap), with a different/smaller column set. If initDb() ran first (thin-bootstrap-then-migrate scenario), the CREATE TABLE IF NOT EXISTS above is a no-op and this file's extra columns (e.g. llm_providers.tier) would silently never be added. Guarded ADD COLUMN so this file is self-healing regardless of which producer created the table first. No-op wherever the columns already exist.
ALTER TABLE access_code_usage ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE access_code_usage ADD COLUMN IF NOT EXISTS code_id TEXT;
ALTER TABLE access_code_usage ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE access_code_usage ADD COLUMN IF NOT EXISTS used_at DATETIME DEFAULT CURRENT_TIMESTAMP;


-- 8. Industrial Assessments (Infrastructure for migration 007, 011 & 041-043)
CREATE TABLE IF NOT EXISTS maturity_assessments (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    axis_scores TEXT,
    completed_axes TEXT,
    overall_as_is REAL,
    overall_to_be REAL,
    overall_gap REAL,
    is_complete INTEGER DEFAULT 0,
    assessment_status TEXT,
    finalized_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS multi_framework_assessments (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rapid_lean_assessments (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    project_id TEXT,
    assessment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    value_stream_score REAL DEFAULT 0,
    waste_elimination_score REAL DEFAULT 0,
    flow_pull_score REAL DEFAULT 0,
    quality_source_score REAL DEFAULT 0,
    continuous_improvement_score REAL DEFAULT 0,
    visual_management_score REAL DEFAULT 0,
    overall_score REAL DEFAULT 0,
    industry_benchmark REAL DEFAULT 0,
    ai_recommendations TEXT DEFAULT '[]',
    top_gaps TEXT DEFAULT '[]',
    questionnaire_responses TEXT DEFAULT '{}',
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS adkar_assessments (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    project_id TEXT,
    assessment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    awareness_score REAL DEFAULT 0,
    desire_score REAL DEFAULT 0,
    knowledge_score REAL DEFAULT 0,
    ability_score REAL DEFAULT 0,
    reinforcement_score REAL DEFAULT 0,
    overall_score REAL DEFAULT 0,
    ai_recommendations TEXT DEFAULT '[]',
    questionnaire_responses TEXT DEFAULT '{}',
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS external_digital_assessments (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    project_id TEXT,
    framework_type TEXT NOT NULL,
    framework_version TEXT,
    assessment_date DATETIME,
    raw_scores_json TEXT NOT NULL DEFAULT '{}',
    normalized_scores_json TEXT DEFAULT '{}',
    mapping_confidence REAL DEFAULT 0,
    drd_axis_mapping TEXT DEFAULT '{}',
    processing_status TEXT DEFAULT 'uploaded',
    uploaded_by TEXT,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS assessments (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    project_id TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS assessment_reports (
    id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL UNIQUE,
    organization_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    organization_id TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'draft',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- 9. Billing & Subscriptions
CREATE TABLE IF NOT EXISTS subscription_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price_monthly REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
-- Strict-schema repair (2026-08, auto-generated): "subscription_plans" is ALSO created inline by PostgresDatabase.ts's initDb() (real app-boot bootstrap), with a different/smaller column set. If initDb() ran first (thin-bootstrap-then-migrate scenario), the CREATE TABLE IF NOT EXISTS above is a no-op and this file's extra columns (e.g. llm_providers.tier) would silently never be added. Guarded ADD COLUMN so this file is self-healing regardless of which producer created the table first. No-op wherever the columns already exist.
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS price_monthly REAL;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS created_at DATETIME DEFAULT CURRENT_TIMESTAMP;


CREATE TABLE IF NOT EXISTS organization_billing (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL UNIQUE,
    subscription_plan_id TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(subscription_plan_id) REFERENCES subscription_plans(id)
);
-- Strict-schema repair (2026-08, auto-generated): "organization_billing" is ALSO created inline by PostgresDatabase.ts's initDb() (real app-boot bootstrap), with a different/smaller column set. If initDb() ran first (thin-bootstrap-then-migrate scenario), the CREATE TABLE IF NOT EXISTS above is a no-op and this file's extra columns (e.g. llm_providers.tier) would silently never be added. Guarded ADD COLUMN so this file is self-healing regardless of which producer created the table first. No-op wherever the columns already exist.
ALTER TABLE organization_billing ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE organization_billing ADD COLUMN IF NOT EXISTS organization_id TEXT UNIQUE;
ALTER TABLE organization_billing ADD COLUMN IF NOT EXISTS subscription_plan_id TEXT;
ALTER TABLE organization_billing ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE organization_billing ADD COLUMN IF NOT EXISTS created_at DATETIME DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE organization_billing ADD COLUMN IF NOT EXISTS updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;


-- 10. AI Infrastructure
CREATE TABLE IF NOT EXISTS ai_audit_logs (
    id TEXT PRIMARY KEY,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_id TEXT,
    organization_id TEXT,
    capability TEXT,
    tokens_used INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_cost_tracking (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    month TEXT NOT NULL,
    total_tokens INTEGER DEFAULT 0,
    total_cost_usd REAL DEFAULT 0,
    budget_limit_usd REAL,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, month)
);

CREATE TABLE IF NOT EXISTS ai_budgets (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT,
    budget_type TEXT NOT NULL,
    budget_limit REAL NOT NULL,
    current_usage REAL DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- 11. Enterprise Features
CREATE TABLE IF NOT EXISTS feature_flags (
    id TEXT PRIMARY KEY,
    flag_key TEXT NOT NULL UNIQUE,
    description TEXT,
    enabled BOOLEAN DEFAULT 0,
    rules TEXT, 
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS webhooks (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);
-- Strict-schema repair (2026-08, auto-generated): "webhooks" is ALSO created inline by PostgresDatabase.ts's initDb() (real app-boot bootstrap), with a different/smaller column set. If initDb() ran first (thin-bootstrap-then-migrate scenario), the CREATE TABLE IF NOT EXISTS above is a no-op and this file's extra columns (e.g. llm_providers.tier) would silently never be added. Guarded ADD COLUMN so this file is self-healing regardless of which producer created the table first. No-op wherever the columns already exist.
ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS organization_id TEXT;
ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS url TEXT;
ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS is_active INTEGER DEFAULT 1;
ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS created_at DATETIME DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;


-- 12. Branding & Communication
CREATE TABLE IF NOT EXISTS email_templates (
    id TEXT PRIMARY KEY,
    organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE, -- null for system defaults
    template_key TEXT NOT NULL, -- 'welcome', 'password_reset', 'invitation', etc.
    name TEXT NOT NULL,
    description TEXT,
    subject TEXT NOT NULL,
    html_content TEXT NOT NULL,
    body_html TEXT NOT NULL DEFAULT '', -- compatibility with 015
    body_text TEXT,
    variables TEXT DEFAULT '[]', -- standard name for 160
    variables_json TEXT DEFAULT '[]', -- legacy name
    available_variables TEXT DEFAULT '[]', -- legacy name
    category TEXT,
    is_default INTEGER DEFAULT 0, -- added for 160
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    UNIQUE(organization_id, template_key)
);

-- 13. AI Infrastructure
CREATE TABLE IF NOT EXISTS llm_providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    provider TEXT NOT NULL,
    model_id TEXT,
    api_key TEXT,
    endpoint TEXT,
    tier TEXT DEFAULT 'standard',
    visibility TEXT DEFAULT 'admin',
    is_active INTEGER DEFAULT 1,
    is_default INTEGER DEFAULT 0,
    cost_per_1k REAL DEFAULT 0,
    context_window INTEGER DEFAULT 4096,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
-- Strict-schema repair (2026-08, auto-generated): "llm_providers" is ALSO created inline by PostgresDatabase.ts's initDb() (real app-boot bootstrap), with a different/smaller column set. If initDb() ran first (thin-bootstrap-then-migrate scenario), the CREATE TABLE IF NOT EXISTS above is a no-op and this file's extra columns (e.g. llm_providers.tier) would silently never be added. Guarded ADD COLUMN so this file is self-healing regardless of which producer created the table first. No-op wherever the columns already exist.
ALTER TABLE llm_providers ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE llm_providers ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE llm_providers ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE llm_providers ADD COLUMN IF NOT EXISTS model_id TEXT;
ALTER TABLE llm_providers ADD COLUMN IF NOT EXISTS api_key TEXT;
ALTER TABLE llm_providers ADD COLUMN IF NOT EXISTS endpoint TEXT;
ALTER TABLE llm_providers ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'standard';
ALTER TABLE llm_providers ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'admin';
ALTER TABLE llm_providers ADD COLUMN IF NOT EXISTS is_active INTEGER DEFAULT 1;
ALTER TABLE llm_providers ADD COLUMN IF NOT EXISTS is_default INTEGER DEFAULT 0;
ALTER TABLE llm_providers ADD COLUMN IF NOT EXISTS cost_per_1k REAL DEFAULT 0;
ALTER TABLE llm_providers ADD COLUMN IF NOT EXISTS context_window INTEGER DEFAULT 4096;
ALTER TABLE llm_providers ADD COLUMN IF NOT EXISTS created_at DATETIME DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE llm_providers ADD COLUMN IF NOT EXISTS updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;


CREATE TABLE IF NOT EXISTS llm_tier_assignments (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL,
    tier TEXT NOT NULL CHECK(tier IN ('BUDGET', 'STANDARD', 'PREMIUM', 'REASONING')),
    priority INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (provider_id) REFERENCES llm_providers(id) ON DELETE CASCADE,
    UNIQUE(provider_id, tier)
);

CREATE TABLE IF NOT EXISTS ai_usage_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    organization_id TEXT,
    provider TEXT,
    model TEXT,
    action TEXT,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    tokens_used INTEGER,
    latency_ms INTEGER,
    status TEXT,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS email_sends (
    id TEXT PRIMARY KEY,
    template_id TEXT,
    organization_id TEXT,
    recipient_email TEXT,
    recipient_user_id TEXT,
    subject TEXT,
    status TEXT DEFAULT 'PENDING',
    sent_at TEXT,
    delivered_at TEXT,
    opened_at TEXT,
    clicked_at TEXT,
    bounced_at TEXT,
    failed_at TEXT,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    open_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    first_click_url TEXT,
    metadata TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(template_id) REFERENCES email_templates(id) ON DELETE SET NULL,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_playbook_templates (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    key TEXT UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    trigger_signal TEXT,
    template_graph TEXT,
    estimated_duration_mins INTEGER,
    status TEXT DEFAULT 'DRAFT',
    version INTEGER DEFAULT 1,
    usage_count INTEGER DEFAULT 0,
    success_rate REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_playbook_runs (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    correlation_id TEXT,
    initiated_by TEXT,
    user_id TEXT,
    status TEXT DEFAULT 'PENDING',
    context_snapshot TEXT,
    result_snapshot TEXT,
    execution_data TEXT,
    started_at TEXT,
    completed_at TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(template_id) REFERENCES ai_playbook_templates(id) ON DELETE CASCADE,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(initiated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 13. Governance & Permissions
CREATE TABLE IF NOT EXISTS permissions (
    key TEXT PRIMARY KEY,
    name TEXT, -- Added for 047
    description TEXT,
    category TEXT,
    icon TEXT, -- Added for 047
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_permissions (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    permission_key TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role, permission_key),
    FOREIGN KEY (permission_key) REFERENCES permissions(key)
);

-- ==========================================
-- SEED DATA
-- ==========================================

INSERT OR IGNORE INTO subscription_plans (id, name, price_monthly) VALUES 
('plan_free', 'Free', 0),
('plan_basic', 'Basic', 20),
('plan_standard', 'Standard', 100),
('plan_premium', 'Premium', 500);

INSERT OR IGNORE INTO system_prompts (id, key, description, content, updated_by) VALUES
('p_analyst', 'ANALYST', 'Tone for Diagnosis', 'You are an Expert Digital Analyst. Your tone is objective, data-driven, and analytical.', 'system'),
('p_consultant', 'CONSULTANT', 'Tone for Recommendations', 'You are a Senior Digital Transformation Consultant. Your tone is professional, solution-oriented, and convincing.', 'system');

INSERT OR IGNORE INTO permissions (key, name, description, category, icon) VALUES 
('CONTENT_VIEW', 'View content templates', 'View content templates', 'CONTENT', 'visibility'),
('CONTENT_EDIT', 'Edit content templates', 'Edit content templates', 'CONTENT', 'edit'),
('CONTENT_PUBLISH', 'Publish content templates', 'Publish content templates', 'CONTENT', 'publish'),
('CONTENT_DELETE', 'Delete content templates', 'Delete content templates', 'CONTENT', 'delete'),
('CONTENT_REVIEW', 'Review content templates', 'Review content templates', 'CONTENT', 'fact_check'),
('EMAIL_SEND_TEST', 'Send test emails', 'Send test emails', 'CONTENT', 'test'),
('CONTENT_ANALYTICS', 'View content analytics', 'View content analytics', 'CONTENT', 'analytics');

INSERT OR IGNORE INTO organizations (id, name, status) VALUES ('system', 'System', 'active');
INSERT OR IGNORE INTO users (id, organization_id, email, first_name, last_name, role, status)
VALUES ('system', 'system', 'system@iris.internal', 'System', 'Administrator', 'SUPERADMIN', 'active');
