-- =====================================================================
-- 20261120_fresh_db_schema_gap_closure.sql
-- =====================================================================
-- POWOD POWSTANIA
--   Audyt integralnosci migracji (2026-08-26) wykazal, ze runner wdrozeniowy
--   server/scripts/migrate.postgres.ts (wolany przez release-migration-gate)
--   nie uruchamia 212 plikow z server/migrations. Filtrem jest
--   isSqliteOnlyMigration(), ktore hurtem wyklucza kazdy plik z numerem
--   1..499 (poza 4 promowanymi: 073, 081, 215, 256) oraz pliki z
--   seed/mock/demo/add_/000_initdb_/sqlite/fts5 w nazwie.
--   Skutkiem jest 174 obiekty uzywane w server/src, ktorych NIE MA na bazie
--   budowanej od zera. Demo/staging maja je fizycznie (stare bazy sprzed
--   reguly), wiec dzialaja; kazde NOWE srodowisko (staging od zera,
--   DR-restore, e2e w CI) pada.
--
-- ZAKRES TEGO PLIKU — WYLACZNIE KLASA "ONLY_DEAD"
--   Obiekty, ktorych DDL ISTNIEJE w martwych plikach-producentach i wystarczy
--   je przepisac. Sekcje ponizej sa opisane nazwa pliku-producenta.
--   Klasa "NO_MIGRATION" (96 obiektow, ktorych ZADEN plik nie tworzy) jest
--   CELOWO POZA ZAKRESEM — to decyzja produktowa per modul.
--
-- OSTRZEZENIE — CZEGO TEN PLIK NIE OZNACZA
--   Ten plik NIE JEST zgoda na uruchamianie plikow <500 ani na poszerzanie
--   wzorca autorun. isSqliteOnlyMigration() pozostaje nietkniete. Pliki
--   zrodlowe pozostaja martwe; tutaj przepisany jest wylacznie ten ich
--   fragment DDL, ktory jest realnie uzywany przez kod produkcyjny.
--
-- GWARANCJE BEZPIECZENSTWA
--   * wylacznie CREATE TABLE IF NOT EXISTS / ALTER TABLE ADD COLUMN IF NOT
--     EXISTS / CREATE INDEX IF NOT EXISTS
--   * ZERO DROP, ZERO ALTER zmieniajacego istniejace typy/constrainty,
--     ZERO danych (zadnych INSERT/seed)
--   * idempotentny; NO-OP na bazie, ktora te obiekty juz ma (demo/staging)
--
-- KLUCZE OBCE
--   Kazdy FK zostal zweryfikowany na bazie zbudowanej od zera: tabela
--   docelowa istnieje i ma PK/UNIQUE na wskazanej kolumnie o typie text.
--   Zaden FK nie zostal pominiety w sekcji tabel. W sekcji kolumn FK sa
--   swiadomie pomijane (patrz komentarze przy kolumnach).
--
-- TLUMACZENIA SQLite -> PostgreSQL
--   Producenci sa SQLite-first. Zastosowane, jednolite reguly (kazde uzycie
--   odnotowane komentarzem "-- [PG]" przy tabeli):
--     DATETIME                          -> TIMESTAMP
--     DEFAULT (datetime('now'))         -> DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'))
--                                          (kolumna zostaje TEXT; format 1:1 jak w SQLite)
--     DEFAULT (lower(hex(randomblob(16)))) -> DEFAULT (replace(gen_random_uuid()::text,'-',''))
--                                          (ten sam ksztalt: 32 znaki hex)
--     INTEGER PRIMARY KEY AUTOINCREMENT -> BIGSERIAL PRIMARY KEY
--     BOOLEAN DEFAULT 1/0               -> BOOLEAN DEFAULT TRUE/FALSE
--   Kolumny INTEGER uzywane jako flagi 0/1 oraz REAL/JSON/DECIMAL zostawiono
--   bez zmian — sa poprawne w PostgreSQL i wierne producentowi.
--
-- ZMIENIONE NAZWY INDEKSOW
--   W PostgreSQL nazwa indeksu jest globalna w schemacie. Szesc nazw z
--   producentow jest juz zajetych przez indeksy na INNYCH tabelach; gdyby je
--   zostawic, CREATE INDEX IF NOT EXISTS byloby cichym no-op i indeks by nie
--   powstal. Przemianowane (tylko nazwa indeksu, definicja bez zmian):
--     idx_contracts_org          -> idx_customer_contracts_org
--     idx_contracts_status       -> idx_customer_contracts_status
--     idx_user_activity_user     -> idx_user_activity_summary_user
--     idx_user_activity_org      -> idx_user_activity_summary_org
--     idx_user_onboarding_user   -> idx_user_onboarding_progress_user
--     idx_user_onboarding_org    -> idx_user_onboarding_progress_org
-- =====================================================================

-- =====================================================================
-- CZESC 1 — TABELE (79) brakujace na bazie od zera
-- =====================================================================

-- ---------------------------------------------------------------------
-- active_sessions
-- producent (plik martwy, nigdy nieuruchamiany): 080_user_settings_extended.sql
-- [PG] DATETIME -> TIMESTAMP
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS active_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    device TEXT, -- Parsed from user_agent: 'Chrome on MacOS', 'Safari on iPhone', etc.
    ip_address TEXT,
    last_active TIMESTAMP,
    session_token TEXT, -- Hashed token for validation
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_active_sessions_user ON active_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_token ON active_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_active_sessions_expires ON active_sessions(expires_at);

-- ---------------------------------------------------------------------
-- ai_ab_experiments
-- producent (plik martwy, nigdy nieuruchamiany): 052_ab_testing.sql
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_ab_experiments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    prompt_id TEXT NOT NULL,
    variants TEXT NOT NULL, -- JSON array of variant configurations
    traffic_split TEXT NOT NULL, -- JSON array of percentages [50, 50]
    min_sample_size INTEGER DEFAULT 100,
    confidence_level REAL DEFAULT 0.95,
    primary_metric TEXT DEFAULT 'user_satisfaction',
    status TEXT DEFAULT 'draft', -- draft, running, stopped, completed
    stop_reason TEXT,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    FOREIGN KEY (prompt_id) REFERENCES ai_system_prompts(id)
);
CREATE INDEX IF NOT EXISTS idx_ab_experiments_prompt_id ON ai_ab_experiments(prompt_id);
CREATE INDEX IF NOT EXISTS idx_ab_experiments_status ON ai_ab_experiments(status);

-- ---------------------------------------------------------------------
-- ai_ab_assignments
-- producent (plik martwy, nigdy nieuruchamiany): 052_ab_testing.sql
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_ab_assignments (
    id TEXT PRIMARY KEY,
    experiment_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    variant_index INTEGER NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(experiment_id, user_id),
    FOREIGN KEY (experiment_id) REFERENCES ai_ab_experiments(id)
);
CREATE INDEX IF NOT EXISTS idx_ab_assignments_experiment ON ai_ab_assignments(experiment_id);
CREATE INDEX IF NOT EXISTS idx_ab_assignments_user ON ai_ab_assignments(user_id);

-- ---------------------------------------------------------------------
-- ai_ab_outcomes
-- producent (plik martwy, nigdy nieuruchamiany): 052_ab_testing.sql
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_ab_outcomes (
    id TEXT PRIMARY KEY,
    experiment_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    variant_index INTEGER NOT NULL,
    metric TEXT NOT NULL,
    value REAL NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (experiment_id) REFERENCES ai_ab_experiments(id)
);
CREATE INDEX IF NOT EXISTS idx_ab_outcomes_experiment ON ai_ab_outcomes(experiment_id);
CREATE INDEX IF NOT EXISTS idx_ab_outcomes_metric ON ai_ab_outcomes(experiment_id, metric);

-- ---------------------------------------------------------------------
-- ai_instructions_org
-- producent (plik martwy, nigdy nieuruchamiany): 245_project_enhancements.sql
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- ai_instructions_system
-- producent (plik martwy, nigdy nieuruchamiany): 245_project_enhancements.sql
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- ai_learning_patterns
-- producent (plik martwy, nigdy nieuruchamiany): 251_ai_learning_system.sql
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_learning_patterns (
    id TEXT PRIMARY KEY,
    
    -- Pattern classification
    pattern_type TEXT NOT NULL, -- 'decision', 'initiative', 'assessment', 'usage', 'error'
    pattern_category TEXT, -- More specific category within type
    
    -- Pattern data
    pattern_data TEXT NOT NULL, -- JSON with pattern details
    pattern_description TEXT, -- Human-readable description
    
    -- Statistics
    occurrence_count INTEGER DEFAULT 1,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    
    -- Confidence
    confidence_score REAL DEFAULT 0.5, -- 0-1
    
    -- Context
    organization_id TEXT, -- NULL for system-wide patterns
    
    -- Timestamps
    first_occurrence_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_occurrence_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ai_patterns_type ON ai_learning_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_ai_patterns_org ON ai_learning_patterns(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_patterns_confidence ON ai_learning_patterns(confidence_score);

-- ---------------------------------------------------------------------
-- approval_workflows
-- producent (plik martwy, nigdy nieuruchamiany): 236_security_module_extended.sql
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS approval_workflows (
    id TEXT PRIMARY KEY,
    organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    workflow_type TEXT NOT NULL CHECK(workflow_type IN (
        'role_assignment', 'api_key_creation', 'data_access', 
        'budget_increase', 'user_invitation', 'permission_change', 'custom'
    )),
    approvers TEXT NOT NULL, -- JSON array of user IDs or emails
    require_all_approvers BOOLEAN DEFAULT FALSE,
    auto_expire_hours INTEGER DEFAULT 72,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_approval_workflows_org ON approval_workflows(organization_id);
CREATE INDEX IF NOT EXISTS idx_approval_workflows_type ON approval_workflows(workflow_type);
CREATE INDEX IF NOT EXISTS idx_approval_workflows_active ON approval_workflows(is_active);

-- ---------------------------------------------------------------------
-- approval_requests
-- producent (plik martwy, nigdy nieuruchamiany): 236_security_module_extended.sql
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS approval_requests (
    id TEXT PRIMARY KEY,
    workflow_id TEXT REFERENCES approval_workflows(id) ON DELETE CASCADE,
    organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    requester_id TEXT NOT NULL REFERENCES users(id),
    request_type TEXT NOT NULL,
    request_data TEXT, -- JSON with request details
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'cancelled', 'expired')),
    approvals TEXT, -- JSON array of {userId, approvedAt, comment}
    rejections TEXT, -- JSON array of {userId, rejectedAt, reason}
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    resolved_at TIMESTAMP,
    resolved_by TEXT REFERENCES users(id),
    resolution_notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_approval_requests_workflow ON approval_requests(workflow_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_org ON approval_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_requester ON approval_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);

-- ---------------------------------------------------------------------
-- assessment_frameworks
-- producent (plik martwy, nigdy nieuruchamiany): 248_assessment_enhancements.sql
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assessment_frameworks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    version TEXT,
    is_licensed INTEGER DEFAULT 0,
    license_holder TEXT,
    dimensions TEXT NOT NULL, -- JSON array of dimension definitions
    scoring_scale INTEGER DEFAULT 5, -- 1-5 typical
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- assessment_responses
-- producent (plik martwy, nigdy nieuruchamiany): 248_assessment_enhancements.sql
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assessment_responses (
    id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL,
    dimension_id TEXT NOT NULL,
    subdimension_id TEXT,
    question_id TEXT NOT NULL,
    score INTEGER, -- 1-5
    evidence TEXT,
    evidence_attachments TEXT, -- JSON array of file IDs
    notes TEXT,
    ai_feedback TEXT,
    answered_by TEXT,
    answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
    UNIQUE(assessment_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_assessment_responses_assessment ON assessment_responses(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_responses_dimension ON assessment_responses(dimension_id);

-- ---------------------------------------------------------------------
-- assessment_workflow_transitions
-- producent (plik martwy, nigdy nieuruchamiany): 286_assessment_workflow_enhancements.sql
-- [PG] DATETIME -> TIMESTAMP
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assessment_workflow_transitions (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT NOT NULL,
    triggered_by TEXT NOT NULL,
    triggered_by_name TEXT,
    reason TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (workflow_id) REFERENCES assessment_workflows(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_transitions_workflow ON assessment_workflow_transitions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_transitions_timestamp ON assessment_workflow_transitions(timestamp);

-- ---------------------------------------------------------------------
-- automation_rule_executions
-- producent (plik martwy, nigdy nieuruchamiany): 240_customer_automation.sql
-- [PG] DEFAULT (lower(hex(randomblob(16)))) -> DEFAULT (replace(gen_random_uuid()::text,'-','')) [ten sam ksztalt: 32 znaki hex]
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS automation_rule_executions (
    id TEXT PRIMARY KEY DEFAULT (replace(gen_random_uuid()::text,'-','')),
    rule_id TEXT NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
    organization_id TEXT REFERENCES organizations(id),
    user_id TEXT REFERENCES users(id),
    status TEXT DEFAULT 'completed',
    execution_details TEXT DEFAULT '{}',
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_automation_rule_executions_rule ON automation_rule_executions(rule_id);
CREATE INDEX IF NOT EXISTS idx_automation_rule_executions_date ON automation_rule_executions(executed_at DESC);

-- ---------------------------------------------------------------------
-- billing_alerts
-- producent (plik martwy, nigdy nieuruchamiany): 091_payment_methods.sql
-- [PG] DATETIME -> TIMESTAMP
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing_alerts (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL UNIQUE,
    token_threshold_80 INTEGER DEFAULT 1, -- Alert at 80%
    token_threshold_90 INTEGER DEFAULT 1, -- Alert at 90%
    token_threshold_100 INTEGER DEFAULT 1, -- Alert at 100%
    storage_threshold_80 INTEGER DEFAULT 1,
    storage_threshold_90 INTEGER DEFAULT 1,
    storage_threshold_100 INTEGER DEFAULT 1,
    auto_upgrade_enabled INTEGER DEFAULT 0,
    auto_upgrade_plan_id TEXT,
    cost_cap_monthly REAL, -- Hard limit in USD
    email_notifications INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (auto_upgrade_plan_id) REFERENCES subscription_plans(id)
);

-- ---------------------------------------------------------------------
-- billing_webhook_events
-- producent (plik martwy, nigdy nieuruchamiany): 150_billing_phase2.sql
-- [PG] DEFAULT (datetime('now')) -> DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')) [kolumna zostaje TEXT, format 1:1 jak w SQLite]
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing_webhook_events (
    id TEXT PRIMARY KEY,
    
    -- Event info
    event_type TEXT NOT NULL,
    event_source TEXT DEFAULT 'internal' CHECK(event_source IN ('stripe', 'internal', 'scheduled')),
    
    -- Target webhook
    webhook_id TEXT, -- Reference to outbound webhooks table if applicable
    target_url TEXT,
    
    -- Payload
    payload TEXT NOT NULL, -- JSON
    headers TEXT, -- JSON
    
    -- Delivery status
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'delivered', 'failed', 'retrying')),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 5,
    next_retry_at TEXT,
    
    -- Response
    response_status INTEGER,
    response_body TEXT,
    response_time_ms INTEGER,
    
    -- Error tracking
    last_error TEXT,
    
    -- Timestamps
    created_at TEXT DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')),
    delivered_at TEXT,
    failed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_billing_webhooks_status ON billing_webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_billing_webhooks_type ON billing_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_billing_webhooks_retry ON billing_webhook_events(next_retry_at) WHERE status = 'retrying';

-- ---------------------------------------------------------------------
-- churn_warnings
-- producent (plik martwy, nigdy nieuruchamiany): 230_superadmin_overview_production.sql
-- [PG] DATETIME -> TIMESTAMP
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS churn_warnings (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    warning_type TEXT NOT NULL, -- 'USAGE_DROP', 'NO_LOGIN', 'FEATURE_ABANDON', 'SUPPORT_ISSUES', 'PAYMENT_RISK'
    severity TEXT DEFAULT 'MEDIUM', -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    message TEXT,
    metrics TEXT, -- JSON with details
    status TEXT DEFAULT 'ACTIVE', -- 'ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    resolved_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_churn_warnings_org ON churn_warnings(organization_id);
CREATE INDEX IF NOT EXISTS idx_churn_warnings_status ON churn_warnings(status);
CREATE INDEX IF NOT EXISTS idx_churn_warnings_severity ON churn_warnings(severity);

-- ---------------------------------------------------------------------
-- consultant_project_access
-- producent (plik martwy, nigdy nieuruchamiany): 127_consultant_project_access.sql
-- [PG] DATETIME -> TIMESTAMP
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS consultant_project_access (
    id TEXT PRIMARY KEY,
    consultant_user_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    
    -- Invitation details
    invited_by_user_id TEXT NOT NULL,
    invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP,
    
    -- Access code (allows free seat)
    access_code TEXT,
    access_code_used_at TIMESTAMP,
    
    -- Status
    status TEXT DEFAULT 'PENDING', -- PENDING, ACTIVE, REVOKED, EXPIRED
    
    -- Custom permissions (JSON) - initially all false
    permissions TEXT DEFAULT '{}',
    
    -- Notes
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(consultant_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(invited_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(consultant_user_id, project_id)
);
CREATE INDEX IF NOT EXISTS idx_consultant_project_access_consultant 
ON consultant_project_access(consultant_user_id);
CREATE INDEX IF NOT EXISTS idx_consultant_project_access_project 
ON consultant_project_access(project_id);
CREATE INDEX IF NOT EXISTS idx_consultant_project_access_org 
ON consultant_project_access(organization_id);
CREATE INDEX IF NOT EXISTS idx_consultant_project_access_status 
ON consultant_project_access(status);

-- ---------------------------------------------------------------------
-- content_analytics
-- producent (plik martwy, nigdy nieuruchamiany): 047_content_module_enterprise.sql
-- [PG] DEFAULT (datetime('now')) -> DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')) [kolumna zostaje TEXT, format 1:1 jak w SQLite]
-- ---------------------------------------------------------------------
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
    
    created_at TEXT DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_content_analytics_content ON content_analytics(content_id, content_type);
CREATE INDEX IF NOT EXISTS idx_content_analytics_event ON content_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_content_analytics_user ON content_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_content_analytics_org ON content_analytics(organization_id);
CREATE INDEX IF NOT EXISTS idx_content_analytics_created ON content_analytics(created_at);

-- ---------------------------------------------------------------------
-- content_favorites
-- producent (plik martwy, nigdy nieuruchamiany): 047_content_module_enterprise.sql
-- [PG] DEFAULT (datetime('now')) -> DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')) [kolumna zostaje TEXT, format 1:1 jak w SQLite]
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS content_favorites (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    content_id TEXT NOT NULL,
    content_type TEXT NOT NULL, -- 'PLAYBOOK_TEMPLATE', 'EMAIL_TEMPLATE'
    
    -- Notes
    notes TEXT,
    
    -- Folder (for organizing favorites)
    folder_name TEXT DEFAULT 'Default',
    
    created_at TEXT DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, content_id, content_type)
);
CREATE INDEX IF NOT EXISTS idx_content_favorites_user ON content_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_content_favorites_content ON content_favorites(content_id, content_type);

-- ---------------------------------------------------------------------
-- content_permissions
-- producent (plik martwy, nigdy nieuruchamiany): 047_content_module_enterprise.sql
-- [PG] DEFAULT (datetime('now')) -> DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')) [kolumna zostaje TEXT, format 1:1 jak w SQLite]
-- ---------------------------------------------------------------------
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
    
    created_at TEXT DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_content_permissions_content ON content_permissions(content_id, content_type);
CREATE INDEX IF NOT EXISTS idx_content_permissions_user ON content_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_content_permissions_role ON content_permissions(role);
CREATE INDEX IF NOT EXISTS idx_content_permissions_org ON content_permissions(organization_id);

-- ---------------------------------------------------------------------
-- content_reviews
-- producent (plik martwy, nigdy nieuruchamiany): 047_content_module_enterprise.sql
-- [PG] DEFAULT (datetime('now')) -> DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')) [kolumna zostaje TEXT, format 1:1 jak w SQLite]
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS content_reviews (
    id TEXT PRIMARY KEY,
    content_id TEXT NOT NULL,
    content_type TEXT NOT NULL, -- 'PLAYBOOK_TEMPLATE', 'EMAIL_TEMPLATE'
    
    -- Review request
    requested_by TEXT NOT NULL,
    requested_at TEXT DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')),
    
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
    
    created_at TEXT DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')),
    updated_at TEXT DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')),
    
    FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_content_reviews_content ON content_reviews(content_id, content_type);
CREATE INDEX IF NOT EXISTS idx_content_reviews_reviewer ON content_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_content_reviews_status ON content_reviews(status);
CREATE INDEX IF NOT EXISTS idx_content_reviews_requested_by ON content_reviews(requested_by);

-- ---------------------------------------------------------------------
-- content_tag_mappings
-- producent (plik martwy, nigdy nieuruchamiany): 047_content_module_enterprise.sql
-- [PG] DEFAULT (datetime('now')) -> DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')) [kolumna zostaje TEXT, format 1:1 jak w SQLite]
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS content_tag_mappings (
    id TEXT PRIMARY KEY,
    content_id TEXT NOT NULL,
    content_type TEXT NOT NULL, -- 'PLAYBOOK_TEMPLATE', 'EMAIL_TEMPLATE'
    tag_id TEXT NOT NULL,
    
    created_at TEXT DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')),
    created_by TEXT,
    
    FOREIGN KEY (tag_id) REFERENCES content_tags(id) ON DELETE CASCADE,
    UNIQUE(content_id, content_type, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_content_tag_mappings_content ON content_tag_mappings(content_id, content_type);
CREATE INDEX IF NOT EXISTS idx_content_tag_mappings_tag ON content_tag_mappings(tag_id);

-- ---------------------------------------------------------------------
-- credit_notes
-- producent (plik martwy, nigdy nieuruchamiany): 150_billing_phase2.sql
-- [PG] DEFAULT (datetime('now')) -> DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')) [kolumna zostaje TEXT, format 1:1 jak w SQLite]
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS credit_notes (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    invoice_id TEXT, -- Reference to original invoice (optional)
    credit_note_number TEXT UNIQUE NOT NULL,
    stripe_credit_note_id TEXT,
    
    -- Amounts
    subtotal INTEGER NOT NULL, -- in smallest currency unit (cents)
    tax_amount INTEGER DEFAULT 0,
    total INTEGER NOT NULL,
    amount_applied INTEGER DEFAULT 0, -- Amount already applied to invoices
    amount_remaining INTEGER, -- Remaining credit
    
    -- Currency
    currency TEXT DEFAULT 'USD',
    exchange_rate REAL DEFAULT 1.0,
    base_currency TEXT DEFAULT 'USD',
    base_total INTEGER,
    
    -- Status
    status TEXT DEFAULT 'issued' CHECK(status IN ('draft', 'issued', 'applied', 'voided', 'refunded')),
    
    -- Metadata
    reason TEXT NOT NULL CHECK(reason IN ('duplicate', 'fraudulent', 'order_change', 'product_unsatisfactory', 'service_issue', 'billing_error', 'other')),
    reason_details TEXT,
    memo TEXT, -- Internal notes
    customer_memo TEXT, -- Visible to customer
    
    -- Refund info
    refund_amount INTEGER DEFAULT 0,
    stripe_refund_id TEXT,
    refunded_at TEXT,
    
    -- Dates
    issued_at TEXT DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')),
    voided_at TEXT,
    
    -- Audit
    created_by TEXT,
    voided_by TEXT,
    
    created_at TEXT DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')),
    updated_at TEXT DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_credit_notes_org ON credit_notes(organization_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_invoice ON credit_notes(invoice_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_status ON credit_notes(status);
CREATE INDEX IF NOT EXISTS idx_credit_notes_number ON credit_notes(credit_note_number);

-- ---------------------------------------------------------------------
-- credit_applications
-- producent (plik martwy, nigdy nieuruchamiany): 150_billing_phase2.sql
-- [PG] DEFAULT (datetime('now')) -> DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')) [kolumna zostaje TEXT, format 1:1 jak w SQLite]
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS credit_applications (
    id TEXT PRIMARY KEY,
    credit_note_id TEXT NOT NULL,
    invoice_id TEXT NOT NULL,
    amount INTEGER NOT NULL, -- Amount applied from this credit note to this invoice
    applied_at TEXT DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')),
    applied_by TEXT,
    FOREIGN KEY (credit_note_id) REFERENCES credit_notes(id) ON DELETE CASCADE,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_credit_applications_note ON credit_applications(credit_note_id);
CREATE INDEX IF NOT EXISTS idx_credit_applications_invoice ON credit_applications(invoice_id);

-- ---------------------------------------------------------------------
-- custom_dashboards
-- producent (plik martwy, nigdy nieuruchamiany): 261_analytics_system.sql
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS custom_dashboards (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT, -- NULL = organization-wide dashboard
    
    name TEXT NOT NULL,
    description TEXT,
    
    -- Layout configuration
    layout TEXT NOT NULL DEFAULT '[]', -- JSON: [{widgetId, x, y, w, h}]
    widgets TEXT NOT NULL DEFAULT '[]', -- JSON: [{widgetId, config}]
    
    -- Theme
    theme TEXT DEFAULT 'default',
    
    -- Sharing
    is_shared INTEGER DEFAULT 0,
    shared_with TEXT DEFAULT '[]', -- JSON: [userId] or [roleId]
    share_link_token TEXT,
    
    -- Settings
    is_default INTEGER DEFAULT 0, -- Default for this user/org
    auto_refresh INTEGER DEFAULT 1,
    refresh_interval_seconds INTEGER DEFAULT 300,
    
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_dashboards_org ON custom_dashboards(organization_id);
CREATE INDEX IF NOT EXISTS idx_dashboards_user ON custom_dashboards(user_id);
CREATE INDEX IF NOT EXISTS idx_dashboards_default ON custom_dashboards(is_default);

-- ---------------------------------------------------------------------
-- customer_communications
-- producent (plik martwy, nigdy nieuruchamiany): 241_customer_communications.sql
-- [PG] DEFAULT (lower(hex(randomblob(16)))) -> DEFAULT (replace(gen_random_uuid()::text,'-','')) [ten sam ksztalt: 32 znaki hex]
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_communications (
    id TEXT PRIMARY KEY DEFAULT (replace(gen_random_uuid()::text,'-','')),
    type TEXT NOT NULL CHECK(type IN ('email', 'announcement', 'broadcast')),
    subject TEXT NOT NULL,
    content TEXT,
    recipients_filter TEXT DEFAULT '{}',
    recipient_count INTEGER DEFAULT 0,
    sent_at TIMESTAMP,
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'scheduled', 'sending', 'sent', 'failed')),
    open_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    created_by TEXT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_communications_status ON customer_communications(status);
CREATE INDEX IF NOT EXISTS idx_communications_type ON customer_communications(type);
CREATE INDEX IF NOT EXISTS idx_communications_sent ON customer_communications(sent_at DESC);

-- ---------------------------------------------------------------------
-- customer_contracts
-- producent (plik martwy, nigdy nieuruchamiany): 202_customer_contracts.sql
-- [PG] DEFAULT (lower(hex(randomblob(16)))) -> DEFAULT (replace(gen_random_uuid()::text,'-','')) [ten sam ksztalt: 32 znaki hex]
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_contracts (
    id TEXT PRIMARY KEY DEFAULT (replace(gen_random_uuid()::text,'-','')),
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contract_type TEXT DEFAULT 'subscription',
    start_date DATE NOT NULL,
    end_date DATE,
    renewal_date DATE,
    value DECIMAL(12,2) DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    status TEXT DEFAULT 'active',
    terms_json TEXT DEFAULT '{}',
    document_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_customer_contracts_org ON customer_contracts(organization_id);
CREATE INDEX IF NOT EXISTS idx_customer_contracts_status ON customer_contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_renewal ON customer_contracts(renewal_date);

-- ---------------------------------------------------------------------
-- customer_lifecycle_stages
-- producent (plik martwy, nigdy nieuruchamiany): 200_customer_lifecycle.sql
-- [PG] DEFAULT (lower(hex(randomblob(16)))) -> DEFAULT (replace(gen_random_uuid()::text,'-','')) [ten sam ksztalt: 32 znaki hex]
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_lifecycle_stages (
    id TEXT PRIMARY KEY DEFAULT (replace(gen_random_uuid()::text,'-','')),
    name TEXT NOT NULL,
    description TEXT,
    order_index INTEGER DEFAULT 0,
    color TEXT DEFAULT '#3B82F6',
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_lifecycle_stages_order ON customer_lifecycle_stages(order_index);

-- ---------------------------------------------------------------------
-- customer_lifecycle_transitions
-- producent (plik martwy, nigdy nieuruchamiany): 200_customer_lifecycle.sql
-- [PG] DEFAULT (lower(hex(randomblob(16)))) -> DEFAULT (replace(gen_random_uuid()::text,'-','')) [ten sam ksztalt: 32 znaki hex]
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_lifecycle_transitions (
    id TEXT PRIMARY KEY DEFAULT (replace(gen_random_uuid()::text,'-','')),
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    from_stage_id TEXT REFERENCES customer_lifecycle_stages(id),
    to_stage_id TEXT NOT NULL REFERENCES customer_lifecycle_stages(id),
    transitioned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    transitioned_by TEXT REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_lifecycle_transitions_org ON customer_lifecycle_transitions(organization_id);
CREATE INDEX IF NOT EXISTS idx_lifecycle_transitions_date ON customer_lifecycle_transitions(transitioned_at DESC);

-- ---------------------------------------------------------------------
-- customer_success_playbooks
-- producent (plik martwy, nigdy nieuruchamiany): 201_customer_playbooks.sql
-- [PG] DEFAULT (lower(hex(randomblob(16)))) -> DEFAULT (replace(gen_random_uuid()::text,'-','')) [ten sam ksztalt: 32 znaki hex]
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_success_playbooks (
    id TEXT PRIMARY KEY DEFAULT (replace(gen_random_uuid()::text,'-','')),
    name TEXT NOT NULL,
    description TEXT,
    trigger_conditions_json TEXT DEFAULT '{}',
    actions_json TEXT DEFAULT '[]',
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- customer_playbook_actions
-- producent (plik martwy, nigdy nieuruchamiany): 201_customer_playbooks.sql
-- [PG] DEFAULT (lower(hex(randomblob(16)))) -> DEFAULT (replace(gen_random_uuid()::text,'-','')) [ten sam ksztalt: 32 znaki hex]
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_playbook_actions (
    id TEXT PRIMARY KEY DEFAULT (replace(gen_random_uuid()::text,'-','')),
    playbook_id TEXT NOT NULL REFERENCES customer_success_playbooks(id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    action_config_json TEXT DEFAULT '{}',
    status TEXT DEFAULT 'pending',
    executed_at TIMESTAMP,
    result_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_playbook_actions_playbook ON customer_playbook_actions(playbook_id);
CREATE INDEX IF NOT EXISTS idx_playbook_actions_org ON customer_playbook_actions(organization_id);
CREATE INDEX IF NOT EXISTS idx_playbook_actions_status ON customer_playbook_actions(status);

-- ---------------------------------------------------------------------
-- decision_delegations
-- producent (plik martwy, nigdy nieuruchamiany): 303_decision_escalation_delegation.sql
-- [PG] DEFAULT (datetime('now')) -> DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')) [kolumna zostaje TEXT, format 1:1 jak w SQLite]
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS decision_delegations (
  id TEXT PRIMARY KEY,
  decision_id TEXT NOT NULL,
  organization_id TEXT,
  
  -- Delegation parties
  from_user_id TEXT NOT NULL,
  to_user_id TEXT NOT NULL,
  
  -- Type and purpose
  delegation_type TEXT NOT NULL,      -- 'full', 'review', 'input', 'co_decide'
  reason TEXT,
  comment TEXT,
  
  -- Status workflow
  status TEXT DEFAULT 'pending',      -- 'pending', 'accepted', 'rejected', 'completed', 'expired'
  
  -- Response
  response_comment TEXT,
  accepted_at TEXT,
  rejected_at TEXT,
  rejection_reason TEXT,
  completed_at TEXT,
  
  -- Expiration
  expires_at TEXT,
  
  -- Metadata
  created_at TEXT DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')),
  updated_at TEXT DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')),
  
  FOREIGN KEY (decision_id) REFERENCES decisions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_delegations_decision ON decision_delegations(decision_id);
CREATE INDEX IF NOT EXISTS idx_delegations_from_user ON decision_delegations(from_user_id);
CREATE INDEX IF NOT EXISTS idx_delegations_to_user ON decision_delegations(to_user_id);
CREATE INDEX IF NOT EXISTS idx_delegations_status ON decision_delegations(status);
CREATE INDEX IF NOT EXISTS idx_delegations_type ON decision_delegations(delegation_type);

-- ---------------------------------------------------------------------
-- decision_consulted_opinions
-- producent (plik martwy, nigdy nieuruchamiany): 303_decision_escalation_delegation.sql
-- [PG] DEFAULT (datetime('now')) -> DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')) [kolumna zostaje TEXT, format 1:1 jak w SQLite]
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS decision_consulted_opinions (
  id TEXT PRIMARY KEY,
  decision_id TEXT NOT NULL,
  delegation_id TEXT,                 -- Link to delegation request if applicable
  organization_id TEXT,
  
  -- Opinion author
  user_id TEXT NOT NULL,
  user_name TEXT,
  
  -- Opinion content
  opinion TEXT NOT NULL,
  recommendation TEXT,                -- 'approve', 'reject', 'defer', 'need_more_info'
  confidence_level TEXT,              -- 'low', 'medium', 'high'
  
  -- Metadata
  created_at TEXT DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')),
  updated_at TEXT DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')),
  
  FOREIGN KEY (decision_id) REFERENCES decisions(id) ON DELETE CASCADE,
  FOREIGN KEY (delegation_id) REFERENCES decision_delegations(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_opinions_decision ON decision_consulted_opinions(decision_id);
CREATE INDEX IF NOT EXISTS idx_opinions_user ON decision_consulted_opinions(user_id);

-- ---------------------------------------------------------------------
-- decision_escalation_chain
-- producent (plik martwy, nigdy nieuruchamiany): 303_decision_escalation_delegation.sql
-- [PG] DEFAULT (datetime('now')) -> DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')) [kolumna zostaje TEXT, format 1:1 jak w SQLite]
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS decision_escalation_chain (
  id TEXT PRIMARY KEY,
  decision_id TEXT,
  organization_id TEXT,
  
  -- Level configuration
  level INTEGER NOT NULL,
  escalate_to_user_id TEXT,
  escalate_to_role TEXT,              -- 'pmo_lead', 'project_sponsor', 'executive'
  
  -- Timing
  delay_hours INTEGER DEFAULT 24,
  
  -- Notifications
  notify_channels TEXT DEFAULT 'in-app,email',  -- comma-separated
  notify_message TEXT,
  
  -- Metadata
  created_at TEXT DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')),
  created_by TEXT,
  
  FOREIGN KEY (decision_id) REFERENCES decisions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_escalation_chain_decision ON decision_escalation_chain(decision_id);
CREATE INDEX IF NOT EXISTS idx_escalation_chain_org ON decision_escalation_chain(organization_id);
CREATE INDEX IF NOT EXISTS idx_escalation_chain_level ON decision_escalation_chain(decision_id, level);

-- ---------------------------------------------------------------------
-- decision_escalation_log
-- producent (plik martwy, nigdy nieuruchamiany): 303_decision_escalation_delegation.sql
-- [PG] DEFAULT (datetime('now')) -> DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')) [kolumna zostaje TEXT, format 1:1 jak w SQLite]
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS decision_escalation_log (
  id TEXT PRIMARY KEY,
  decision_id TEXT NOT NULL,
  organization_id TEXT,
  
  -- Escalation details
  from_level INTEGER,
  to_level INTEGER,
  from_user_id TEXT,
  to_user_id TEXT,
  
  -- Context
  reason TEXT,
  triggered_by TEXT,                  -- 'auto' or user_id
  trigger_type TEXT,                  -- 'overdue', 'manual', 'threshold'
  
  -- Metadata
  created_at TEXT DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')),
  
  FOREIGN KEY (decision_id) REFERENCES decisions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_escalation_log_decision ON decision_escalation_log(decision_id);
CREATE INDEX IF NOT EXISTS idx_escalation_log_created ON decision_escalation_log(created_at);

-- ---------------------------------------------------------------------
-- decision_escalation_templates
-- producent (plik martwy, nigdy nieuruchamiany): 303_decision_escalation_delegation.sql
-- [PG] DEFAULT (datetime('now')) -> DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')) [kolumna zostaje TEXT, format 1:1 jak w SQLite]
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS decision_escalation_templates (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  
  -- Template info
  name TEXT NOT NULL,
  description TEXT,
  is_default INTEGER DEFAULT 0,
  
  -- Chain definition (JSON array)
  chain_config TEXT,                  -- JSON: [{level: 1, role: 'pmo_lead', delay_hours: 24}, ...]
  
  -- Thresholds
  warning_hours INTEGER DEFAULT 72,
  critical_hours INTEGER DEFAULT 24,
  
  -- Metadata
  created_at TEXT DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')),
  updated_at TEXT DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')),
  created_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_escalation_templates_org ON decision_escalation_templates(organization_id);

-- ---------------------------------------------------------------------
-- discount_codes
-- producent (plik martwy, nigdy nieuruchamiany): 091_payment_methods.sql
-- [PG] DATETIME -> TIMESTAMP
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS discount_codes (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    stripe_coupon_id TEXT,
    discount_type TEXT NOT NULL, -- percent, fixed_amount
    discount_value REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    max_uses INTEGER,
    current_uses INTEGER DEFAULT 0,
    valid_from TIMESTAMP,
    valid_until TIMESTAMP,
    applicable_plans TEXT, -- JSON array of plan IDs, null = all plans
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- dlp_policies
-- producent (plik martwy, nigdy nieuruchamiany): 236_security_module_extended.sql
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dlp_policies (
    id TEXT PRIMARY KEY,
    organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    policy_type TEXT NOT NULL CHECK(policy_type IN (
        'pii_detection', 'credit_card', 'ssn', 'api_key_exposure',
        'password_exposure', 'sensitive_data', 'file_upload', 'custom_regex'
    )),
    rules_json TEXT NOT NULL, -- JSON with detection rules
    enforcement_action TEXT NOT NULL DEFAULT 'warn' CHECK(enforcement_action IN ('warn', 'block', 'log_only', 'quarantine')),
    severity TEXT NOT NULL DEFAULT 'MEDIUM' CHECK(severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    is_active BOOLEAN DEFAULT TRUE,
    applies_to TEXT, -- JSON array of resource types or 'all'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_dlp_policies_org ON dlp_policies(organization_id);
CREATE INDEX IF NOT EXISTS idx_dlp_policies_type ON dlp_policies(policy_type);
CREATE INDEX IF NOT EXISTS idx_dlp_policies_active ON dlp_policies(is_active);

-- ---------------------------------------------------------------------
-- dlp_violations
-- producent (plik martwy, nigdy nieuruchamiany): 236_security_module_extended.sql
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dlp_violations (
    id TEXT PRIMARY KEY,
    policy_id TEXT REFERENCES dlp_policies(id) ON DELETE CASCADE,
    organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id),
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    resource_name TEXT,
    violation_type TEXT NOT NULL,
    matched_content TEXT, -- Redacted/masked content that triggered violation
    severity TEXT NOT NULL DEFAULT 'MEDIUM',
    action_taken TEXT NOT NULL,
    is_resolved BOOLEAN DEFAULT FALSE,
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    resolved_by TEXT REFERENCES users(id),
    resolution_notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_dlp_violations_policy ON dlp_violations(policy_id);
CREATE INDEX IF NOT EXISTS idx_dlp_violations_org ON dlp_violations(organization_id);
CREATE INDEX IF NOT EXISTS idx_dlp_violations_user ON dlp_violations(user_id);
CREATE INDEX IF NOT EXISTS idx_dlp_violations_resolved ON dlp_violations(is_resolved);
CREATE INDEX IF NOT EXISTS idx_dlp_violations_severity ON dlp_violations(severity);

-- ---------------------------------------------------------------------
-- escalation_rules
-- producent (plik martwy, nigdy nieuruchamiany): 295_unified_decisions.sql
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS escalation_rules (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    
    -- Context matching
    context_type TEXT, -- 'initiative', 'task', 'analysis', 'assessment', 'tool', NULL for all
    decision_type TEXT, -- 'INITIATIVE_APPROVAL', 'PHASE_TRANSITION', etc. NULL for all
    
    -- Thresholds (in days)
    amber_threshold_days INTEGER DEFAULT 5,
    red_threshold_days INTEGER DEFAULT 7,
    
    -- Actions
    auto_escalate INTEGER DEFAULT 1, -- 1 = auto-escalate to 'escalated' status when red
    notify_on_amber INTEGER DEFAULT 1, -- Send notification when amber threshold reached
    notify_on_red INTEGER DEFAULT 1, -- Send notification when red threshold reached
    
    -- Escalation path
    escalate_to_role TEXT, -- Role to escalate to (e.g., 'PMO', 'SPONSOR')
    escalate_to_user_id TEXT, -- Specific user to escalate to
    
    -- Status
    is_active INTEGER DEFAULT 1,
    priority INTEGER DEFAULT 0, -- Higher priority rules are applied first
    
    -- Audit
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_escalation_rules_org ON escalation_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_escalation_rules_context ON escalation_rules(context_type);
CREATE INDEX IF NOT EXISTS idx_escalation_rules_active ON escalation_rules(is_active);

-- ---------------------------------------------------------------------
-- feature_votes
-- producent (plik martwy, nigdy nieuruchamiany): 200_enterprise_feedback_system.sql
-- [PG] DATETIME -> TIMESTAMP
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feature_votes (
    id TEXT PRIMARY KEY,
    feature_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(feature_id, user_id),
    FOREIGN KEY (feature_id) REFERENCES feature_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_feature_votes_feature ON feature_votes(feature_id);
CREATE INDEX IF NOT EXISTS idx_feature_votes_user ON feature_votes(user_id);

-- ---------------------------------------------------------------------
-- feedback_analysis
-- producent (plik martwy, nigdy nieuruchamiany): 200_enterprise_feedback_system.sql
-- [PG] DATETIME -> TIMESTAMP
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feedback_analysis (
    id TEXT PRIMARY KEY,
    feedback_id TEXT NOT NULL,
    sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral', 'mixed')),
    sentiment_score REAL, -- -1 to 1
    categories_json TEXT, -- JSON array of categories
    keywords_json TEXT, -- JSON array of extracted keywords
    priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    priority_score INTEGER, -- 0-100
    similar_feedback_ids_json TEXT, -- JSON array of similar feedback IDs
    suggested_actions_json TEXT, -- JSON array of suggested actions
    ai_summary TEXT, -- One-line summary
    model_used TEXT, -- Which AI model was used
    analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (feedback_id) REFERENCES system_feedback(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_feedback_analysis_feedback ON feedback_analysis(feedback_id);
CREATE INDEX IF NOT EXISTS idx_feedback_analysis_sentiment ON feedback_analysis(sentiment);
CREATE INDEX IF NOT EXISTS idx_feedback_analysis_priority ON feedback_analysis(priority);
CREATE INDEX IF NOT EXISTS idx_feedback_analysis_analyzed ON feedback_analysis(analyzed_at);

-- ---------------------------------------------------------------------
-- feedback_comments
-- producent (plik martwy, nigdy nieuruchamiany): 015_enterprise_customers_module.sql
-- [PG] DATETIME -> TIMESTAMP
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feedback_comments (
    id TEXT PRIMARY KEY,
    feedback_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    comment_text TEXT NOT NULL,
    is_internal INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(feedback_id) REFERENCES feedback_items(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_feedback_comments_feedback ON feedback_comments(feedback_id);
CREATE INDEX IF NOT EXISTS idx_feedback_comments_user ON feedback_comments(user_id);

-- ---------------------------------------------------------------------
-- feedback_votes
-- producent (plik martwy, nigdy nieuruchamiany): 015_enterprise_customers_module.sql
-- [PG] DATETIME -> TIMESTAMP
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feedback_votes (
    id TEXT PRIMARY KEY,
    feedback_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    vote_type TEXT DEFAULT 'upvote',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(feedback_id) REFERENCES feedback_items(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(feedback_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_feedback_votes_feedback ON feedback_votes(feedback_id);
CREATE INDEX IF NOT EXISTS idx_feedback_votes_user ON feedback_votes(user_id);

-- ---------------------------------------------------------------------
-- help_feedback
-- producent (plik martwy, nigdy nieuruchamiany): 070_help_feedback.sql
-- [PG] DATETIME -> TIMESTAMP
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS help_feedback (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    organization_id TEXT,
    content_type TEXT NOT NULL CHECK (content_type IN ('module', 'card', 'faq', 'video')),
    content_id TEXT NOT NULL,
    is_helpful BOOLEAN,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    metadata TEXT, -- JSON: additional context
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_help_feedback_content ON help_feedback(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_help_feedback_user ON help_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_help_feedback_org ON help_feedback(organization_id);
CREATE INDEX IF NOT EXISTS idx_help_feedback_created ON help_feedback(created_at);

-- ---------------------------------------------------------------------
-- help_progress
-- producent (plik martwy, nigdy nieuruchamiany): 230_superadmin_overview_production.sql
-- [PG] DATETIME -> TIMESTAMP
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS help_progress (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT,
    playbook_key TEXT NOT NULL,
    step_index INTEGER DEFAULT 0,
    total_steps INTEGER NOT NULL DEFAULT 5,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completion_percentage INTEGER DEFAULT 0,
    UNIQUE(user_id, playbook_key)
);
CREATE INDEX IF NOT EXISTS idx_help_progress_playbook ON help_progress(playbook_key);
CREATE INDEX IF NOT EXISTS idx_help_progress_user ON help_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_help_progress_org ON help_progress(organization_id);

-- ---------------------------------------------------------------------
-- interview_context_exports
-- producent (plik martwy, nigdy nieuruchamiany): 295_interview_context.sql
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- invoice_templates
-- producent (plik martwy, nigdy nieuruchamiany): 150_billing_phase2.sql
-- [PG] DEFAULT (datetime('now')) -> DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')) [kolumna zostaje TEXT, format 1:1 jak w SQLite]
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoice_templates (
    id TEXT PRIMARY KEY,
    organization_id TEXT, -- NULL for system templates
    name TEXT NOT NULL,
    description TEXT,
    
    -- Template type
    template_type TEXT DEFAULT 'standard' CHECK(template_type IN ('standard', 'recurring', 'usage', 'credit_note', 'proforma', 'custom')),
    is_default INTEGER DEFAULT 0,
    is_system INTEGER DEFAULT 0, -- System templates cannot be edited/deleted
    
    -- Branding
    logo_url TEXT,
    header_html TEXT,
    footer_html TEXT,
    custom_css TEXT,
    
    -- Content sections
    show_company_info INTEGER DEFAULT 1,
    show_customer_info INTEGER DEFAULT 1,
    show_payment_terms INTEGER DEFAULT 1,
    show_due_date INTEGER DEFAULT 1,
    show_tax_breakdown INTEGER DEFAULT 1,
    show_currency_conversion INTEGER DEFAULT 0,
    
    -- Default values
    payment_terms_days INTEGER DEFAULT 30,
    default_currency TEXT DEFAULT 'USD',
    default_tax_rate REAL,
    default_notes TEXT,
    default_terms TEXT,
    
    -- Localization
    locale TEXT DEFAULT 'en',
    date_format TEXT DEFAULT 'YYYY-MM-DD',
    number_format TEXT DEFAULT 'en-US',
    
    -- Colors (hex)
    primary_color TEXT DEFAULT '#8B5CF6',
    secondary_color TEXT DEFAULT '#10B981',
    text_color TEXT DEFAULT '#1F2937',
    background_color TEXT DEFAULT '#FFFFFF',
    
    -- Layout
    layout_type TEXT DEFAULT 'modern' CHECK(layout_type IN ('classic', 'modern', 'minimal', 'detailed')),
    paper_size TEXT DEFAULT 'A4' CHECK(paper_size IN ('A4', 'Letter', 'Legal')),
    
    -- Metadata
    metadata TEXT, -- JSON for additional customizations
    
    created_at TEXT DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')),
    updated_at TEXT DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_invoice_templates_org ON invoice_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoice_templates_type ON invoice_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_invoice_templates_default ON invoice_templates(organization_id, is_default);

-- ---------------------------------------------------------------------
-- ip_access_rules
-- producent (plik martwy, nigdy nieuruchamiany): 134_advanced_security.sql
-- [PG] DATETIME -> TIMESTAMP
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ip_access_rules (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    organization_id TEXT,
    ip_address TEXT NOT NULL, -- Single IP or CIDR notation
    rule_type TEXT NOT NULL DEFAULT 'allow', -- 'allow' or 'block'
    description TEXT,
    is_active INTEGER DEFAULT 1,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_ip_access_rules_user ON ip_access_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_ip_access_rules_org ON ip_access_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_ip_access_rules_ip ON ip_access_rules(ip_address);

-- ---------------------------------------------------------------------
-- ip_whitelist
-- producent (plik martwy, nigdy nieuruchamiany): 258_advanced_security.sql
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ip_whitelist (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    
    -- Rule
    rule_type TEXT NOT NULL, -- 'ip', 'cidr', 'range'
    rule_value TEXT NOT NULL, -- IP address, CIDR block, or "start-end"
    description TEXT,
    
    -- Enforcement
    is_enabled INTEGER DEFAULT 1,
    bypass_for_admins INTEGER DEFAULT 1,
    
    -- Audit
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ip_whitelist_org ON ip_whitelist(organization_id);
CREATE INDEX IF NOT EXISTS idx_ip_whitelist_enabled ON ip_whitelist(is_enabled);

-- ---------------------------------------------------------------------
-- management_report_schedules
-- producent (plik martwy, nigdy nieuruchamiany): 062_management_reports.sql
-- [PG] DATETIME -> TIMESTAMP
-- [PG] BOOLEAN DEFAULT 1/0 -> BOOLEAN DEFAULT TRUE/FALSE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS management_report_schedules (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    project_id TEXT,
    report_type TEXT NOT NULL CHECK (report_type IN ('TEAM_MEETING', 'STEERING_COMMITTEE')),
    scope TEXT NOT NULL DEFAULT 'PROJECT' CHECK (scope IN ('PROJECT', 'PORTFOLIO')),
    frequency TEXT NOT NULL CHECK (frequency IN ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY')),
    day_of_week INTEGER,  -- 0=Sunday, 1=Monday, etc.
    day_of_month INTEGER, -- 1-31
    time_of_day TEXT DEFAULT '09:00',  -- HH:MM format
    timezone TEXT DEFAULT 'Europe/Warsaw',
    is_active BOOLEAN DEFAULT TRUE,
    last_generated_at TIMESTAMP,
    next_scheduled_at TIMESTAMP,
    recipients JSON,  -- Array of user_ids or emails
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_mrs_org ON management_report_schedules(organization_id);
CREATE INDEX IF NOT EXISTS idx_mrs_next ON management_report_schedules(next_scheduled_at);
CREATE INDEX IF NOT EXISTS idx_mrs_active ON management_report_schedules(is_active);

-- ---------------------------------------------------------------------
-- management_report_templates
-- producent (plik martwy, nigdy nieuruchamiany): 065_report_templates.sql
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS management_report_templates (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    report_type TEXT NOT NULL,                -- 'TEAM_MEETING' | 'STEERING_COMMITTEE'
    scope TEXT DEFAULT 'PORTFOLIO',           -- 'PROJECT' | 'PORTFOLIO'
    
    -- Template configuration
    sections JSON NOT NULL,                   -- Ordered list of sections with config
    default_period_days INTEGER DEFAULT 7,
    default_ai_enhancement BOOLEAN DEFAULT TRUE,
    default_approval_config JSON,
    
    -- Branding overrides
    custom_header_text TEXT,
    custom_footer_text TEXT,
    include_logo BOOLEAN DEFAULT TRUE,
    
    -- Export settings
    pdf_orientation TEXT DEFAULT 'portrait',  -- 'portrait' | 'landscape'
    pptx_theme TEXT DEFAULT 'professional',   -- 'professional' | 'modern' | 'minimal'
    
    -- Status
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Audit
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_mrt_org ON management_report_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_mrt_type ON management_report_templates(organization_id, report_type);
CREATE INDEX IF NOT EXISTS idx_mrt_default ON management_report_templates(organization_id, is_default);
CREATE INDEX IF NOT EXISTS idx_mrt_active ON management_report_templates(organization_id, is_active);

-- ---------------------------------------------------------------------
-- mcp_audit_logs
-- producent (plik martwy, nigdy nieuruchamiany): 105_user_integrations.sql
-- [PG] DATETIME -> TIMESTAMP
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mcp_audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    organization_id TEXT,
    tool_name TEXT,
    resource_path TEXT,
    prompt_name TEXT,
    request_json TEXT,
    response_json TEXT,
    success INTEGER DEFAULT 1,
    error_message TEXT,
    latency_ms INTEGER,
    tokens_used INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_user ON mcp_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_created ON mcp_audit_logs(created_at);

-- ---------------------------------------------------------------------
-- message_edits
-- producent (plik martwy, nigdy nieuruchamiany): 282_conversation_branches.sql
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS message_edits (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL REFERENCES conversation_messages(id) ON DELETE CASCADE,
    original_content TEXT NOT NULL,
    edited_content TEXT NOT NULL,
    edited_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_message_edits_message ON message_edits(message_id);

-- ---------------------------------------------------------------------
-- partner_payout_settings
-- producent (plik martwy, nigdy nieuruchamiany): 217_partner_discount_system.sql
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partner_payout_settings (
    id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    minimum_threshold REAL NOT NULL DEFAULT 100.00,
    payout_schedule TEXT NOT NULL DEFAULT 'MONTHLY' CHECK (payout_schedule IN ('WEEKLY', 'BIWEEKLY', 'MONTHLY')),
    processing_fee_percent REAL DEFAULT 1.00,
    auto_payout_enabled BOOLEAN DEFAULT FALSE,
    payment_methods TEXT DEFAULT '["BANK_TRANSFER"]', -- JSON array
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- pinned_prompts
-- producent (plik martwy, nigdy nieuruchamiany): 074_pinned_prompts.sql
-- [PG] DATETIME -> TIMESTAMP
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pinned_prompts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT,
    prompt TEXT NOT NULL,
    label TEXT,
    category TEXT DEFAULT 'general',
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_pinned_prompts_user ON pinned_prompts(user_id);
CREATE INDEX IF NOT EXISTS idx_pinned_prompts_org ON pinned_prompts(organization_id);
CREATE INDEX IF NOT EXISTS idx_pinned_prompts_usage ON pinned_prompts(user_id, usage_count DESC);

-- ---------------------------------------------------------------------
-- pmo_role_definitions
-- producent (plik martwy, nigdy nieuruchamiany): 060_work_dimensions.sql
-- [PG] DATETIME -> TIMESTAMP
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pmo_role_definitions (
    id TEXT PRIMARY KEY,
    
    -- Role identity
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    name_pl TEXT,
    
    -- PMO Standards mapping
    prince2_role TEXT,
    pmbok_role TEXT,
    iso21500_reference TEXT,
    
    -- Hierarchy (0=Executive, 1=Manager, 2=Lead, 3=Member, 4=Stakeholder)
    level INTEGER DEFAULT 0,
    reports_to_code TEXT,
    
    -- Default capabilities (JSON array)
    default_capabilities TEXT DEFAULT '[]',
    
    -- Configuration
    is_required BOOLEAN DEFAULT FALSE,
    max_per_project INTEGER,
    can_be_external BOOLEAN DEFAULT FALSE,
    
    -- Descriptions
    description TEXT,
    description_pl TEXT,
    
    -- System flag (TRUE=built-in, FALSE=custom)
    is_system BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pmo_roles_code ON pmo_role_definitions(code);
CREATE INDEX IF NOT EXISTS idx_pmo_roles_level ON pmo_role_definitions(level);

-- ---------------------------------------------------------------------
-- pmo_standards
-- producent (plik martwy, nigdy nieuruchamiany): 245_project_enhancements.sql
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pmo_standards (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- pricing_plan_features
-- producent (plik martwy, nigdy nieuruchamiany): 234_revenue_module_complete.sql
-- [PG] DEFAULT (datetime('now')) -> DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')) [kolumna zostaje TEXT, format 1:1 jak w SQLite]
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pricing_plan_features (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL,
    
    -- Feature info
    feature_key TEXT NOT NULL,
    feature_name TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    
    -- Value
    feature_value TEXT, -- can be number, text, or 'unlimited'
    is_included INTEGER DEFAULT 1,
    
    -- Display
    display_order INTEGER DEFAULT 0,
    tooltip TEXT,
    
    -- Audit
    created_at TEXT DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')),
    updated_at TEXT DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')),
    
    FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE CASCADE,
    UNIQUE(plan_id, feature_key)
);
CREATE INDEX IF NOT EXISTS idx_pricing_plan_features_plan ON pricing_plan_features(plan_id);
CREATE INDEX IF NOT EXISTS idx_pricing_plan_features_category ON pricing_plan_features(category);

-- ---------------------------------------------------------------------
-- project_budgets
-- producent (plik martwy, nigdy nieuruchamiany): 063_project_kpis.sql
-- [PG] DATETIME -> TIMESTAMP
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_budgets (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL UNIQUE,
    
    -- Budget amounts
    planned_budget REAL,
    actual_spend REAL DEFAULT 0,
    committed_spend REAL DEFAULT 0,
    forecast_at_completion REAL,
    
    -- Variance tracking
    variance_percent REAL DEFAULT 0,
    contingency_budget REAL DEFAULT 0,
    contingency_used REAL DEFAULT 0,
    
    -- Period tracking
    current_period_budget REAL,
    current_period_actual REAL,
    
    -- Currency
    currency TEXT DEFAULT 'USD',
    
    -- Budget categories breakdown (JSON)
    category_breakdown TEXT, -- JSON: {"labor": 50000, "materials": 20000, "contractors": 30000}
    
    -- Historical snapshots (JSON array)
    monthly_snapshots TEXT, -- JSON array: [{"month": "2024-01", "planned": 10000, "actual": 9500}, ...]
    
    -- Timestamps
    last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_project_budgets_project ON project_budgets(project_id);

-- ---------------------------------------------------------------------
-- project_kpis
-- producent (plik martwy, nigdy nieuruchamiany): 063_project_kpis.sql
-- [PG] DATETIME -> TIMESTAMP
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_kpis (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- 'SCHEDULE', 'BUDGET', 'QUALITY', 'SCOPE', 'RISK', 'RESOURCES', 'CUSTOM'
    description TEXT,
    
    -- Target and current values
    target_value REAL,
    current_value REAL,
    baseline_value REAL,
    unit TEXT, -- '%', 'days', 'count', '$', 'hours', etc.
    
    -- Thresholds for RAG status
    green_threshold REAL,
    amber_threshold REAL,
    red_threshold REAL,
    threshold_direction TEXT DEFAULT 'HIGHER_IS_BETTER', -- 'HIGHER_IS_BETTER' or 'LOWER_IS_BETTER'
    
    -- Trend and historical data (JSON array of {date, value})
    historical_values TEXT, -- JSON array: [{"date": "2024-01-01", "value": 75}, ...]
    trend TEXT DEFAULT 'STABLE', -- 'IMPROVING', 'STABLE', 'DECLINING'
    
    -- Ownership
    owner_id TEXT,
    
    -- Display options
    display_order INTEGER DEFAULT 0,
    show_sparkline INTEGER DEFAULT 1,
    show_target INTEGER DEFAULT 1,
    
    -- Status
    status TEXT DEFAULT 'ACTIVE', -- 'ACTIVE', 'ARCHIVED', 'DRAFT'
    
    -- Timestamps
    last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_project_kpis_project ON project_kpis(project_id);
CREATE INDEX IF NOT EXISTS idx_project_kpis_category ON project_kpis(category);
CREATE INDEX IF NOT EXISTS idx_project_kpis_status ON project_kpis(status);

-- ---------------------------------------------------------------------
-- project_role_assignments
-- producent (plik martwy, nigdy nieuruchamiany): 245_project_enhancements.sql
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- scheduled_events
-- producent (plik martwy, nigdy nieuruchamiany): 229_admin_overview_seed.sql
-- [PG] DATETIME -> TIMESTAMP
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scheduled_events (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    event_type TEXT,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    location TEXT,
    is_all_day INTEGER DEFAULT 0,
    status TEXT DEFAULT 'SCHEDULED',
    project_id TEXT,
    attendees TEXT DEFAULT '[]',
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_scheduled_events_org ON scheduled_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_events_start ON scheduled_events(start_time);

-- ---------------------------------------------------------------------
-- security_settings
-- producent (plik martwy, nigdy nieuruchamiany): 101_security_sessions.sql
-- [PG] DEFAULT (datetime('now')) -> DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')) [kolumna zostaje TEXT, format 1:1 jak w SQLite]
-- [PG] UWAGA: istnieje tez wariant 101_security_sessions_postgres.sql, ale deklaruje
--      organization_id/updated_by jako UUID, co jest niekompatybilne z organizations.id
--      i users.id typu text w schemacie od zera. Zrodlem jest 101_security_sessions.sql (TEXT).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS security_settings (
    organization_id TEXT PRIMARY KEY,
    require_2fa INTEGER DEFAULT 0,
    password_min_length INTEGER DEFAULT 8,
    password_require_uppercase INTEGER DEFAULT 1,
    password_require_number INTEGER DEFAULT 1,
    password_require_special INTEGER DEFAULT 0,
    password_expiry_days INTEGER DEFAULT 0,
    session_timeout_minutes INTEGER DEFAULT 480,
    max_sessions_per_user INTEGER DEFAULT 5,
    ip_whitelist TEXT,
    updated_at TEXT DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')),
    updated_by TEXT,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- sms_delivery_log
-- producent (plik martwy, nigdy nieuruchamiany): 107_sms_mfa.sql
-- [PG] DEFAULT (datetime('now')) -> DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')) [kolumna zostaje TEXT, format 1:1 jak w SQLite]
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sms_delivery_log (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    phone_number TEXT NOT NULL,
    message_type TEXT NOT NULL, -- 'verification', 'mfa', 'alert'
    message_sid TEXT, -- Twilio message SID
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'delivered', 'failed', 'undelivered')),
    error_code TEXT,
    error_message TEXT,
    provider TEXT DEFAULT 'twilio',
    created_at TEXT DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')),
    updated_at TEXT DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_sms_log_user ON sms_delivery_log(user_id);
CREATE INDEX IF NOT EXISTS idx_sms_log_phone ON sms_delivery_log(phone_number);
CREATE INDEX IF NOT EXISTS idx_sms_log_status ON sms_delivery_log(status);

-- ---------------------------------------------------------------------
-- sms_rate_limits
-- producent (plik martwy, nigdy nieuruchamiany): 107_sms_mfa.sql
-- [PG] DEFAULT (datetime('now')) -> DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')) [kolumna zostaje TEXT, format 1:1 jak w SQLite]
-- [PG] INTEGER PRIMARY KEY AUTOINCREMENT -> BIGSERIAL PRIMARY KEY
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sms_rate_limits (
    id BIGSERIAL PRIMARY KEY,
    phone_number TEXT NOT NULL,
    user_id TEXT,
    count INTEGER DEFAULT 1,
    window_start TEXT DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')),
    UNIQUE(phone_number, window_start)
);
CREATE INDEX IF NOT EXISTS idx_sms_rate_phone ON sms_rate_limits(phone_number);

-- ---------------------------------------------------------------------
-- sms_verification_codes
-- producent (plik martwy, nigdy nieuruchamiany): 107_sms_mfa.sql
-- [PG] DEFAULT (datetime('now')) -> DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')) [kolumna zostaje TEXT, format 1:1 jak w SQLite]
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sms_verification_codes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    code TEXT NOT NULL, -- Hashed 6-digit code
    purpose TEXT NOT NULL CHECK(purpose IN ('phone_verify', 'mfa_login', 'mfa_setup', 'password_reset')),
    expires_at TEXT NOT NULL,
    used_at TEXT,
    attempts INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sms_codes_user ON sms_verification_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_sms_codes_phone ON sms_verification_codes(phone_number);
CREATE INDEX IF NOT EXISTS idx_sms_codes_expires ON sms_verification_codes(expires_at);

-- ---------------------------------------------------------------------
-- superadmin_audit_log
-- producent (plik martwy, nigdy nieuruchamiany): 232_configuration_module_tables.sql
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS superadmin_audit_log (
    id TEXT PRIMARY KEY,
    admin_user_id TEXT NOT NULL,
    admin_email TEXT,
    action TEXT NOT NULL, -- 'settings_update', 'branding_change', 'user_create', etc.
    entity_type TEXT, -- 'settings', 'branding', 'user', 'organization', 'legal'
    entity_id TEXT,
    old_value TEXT, -- JSON of previous state
    new_value TEXT, -- JSON of new state
    ip_address TEXT,
    user_agent TEXT,
    metadata TEXT DEFAULT '{}', -- Additional context JSON
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_superadmin_audit_admin ON superadmin_audit_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_superadmin_audit_action ON superadmin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_superadmin_audit_entity ON superadmin_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_superadmin_audit_created ON superadmin_audit_log(created_at);

-- ---------------------------------------------------------------------
-- tax_rates
-- producent (plik martwy, nigdy nieuruchamiany): 150_billing_phase2.sql
-- [PG] DEFAULT (datetime('now')) -> DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')) [kolumna zostaje TEXT, format 1:1 jak w SQLite]
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tax_rates (
    id TEXT PRIMARY KEY,
    stripe_tax_rate_id TEXT,
    
    -- Basic info
    display_name TEXT NOT NULL,
    description TEXT,
    jurisdiction TEXT, -- Country or state code
    jurisdiction_level TEXT CHECK(jurisdiction_level IN ('country', 'state', 'county', 'city', 'district')),
    
    -- Rate info
    percentage REAL NOT NULL, -- Tax rate as percentage (e.g., 23.0 for 23%)
    inclusive INTEGER DEFAULT 0, -- Whether tax is included in price
    
    -- Type
    tax_type TEXT NOT NULL CHECK(tax_type IN ('vat', 'gst', 'hst', 'pst', 'sales_tax', 'withholding', 'other')),
    
    -- Applicability
    country TEXT, -- ISO country code
    state TEXT, -- State/province code
    postal_codes TEXT, -- JSON array of applicable postal codes
    product_categories TEXT, -- JSON array of applicable product categories
    
    -- Status
    is_active INTEGER DEFAULT 1,
    effective_from TEXT,
    effective_until TEXT,
    
    -- Stripe Tax integration
    stripe_tax_code TEXT, -- Stripe Tax code for automatic calculation
    automatic_tax INTEGER DEFAULT 0, -- Use Stripe Tax for automatic calculation
    
    created_at TEXT DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')),
    updated_at TEXT DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'))
);
CREATE INDEX IF NOT EXISTS idx_tax_rates_jurisdiction ON tax_rates(country, state);
CREATE INDEX IF NOT EXISTS idx_tax_rates_type ON tax_rates(tax_type);
CREATE INDEX IF NOT EXISTS idx_tax_rates_active ON tax_rates(is_active);

-- ---------------------------------------------------------------------
-- threat_intelligence
-- producent (plik martwy, nigdy nieuruchamiany): 236_security_module_extended.sql
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS threat_intelligence (
    id TEXT PRIMARY KEY,
    organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    threat_type TEXT NOT NULL CHECK(threat_type IN ('ip', 'domain', 'email', 'hash', 'url')),
    indicator TEXT NOT NULL, -- The actual IP, domain, email, hash, or URL
    threat_level TEXT NOT NULL DEFAULT 'MEDIUM' CHECK(threat_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    reputation_score INTEGER DEFAULT 50 CHECK(reputation_score >= 0 AND reputation_score <= 100),
    source TEXT, -- 'internal', 'abuseipdb', 'virustotal', 'manual', etc.
    description TEXT,
    tags TEXT, -- JSON array of tags
    first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_blocked BOOLEAN DEFAULT FALSE,
    blocked_at TIMESTAMP,
    blocked_by TEXT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_threat_intel_org ON threat_intelligence(organization_id);
CREATE INDEX IF NOT EXISTS idx_threat_intel_type ON threat_intelligence(threat_type);
CREATE INDEX IF NOT EXISTS idx_threat_intel_indicator ON threat_intelligence(indicator);
CREATE INDEX IF NOT EXISTS idx_threat_intel_blocked ON threat_intelligence(is_blocked);
CREATE INDEX IF NOT EXISTS idx_threat_intel_level ON threat_intelligence(threat_level);

-- ---------------------------------------------------------------------
-- user_activity_summary
-- producent (plik martwy, nigdy nieuruchamiany): 015_enterprise_customers_module.sql
-- [PG] DATETIME -> TIMESTAMP
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_activity_summary (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    login_count INTEGER DEFAULT 0,
    last_login_at TIMESTAMP,
    ai_interactions INTEGER DEFAULT 0,
    tasks_created INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    projects_accessed INTEGER DEFAULT 0,
    features_used_json TEXT DEFAULT '[]',
    engagement_score REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    UNIQUE(user_id, organization_id, period_start)
);
CREATE INDEX IF NOT EXISTS idx_user_activity_summary_user ON user_activity_summary(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_summary_org ON user_activity_summary(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_period ON user_activity_summary(period_start DESC);

-- ---------------------------------------------------------------------
-- user_adoption_metrics
-- producent (plik martwy, nigdy nieuruchamiany): 015_enterprise_customers_module.sql
-- [PG] DATETIME -> TIMESTAMP
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_adoption_metrics (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    metric_date DATE NOT NULL,
    features_used_json TEXT DEFAULT '[]',
    playbooks_completed INTEGER DEFAULT 0,
    ai_interactions INTEGER DEFAULT 0,
    login_frequency INTEGER DEFAULT 0,
    engagement_score REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    UNIQUE(user_id, organization_id, metric_date)
);
CREATE INDEX IF NOT EXISTS idx_user_adoption_user ON user_adoption_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_adoption_org ON user_adoption_metrics(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_adoption_date ON user_adoption_metrics(metric_date DESC);

-- ---------------------------------------------------------------------
-- user_ai_preferences
-- producent (plik martwy, nigdy nieuruchamiany): 207_user_ai_preferences.sql
-- [PG] DATETIME -> TIMESTAMP
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_ai_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    preferences TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_user_ai_preferences_user_id ON user_ai_preferences (user_id);
CREATE INDEX IF NOT EXISTS idx_user_ai_preferences_updated ON user_ai_preferences (updated_at);

-- ---------------------------------------------------------------------
-- user_ai_profiles
-- producent (plik martwy, nigdy nieuruchamiany): add_response_feedback.sql
-- [PG] DATETIME -> TIMESTAMP
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_ai_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    
    -- Response mode preferences
    response_mode_preference TEXT DEFAULT 'standard' 
        CHECK(response_mode_preference IN ('quick', 'standard', 'deepStudy')),
    
    -- Length preferences per mode
    quick_length_preference TEXT DEFAULT 'short'
        CHECK(quick_length_preference IN ('ultra_short', 'short', 'medium')),
    standard_length_preference TEXT DEFAULT 'medium'
        CHECK(standard_length_preference IN ('short', 'medium', 'long')),
    deep_study_length_preference TEXT DEFAULT 'long'
        CHECK(deep_study_length_preference IN ('medium', 'long', 'comprehensive')),
    
    -- Auto-detect intent toggle
    auto_detect_intent INTEGER DEFAULT 1,
    
    -- Formatting preferences
    prefer_bullet_points INTEGER DEFAULT 1,
    prefer_tables INTEGER DEFAULT 0,
    prefer_action_items INTEGER DEFAULT 1,
    include_examples TEXT DEFAULT 'minimal'
        CHECK(include_examples IN ('none', 'minimal', 'detailed')),
    
    -- Feedback tracking
    feedback_count INTEGER DEFAULT 0,
    positive_feedback_count INTEGER DEFAULT 0,
    satisfaction_score REAL DEFAULT 0.0,
    last_feedback_at TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_ai_profiles_user ON user_ai_profiles(user_id);

-- ---------------------------------------------------------------------
-- user_groups
-- producent (plik martwy, nigdy nieuruchamiany): 015_enterprise_customers_module.sql
-- [PG] DATETIME -> TIMESTAMP
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    group_type TEXT,
    organization_id TEXT,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_user_groups_org ON user_groups(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_groups_type ON user_groups(group_type);

-- ---------------------------------------------------------------------
-- user_group_members
-- producent (plik martwy, nigdy nieuruchamiany): 015_enterprise_customers_module.sql
-- [PG] DATETIME -> TIMESTAMP
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_group_members (
    group_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT DEFAULT 'member',
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    added_by TEXT,
    PRIMARY KEY(group_id, user_id),
    FOREIGN KEY(group_id) REFERENCES user_groups(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(added_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_user_group_members_group ON user_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_user_group_members_user ON user_group_members(user_id);

-- ---------------------------------------------------------------------
-- user_onboarding_progress
-- producent (plik martwy, nigdy nieuruchamiany): 015_enterprise_customers_module.sql
-- [PG] DATETIME -> TIMESTAMP
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_onboarding_progress (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    step_key TEXT NOT NULL,
    step_name TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    completed_at TIMESTAMP,
    skipped INTEGER DEFAULT 0,
    skipped_at TIMESTAMP,
    progress_data TEXT DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    UNIQUE(user_id, organization_id, step_key)
);
CREATE INDEX IF NOT EXISTS idx_user_onboarding_progress_user ON user_onboarding_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_onboarding_progress_org ON user_onboarding_progress(organization_id);

-- ---------------------------------------------------------------------
-- user_profiles
-- producent (plik martwy, nigdy nieuruchamiany): 015_enterprise_customers_module.sql
-- [PG] DATETIME -> TIMESTAMP
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    job_title TEXT,
    department TEXT,
    phone TEXT,
    timezone TEXT DEFAULT 'UTC',
    locale TEXT DEFAULT 'en',
    avatar_url TEXT,
    bio TEXT,
    linkedin_url TEXT,
    github_url TEXT,
    website_url TEXT,
    skills_json TEXT DEFAULT '[]',
    certifications_json TEXT DEFAULT '[]',
    preferences_json TEXT DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user ON user_profiles(user_id);

-- ---------------------------------------------------------------------
-- vat_validations
-- producent (plik martwy, nigdy nieuruchamiany): 150_billing_phase2.sql
-- [PG] DEFAULT (datetime('now')) -> DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')) [kolumna zostaje TEXT, format 1:1 jak w SQLite]
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vat_validations (
    id TEXT PRIMARY KEY,
    vat_number TEXT NOT NULL,
    country_code TEXT NOT NULL,
    is_valid INTEGER NOT NULL,
    company_name TEXT,
    company_address TEXT,
    validated_at TEXT DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')),
    expires_at TEXT, -- Cache expiry
    validation_source TEXT DEFAULT 'vies', -- vies, stripe, manual
    raw_response TEXT, -- JSON
    UNIQUE(vat_number, country_code)
);
CREATE INDEX IF NOT EXISTS idx_vat_validations_number ON vat_validations(vat_number);
CREATE INDEX IF NOT EXISTS idx_vat_validations_expires ON vat_validations(expires_at);

-- =====================================================================
-- CZESC 2 — BRAKUJACE KOLUMNY na istniejacych tabelach
-- =====================================================================
-- Wszystkie ponizsze kolumny sa klasy ONLY_DEAD: ich DDL istnieje wylacznie
-- w plikach, ktorych runner nigdy nie uruchamia. FK z producentow sa tu
-- SWIADOMIE POMIJANE — ALTER TABLE ADD COLUMN + FOREIGN KEY na zywej bazie
-- demo/staging walidowalby cala istniejaca zawartosc tabeli; brak FK na
-- dodanej kolumnie jest bezpieczniejszy niz migracja, ktora moze paść.

-- ---------------------------------------------------------------------
-- organizations — budzet i zuzycie zasobow
-- producent (plik martwy): 000_initdb_core_tables.sql
-- ---------------------------------------------------------------------
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS monthly_budget_usd REAL;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS budget_spent_current_period REAL DEFAULT 0;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS budget_alert_threshold REAL DEFAULT 0.8;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS budget_period_start TIMESTAMP;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS memory_usage_mb_current INTEGER DEFAULT 0;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS cpu_usage_percent_avg REAL DEFAULT 0;

-- ---------------------------------------------------------------------
-- subscription_plans — limity planu
-- producent (plik martwy): 000_initdb_core_tables.sql
--   (token_limit dodatkowo w 067b_subscription_plans_token_limit.sql — tez martwy)
-- ---------------------------------------------------------------------
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS token_limit INTEGER;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS storage_limit_gb REAL;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS memory_limit_mb INTEGER;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS cpu_quota_percent REAL;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_concurrent_ai_jobs INTEGER;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS token_overage_rate REAL;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS storage_overage_rate REAL;

-- ---------------------------------------------------------------------
-- organization_billing — identyfikatory Stripe i okres rozliczeniowy
-- producent (plik martwy): 000_initdb_core_tables.sql
-- ---------------------------------------------------------------------
ALTER TABLE organization_billing ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE organization_billing ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE organization_billing ADD COLUMN IF NOT EXISTS billing_email TEXT;
ALTER TABLE organization_billing ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMP;
ALTER TABLE organization_billing ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP;

-- ---------------------------------------------------------------------
-- knowledge_chunks — metadane chunka RAG
-- producent (plik martwy): 266_knowledge_rag.sql
-- ---------------------------------------------------------------------
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS section_title TEXT;
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS metadata TEXT DEFAULT '{}';

-- ---------------------------------------------------------------------
-- initiative_status_history — znacznik czasu zmiany statusu
-- producent (plik martwy): 061_initiative_lifecycle.sql
-- [PG] DATETIME DEFAULT CURRENT_TIMESTAMP -> TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- ---------------------------------------------------------------------
ALTER TABLE initiative_status_history ADD COLUMN IF NOT EXISTS changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- ---------------------------------------------------------------------
-- ai_playbook_templates — kategoria tresci
-- producent (plik martwy): 000_initdb_core_tables.sql / 047_content_module_enterprise.sql
-- FK do content_categories(id) POMINIETY swiadomie (patrz naglowek Czesci 2).
-- ---------------------------------------------------------------------
ALTER TABLE ai_playbook_templates ADD COLUMN IF NOT EXISTS category_id TEXT;

-- ---------------------------------------------------------------------
-- email_templates — schemat zmiennych szablonu
-- producent (plik martwy): 047_content_module_enterprise.sql
-- ---------------------------------------------------------------------
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS variables_schema TEXT DEFAULT '{}';

-- ---------------------------------------------------------------------
-- kb_articles — cykl zycia artykulu Help
-- producent: 20260409_p25d_help_seed_and_lifecycle.sql
-- UWAGA: to NIE jest plik <500. Jest wykluczony przez inna galaz tego samego
-- filtra — nazwa zawiera "seed" — mimo ze plik niesie DDL, nie tylko dane.
-- Kolumny dostaja sie na baze wylacznie przez runner bootowy aplikacji, wiec
-- w lancuchu wdrozeniowym (release-migration-gate) sa taka sama luka.
-- ---------------------------------------------------------------------
ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS last_reviewed_at TEXT DEFAULT NULL;
ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS content_owner TEXT DEFAULT NULL;
ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS redirect_to_slug TEXT DEFAULT NULL;
ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
