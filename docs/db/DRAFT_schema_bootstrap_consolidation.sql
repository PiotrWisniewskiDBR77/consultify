-- ============================================================================
-- DRAFT — generated, NOT auto-run.
--
-- This file re-issues DDL for 194 tables that are referenced by server/src but
-- defined only in migration files the canonical Postgres runner SKIPS (version<500,
-- .sql.sql double-extension, 000_initdb_*, sqlite-only). On a fresh Postgres those
-- tables are never created. See docs/audit/2026-06-03/schema-bootstrap-orphans.md.
--
-- SAFETY: This file lives in docs/db/ — OUTSIDE server/migrations/ — so NEITHER
-- runner scans it (app-startup regex /^(7\d{2}|\d{8})_/ AND migrate.postgres.ts
-- readdir(server/migrations) both miss it). It is PARKED reference only; it will
-- NOT be applied automatically. (NOTE: a leading-underscore name INSIDE
-- server/migrations/ would still be RUN by migrate.postgres.ts, since its skip
-- rules don't catch non-numeric prefixes — that is why this lives in docs/db/.)
--
-- TO ACTIVATE (do TOGETHER, test phase): validate against staging Postgres, then
-- MOVE into server/migrations/ with an 8-digit date prefix
-- (e.g. 20260604_schema_bootstrap_consolidation.sql) so the runner applies it.
--
-- Every statement is IDEMPOTENT (CREATE TABLE/INDEX IF NOT EXISTS). sqlite-isms
-- have been Postgres-normalized: DATETIME->TIMESTAMPTZ, datetime('now')->
-- CURRENT_TIMESTAMP, TEXT/DATETIME DEFAULT (datetime('now'))->TIMESTAMPTZ DEFAULT
-- CURRENT_TIMESTAMP, INTEGER PRIMARY KEY AUTOINCREMENT->SERIAL PRIMARY KEY,
-- strftime(...)->CURRENT_TIMESTAMP, backticks removed. Boolean INTEGER flags are
-- intentionally left as INTEGER.
--
-- NOTE: FOREIGN KEY clauses are preserved as-authored. They assume referenced
-- parent tables (organizations, users, projects, etc.) already exist via
-- 000_z_core_baseline + the modern migration set. Validate FK targets on staging.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- DOMAIN: AI / Memory / Prompts / Learning
-- ----------------------------------------------------------------------------

-- ai_actions_config  (source: 250_ai_memory_system.sql)
CREATE TABLE IF NOT EXISTS ai_actions_config (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    project_id TEXT, -- NULL for org-wide config
    
    -- Allowed actions (JSON)
    allowed_actions TEXT DEFAULT '{"suggestInitiatives":true,"createDraftInitiatives":false,"createTasks":false,"assignTasks":false,"updateTaskStatus":false,"createDecisionRequests":false,"makeRecommendations":true,"sendNotifications":false,"modifyBudgets":false,"approveItems":false}',
    
    -- Approval requirements (JSON)
    approval_required TEXT DEFAULT '{"createInitiatives":true,"createTasks":true,"assignTasks":true}',
    
    -- Autonomy level
    autonomy_level TEXT DEFAULT 'advisory', -- 'advisory', 'assisted', 'autonomous'
    
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(organization_id, project_id)
);
CREATE INDEX IF NOT EXISTS idx_ai_actions_config_org ON ai_actions_config(organization_id);

-- ai_org_memory  (source: 250_ai_memory_system.sql)
CREATE TABLE IF NOT EXISTS ai_org_memory (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL UNIQUE,
    
    -- Company context
    industry TEXT,
    company_size TEXT,
    company_context TEXT, -- JSON with strategic context
    
    -- Terminology
    terminology TEXT, -- JSON: {term: definition}
    
    -- Learning
    decision_patterns TEXT, -- JSON array of learned patterns
    common_queries TEXT, -- JSON array of frequent query types
    
    -- Assessment history
    assessment_summary TEXT, -- JSON with assessment findings
    
    -- AI Maturity stage
    ai_maturity_stage TEXT DEFAULT 'sceptic', -- 'sceptic', 'partner', 'autonomy'
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ai_org_memory_org ON ai_org_memory(organization_id);

-- ai_user_memory  (source: 250_ai_memory_system.sql)
CREATE TABLE IF NOT EXISTS ai_user_memory (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    
    -- Preferences
    preferences TEXT, -- JSON: {language, detailLevel, communicationStyle}
    
    -- Context
    expertise TEXT, -- JSON array of expertise areas
    recent_topics TEXT, -- JSON array of recent conversation topics
    assigned_projects TEXT, -- JSON array of project IDs
    
    -- Interaction stats
    interaction_count INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0,
    avg_response_rating REAL,
    
    -- Timestamps
    last_interaction_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ai_user_memory_user ON ai_user_memory(user_id);

-- ai_learning_patterns  (source: 251_ai_learning_system.sql)
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

-- ai_ab_assignments  (source: 052_ab_testing.sql)
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

-- ai_ab_experiments  (source: 052_ab_testing.sql)
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

-- ai_ab_outcomes  (source: 052_ab_testing.sql)
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

-- ai_prompt_blocks  (source: 210_ai_system_prompts.sql)
CREATE TABLE IF NOT EXISTS ai_prompt_blocks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'general',
    content TEXT NOT NULL,
    variables TEXT, -- JSON array
    is_active BOOLEAN DEFAULT TRUE,
    usage_count INTEGER DEFAULT 0,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_prompt_blocks_category ON ai_prompt_blocks(category);
CREATE INDEX IF NOT EXISTS idx_prompt_blocks_active ON ai_prompt_blocks(is_active);

-- ai_prompt_versions  (source: 210_ai_system_prompts.sql)
CREATE TABLE IF NOT EXISTS ai_prompt_versions (
    id TEXT PRIMARY KEY,
    prompt_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    content TEXT NOT NULL,
    system_prompt TEXT,
    user_prompt_template TEXT,
    change_reason TEXT,
    changed_by TEXT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (prompt_id) REFERENCES ai_system_prompts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_prompt ON ai_prompt_versions(prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_version ON ai_prompt_versions(prompt_id, version);

-- ai_response_feedback  (source: add_response_feedback.sql)
CREATE TABLE IF NOT EXISTS ai_response_feedback (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    conversation_id TEXT,
    
    -- Core feedback
    rating TEXT CHECK(rating IN ('positive', 'negative', 'neutral')),
    
    -- Length assessment
    length_feedback TEXT CHECK(length_feedback IN ('too_short', 'just_right', 'too_long')),
    
    -- Detail assessment
    detail_feedback TEXT CHECK(detail_feedback IN ('needs_more_detail', 'good_detail', 'too_detailed')),
    
    -- Format assessment
    format_feedback TEXT CHECK(format_feedback IN ('needs_structure', 'good_format', 'too_complex')),
    
    -- What user wanted
    wanted_mode TEXT CHECK(wanted_mode IN ('quick', 'standard', 'deepStudy')),
    
    -- Free-form feedback
    custom_feedback TEXT,
    
    -- Context
    response_mode_used TEXT CHECK(response_mode_used IN ('quick', 'standard', 'deepStudy')),
    response_length_actual INTEGER,
    capability_used TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_response_feedback_user ON ai_response_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_response_feedback_rating ON ai_response_feedback(rating);
CREATE INDEX IF NOT EXISTS idx_response_feedback_created ON ai_response_feedback(created_at);

-- ai_settings_audit  (source: 090_ai_settings_system.sql.sql)
CREATE TABLE IF NOT EXISTS ai_settings_audit (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Level & Actor
    level TEXT NOT NULL CHECK (level IN ('superadmin', 'admin', 'user')),
    actor_id TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    
    -- Target & Change
    target_id TEXT NOT NULL, -- orgId or userId or 'global'
    setting_key TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    
    -- Request Metadata
    ip_address TEXT,
    user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_ai_settings_audit_level ON ai_settings_audit(level);
CREATE INDEX IF NOT EXISTS idx_ai_settings_audit_timestamp ON ai_settings_audit(timestamp);
CREATE INDEX IF NOT EXISTS idx_ai_settings_audit_target ON ai_settings_audit(target_id);
CREATE INDEX IF NOT EXISTS idx_ai_settings_audit_actor ON ai_settings_audit(actor_id);

-- ai_style_learning_patterns  (source: 285_user_style_profiles.sql)
CREATE TABLE IF NOT EXISTS ai_style_learning_patterns (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    organization_id TEXT,
    
    -- Pattern details
    pattern_type TEXT NOT NULL, -- 'length_preference', 'format_preference', 'depth_preference', 'context_specific'
    pattern_key TEXT NOT NULL,
    pattern_value TEXT NOT NULL,
    
    -- Confidence and frequency
    occurrence_count INTEGER DEFAULT 1,
    confidence_score REAL DEFAULT 0.5,
    
    -- Context where pattern was detected
    detected_in_context TEXT,
    
    -- Status
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'applied', 'rejected', 'expired')),
    applied_at TEXT,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_style_patterns_user ON ai_style_learning_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_style_patterns_type ON ai_style_learning_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_style_patterns_status ON ai_style_learning_patterns(status);

-- ai_user_style_profiles  (source: 285_user_style_profiles.sql)
CREATE TABLE IF NOT EXISTS ai_user_style_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    organization_id TEXT,
    
    -- Communication Preferences (user-configurable)
    preferred_depth TEXT DEFAULT 'balanced' CHECK(preferred_depth IN ('executive_summary', 'balanced', 'deep_dive')),
    preferred_format TEXT DEFAULT 'structured' CHECK(preferred_format IN ('bullets', 'paragraphs', 'structured', 'conversational')),
    technical_level TEXT DEFAULT 'intermediate' CHECK(technical_level IN ('beginner', 'intermediate', 'expert')),
    response_length TEXT DEFAULT 'medium' CHECK(response_length IN ('concise', 'medium', 'comprehensive')),
    
    -- Automatically detected patterns (JSON arrays)
    detected_expertise_areas TEXT DEFAULT '[]',
    common_question_types TEXT DEFAULT '[]',
    peak_activity_hours TEXT DEFAULT '[]',
    preferred_focus_modes TEXT DEFAULT '[]',
    
    -- Context-specific preferences (JSON object)
    context_preferences TEXT DEFAULT '{}',
    
    -- Learning metrics
    total_interactions INTEGER DEFAULT 0,
    positive_feedback_count INTEGER DEFAULT 0,
    negative_feedback_count INTEGER DEFAULT 0,
    last_profile_update TEXT,
    confidence_score REAL DEFAULT 0.5,
    
    -- Auto-learning flags
    auto_adapt_enabled INTEGER DEFAULT 1,
    manual_overrides TEXT DEFAULT '{}',
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_style_profiles_user ON ai_user_style_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_style_profiles_org ON ai_user_style_profiles(organization_id);

-- ai_user_preferences  (source: 053_learning_system.sql)
CREATE TABLE IF NOT EXISTS ai_user_preferences (
    user_id TEXT PRIMARY KEY,
    preferred_language TEXT DEFAULT 'pl',
    preferred_detail_level TEXT DEFAULT 'balanced', -- 'brief', 'balanced', 'detailed'
    enable_proactive_nudges BOOLEAN DEFAULT true,
    enable_max_mode BOOLEAN DEFAULT false,
    custom_instructions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ai_usage_stats  (source: 229_admin_overview_seed.sql)
CREATE TABLE IF NOT EXISTS ai_usage_stats (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT,
    project_id TEXT,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    requests_count INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0,
    tier TEXT DEFAULT 'STANDARD',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, period_start, period_end)
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_stats_org ON ai_usage_stats(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_stats_user ON ai_usage_stats(user_id);

-- ai_policy_rules  (source: 025_ai_actions_complete.sql.sql)
CREATE TABLE IF NOT EXISTS ai_policy_rules (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    conditions TEXT NOT NULL DEFAULT '{}',
    decision TEXT NOT NULL CHECK(decision IN ('AUTO_APPROVE', 'REQUIRE_REVIEW', 'AUTO_REJECT')),
    priority INTEGER DEFAULT 100,
    enabled INTEGER DEFAULT 1,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_policy_rules_org ON ai_policy_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_policy_rules_enabled ON ai_policy_rules(organization_id, enabled);

-- ai_policy_settings  (source: 025_ai_actions_complete.sql.sql)
CREATE TABLE IF NOT EXISTS ai_policy_settings (
    id TEXT PRIMARY KEY DEFAULT 'global',
    policy_engine_enabled INTEGER DEFAULT 0,
    updated_by TEXT,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ai_instructions_org  (source: 245_project_enhancements.sql)
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

-- ai_instructions_system  (source: 245_project_enhancements.sql)
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

-- ai_playbook_template_versions  (source: 047_content_module_enterprise.sql)
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
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (template_id) REFERENCES ai_playbook_templates(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_playbook_template_versions_template ON ai_playbook_template_versions(template_id);
CREATE INDEX IF NOT EXISTS idx_playbook_template_versions_version ON ai_playbook_template_versions(template_id, version);

-- ai_inbox  (source: 253_mywork_system.sql)
CREATE TABLE IF NOT EXISTS ai_inbox (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    
    -- Item details
    type TEXT NOT NULL, -- 'suggestion', 'insight', 'alert', 'action', 'reminder'
    category TEXT, -- 'task_risk', 'decision_pending', 'optimization', 'deadline', 'pattern'
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    
    -- Context
    related_type TEXT, -- 'task', 'initiative', 'project', 'decision', 'assessment'
    related_id TEXT,
    related_name TEXT,
    
    -- Action
    action_type TEXT, -- 'view', 'decide', 'update', 'review'
    action_url TEXT, -- Deep link
    
    -- Status
    status TEXT DEFAULT 'unread', -- 'unread', 'read', 'dismissed', 'actioned', 'snoozed'
    read_at TIMESTAMP,
    dismissed_at TIMESTAMP,
    actioned_at TIMESTAMP,
    snoozed_until TIMESTAMP,
    
    -- AI metadata
    confidence_score REAL DEFAULT 0.8,
    generated_by TEXT DEFAULT 'ai',
    generation_context TEXT, -- JSON with why this was generated
    
    -- Lifecycle
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ai_inbox_user ON ai_inbox(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_inbox_org ON ai_inbox(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_inbox_status ON ai_inbox(status);
CREATE INDEX IF NOT EXISTS idx_ai_inbox_type ON ai_inbox(type);
CREATE INDEX IF NOT EXISTS idx_ai_inbox_created ON ai_inbox(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_inbox_expires ON ai_inbox(expires_at);

-- user_ai_preferences  (source: 207_user_ai_preferences.sql)
CREATE TABLE IF NOT EXISTS user_ai_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    preferences TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_user_ai_preferences_user_id ON user_ai_preferences (user_id);
CREATE INDEX IF NOT EXISTS idx_user_ai_preferences_updated ON user_ai_preferences (updated_at);

-- user_ai_profiles  (source: add_response_feedback.sql)
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
    last_feedback_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_ai_profiles_user ON user_ai_profiles(user_id);

-- async_jobs  (source: 025_ai_actions_complete.sql.sql)
CREATE TABLE IF NOT EXISTS async_jobs (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('ACTION_EXECUTION', 'PLAYBOOK_ADVANCE', 'NOTIFICATION', 'RETENTION')),
    entity_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    status TEXT DEFAULT 'QUEUED' CHECK(status IN ('QUEUED', 'RUNNING', 'SUCCESS', 'FAILED', 'DEAD_LETTER', 'CANCELLED')),
    priority TEXT DEFAULT 'normal' CHECK(priority IN ('low', 'normal', 'high', 'critical')),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    correlation_id TEXT,
    created_by TEXT,
    error_code TEXT,
    error_message TEXT,
    result TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_jobs_org ON async_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON async_jobs(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_type_entity ON async_jobs(type, entity_id);
CREATE INDEX IF NOT EXISTS idx_jobs_correlation ON async_jobs(correlation_id);

-- pinned_prompts  (source: 074_pinned_prompts.sql)
CREATE TABLE IF NOT EXISTS pinned_prompts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT,
    prompt TEXT NOT NULL,
    label TEXT,
    category TEXT DEFAULT 'general',
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_pinned_prompts_user ON pinned_prompts(user_id);
CREATE INDEX IF NOT EXISTS idx_pinned_prompts_org ON pinned_prompts(organization_id);
CREATE INDEX IF NOT EXISTS idx_pinned_prompts_usage ON pinned_prompts(user_id, usage_count DESC);

-- ----------------------------------------------------------------------------
-- DOMAIN: Assessments
-- ----------------------------------------------------------------------------

-- assessment_frameworks  (source: 248_assessment_enhancements.sql)
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

-- assessment_questions  (source: 248_assessment_enhancements.sql)
CREATE TABLE IF NOT EXISTS assessment_questions (
    id TEXT PRIMARY KEY,
    framework_id TEXT NOT NULL,
    dimension_id TEXT NOT NULL,
    subdimension_id TEXT,
    question_order INTEGER DEFAULT 0,
    question_text TEXT NOT NULL,
    question_text_translations TEXT, -- JSON for i18n
    help_text TEXT,
    help_text_translations TEXT, -- JSON for i18n
    scoring_criteria TEXT, -- JSON with level descriptions
    evidence_required INTEGER DEFAULT 0,
    weight REAL DEFAULT 1.0,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (framework_id) REFERENCES assessment_frameworks(id)
);
CREATE INDEX IF NOT EXISTS idx_questions_framework ON assessment_questions(framework_id);
CREATE INDEX IF NOT EXISTS idx_questions_dimension ON assessment_questions(dimension_id);

-- assessment_responses  (source: 248_assessment_enhancements.sql)
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

-- assessment_reviews  (source: 010_assessment_workflow.sql.sql)
CREATE TABLE IF NOT EXISTS assessment_reviews (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    
    -- Reviewer Info
    reviewer_id TEXT NOT NULL,
    reviewer_role TEXT, -- e.g., 'CTO', 'Finance Director', 'Operations Lead'
    
    -- Review Status
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED')),
    
    -- Review Content
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comments TEXT,
    axis_comments TEXT, -- JSON: { axisId: { score: number, comment: string } }
    recommendation TEXT CHECK (recommendation IN ('APPROVE', 'APPROVE_WITH_CHANGES', 'REQUEST_CHANGES', 'REJECT')),
    
    -- Timeline
    requested_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    due_date TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    FOREIGN KEY (workflow_id) REFERENCES assessment_workflows(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_reviews_workflow ON assessment_reviews(workflow_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON assessment_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON assessment_reviews(status);

-- assessment_versions  (source: 010_assessment_workflow.sql.sql)
CREATE TABLE IF NOT EXISTS assessment_versions (
    id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    
    -- Snapshot Data
    assessment_data TEXT NOT NULL, -- JSON: Complete axis scores and analysis
    
    -- Change Info
    change_summary TEXT,
    changed_axes TEXT, -- JSON: List of axes that changed from previous version
    
    -- Metadata
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(assessment_id, version)
);
CREATE INDEX IF NOT EXISTS idx_versions_assessment ON assessment_versions(assessment_id);
CREATE INDEX IF NOT EXISTS idx_versions_version ON assessment_versions(assessment_id, version);

-- assessment_workflows  (source: 010_assessment_workflow.sql.sql)
CREATE TABLE IF NOT EXISTS assessment_workflows (
    id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL,
    project_id INTEGER,
    organization_id INTEGER NOT NULL,
    
    -- Workflow State
    status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'IN_REVIEW', 'AWAITING_APPROVAL', 'APPROVED', 'REJECTED', 'ARCHIVED')),
    current_version INTEGER DEFAULT 1,
    
    -- Submission
    submitted_by TEXT,
    submitted_at TIMESTAMPTZ,
    
    -- Approval
    approved_by TEXT,
    approved_at TIMESTAMPTZ,
    approval_notes TEXT,
    
    -- Rejection
    rejected_by TEXT,
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,
    axis_issues TEXT, -- JSON: { axisId: "issue description" }
    
    -- Metadata
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);
CREATE INDEX IF NOT EXISTS idx_workflows_assessment ON assessment_workflows(assessment_id);
CREATE INDEX IF NOT EXISTS idx_workflows_org ON assessment_workflows(organization_id);
CREATE INDEX IF NOT EXISTS idx_workflows_status ON assessment_workflows(status);

-- assessment_workflow_transitions  (source: 286_assessment_workflow_enhancements.sql)
CREATE TABLE IF NOT EXISTS assessment_workflow_transitions (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT NOT NULL,
    triggered_by TEXT NOT NULL,
    triggered_by_name TEXT,
    reason TEXT,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (workflow_id) REFERENCES assessment_workflows(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_transitions_workflow ON assessment_workflow_transitions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_transitions_timestamp ON assessment_workflow_transitions(timestamp);

-- ----------------------------------------------------------------------------
-- DOMAIN: Analytics / Metrics / Predictive
-- ----------------------------------------------------------------------------

-- analytics_dashboards  (source: 238_analytics_module_tables.sql)
CREATE TABLE IF NOT EXISTS analytics_dashboards (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    description TEXT,
    
    -- Layout configuration
    layout_json TEXT DEFAULT '{}', -- Grid layout
    widgets_json TEXT DEFAULT '[]', -- Widget configurations
    
    -- Sharing
    is_shared BOOLEAN DEFAULT FALSE,
    shared_with TEXT DEFAULT '[]', -- JSON array of user IDs
    
    -- Metadata
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_analytics_dashboards_created_by ON analytics_dashboards(created_by);
CREATE INDEX IF NOT EXISTS idx_analytics_dashboards_shared ON analytics_dashboards(is_shared);

-- analytics_reports  (source: 238_analytics_module_tables.sql)
CREATE TABLE IF NOT EXISTS analytics_reports (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    description TEXT,
    
    -- Report configuration
    report_type TEXT DEFAULT 'custom', -- custom, revenue, usage, security
    query_sql TEXT,
    parameters_json TEXT DEFAULT '[]', -- Input parameters
    visualization_type TEXT DEFAULT 'table', -- table, chart, pivot
    
    -- Scheduling
    schedule_json TEXT, -- Cron schedule
    recipients_json TEXT DEFAULT '[]', -- Email recipients
    last_executed_at TEXT,
    next_execution_at TEXT,
    
    -- Status
    status TEXT DEFAULT 'active',
    
    -- Metadata
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_analytics_reports_type ON analytics_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_analytics_reports_status ON analytics_reports(status);

-- analytics_report_executions  (source: 238_analytics_module_tables.sql)
CREATE TABLE IF NOT EXISTS analytics_report_executions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    report_id TEXT NOT NULL,
    
    -- Execution details
    parameters_json TEXT DEFAULT '{}',
    row_count INTEGER DEFAULT 0,
    execution_time_ms INTEGER,
    status TEXT DEFAULT 'pending', -- pending, running, success, failed
    error_message TEXT,
    
    -- Results (optional, for caching)
    results_json TEXT,
    
    -- Metadata
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    executed_by TEXT,
    
    FOREIGN KEY (report_id) REFERENCES analytics_reports(id) ON DELETE CASCADE,
    FOREIGN KEY (executed_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_analytics_report_executions_report ON analytics_report_executions(report_id);
CREATE INDEX IF NOT EXISTS idx_analytics_report_executions_date ON analytics_report_executions(executed_at);

-- analytics_snapshots  (source: 261_analytics_system.sql)
CREATE TABLE IF NOT EXISTS analytics_snapshots (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    snapshot_date DATE NOT NULL,
    
    -- Projects metrics
    projects_total INTEGER DEFAULT 0,
    projects_active INTEGER DEFAULT 0,
    projects_completed INTEGER DEFAULT 0,
    projects_archived INTEGER DEFAULT 0,
    projects_on_track INTEGER DEFAULT 0,
    projects_at_risk INTEGER DEFAULT 0,
    projects_critical INTEGER DEFAULT 0,
    
    -- Initiatives metrics
    initiatives_total INTEGER DEFAULT 0,
    initiatives_draft INTEGER DEFAULT 0,
    initiatives_planning INTEGER DEFAULT 0,
    initiatives_review INTEGER DEFAULT 0,
    initiatives_approved INTEGER DEFAULT 0,
    initiatives_executing INTEGER DEFAULT 0,
    initiatives_done INTEGER DEFAULT 0,
    initiatives_blocked INTEGER DEFAULT 0,
    initiatives_cancelled INTEGER DEFAULT 0,
    
    -- Tasks metrics
    tasks_total INTEGER DEFAULT 0,
    tasks_todo INTEGER DEFAULT 0,
    tasks_in_progress INTEGER DEFAULT 0,
    tasks_done INTEGER DEFAULT 0,
    tasks_overdue INTEGER DEFAULT 0,
    tasks_created_today INTEGER DEFAULT 0,
    tasks_completed_today INTEGER DEFAULT 0,
    task_completion_rate REAL,
    avg_task_duration_days REAL,
    
    -- Decisions metrics
    decisions_total INTEGER DEFAULT 0,
    decisions_pending INTEGER DEFAULT 0,
    decisions_made_today INTEGER DEFAULT 0,
    decisions_escalated INTEGER DEFAULT 0,
    decisions_overdue INTEGER DEFAULT 0,
    avg_decision_time_hours REAL,
    
    -- User metrics
    users_total INTEGER DEFAULT 0,
    users_active_today INTEGER DEFAULT 0,
    users_active_week INTEGER DEFAULT 0,
    users_active_month INTEGER DEFAULT 0,
    
    -- AI metrics
    ai_tokens_used_today INTEGER DEFAULT 0,
    ai_tokens_used_month INTEGER DEFAULT 0,
    ai_requests_today INTEGER DEFAULT 0,
    ai_suggestions_count INTEGER DEFAULT 0,
    ai_suggestions_accepted INTEGER DEFAULT 0,
    ai_suggestion_acceptance_rate REAL,
    
    -- Assessment metrics
    assessments_total INTEGER DEFAULT 0,
    assessments_completed INTEGER DEFAULT 0,
    assessments_in_progress INTEGER DEFAULT 0,
    avg_assessment_score REAL,
    
    -- Tool usage
    tool_sessions_today INTEGER DEFAULT 0,
    reports_generated_today INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(organization_id, snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_analytics_org ON analytics_snapshots(organization_id);
CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_analytics_org_date ON analytics_snapshots(organization_id, snapshot_date);

-- custom_dashboards  (source: 261_analytics_system.sql)
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

-- business_metrics  (source: 238_analytics_module_tables.sql)
CREATE TABLE IF NOT EXISTS business_metrics (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    description TEXT,
    
    -- Metric definition
    category TEXT DEFAULT 'custom', -- revenue, growth, engagement, operational
    formula TEXT, -- Calculation formula or SQL
    unit TEXT DEFAULT 'number', -- number, currency, percentage, time
    
    -- Thresholds
    target_value REAL,
    threshold_warning REAL,
    threshold_critical REAL,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_business_metrics_category ON business_metrics(category);
CREATE INDEX IF NOT EXISTS idx_business_metrics_active ON business_metrics(is_active);

-- business_metric_values  (source: 238_analytics_module_tables.sql)
CREATE TABLE IF NOT EXISTS business_metric_values (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    metric_id TEXT NOT NULL,
    
    -- Value
    value REAL NOT NULL,
    
    -- Metadata
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (metric_id) REFERENCES business_metrics(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_business_metric_values_metric ON business_metric_values(metric_id);
CREATE INDEX IF NOT EXISTS idx_business_metric_values_date ON business_metric_values(recorded_at);

-- predictive_models  (source: 238_analytics_module_tables.sql)
CREATE TABLE IF NOT EXISTS predictive_models (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    description TEXT,
    
    -- Model configuration
    model_type TEXT DEFAULT 'linear_regression', -- linear_regression, logistic, random_forest, xgboost
    target_metric TEXT,
    features_json TEXT DEFAULT '[]', -- Input features
    model_parameters_json TEXT DEFAULT '{}', -- Hyperparameters
    
    -- Status
    status TEXT DEFAULT 'draft', -- draft, training, trained, deployed, archived
    last_trained_at TEXT,
    
    -- Metadata
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_predictive_models_type ON predictive_models(model_type);
CREATE INDEX IF NOT EXISTS idx_predictive_models_status ON predictive_models(status);

-- predictive_model_runs  (source: 238_analytics_module_tables.sql)
CREATE TABLE IF NOT EXISTS predictive_model_runs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    model_id TEXT NOT NULL,
    
    -- Training results
    accuracy_score REAL,
    precision_score REAL,
    recall_score REAL,
    f1_score REAL,
    training_samples INTEGER,
    validation_samples INTEGER,
    
    -- Performance
    training_time_seconds REAL,
    
    -- Status
    status TEXT DEFAULT 'pending', -- pending, running, completed, failed
    error_message TEXT,
    
    -- Metadata
    run_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (model_id) REFERENCES predictive_models(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_predictive_model_runs_model ON predictive_model_runs(model_id);
CREATE INDEX IF NOT EXISTS idx_predictive_model_runs_date ON predictive_model_runs(run_at);

-- predictive_model_predictions  (source: 238_analytics_module_tables.sql)
CREATE TABLE IF NOT EXISTS predictive_model_predictions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    model_id TEXT NOT NULL,
    
    -- Prediction
    input_data_json TEXT,
    predicted_value REAL,
    confidence_score REAL,
    actual_value REAL, -- For tracking accuracy
    
    -- Metadata
    predicted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (model_id) REFERENCES predictive_models(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_predictive_model_predictions_model ON predictive_model_predictions(model_id);
CREATE INDEX IF NOT EXISTS idx_predictive_model_predictions_date ON predictive_model_predictions(predicted_at);

-- metrics_snapshots  (source: 071_create_metrics_snapshots.sql.sql)
CREATE TABLE IF NOT EXISTS metrics_snapshots (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    window_minutes INTEGER DEFAULT 60,
    
    -- Request Metrics
    total_requests INTEGER DEFAULT 0,
    avg_response_time REAL DEFAULT 0,
    request_rate REAL DEFAULT 0, -- requests per minute
    error_rate REAL DEFAULT 0,
    slow_requests_count INTEGER DEFAULT 0,
    
    -- System Metrics
    memory_heap_used_mb REAL,
    memory_rss_mb REAL,
    cpu_usage_percent REAL,
    
    -- DB Metrics
    avg_db_query_time REAL DEFAULT 0,
    db_query_count INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_metrics_snapshots_timestamp ON metrics_snapshots(timestamp);

-- scheduled_events  (source: 229_admin_overview_seed.sql)
CREATE TABLE IF NOT EXISTS scheduled_events (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    event_type TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    location TEXT,
    is_all_day INTEGER DEFAULT 0,
    status TEXT DEFAULT 'SCHEDULED',
    project_id TEXT,
    attendees TEXT DEFAULT '[]',
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_scheduled_events_org ON scheduled_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_events_start ON scheduled_events(start_time);

-- ----------------------------------------------------------------------------
-- DOMAIN: Billing / Revenue / Subscriptions / Currency
-- ----------------------------------------------------------------------------

-- billing_alerts  (source: 091_payment_methods.sql)
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
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (auto_upgrade_plan_id) REFERENCES subscription_plans(id)
);

-- billing_tax_settings  (source: 091_payment_methods.sql)
CREATE TABLE IF NOT EXISTS billing_tax_settings (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL UNIQUE,
    tax_id TEXT, -- VAT/Tax ID number
    tax_id_type TEXT, -- eu_vat, us_ein, etc.
    tax_exempt INTEGER DEFAULT 0,
    billing_name TEXT,
    billing_email TEXT,
    billing_address_line1 TEXT,
    billing_address_line2 TEXT,
    billing_city TEXT,
    billing_state TEXT,
    billing_postal_code TEXT,
    billing_country TEXT,
    invoice_prefix TEXT, -- Custom invoice prefix
    po_number TEXT, -- Purchase Order number
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- billing_webhook_events  (source: 150_billing_phase2.sql)
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
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    delivered_at TEXT,
    failed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_billing_webhooks_status ON billing_webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_billing_webhooks_type ON billing_webhook_events(event_type);

-- tax_rates  (source: 150_billing_phase2.sql)
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
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tax_rates_jurisdiction ON tax_rates(country, state);
CREATE INDEX IF NOT EXISTS idx_tax_rates_type ON tax_rates(tax_type);
CREATE INDEX IF NOT EXISTS idx_tax_rates_active ON tax_rates(is_active);

-- vat_validations  (source: 150_billing_phase2.sql)
CREATE TABLE IF NOT EXISTS vat_validations (
    id TEXT PRIMARY KEY,
    vat_number TEXT NOT NULL,
    country_code TEXT NOT NULL,
    is_valid INTEGER NOT NULL,
    company_name TEXT,
    company_address TEXT,
    validated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT, -- Cache expiry
    validation_source TEXT DEFAULT 'vies', -- vies, stripe, manual
    raw_response TEXT, -- JSON
    UNIQUE(vat_number, country_code)
);
CREATE INDEX IF NOT EXISTS idx_vat_validations_number ON vat_validations(vat_number);
CREATE INDEX IF NOT EXISTS idx_vat_validations_expires ON vat_validations(expires_at);

-- credit_applications  (source: 150_billing_phase2.sql)
CREATE TABLE IF NOT EXISTS credit_applications (
    id TEXT PRIMARY KEY,
    credit_note_id TEXT NOT NULL,
    invoice_id TEXT NOT NULL,
    amount INTEGER NOT NULL, -- Amount applied from this credit note to this invoice
    applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    applied_by TEXT,
    FOREIGN KEY (credit_note_id) REFERENCES credit_notes(id) ON DELETE CASCADE,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_credit_applications_note ON credit_applications(credit_note_id);
CREATE INDEX IF NOT EXISTS idx_credit_applications_invoice ON credit_applications(invoice_id);

-- credit_notes  (source: 150_billing_phase2.sql)
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
    issued_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    voided_at TEXT,
    
    -- Audit
    created_by TEXT,
    voided_by TEXT,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_credit_notes_org ON credit_notes(organization_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_invoice ON credit_notes(invoice_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_status ON credit_notes(status);
CREATE INDEX IF NOT EXISTS idx_credit_notes_number ON credit_notes(credit_note_number);

-- discount_codes  (source: 091_payment_methods.sql)
CREATE TABLE IF NOT EXISTS discount_codes (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    stripe_coupon_id TEXT,
    discount_type TEXT NOT NULL, -- percent, fixed_amount
    discount_value REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    max_uses INTEGER,
    current_uses INTEGER DEFAULT 0,
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,
    applicable_plans TEXT, -- JSON array of plan IDs, null = all plans
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- invoice_items  (source: 030_multi_currency.sql.sql)
CREATE TABLE IF NOT EXISTS invoice_items (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL,
    description TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit_price INTEGER NOT NULL, -- in smallest currency unit
    amount INTEGER NOT NULL,
    metadata TEXT, -- JSON
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);

-- invoice_templates  (source: 150_billing_phase2.sql)
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
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_invoice_templates_org ON invoice_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoice_templates_type ON invoice_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_invoice_templates_default ON invoice_templates(organization_id, is_default);

-- invoice_reminders_sent  (source: 243_invoice_reminders.sql)
CREATE TABLE IF NOT EXISTS invoice_reminders_sent (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL,
    days_before INTEGER NOT NULL, -- 7, 3, 1, 0, or negative for overdue
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(invoice_id, days_before)
);
CREATE INDEX IF NOT EXISTS idx_invoice_reminders_invoice ON invoice_reminders_sent(invoice_id);

-- exchange_rates  (source: 030_multi_currency.sql.sql)
CREATE TABLE IF NOT EXISTS exchange_rates (
    id TEXT PRIMARY KEY,
    from_currency TEXT NOT NULL,
    to_currency TEXT NOT NULL,
    rate REAL NOT NULL,
    source TEXT DEFAULT 'openexchangerates', -- API source
    fetched_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT,
    UNIQUE(from_currency, to_currency)
);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_pair ON exchange_rates(from_currency, to_currency);

-- supported_currencies  (source: 030_multi_currency.sql.sql)
CREATE TABLE IF NOT EXISTS supported_currencies (
    code TEXT PRIMARY KEY, -- ISO 4217 code
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    decimal_places INTEGER DEFAULT 2,
    is_active INTEGER DEFAULT 1
);

-- mrr_snapshots  (source: 234_revenue_module_complete.sql)
CREATE TABLE IF NOT EXISTS mrr_snapshots (
    id TEXT PRIMARY KEY,
    snapshot_date TEXT NOT NULL,
    
    -- MRR breakdown
    mrr INTEGER NOT NULL DEFAULT 0, -- cents
    new_mrr INTEGER DEFAULT 0,
    expansion_mrr INTEGER DEFAULT 0,
    contraction_mrr INTEGER DEFAULT 0,
    churned_mrr INTEGER DEFAULT 0,
    reactivation_mrr INTEGER DEFAULT 0,
    
    -- Metrics
    active_subscriptions INTEGER DEFAULT 0,
    new_subscriptions INTEGER DEFAULT 0,
    churned_subscriptions INTEGER DEFAULT 0,
    growth_rate REAL DEFAULT 0,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_mrr_snapshots_date ON mrr_snapshots(snapshot_date);

-- payment_failures  (source: 234_revenue_module_complete.sql)
CREATE TABLE IF NOT EXISTS payment_failures (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    subscription_id TEXT,
    invoice_id TEXT,
    
    -- Failure details
    amount INTEGER NOT NULL, -- cents
    currency TEXT DEFAULT 'USD',
    failure_code TEXT,
    failure_message TEXT,
    decline_code TEXT,
    
    -- Payment method
    payment_method_id TEXT,
    payment_method_type TEXT,
    payment_method_last4 TEXT,
    
    -- Recovery
    recovery_status TEXT DEFAULT 'pending' CHECK(recovery_status IN ('pending', 'retrying', 'recovered', 'failed', 'resolved')),
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    last_retry_at TEXT,
    next_retry_at TEXT,
    
    -- Resolution
    resolution_type TEXT CHECK(resolution_type IN ('auto_recovered', 'manual', 'payment_updated', 'written_off', 'refunded')),
    resolved_at TEXT,
    resolved_by TEXT,
    
    -- Timing
    failed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    recovered_at TEXT,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_payment_failures_org ON payment_failures(organization_id);
CREATE INDEX IF NOT EXISTS idx_payment_failures_status ON payment_failures(recovery_status);
CREATE INDEX IF NOT EXISTS idx_payment_failures_date ON payment_failures(failed_at);

-- pricing_plan_features  (source: 234_revenue_module_complete.sql)
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
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE CASCADE,
    UNIQUE(plan_id, feature_key)
);
CREATE INDEX IF NOT EXISTS idx_pricing_plan_features_plan ON pricing_plan_features(plan_id);
CREATE INDEX IF NOT EXISTS idx_pricing_plan_features_category ON pricing_plan_features(category);

-- revenue_forecasts  (source: 234_revenue_module_complete.sql)
CREATE TABLE IF NOT EXISTS revenue_forecasts (
    id TEXT PRIMARY KEY,
    
    -- Forecast type
    forecast_type TEXT NOT NULL CHECK(forecast_type IN ('mrr', 'arr', 'revenue', 'churn', 'ltv')),
    scenario TEXT DEFAULT 'base' CHECK(scenario IN ('base', 'optimistic', 'pessimistic', 'custom')),
    
    -- Time period
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    
    -- Forecast values
    forecasted_amount INTEGER NOT NULL, -- cents
    currency TEXT DEFAULT 'USD',
    confidence_level REAL DEFAULT 0.75,
    
    -- Model info
    method TEXT DEFAULT 'linear' CHECK(method IN ('linear', 'exponential', 'moving_average', 'arima', 'ml_based')),
    input_data TEXT, -- JSON with historical data used
    model_parameters TEXT, -- JSON with model config
    
    -- Accuracy tracking
    actual_amount INTEGER, -- filled when period ends
    accuracy REAL, -- calculated accuracy
    
    -- Status
    status TEXT DEFAULT 'active' CHECK(status IN ('draft', 'active', 'expired', 'archived')),
    
    -- Audit
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_revenue_forecasts_type ON revenue_forecasts(forecast_type);
CREATE INDEX IF NOT EXISTS idx_revenue_forecasts_scenario ON revenue_forecasts(scenario);
CREATE INDEX IF NOT EXISTS idx_revenue_forecasts_status ON revenue_forecasts(status);

-- revenue_recognition  (source: 234_revenue_module_complete.sql)
CREATE TABLE IF NOT EXISTS revenue_recognition (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    contract_id TEXT,
    contract_name TEXT,
    
    -- Amounts (cents)
    total_amount INTEGER NOT NULL,
    recognized_amount INTEGER DEFAULT 0,
    remaining_amount INTEGER,
    currency TEXT DEFAULT 'USD',
    
    -- Recognition method
    recognition_method TEXT DEFAULT 'straight_line' CHECK(recognition_method IN ('straight_line', 'milestone', 'percentage_completion', 'point_in_time', 'usage_based')),
    recognition_schedule TEXT, -- JSON array of periods
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed', 'on_hold')),
    
    -- Dates
    start_date TEXT,
    end_date TEXT,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_revenue_recognition_org ON revenue_recognition(organization_id);
CREATE INDEX IF NOT EXISTS idx_revenue_recognition_status ON revenue_recognition(status);
CREATE INDEX IF NOT EXISTS idx_revenue_recognition_method ON revenue_recognition(recognition_method);

-- subscription_changes  (source: 234_revenue_module_complete.sql)
CREATE TABLE IF NOT EXISTS subscription_changes (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    subscription_id TEXT,
    
    -- Change details
    change_type TEXT NOT NULL CHECK(change_type IN ('upgrade', 'downgrade', 'cancel', 'reactivate')),
    from_plan_id TEXT,
    to_plan_id TEXT,
    
    -- Financial
    proration_amount INTEGER DEFAULT 0, -- cents
    proration_type TEXT CHECK(proration_type IN ('credit', 'charge', 'none')),
    
    -- Scheduling
    requested_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    effective_date TEXT,
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'completed', 'cancelled')),
    
    -- Processing
    processed_at TEXT,
    processed_by TEXT,
    admin_notes TEXT,
    rejection_reason TEXT,
    customer_reason TEXT,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL,
    FOREIGN KEY (from_plan_id) REFERENCES subscription_plans(id) ON DELETE SET NULL,
    FOREIGN KEY (to_plan_id) REFERENCES subscription_plans(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_subscription_changes_org ON subscription_changes(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscription_changes_status ON subscription_changes(status);
CREATE INDEX IF NOT EXISTS idx_subscription_changes_type ON subscription_changes(change_type);

-- subscription_events  (source: 234_revenue_module_tables.sql)
CREATE TABLE IF NOT EXISTS subscription_events (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    organization_id TEXT NOT NULL,
    subscription_id TEXT,
    
    -- Event type
    event_type TEXT NOT NULL CHECK(event_type IN ('new', 'expansion', 'contraction', 'churn', 'reactivation')),
    
    -- MRR impact
    mrr_delta REAL NOT NULL DEFAULT 0,
    previous_mrr REAL DEFAULT 0,
    new_mrr REAL DEFAULT 0,
    
    -- Plan info
    from_plan_id TEXT,
    to_plan_id TEXT,
    
    -- Metadata
    reason TEXT,
    metadata TEXT, -- JSON
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_subscription_events_org ON subscription_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_type ON subscription_events(event_type);
CREATE INDEX IF NOT EXISTS idx_subscription_events_date ON subscription_events(created_at);

-- subscription_history  (source: 029_dunning_system.sql.sql)
CREATE TABLE IF NOT EXISTS subscription_history (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    action TEXT NOT NULL, -- 'created', 'upgraded', 'downgraded', 'paused', 'canceled', 'resumed', 'suspended', 'reactivated'
    from_plan TEXT,
    to_plan TEXT,
    reason TEXT,
    performed_by TEXT, -- user_id or 'system'
    metadata TEXT, -- JSON
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_subscription_history_org ON subscription_history(organization_id);

-- dunning_notifications  (source: 029_dunning_system.sql.sql)
CREATE TABLE IF NOT EXISTS dunning_notifications (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    notification_type TEXT NOT NULL, -- 'initial_failure', 'retry_1', 'retry_2', 'final_notice', 'suspension', 'recovery'
    sent_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    email_to TEXT,
    metadata TEXT, -- JSON with additional info
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_dunning_notifications_org ON dunning_notifications(organization_id);

-- ----------------------------------------------------------------------------
-- DOMAIN: Content Module
-- ----------------------------------------------------------------------------

-- content_analytics  (source: 047_content_module_enterprise.sql)
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
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_content_analytics_content ON content_analytics(content_id, content_type);
CREATE INDEX IF NOT EXISTS idx_content_analytics_event ON content_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_content_analytics_user ON content_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_content_analytics_org ON content_analytics(organization_id);
CREATE INDEX IF NOT EXISTS idx_content_analytics_created ON content_analytics(created_at);

-- content_categories  (source: 047_content_module_enterprise.sql)
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
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    
    FOREIGN KEY (parent_id) REFERENCES content_categories(id) ON DELETE SET NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_categories_slug ON content_categories(slug, organization_id);
CREATE INDEX IF NOT EXISTS idx_content_categories_type ON content_categories(content_type);
CREATE INDEX IF NOT EXISTS idx_content_categories_parent ON content_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_content_categories_org ON content_categories(organization_id);

-- content_favorites  (source: 047_content_module_enterprise.sql)
CREATE TABLE IF NOT EXISTS content_favorites (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    content_id TEXT NOT NULL,
    content_type TEXT NOT NULL, -- 'PLAYBOOK_TEMPLATE', 'EMAIL_TEMPLATE'
    
    -- Notes
    notes TEXT,
    
    -- Folder (for organizing favorites)
    folder_name TEXT DEFAULT 'Default',
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, content_id, content_type)
);
CREATE INDEX IF NOT EXISTS idx_content_favorites_user ON content_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_content_favorites_content ON content_favorites(content_id, content_type);

-- content_permissions  (source: 048_content_module_permissions.sql)
CREATE TABLE IF NOT EXISTS content_permissions (
    id TEXT PRIMARY KEY,
    content_id TEXT NOT NULL,
    content_type TEXT NOT NULL CHECK(content_type IN ('PLAYBOOK_TEMPLATE', 'EMAIL_TEMPLATE', 'CATEGORY', 'TAG')),
    user_id TEXT,
    role TEXT,
    permission_key TEXT NOT NULL,
    grant_type TEXT NOT NULL DEFAULT 'GRANT' CHECK(grant_type IN ('GRANT', 'REVOKE')),
    granted_by TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ,
    UNIQUE(content_id, content_type, user_id, permission_key),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(granted_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_content_permissions_content ON content_permissions(content_id, content_type);
CREATE INDEX IF NOT EXISTS idx_content_permissions_user ON content_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_content_permissions_role ON content_permissions(role);

-- content_reviews  (source: 047_content_module_enterprise.sql)
CREATE TABLE IF NOT EXISTS content_reviews (
    id TEXT PRIMARY KEY,
    content_id TEXT NOT NULL,
    content_type TEXT NOT NULL, -- 'PLAYBOOK_TEMPLATE', 'EMAIL_TEMPLATE'
    
    -- Review request
    requested_by TEXT NOT NULL,
    requested_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
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
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_content_reviews_content ON content_reviews(content_id, content_type);
CREATE INDEX IF NOT EXISTS idx_content_reviews_reviewer ON content_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_content_reviews_status ON content_reviews(status);
CREATE INDEX IF NOT EXISTS idx_content_reviews_requested_by ON content_reviews(requested_by);

-- content_tags  (source: 047_content_module_enterprise.sql)
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
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_tags_slug ON content_tags(slug, organization_id);
CREATE INDEX IF NOT EXISTS idx_content_tags_type ON content_tags(content_type);
CREATE INDEX IF NOT EXISTS idx_content_tags_org ON content_tags(organization_id);

-- content_tag_mappings  (source: 047_content_module_enterprise.sql)
CREATE TABLE IF NOT EXISTS content_tag_mappings (
    id TEXT PRIMARY KEY,
    content_id TEXT NOT NULL,
    content_type TEXT NOT NULL, -- 'PLAYBOOK_TEMPLATE', 'EMAIL_TEMPLATE'
    tag_id TEXT NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    
    FOREIGN KEY (tag_id) REFERENCES content_tags(id) ON DELETE CASCADE,
    UNIQUE(content_id, content_type, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_content_tag_mappings_content ON content_tag_mappings(content_id, content_type);
CREATE INDEX IF NOT EXISTS idx_content_tag_mappings_tag ON content_tag_mappings(tag_id);

-- email_template_versions  (source: 047_content_module_enterprise.sql)
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
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (template_id) REFERENCES email_templates(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_email_template_versions_template ON email_template_versions(template_id);
CREATE INDEX IF NOT EXISTS idx_email_template_versions_version ON email_template_versions(template_id, version);

-- ----------------------------------------------------------------------------
-- DOMAIN: Customers / Lifecycle / Automation / Feedback
-- ----------------------------------------------------------------------------

-- customer_communications  (source: 241_customer_communications.sql)
CREATE TABLE IF NOT EXISTS customer_communications (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
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

-- customer_contracts  (source: 202_customer_contracts.sql)
CREATE TABLE IF NOT EXISTS customer_contracts (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
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
CREATE INDEX IF NOT EXISTS idx_contracts_org ON customer_contracts(organization_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON customer_contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_renewal ON customer_contracts(renewal_date);

-- customer_lifecycle_stages  (source: 200_customer_lifecycle.sql)
CREATE TABLE IF NOT EXISTS customer_lifecycle_stages (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    description TEXT,
    order_index INTEGER DEFAULT 0,
    color TEXT DEFAULT '#3B82F6',
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_lifecycle_stages_order ON customer_lifecycle_stages(order_index);

-- customer_lifecycle_transitions  (source: 200_customer_lifecycle.sql)
CREATE TABLE IF NOT EXISTS customer_lifecycle_transitions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
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

-- automation_rules  (source: 240_customer_automation.sql)
CREATE TABLE IF NOT EXISTS automation_rules (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL,
    trigger_config TEXT DEFAULT '{}',
    action_type TEXT NOT NULL,
    action_config TEXT DEFAULT '{}',
    is_active INTEGER DEFAULT 1,
    executions_count INTEGER DEFAULT 0,
    last_executed_at TIMESTAMP,
    created_by TEXT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_automation_rules_active ON automation_rules(is_active);

-- automation_rule_executions  (source: 240_customer_automation.sql)
CREATE TABLE IF NOT EXISTS automation_rule_executions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    rule_id TEXT NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
    organization_id TEXT REFERENCES organizations(id),
    user_id TEXT REFERENCES users(id),
    status TEXT DEFAULT 'completed',
    execution_details TEXT DEFAULT '{}',
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_automation_rule_executions_rule ON automation_rule_executions(rule_id);
CREATE INDEX IF NOT EXISTS idx_automation_rule_executions_date ON automation_rule_executions(executed_at DESC);

-- feature_requests  (source: 200_enterprise_feedback_system.sql)
CREATE TABLE IF NOT EXISTS feature_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    user_email TEXT,
    organization_id TEXT,
    category TEXT DEFAULT 'other' CHECK (category IN ('usability', 'performance', 'missing', 'improvement', 'integration', 'other')),
    feature_name TEXT NOT NULL,
    description TEXT NOT NULL,
    impact TEXT DEFAULT 'medium' CHECK (impact IN ('low', 'medium', 'high', 'critical')),
    context TEXT, -- Where the request originated
    status TEXT DEFAULT 'NEW' CHECK (status IN ('NEW', 'REVIEWING', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'DUPLICATE')),
    priority INTEGER DEFAULT 0,
    votes_count INTEGER DEFAULT 0,
    admin_notes TEXT,
    target_release TEXT, -- e.g., "Q2 2026"
    related_ticket_url TEXT, -- Link to Jira/Linear/etc
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_feature_requests_user ON feature_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_feature_requests_status ON feature_requests(status);
CREATE INDEX IF NOT EXISTS idx_feature_requests_category ON feature_requests(category);
CREATE INDEX IF NOT EXISTS idx_feature_requests_votes ON feature_requests(votes_count DESC);
CREATE INDEX IF NOT EXISTS idx_feature_requests_created ON feature_requests(created_at);

-- feature_votes  (source: 200_enterprise_feedback_system.sql)
CREATE TABLE IF NOT EXISTS feature_votes (
    id TEXT PRIMARY KEY,
    feature_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(feature_id, user_id),
    FOREIGN KEY (feature_id) REFERENCES feature_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_feature_votes_feature ON feature_votes(feature_id);
CREATE INDEX IF NOT EXISTS idx_feature_votes_user ON feature_votes(user_id);

-- feature_roadmap  (source: 015_enterprise_customers_module.sql)
CREATE TABLE IF NOT EXISTS feature_roadmap (
    id TEXT PRIMARY KEY,
    feature_title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'planned',
    priority TEXT DEFAULT 'medium',
    target_release_date DATE,
    related_feedback_ids_json TEXT DEFAULT '[]',
    votes_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_feature_roadmap_status ON feature_roadmap(status);
CREATE INDEX IF NOT EXISTS idx_feature_roadmap_priority ON feature_roadmap(priority);

-- feedback_analysis  (source: 200_enterprise_feedback_system.sql)
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
    analyzed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (feedback_id) REFERENCES system_feedback(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_feedback_analysis_feedback ON feedback_analysis(feedback_id);
CREATE INDEX IF NOT EXISTS idx_feedback_analysis_sentiment ON feedback_analysis(sentiment);
CREATE INDEX IF NOT EXISTS idx_feedback_analysis_priority ON feedback_analysis(priority);
CREATE INDEX IF NOT EXISTS idx_feedback_analysis_analyzed ON feedback_analysis(analyzed_at);

-- feedback_pulse  (source: 200_enterprise_feedback_system.sql)
CREATE TABLE IF NOT EXISTS feedback_pulse (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    organization_id TEXT,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    context TEXT DEFAULT '/', -- Page/module context
    comment TEXT,
    metadata TEXT, -- JSON for additional context
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_feedback_pulse_user ON feedback_pulse(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_pulse_rating ON feedback_pulse(rating);
CREATE INDEX IF NOT EXISTS idx_feedback_pulse_context ON feedback_pulse(context);
CREATE INDEX IF NOT EXISTS idx_feedback_pulse_created ON feedback_pulse(created_at);

-- feedback_trending_topics  (source: 200_enterprise_feedback_system.sql)
CREATE TABLE IF NOT EXISTS feedback_trending_topics (
    id TEXT PRIMARY KEY,
    topic TEXT NOT NULL,
    topic_count INTEGER DEFAULT 0,
    sentiment TEXT,
    trend TEXT CHECK (trend IN ('rising', 'stable', 'falling')),
    sample_feedback_ids_json TEXT, -- JSON array of sample feedback IDs
    period TEXT DEFAULT '7d', -- '7d', '30d', '90d'
    calculated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_feedback_trending_topic ON feedback_trending_topics(topic);
CREATE INDEX IF NOT EXISTS idx_feedback_trending_period ON feedback_trending_topics(period);
CREATE INDEX IF NOT EXISTS idx_feedback_trending_count ON feedback_trending_topics(topic_count DESC);

-- feedback_comments  (source: 015_enterprise_customers_module.sql)
CREATE TABLE IF NOT EXISTS feedback_comments (
    id TEXT PRIMARY KEY,
    feedback_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    comment_text TEXT NOT NULL,
    is_internal INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(feedback_id) REFERENCES feedback_items(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_feedback_comments_feedback ON feedback_comments(feedback_id);
CREATE INDEX IF NOT EXISTS idx_feedback_comments_user ON feedback_comments(user_id);

-- feedback_votes  (source: 015_enterprise_customers_module.sql)
CREATE TABLE IF NOT EXISTS feedback_votes (
    id TEXT PRIMARY KEY,
    feedback_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    vote_type TEXT DEFAULT 'upvote',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(feedback_id) REFERENCES feedback_items(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(feedback_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_feedback_votes_feedback ON feedback_votes(feedback_id);
CREATE INDEX IF NOT EXISTS idx_feedback_votes_user ON feedback_votes(user_id);

-- ----------------------------------------------------------------------------
-- DOMAIN: Conversations / Sharing / Branches
-- ----------------------------------------------------------------------------

-- conversation_shares  (source: 283_conversation_sharing.sql)
CREATE TABLE IF NOT EXISTS conversation_shares (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    share_token TEXT UNIQUE NOT NULL,
    created_by TEXT NOT NULL,
    title TEXT,
    description TEXT,
    expires_at TIMESTAMP,
    view_count INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    settings JSON DEFAULT '{}',
    -- Settings can include:
    -- - allow_copy: boolean - can viewers copy messages
    -- - show_timestamps: boolean - show message timestamps
    -- - anonymize: boolean - hide user info
    -- - password_hash: string - optional password protection
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_shares_token ON conversation_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_shares_conversation ON conversation_shares(conversation_id);
CREATE INDEX IF NOT EXISTS idx_shares_active ON conversation_shares(is_active);

-- conversation_share_views  (source: 283_conversation_sharing.sql)
CREATE TABLE IF NOT EXISTS conversation_share_views (
    id TEXT PRIMARY KEY,
    share_id TEXT NOT NULL REFERENCES conversation_shares(id) ON DELETE CASCADE,
    viewer_ip TEXT,
    viewer_agent TEXT,
    referrer TEXT,
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_share_views_share ON conversation_share_views(share_id);
CREATE INDEX IF NOT EXISTS idx_share_views_date ON conversation_share_views(viewed_at);

-- message_edits  (source: 282_conversation_branches.sql)
CREATE TABLE IF NOT EXISTS message_edits (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL REFERENCES conversation_messages(id) ON DELETE CASCADE,
    original_content TEXT NOT NULL,
    edited_content TEXT NOT NULL,
    edited_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_message_edits_message ON message_edits(message_id);

-- ----------------------------------------------------------------------------
-- DOMAIN: Consultants / Partner Portal / Discounts
-- ----------------------------------------------------------------------------

-- consultants  (source: 017_consultant_mode.sql.sql)
CREATE TABLE IF NOT EXISTS consultants (
    id TEXT PRIMARY KEY, -- user_id
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, SUSPENDED
    display_name TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id) REFERENCES users(id)
);

-- consultant_org_links  (source: 017_consultant_mode.sql.sql)
CREATE TABLE IF NOT EXISTS consultant_org_links (
    id TEXT PRIMARY KEY,
    consultant_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    role_in_org TEXT DEFAULT 'CONSULTANT',
    permission_scope TEXT, -- JSON blob for granular permissions
    status TEXT DEFAULT 'ACTIVE', -- ACTIVE, REVOKED
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id TEXT,
    FOREIGN KEY (consultant_id) REFERENCES consultants(id),
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);
CREATE INDEX IF NOT EXISTS idx_consultant_links_consultant ON consultant_org_links(consultant_id);
CREATE INDEX IF NOT EXISTS idx_consultant_links_org ON consultant_org_links(organization_id);

-- organization_discounts  (source: 217_partner_discount_system.sql)
CREATE TABLE IF NOT EXISTS organization_discounts (
    id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    organization_id TEXT NOT NULL,
    partner_org_id TEXT NOT NULL,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('PERCENTAGE', 'FLAT')),
    discount_value REAL NOT NULL,
    start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP NOT NULL,
    total_discount_applied REAL DEFAULT 0.00,
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'CANCELLED', 'SUSPENDED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (partner_org_id) REFERENCES partner_organizations(id)
);
CREATE INDEX IF NOT EXISTS idx_org_discounts_org_id ON organization_discounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_discounts_partner_id ON organization_discounts(partner_org_id);
CREATE INDEX IF NOT EXISTS idx_org_discounts_status ON organization_discounts(status);

-- partner_commission_rates  (source: 217_partner_discount_system.sql)
CREATE TABLE IF NOT EXISTS partner_commission_rates (
    id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    tier TEXT NOT NULL UNIQUE,
    tier_name TEXT NOT NULL,
    rate REAL NOT NULL DEFAULT 10.00,
    min_revenue REAL DEFAULT 0,
    color TEXT DEFAULT 'bg-slate-500',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- partner_discount_config  (source: 217_partner_discount_system.sql)
CREATE TABLE IF NOT EXISTS partner_discount_config (
    id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    discount_type TEXT NOT NULL DEFAULT 'PERCENTAGE' CHECK (discount_type IN ('PERCENTAGE', 'FLAT')),
    discount_value REAL NOT NULL DEFAULT 15.00,
    duration_months INTEGER NOT NULL DEFAULT 12,
    max_discount_per_month REAL,
    tier_overrides TEXT DEFAULT '{}', -- JSON: tier-specific overrides
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- partner_payout_settings  (source: 217_partner_discount_system.sql)
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

-- partner_learning_progress  (source: 215_partner_portal.sql)
CREATE TABLE IF NOT EXISTS partner_learning_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certification_id UUID NOT NULL REFERENCES partner_certifications(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES partner_learning_modules(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
    progress_percent INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    score INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(certification_id, module_id)
);

-- partner_regions  (source: 215_partner_portal.sql)
CREATE TABLE IF NOT EXISTS partner_regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_org_id UUID NOT NULL REFERENCES partner_organizations(id) ON DELETE CASCADE,
    region VARCHAR(50) NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(partner_org_id, region)
);
CREATE INDEX IF NOT EXISTS idx_partner_regions_partner ON partner_regions(partner_org_id);

-- partner_specializations  (source: 215_partner_portal.sql)
CREATE TABLE IF NOT EXISTS partner_specializations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_org_id UUID NOT NULL REFERENCES partner_organizations(id) ON DELETE CASCADE,
    framework VARCHAR(50) NOT NULL CHECK (framework IN ('DRD', 'SIRI', 'ADMA', 'CMMI', 'Lean4.0', 'ISO21500', 'PMBOK', 'PRINCE2')),
    certified BOOLEAN DEFAULT false,
    certified_at TIMESTAMP WITH TIME ZONE,
    certification_expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(partner_org_id, framework)
);
CREATE INDEX IF NOT EXISTS idx_partner_specializations_partner ON partner_specializations(partner_org_id);

-- ----------------------------------------------------------------------------
-- DOMAIN: Decisions / Escalation / Governance
-- ----------------------------------------------------------------------------

-- decision_consulted_opinions  (source: 303_decision_escalation_delegation.sql)
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
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (decision_id) REFERENCES decisions(id) ON DELETE CASCADE,
  FOREIGN KEY (delegation_id) REFERENCES decision_delegations(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_opinions_decision ON decision_consulted_opinions(decision_id);
CREATE INDEX IF NOT EXISTS idx_opinions_user ON decision_consulted_opinions(user_id);

-- decision_delegations  (source: 303_decision_escalation_delegation.sql)
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
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (decision_id) REFERENCES decisions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_delegations_decision ON decision_delegations(decision_id);
CREATE INDEX IF NOT EXISTS idx_delegations_from_user ON decision_delegations(from_user_id);
CREATE INDEX IF NOT EXISTS idx_delegations_to_user ON decision_delegations(to_user_id);
CREATE INDEX IF NOT EXISTS idx_delegations_status ON decision_delegations(status);
CREATE INDEX IF NOT EXISTS idx_delegations_type ON decision_delegations(delegation_type);

-- decision_escalation_chain  (source: 303_decision_escalation_delegation.sql)
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
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  
  FOREIGN KEY (decision_id) REFERENCES decisions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_escalation_chain_decision ON decision_escalation_chain(decision_id);
CREATE INDEX IF NOT EXISTS idx_escalation_chain_org ON decision_escalation_chain(organization_id);
CREATE INDEX IF NOT EXISTS idx_escalation_chain_level ON decision_escalation_chain(decision_id, level);

-- decision_escalation_log  (source: 303_decision_escalation_delegation.sql)
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
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (decision_id) REFERENCES decisions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_escalation_log_decision ON decision_escalation_log(decision_id);
CREATE INDEX IF NOT EXISTS idx_escalation_log_created ON decision_escalation_log(created_at);

-- decision_escalation_templates  (source: 303_decision_escalation_delegation.sql)
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
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_escalation_templates_org ON decision_escalation_templates(organization_id);

-- escalation_rules  (source: 295_unified_decisions.sql)
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

-- governance_audit_log  (source: 014_governance_enterprise.sql.sql)
CREATE TABLE IF NOT EXISTS governance_audit_log (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    actor_role TEXT,
    action TEXT NOT NULL CHECK(action IN (
        'CREATE', 'UPDATE', 'DELETE', 'PUBLISH', 'TOGGLE', 
        'DELETE_SOFT', 'GRANT_PERMISSION', 'REVOKE_PERMISSION',
        'BREAK_GLASS_START', 'BREAK_GLASS_CLOSE'
    )),
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    before_json TEXT,
    after_json TEXT,
    correlation_id TEXT,
    prev_hash TEXT,
    record_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_org_created ON governance_audit_log(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON governance_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON governance_audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_correlation ON governance_audit_log(correlation_id);

-- ----------------------------------------------------------------------------
-- DOMAIN: Digitization / Economics
-- ----------------------------------------------------------------------------

-- digitization_analyses  (source: 060_digitization_analyses.sql)
CREATE TABLE IF NOT EXISTS digitization_analyses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed')),
    
    -- Relationships
    project_id TEXT,
    organization_id INTEGER NOT NULL,
    created_by TEXT NOT NULL,
    
    -- Calculated Scores
    overall_score REAL,
    completion_percent INTEGER DEFAULT 0,
    
    -- JSON field for aggregated axis scores (for quick access)
    axis_scores TEXT, -- JSON: { axisId: { currentScore: number, targetScore: number, completedAreas: number, totalAreas: number } }
    
    -- Import metadata
    imported_from TEXT, -- Original Excel filename if imported
    import_date TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);
CREATE INDEX IF NOT EXISTS idx_digitization_analyses_org ON digitization_analyses(organization_id);
CREATE INDEX IF NOT EXISTS idx_digitization_analyses_status ON digitization_analyses(status);
CREATE INDEX IF NOT EXISTS idx_digitization_analyses_project ON digitization_analyses(project_id);
CREATE INDEX IF NOT EXISTS idx_digitization_analyses_created ON digitization_analyses(created_at);

-- digitization_axis_scores  (source: 060_digitization_analyses.sql)
CREATE TABLE IF NOT EXISTS digitization_axis_scores (
    id TEXT PRIMARY KEY,
    analysis_id TEXT NOT NULL,
    
    -- Axis and Area Identification
    axis_id TEXT NOT NULL, -- e.g., 'digital_processes', 'digital_products', etc.
    area_id TEXT NOT NULL, -- e.g., '1.1', '1.2', etc.
    area_code TEXT, -- e.g., '1.1'
    
    -- Score Data
    current_level INTEGER CHECK (current_level >= 0 AND current_level <= 7),
    target_level INTEGER CHECK (target_level >= 0 AND target_level <= 7),
    
    -- Additional Assessment Data
    notes TEXT,
    evidence TEXT, -- JSON array of evidence strings
    justification TEXT, -- Why this score was chosen
    
    -- Metadata
    assessed_by TEXT,
    assessed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (analysis_id) REFERENCES digitization_analyses(id) ON DELETE CASCADE,
    UNIQUE(analysis_id, axis_id, area_id)
);
CREATE INDEX IF NOT EXISTS idx_axis_scores_analysis ON digitization_axis_scores(analysis_id);
CREATE INDEX IF NOT EXISTS idx_axis_scores_axis ON digitization_axis_scores(axis_id);
CREATE INDEX IF NOT EXISTS idx_axis_scores_area ON digitization_axis_scores(area_id);

-- analysis_financials  (source: 068_economics_analysis_financials.sql)
CREATE TABLE IF NOT EXISTS analysis_financials (
    id TEXT PRIMARY KEY,
    analysis_id TEXT NOT NULL UNIQUE,
    initiative_id TEXT,
    organization_id INTEGER NOT NULL,

    -- Cost Structure
    initial_investment REAL DEFAULT 0,
    implementation_cost REAL DEFAULT 0,
    annual_operating_cost REAL DEFAULT 0,
    training_cost REAL DEFAULT 0,
    contingency_percent REAL DEFAULT 15,

    -- Benefits Structure
    annual_cost_savings REAL DEFAULT 0,
    annual_revenue_increase REAL DEFAULT 0,
    productivity_gains_percent REAL DEFAULT 0,
    risk_reduction_value REAL DEFAULT 0,

    -- Time Parameters
    implementation_months INTEGER DEFAULT 12,
    benefit_realization_months INTEGER DEFAULT 6,
    analysis_horizon_years INTEGER DEFAULT 5,
    discount_rate REAL DEFAULT 10,

    -- Calculated Metrics (cached)
    npv REAL,
    irr REAL,
    payback_months REAL,
    roi_percent REAL,

    -- Metadata
    currency TEXT DEFAULT 'PLN',
    assumptions TEXT, -- JSON array
    cash_flow_projections TEXT, -- JSON array

    -- Audit
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_calculated_at TIMESTAMPTZ,

    FOREIGN KEY (analysis_id) REFERENCES digitization_analyses(id) ON DELETE CASCADE,
    FOREIGN KEY (initiative_id) REFERENCES initiatives(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_analysis_financials_analysis ON analysis_financials(analysis_id);
CREATE INDEX IF NOT EXISTS idx_analysis_financials_initiative ON analysis_financials(initiative_id);
CREATE INDEX IF NOT EXISTS idx_analysis_financials_org ON analysis_financials(organization_id);

-- analysis_financial_scenarios  (source: 068_economics_analysis_financials.sql)
CREATE TABLE IF NOT EXISTS analysis_financial_scenarios (
    id TEXT PRIMARY KEY,
    analysis_id TEXT NOT NULL,
    organization_id INTEGER NOT NULL,

    scenario_type TEXT NOT NULL CHECK (scenario_type IN ('base', 'optimistic', 'conservative')),
    name TEXT,
    assumptions TEXT, -- JSON array
    financial_data TEXT NOT NULL, -- JSON snapshot of inputs
    metrics TEXT NOT NULL, -- JSON { npv, irr, roi, paybackPeriod, cashFlows }
    is_active BOOLEAN DEFAULT FALSE,

    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (analysis_id) REFERENCES digitization_analyses(id) ON DELETE CASCADE,
    UNIQUE(analysis_id, scenario_type)
);
CREATE INDEX IF NOT EXISTS idx_financial_scenarios_analysis ON analysis_financial_scenarios(analysis_id);
CREATE INDEX IF NOT EXISTS idx_financial_scenarios_active ON analysis_financial_scenarios(analysis_id, is_active);

-- benefit_tracking  (source: 067_economics_initiative_integration.sql)
CREATE TABLE IF NOT EXISTS benefit_tracking (
    id TEXT PRIMARY KEY,
    financial_id TEXT NOT NULL REFERENCES initiative_financials(id) ON DELETE CASCADE,
    initiative_id TEXT NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
    organization_id INTEGER NOT NULL,
    
    -- Tracking Period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    period_type TEXT DEFAULT 'monthly' CHECK (period_type IN ('monthly', 'quarterly', 'yearly')),
    
    -- Planned Values (from financial model at period start)
    planned_cost_savings REAL DEFAULT 0,
    planned_revenue_increase REAL DEFAULT 0,
    planned_productivity_gains REAL DEFAULT 0,
    
    -- Actual Values
    actual_cost_savings REAL DEFAULT 0,
    actual_revenue_increase REAL DEFAULT 0,
    actual_productivity_gains REAL DEFAULT 0,
    
    -- Variance Calculations
    variance_cost_savings_percent REAL,
    variance_revenue_percent REAL,
    variance_productivity_percent REAL,
    overall_variance_percent REAL,
    
    -- Qualitative Data
    variance_notes TEXT,
    achievements TEXT, -- JSON array of achievement descriptions
    challenges TEXT, -- JSON array of challenge descriptions
    
    -- Evidence and Verification
    evidence_links TEXT, -- JSON array of evidence URLs/references
    verified_by TEXT,
    verified_at TIMESTAMPTZ,
    verification_status TEXT DEFAULT 'pending' 
        CHECK (verification_status IN ('pending', 'verified', 'disputed')),
    
    -- Audit
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_benefit_tracking_financial ON benefit_tracking(financial_id);
CREATE INDEX IF NOT EXISTS idx_benefit_tracking_initiative ON benefit_tracking(initiative_id);
CREATE INDEX IF NOT EXISTS idx_benefit_tracking_org ON benefit_tracking(organization_id);
CREATE INDEX IF NOT EXISTS idx_benefit_tracking_period ON benefit_tracking(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_benefit_tracking_status ON benefit_tracking(verification_status);

-- ----------------------------------------------------------------------------
-- DOMAIN: Enterprise Features / Security / Compliance
-- ----------------------------------------------------------------------------

-- data_residency  (source: 260_enterprise_features.sql)
CREATE TABLE IF NOT EXISTS data_residency (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL UNIQUE,
    
    -- Region
    region TEXT NOT NULL DEFAULT 'eu', -- 'eu', 'us', 'apac', 'custom'
    region_display_name TEXT,
    region_locked INTEGER DEFAULT 0, -- Cannot change after data migration
    locked_at TIMESTAMP,
    locked_reason TEXT,
    
    -- Compliance requirements
    data_sovereignty_required INTEGER DEFAULT 0,
    cross_border_transfer_allowed INTEGER DEFAULT 1,
    specific_country TEXT, -- ISO country code if specific country required
    
    -- Storage locations (for multi-region setup)
    primary_database_region TEXT,
    replica_database_regions TEXT DEFAULT '[]', -- JSON array
    file_storage_region TEXT,
    backup_regions TEXT DEFAULT '[]', -- JSON array
    cdn_regions TEXT DEFAULT '["global"]', -- JSON array
    
    -- AI processing
    ai_processing_region TEXT DEFAULT 'same', -- 'same', 'us', 'eu', 'any'
    ai_data_leaves_region INTEGER DEFAULT 0,
    
    -- Compliance attestations
    gdpr_compliant INTEGER DEFAULT 1,
    hipaa_compliant INTEGER DEFAULT 0,
    sox_compliant INTEGER DEFAULT 0,
    
    configured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    configured_by TEXT,
    last_verified_at TIMESTAMP,
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);
CREATE INDEX IF NOT EXISTS idx_residency_org ON data_residency(organization_id);
CREATE INDEX IF NOT EXISTS idx_residency_region ON data_residency(region);

-- enterprise_contracts  (source: 260_enterprise_features.sql)
CREATE TABLE IF NOT EXISTS enterprise_contracts (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    
    -- Contract info
    contract_type TEXT NOT NULL DEFAULT 'standard', -- 'standard', 'annual', 'enterprise', 'custom'
    contract_number TEXT UNIQUE,
    contract_name TEXT,
    
    -- Dates
    start_date DATE NOT NULL,
    end_date DATE,
    signed_date DATE,
    auto_renew INTEGER DEFAULT 0,
    renewal_notice_days INTEGER DEFAULT 30,
    
    -- SLA
    sla_level TEXT DEFAULT 'standard', -- 'standard', 'premium', 'enterprise'
    uptime_guarantee REAL DEFAULT 99.9,
    support_response_hours TEXT DEFAULT '{"critical":4,"high":8,"medium":24,"low":48}',
    
    -- Limits (NULL = plan default)
    max_users INTEGER,
    max_projects INTEGER,
    max_storage_gb INTEGER,
    max_tokens_monthly INTEGER,
    max_assessments_monthly INTEGER,
    
    -- Pricing
    base_price REAL,
    per_user_price REAL,
    per_seat_price REAL,
    currency TEXT DEFAULT 'USD',
    billing_cycle TEXT DEFAULT 'monthly', -- 'monthly', 'quarterly', 'annual'
    payment_terms_days INTEGER DEFAULT 30,
    custom_pricing_notes TEXT,
    
    -- Discounts
    discount_percentage REAL DEFAULT 0,
    discount_reason TEXT,
    
    -- Features
    enabled_features TEXT DEFAULT '[]', -- JSON array of feature flags
    disabled_features TEXT DEFAULT '[]',
    
    -- Support
    account_manager_id TEXT,
    account_manager_name TEXT,
    account_manager_email TEXT,
    account_manager_phone TEXT,
    support_slack_channel TEXT,
    support_priority TEXT DEFAULT 'standard', -- 'standard', 'priority', 'dedicated'
    
    -- Documents
    signed_contract_url TEXT,
    terms_accepted_at TIMESTAMP,
    terms_version TEXT,
    addendums TEXT DEFAULT '[]', -- JSON array: [{name, url, signedAt}]
    
    -- Status
    status TEXT DEFAULT 'draft', -- 'draft', 'pending_signature', 'active', 'expired', 'terminated', 'suspended'
    termination_reason TEXT,
    terminated_at TIMESTAMP,
    
    -- Audit
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);
CREATE INDEX IF NOT EXISTS idx_contracts_org ON enterprise_contracts(organization_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON enterprise_contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_end_date ON enterprise_contracts(end_date);

-- sla_tracking  (source: 260_enterprise_features.sql)
CREATE TABLE IF NOT EXISTS sla_tracking (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    month DATE NOT NULL, -- First day of month (YYYY-MM-01)
    
    -- Uptime metrics
    total_minutes INTEGER NOT NULL DEFAULT 43200, -- ~30 days
    scheduled_maintenance_minutes INTEGER DEFAULT 0,
    unplanned_downtime_minutes INTEGER DEFAULT 0,
    uptime_percentage REAL,
    
    -- Incidents
    incidents_total INTEGER DEFAULT 0,
    incidents_critical INTEGER DEFAULT 0,
    incidents_major INTEGER DEFAULT 0,
    incidents_minor INTEGER DEFAULT 0,
    mttr_minutes INTEGER, -- Mean time to recovery
    
    -- Support metrics
    tickets_total INTEGER DEFAULT 0,
    tickets_critical INTEGER DEFAULT 0,
    tickets_high INTEGER DEFAULT 0,
    tickets_medium INTEGER DEFAULT 0,
    tickets_low INTEGER DEFAULT 0,
    tickets_within_sla INTEGER DEFAULT 0,
    tickets_breached_sla INTEGER DEFAULT 0,
    avg_first_response_minutes INTEGER,
    avg_resolution_minutes INTEGER,
    
    -- Performance
    avg_response_time_ms INTEGER,
    p95_response_time_ms INTEGER,
    p99_response_time_ms INTEGER,
    
    -- SLA breach & credits
    sla_target REAL, -- From contract
    sla_met INTEGER DEFAULT 1,
    credit_eligible INTEGER DEFAULT 0,
    credit_percentage REAL DEFAULT 0,
    credit_amount REAL DEFAULT 0,
    credit_currency TEXT DEFAULT 'USD',
    credit_applied INTEGER DEFAULT 0,
    credit_applied_at TIMESTAMP,
    credit_invoice_id TEXT,
    
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(organization_id, month)
);
CREATE INDEX IF NOT EXISTS idx_sla_org ON sla_tracking(organization_id);
CREATE INDEX IF NOT EXISTS idx_sla_month ON sla_tracking(month);
CREATE INDEX IF NOT EXISTS idx_sla_breach ON sla_tracking(sla_met);

-- white_label_config  (source: 260_enterprise_features.sql)
CREATE TABLE IF NOT EXISTS white_label_config (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL UNIQUE,
    
    -- Branding - Logo
    logo_light_url TEXT,
    logo_dark_url TEXT,
    logo_small_url TEXT, -- For mobile/favicon
    favicon_url TEXT,
    
    -- Branding - Colors
    color_primary TEXT,
    color_primary_dark TEXT,
    color_secondary TEXT,
    color_accent TEXT,
    color_background TEXT,
    color_text TEXT,
    
    -- Branding - Typography
    font_family TEXT,
    font_heading TEXT,
    
    -- Custom CSS
    custom_css TEXT,
    custom_css_enabled INTEGER DEFAULT 0,
    
    -- Custom Domain
    custom_domain TEXT UNIQUE,
    custom_domain_status TEXT DEFAULT 'pending', -- 'pending', 'verifying', 'verified', 'failed'
    custom_domain_verified_at TIMESTAMP,
    custom_domain_dns_records TEXT, -- JSON: required DNS records
    ssl_certificate_id TEXT,
    ssl_certificate_expires_at TIMESTAMP,
    ssl_auto_renew INTEGER DEFAULT 1,
    
    -- Email Branding
    email_from_name TEXT,
    email_from_address TEXT,
    email_reply_to TEXT,
    email_domain_verified INTEGER DEFAULT 0,
    email_dkim_configured INTEGER DEFAULT 0,
    email_spf_configured INTEGER DEFAULT 0,
    email_template_header TEXT, -- Custom HTML
    email_template_footer TEXT,
    
    -- Report Branding
    report_header_logo_url TEXT,
    report_footer_logo_url TEXT,
    report_footer_text TEXT,
    report_cover_template TEXT,
    hide_consultinity_branding INTEGER DEFAULT 0,
    
    -- Login Page
    login_background_url TEXT,
    login_background_color TEXT,
    login_welcome_title TEXT,
    login_welcome_text TEXT,
    login_custom_html TEXT,
    login_show_social INTEGER DEFAULT 1,
    
    -- App Customization
    app_name TEXT, -- Override "Consultinity"
    app_tagline TEXT,
    help_url TEXT, -- Custom help center URL
    support_email TEXT,
    privacy_policy_url TEXT,
    terms_url TEXT,
    
    -- Feature visibility
    hide_upgrade_prompts INTEGER DEFAULT 0,
    hide_partner_links INTEGER DEFAULT 0,
    
    is_enabled INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);
CREATE INDEX IF NOT EXISTS idx_whitelabel_org ON white_label_config(organization_id);
CREATE INDEX IF NOT EXISTS idx_whitelabel_domain ON white_label_config(custom_domain);

-- approval_requests  (source: 236_security_module_extended.sql)
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

-- approval_workflows  (source: 236_security_module_extended.sql)
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

-- dlp_policies  (source: 236_security_module_extended.sql)
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

-- dlp_violations  (source: 236_security_module_extended.sql)
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

-- threat_intelligence  (source: 236_security_module_extended.sql)
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

-- ip_access_rules  (source: 134_advanced_security.sql)
CREATE TABLE IF NOT EXISTS ip_access_rules (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    organization_id TEXT,
    ip_address TEXT NOT NULL, -- Single IP or CIDR notation
    rule_type TEXT NOT NULL DEFAULT 'allow', -- 'allow' or 'block'
    description TEXT,
    is_active INTEGER DEFAULT 1,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_ip_access_rules_user ON ip_access_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_ip_access_rules_org ON ip_access_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_ip_access_rules_ip ON ip_access_rules(ip_address);

-- ip_whitelist  (source: 258_advanced_security.sql)
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

-- sso_configurations  (source: 258_advanced_security.sql)
CREATE TABLE IF NOT EXISTS sso_configurations (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    
    -- Protocol
    protocol TEXT NOT NULL, -- 'saml', 'oidc'
    provider_name TEXT NOT NULL,
    provider_type TEXT NOT NULL, -- 'okta', 'azure_ad', 'google', 'onelogin', 'auth0', 'keycloak', 'custom'
    
    -- SAML config (JSON)
    saml_entity_id TEXT,
    saml_sso_url TEXT,
    saml_slo_url TEXT,
    saml_certificate TEXT,
    saml_signature_algorithm TEXT DEFAULT 'SHA256',
    saml_name_id_format TEXT DEFAULT 'emailAddress',
    
    -- OIDC config (encrypted in app layer)
    oidc_issuer TEXT,
    oidc_client_id TEXT,
    oidc_client_secret TEXT, -- Encrypted
    oidc_authorization_url TEXT,
    oidc_token_url TEXT,
    oidc_userinfo_url TEXT,
    oidc_scopes TEXT DEFAULT 'openid profile email',
    
    -- Attribute mappings (JSON)
    attribute_mappings TEXT DEFAULT '{"email":"email","firstName":"given_name","lastName":"family_name"}',
    
    -- Settings
    jit_provisioning INTEGER DEFAULT 1, -- Just-in-time user provisioning
    default_role TEXT DEFAULT 'user',
    group_mappings TEXT DEFAULT '[]', -- JSON: [{idpGroup, appRole}]
    
    -- Domains
    allowed_domains TEXT, -- JSON array of email domains
    
    -- Status
    is_enabled INTEGER DEFAULT 0,
    is_default INTEGER DEFAULT 0,
    
    -- Audit
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP,
    
    UNIQUE(organization_id, provider_name)
);
CREATE INDEX IF NOT EXISTS idx_sso_config_org ON sso_configurations(organization_id);
CREATE INDEX IF NOT EXISTS idx_sso_config_enabled ON sso_configurations(is_enabled);

-- webauthn_challenges  (source: 200_security_mvp_enterprise.sql.sql)
CREATE TABLE IF NOT EXISTS webauthn_challenges (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    
    -- Challenge data
    challenge TEXT NOT NULL, -- Base64URL encoded
    challenge_type TEXT NOT NULL CHECK(challenge_type IN ('registration', 'authentication')),
    
    -- RP info
    rp_id TEXT NOT NULL,
    rp_name TEXT,
    
    -- User verification requirement
    user_verification TEXT DEFAULT 'preferred' CHECK(user_verification IN ('required', 'preferred', 'discouraged')),
    
    -- For registration
    attestation TEXT DEFAULT 'none' CHECK(attestation IN ('none', 'direct', 'indirect', 'enterprise')),
    authenticator_selection TEXT, -- JSON
    
    -- For authentication
    allowed_credentials TEXT, -- JSON array of credential IDs
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'used', 'expired')),
    
    -- Expiration
    expires_at TEXT NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    used_at TEXT,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_user ON webauthn_challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_status ON webauthn_challenges(status);
CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_expires ON webauthn_challenges(expires_at);

-- webauthn_credentials  (source: 200_security_mvp_enterprise.sql.sql)
CREATE TABLE IF NOT EXISTS webauthn_credentials (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    
    -- Credential info
    credential_id TEXT NOT NULL UNIQUE, -- Base64URL encoded
    public_key TEXT NOT NULL, -- COSE key in base64
    
    -- Authenticator info
    aaguid TEXT, -- Authenticator Attestation GUID
    sign_count INTEGER DEFAULT 0,
    transports TEXT, -- JSON array: ['usb', 'nfc', 'ble', 'internal']
    
    -- Attestation
    attestation_type TEXT DEFAULT 'none', -- 'none', 'direct', 'indirect', 'enterprise'
    attestation_format TEXT, -- 'packed', 'tpm', 'android-key', etc.
    
    -- Device info
    device_name TEXT,
    device_type TEXT DEFAULT 'unknown' CHECK(device_type IN ('platform', 'cross-platform', 'unknown')),
    
    -- Backup eligibility (for passkeys)
    backup_eligible INTEGER DEFAULT 0,
    backup_state INTEGER DEFAULT 0,
    
    -- Usage
    last_used_at TEXT,
    usage_count INTEGER DEFAULT 0,
    
    -- Status
    is_active INTEGER DEFAULT 1,
    revoked_at TEXT,
    revoked_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_webauthn_creds_user ON webauthn_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_webauthn_creds_credential ON webauthn_credentials(credential_id);

-- gdpr_data_subject_requests  (source: 015_enterprise_customers_module.sql)
CREATE TABLE IF NOT EXISTS gdpr_data_subject_requests (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT,
    request_type TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    requested_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    data_json TEXT,
    notes TEXT,
    created_by TEXT,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_gdpr_requests_org ON gdpr_data_subject_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_requests_user ON gdpr_data_subject_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_requests_status ON gdpr_data_subject_requests(status);

-- superadmin_audit_log  (source: 232_configuration_module_tables.sql)
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

-- churn_warnings  (source: 230_superadmin_overview_production.sql)
CREATE TABLE IF NOT EXISTS churn_warnings (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    warning_type TEXT NOT NULL, -- 'USAGE_DROP', 'NO_LOGIN', 'FEATURE_ABANDON', 'SUPPORT_ISSUES', 'PAYMENT_RISK'
    severity TEXT DEFAULT 'MEDIUM', -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    message TEXT,
    metrics TEXT, -- JSON with details
    status TEXT DEFAULT 'ACTIVE', -- 'ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED'
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMPTZ,
    resolved_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_churn_warnings_org ON churn_warnings(organization_id);
CREATE INDEX IF NOT EXISTS idx_churn_warnings_status ON churn_warnings(status);
CREATE INDEX IF NOT EXISTS idx_churn_warnings_severity ON churn_warnings(severity);

-- ownership_transfers  (source: 100_owner_role_postgres.sql)
CREATE TABLE IF NOT EXISTS ownership_transfers (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    from_user_id TEXT NOT NULL REFERENCES users(id),
    to_user_id TEXT NOT NULL REFERENCES users(id),
    reason TEXT,
    transferred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    transferred_by TEXT NOT NULL REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_ownership_transfers_org ON ownership_transfers(organization_id);

-- ----------------------------------------------------------------------------
-- DOMAIN: Help / Onboarding / Tooltips
-- ----------------------------------------------------------------------------

-- help_analytics  (source: 070_help_feedback.sql)
CREATE TABLE IF NOT EXISTS help_analytics (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    organization_id TEXT,
    session_id TEXT,
    event_type TEXT NOT NULL CHECK (event_type IN ('view', 'search', 'click', 'complete', 'video_progress', 'tour_step', 'tour_complete', 'feedback_submit')),
    content_type TEXT CHECK (content_type IN ('module', 'card', 'faq', 'video', 'tour', 'search')),
    content_id TEXT,
    metadata TEXT, -- JSON: search query, progress percentage, etc.
    duration_ms INTEGER, -- Time spent on content
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_help_analytics_event ON help_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_help_analytics_content ON help_analytics(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_help_analytics_user ON help_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_help_analytics_org ON help_analytics(organization_id);
CREATE INDEX IF NOT EXISTS idx_help_analytics_session ON help_analytics(session_id);
CREATE INDEX IF NOT EXISTS idx_help_analytics_created ON help_analytics(created_at);

-- help_feedback  (source: 070_help_feedback.sql)
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
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_help_feedback_content ON help_feedback(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_help_feedback_user ON help_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_help_feedback_org ON help_feedback(organization_id);
CREATE INDEX IF NOT EXISTS idx_help_feedback_created ON help_feedback(created_at);

-- help_progress  (source: 230_superadmin_overview_production.sql)
CREATE TABLE IF NOT EXISTS help_progress (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT,
    playbook_key TEXT NOT NULL,
    step_index INTEGER DEFAULT 0,
    total_steps INTEGER NOT NULL DEFAULT 5,
    started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    completion_percentage INTEGER DEFAULT 0,
    UNIQUE(user_id, playbook_key)
);
CREATE INDEX IF NOT EXISTS idx_help_progress_playbook ON help_progress(playbook_key);
CREATE INDEX IF NOT EXISTS idx_help_progress_user ON help_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_help_progress_org ON help_progress(organization_id);

-- module_help  (source: 255_help_system.sql)
CREATE TABLE IF NOT EXISTS module_help (
    id TEXT PRIMARY KEY,
    module_key TEXT NOT NULL UNIQUE, -- e.g., 'initiatives', 'assessments.drd', 'tools.process-flow'
    title TEXT NOT NULL,
    title_translations TEXT, -- JSON
    short_description TEXT NOT NULL,
    short_description_translations TEXT, -- JSON
    video_url TEXT,
    video_duration_seconds INTEGER,
    article_id TEXT, -- Link to full article
    tips TEXT DEFAULT '[]', -- JSON array of quick tips
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES help_articles(id)
);
CREATE INDEX IF NOT EXISTS idx_module_help_key ON module_help(module_key);

-- ticket_messages  (source: 255_help_system.sql)
CREATE TABLE IF NOT EXISTS ticket_messages (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL,
    sender_type TEXT NOT NULL, -- 'user', 'support', 'system', 'ai'
    sender_id TEXT,
    sender_name TEXT,
    message TEXT NOT NULL,
    attachments TEXT DEFAULT '[]', -- JSON array of file IDs
    is_internal BOOLEAN DEFAULT FALSE, -- Internal notes for support team
    is_solution BOOLEAN DEFAULT FALSE, -- Mark as solution message
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_internal ON ticket_messages(is_internal);

-- tooltip_dismissals  (source: 255_help_system.sql)
CREATE TABLE IF NOT EXISTS tooltip_dismissals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    tooltip_id TEXT NOT NULL,
    tooltip_type TEXT DEFAULT 'standard', -- 'standard', 'module_help', 'onboarding'
    dismissed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    dismiss_duration TEXT NOT NULL, -- '15_days', '30_days', '60_days', 'forever'
    show_again_at TIMESTAMP,
    UNIQUE(user_id, tooltip_id)
);
CREATE INDEX IF NOT EXISTS idx_tooltip_dismissals_user ON tooltip_dismissals(user_id);
CREATE INDEX IF NOT EXISTS idx_tooltip_dismissals_show ON tooltip_dismissals(show_again_at);

-- user_help_interactions  (source: 255_help_system.sql)
CREATE TABLE IF NOT EXISTS user_help_interactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    interaction_type TEXT NOT NULL, -- 'article_view', 'video_watch', 'search', 'feedback', 'tooltip_dismiss'
    target_id TEXT, -- Article ID, video ID, etc.
    target_type TEXT, -- 'article', 'video', 'module_help'
    search_query TEXT, -- For search interactions
    feedback_value INTEGER, -- 1 for helpful, -1 for not helpful
    feedback_comment TEXT,
    duration_seconds INTEGER, -- Time spent
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_help_interactions_user ON user_help_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_help_interactions_type ON user_help_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_help_interactions_target ON user_help_interactions(target_type, target_id);

-- onboarding_achievements  (source: 254_onboarding_extended.sql)
CREATE TABLE IF NOT EXISTS onboarding_achievements (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    points INTEGER DEFAULT 10,
    condition_type TEXT NOT NULL, -- 'step_complete', 'points_reached', 'all_complete', 'bonus'
    condition_value TEXT, -- Step ID, points threshold, or custom condition
    is_hidden BOOLEAN DEFAULT FALSE, -- Hidden achievements
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- onboarding_steps  (source: 254_onboarding_extended.sql)
CREATE TABLE IF NOT EXISTS onboarding_steps (
    id TEXT PRIMARY KEY,
    step_order INTEGER NOT NULL,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    is_required BOOLEAN DEFAULT TRUE,
    points INTEGER DEFAULT 10,
    trigger_action TEXT, -- What action completes this step
    help_url TEXT,
    icon TEXT,
    estimated_minutes INTEGER DEFAULT 5,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- onboarding_tooltips  (source: 254_onboarding_extended.sql)
CREATE TABLE IF NOT EXISTS onboarding_tooltips (
    id TEXT PRIMARY KEY,
    target_selector TEXT NOT NULL, -- CSS selector for target element
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    position TEXT DEFAULT 'bottom', -- 'top', 'bottom', 'left', 'right'
    order_index INTEGER NOT NULL,
    page_pattern TEXT, -- URL pattern where this appears (regex)
    trigger_type TEXT DEFAULT 'auto', -- 'auto', 'click', 'hover'
    show_once BOOLEAN DEFAULT TRUE,
    delay_ms INTEGER DEFAULT 500,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- user_tooltips_seen  (source: 254_onboarding_extended.sql)
CREATE TABLE IF NOT EXISTS user_tooltips_seen (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    tooltip_id TEXT NOT NULL,
    seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, tooltip_id),
    FOREIGN KEY (tooltip_id) REFERENCES onboarding_tooltips(id)
);
CREATE INDEX IF NOT EXISTS idx_user_tooltips_user ON user_tooltips_seen(user_id);

-- user_onboarding  (source: 244_onboarding_progress.sql)
CREATE TABLE IF NOT EXISTS user_onboarding (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    organization_id TEXT NOT NULL,
    
    -- Onboarding steps completion
    profile_completed INTEGER DEFAULT 0,
    team_invited INTEGER DEFAULT 0,
    first_project_created INTEGER DEFAULT 0,
    first_assessment_run INTEGER DEFAULT 0,
    ai_assistant_used INTEGER DEFAULT 0,
    settings_configured INTEGER DEFAULT 0,
    
    -- Progress tracking
    current_step TEXT DEFAULT 'profile',
    completed_steps TEXT DEFAULT '[]', -- JSON array of step names
    skipped_steps TEXT DEFAULT '[]',   -- JSON array of skipped steps
    
    -- Timestamps
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_onboarding_user ON user_onboarding(user_id);
CREATE INDEX IF NOT EXISTS idx_user_onboarding_org ON user_onboarding(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_onboarding_completed ON user_onboarding(completed_at);

-- user_onboarding_progress  (source: 015_enterprise_customers_module.sql)
CREATE TABLE IF NOT EXISTS user_onboarding_progress (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    step_key TEXT NOT NULL,
    step_name TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    completed_at TIMESTAMPTZ,
    skipped INTEGER DEFAULT 0,
    skipped_at TIMESTAMPTZ,
    progress_data TEXT DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    UNIQUE(user_id, organization_id, step_key)
);
CREATE INDEX IF NOT EXISTS idx_user_onboarding_user ON user_onboarding_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_onboarding_org ON user_onboarding_progress(organization_id);

-- ----------------------------------------------------------------------------
-- DOMAIN: Initiatives / PMO / Projects
-- ----------------------------------------------------------------------------

-- initiative_history  (source: 247_initiative_enhancements.sql)
CREATE TABLE IF NOT EXISTS initiative_history (
    id TEXT PRIMARY KEY,
    initiative_id TEXT NOT NULL,
    action TEXT NOT NULL, -- 'created', 'updated', 'status_changed', 'moved', 'blocked', 'unblocked'
    old_value TEXT, -- JSON
    new_value TEXT, -- JSON
    changed_by TEXT NOT NULL,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_initiative_history_initiative ON initiative_history(initiative_id);
CREATE INDEX IF NOT EXISTS idx_initiative_history_action ON initiative_history(action);

-- initiative_watchers  (source: 334_initiative_watchers.sql)
CREATE TABLE IF NOT EXISTS initiative_watchers (
  id TEXT PRIMARY KEY,
  initiative_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_initiative_watchers_unique ON initiative_watchers(initiative_id, user_id);
CREATE INDEX IF NOT EXISTS idx_initiative_watchers_initiative ON initiative_watchers(initiative_id);
CREATE INDEX IF NOT EXISTS idx_initiative_watchers_user ON initiative_watchers(user_id);

-- locations  (source: 245_project_enhancements.sql)
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

-- pmo_role_definitions  (source: 245_project_enhancements.sql)
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

-- pmo_standards  (source: 245_project_enhancements.sql)
CREATE TABLE IF NOT EXISTS pmo_standards (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- project_budgets  (source: 063_project_kpis.sql)
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
    last_updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_project_budgets_project ON project_budgets(project_id);

-- project_kpis  (source: 063_project_kpis.sql)
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
    last_updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_project_kpis_project ON project_kpis(project_id);
CREATE INDEX IF NOT EXISTS idx_project_kpis_category ON project_kpis(category);
CREATE INDEX IF NOT EXISTS idx_project_kpis_status ON project_kpis(status);

-- project_insights  (source: 072_project_intelligence.sql.sql)
CREATE TABLE IF NOT EXISTS project_insights (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    session_id TEXT,
    category TEXT NOT NULL CHECK(category IN (
        'objective', 'stakeholder', 'risk', 'assumption', 
        'constraint', 'decision', 'dependency', 'success_criteria'
    )),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    source TEXT,
    confidence TEXT DEFAULT 'medium' CHECK(confidence IN ('high', 'medium', 'low')),
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'confirmed', 'archived')),
    related_insights TEXT,
    pmo_domain TEXT,
    created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES interview_sessions(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_insights_project ON project_insights(project_id);
CREATE INDEX IF NOT EXISTS idx_insights_category ON project_insights(category);
CREATE INDEX IF NOT EXISTS idx_insights_status ON project_insights(status);

-- project_role_assignments  (source: 245_project_enhancements.sql)
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

-- project_notification_settings  (source: 004_project_notification_settings.sql.sql)
CREATE TABLE IF NOT EXISTS project_notification_settings (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL UNIQUE,
    -- Task notifications
    task_overdue_enabled INTEGER DEFAULT 1,
    task_due_soon_enabled INTEGER DEFAULT 1,
    task_blocked_enabled INTEGER DEFAULT 1,
    -- Decision notifications
    decision_pending_enabled INTEGER DEFAULT 1,
    decision_escalation_enabled INTEGER DEFAULT 1,
    -- Phase notifications
    phase_transition_enabled INTEGER DEFAULT 1,
    gate_blocked_enabled INTEGER DEFAULT 1,
    -- Initiative notifications
    initiative_at_risk_enabled INTEGER DEFAULT 1,
    -- Escalation settings
    escalation_days INTEGER DEFAULT 3,
    escalation_email_enabled INTEGER DEFAULT 0,
    -- Email digest settings
    email_daily_digest INTEGER DEFAULT 0,
    email_weekly_summary INTEGER DEFAULT 0,
    -- Metadata
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_pns_project_id ON project_notification_settings(project_id);

-- task_escalations  (source: 042_pmo_roles_workstreams.sql.sql)
CREATE TABLE IF NOT EXISTS task_escalations (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Escalation level transition (0→1→2→3)
  from_level INTEGER NOT NULL DEFAULT 0,
  to_level INTEGER NOT NULL DEFAULT 1,
  
  -- Who received the escalation
  escalated_to_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  
  -- Reason for escalation
  reason TEXT NOT NULL,
  
  -- Type of escalation trigger: SLA_BREACH, BLOCKED, MANUAL, PRIORITY_CHANGE
  trigger_type TEXT NOT NULL DEFAULT 'SLA_BREACH',
  
  -- Resolution (if resolved)
  resolved_at TEXT,
  resolution_note TEXT,
  
  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_task_escalations_task ON task_escalations(task_id);
CREATE INDEX IF NOT EXISTS idx_task_escalations_project ON task_escalations(project_id);
CREATE INDEX IF NOT EXISTS idx_task_escalations_escalated_to ON task_escalations(escalated_to_id);
CREATE INDEX IF NOT EXISTS idx_task_escalations_trigger ON task_escalations(trigger_type);

-- task_history  (source: 001_upgrade_tasks.sql.sql)
CREATE TABLE IF NOT EXISTS task_history (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    field TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by TEXT,
    changed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY(changed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ----------------------------------------------------------------------------
-- DOMAIN: Integrations / MCP / Webhooks / Notifications
-- ----------------------------------------------------------------------------

-- integration_api_keys  (source: 256_integrations_system.sql)
CREATE TABLE IF NOT EXISTS integration_api_keys (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    
    -- Key details
    name TEXT NOT NULL,
    api_key_hash TEXT NOT NULL, -- Hashed key
    key_prefix TEXT NOT NULL, -- First 8 chars for identification
    
    -- Permissions
    permissions TEXT DEFAULT '["read","write"]', -- JSON array
    allowed_events TEXT DEFAULT '[]', -- JSON array of allowed trigger events
    allowed_actions TEXT DEFAULT '[]', -- JSON array of allowed actions
    
    -- Rate limiting
    rate_limit_per_minute INTEGER DEFAULT 60,
    rate_limit_per_day INTEGER DEFAULT 10000,
    
    -- Usage tracking
    last_used_at TIMESTAMP,
    request_count INTEGER DEFAULT 0,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP,
    
    -- Audit
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP,
    revoked_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_api_keys_org ON integration_api_keys(organization_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON integration_api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON integration_api_keys(is_active);

-- integration_sync_log  (source: 256_integrations_system.sql)
CREATE TABLE IF NOT EXISTS integration_sync_log (
    id TEXT PRIMARY KEY,
    integration_id TEXT NOT NULL,
    
    -- Sync details
    sync_type TEXT NOT NULL, -- 'full', 'incremental', 'single_item', 'webhook'
    direction TEXT NOT NULL, -- 'push', 'pull', 'bidirectional'
    trigger_type TEXT DEFAULT 'scheduled', -- 'scheduled', 'manual', 'webhook', 'realtime'
    
    -- Results
    status TEXT NOT NULL, -- 'success', 'partial', 'failed'
    items_processed INTEGER DEFAULT 0,
    items_created INTEGER DEFAULT 0,
    items_updated INTEGER DEFAULT 0,
    items_deleted INTEGER DEFAULT 0,
    items_failed INTEGER DEFAULT 0,
    items_skipped INTEGER DEFAULT 0,
    
    -- Errors
    error_summary TEXT,
    error_details TEXT, -- JSON array of errors
    
    -- Performance
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    duration_ms INTEGER,
    
    FOREIGN KEY (integration_id) REFERENCES integrations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sync_log_integration ON integration_sync_log(integration_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_status ON integration_sync_log(status);
CREATE INDEX IF NOT EXISTS idx_sync_log_started ON integration_sync_log(started_at);

-- integration_sync_mappings  (source: 256_integrations_system.sql)
CREATE TABLE IF NOT EXISTS integration_sync_mappings (
    id TEXT PRIMARY KEY,
    integration_id TEXT NOT NULL,
    
    -- Local entity
    local_type TEXT NOT NULL, -- 'task', 'initiative', 'project', 'decision'
    local_id TEXT NOT NULL,
    
    -- External entity
    external_type TEXT NOT NULL, -- 'issue', 'task', 'card', 'message'
    external_id TEXT NOT NULL,
    external_url TEXT,
    
    -- Sync state
    last_local_update TIMESTAMP,
    last_external_update TIMESTAMP,
    last_sync_at TIMESTAMP,
    sync_status TEXT DEFAULT 'synced', -- 'synced', 'pending_push', 'pending_pull', 'conflict', 'error'
    conflict_data TEXT, -- JSON: conflict details
    
    -- Metadata
    metadata TEXT DEFAULT '{}', -- JSON: extra sync data
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(integration_id, local_type, local_id),
    UNIQUE(integration_id, external_type, external_id),
    FOREIGN KEY (integration_id) REFERENCES integrations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sync_mappings_integration ON integration_sync_mappings(integration_id);
CREATE INDEX IF NOT EXISTS idx_sync_mappings_local ON integration_sync_mappings(local_type, local_id);
CREATE INDEX IF NOT EXISTS idx_sync_mappings_external ON integration_sync_mappings(external_type, external_id);
CREATE INDEX IF NOT EXISTS idx_sync_mappings_status ON integration_sync_mappings(sync_status);

-- mcp_audit_logs  (source: 105_user_integrations.sql)
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
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_user ON mcp_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_created ON mcp_audit_logs(created_at);

-- webhook_retry_queue  (source: 242_webhook_retry_queue.sql)
CREATE TABLE IF NOT EXISTS webhook_retry_queue (
    id TEXT PRIMARY KEY,
    webhook_type TEXT NOT NULL, -- 'stripe', 'partner', etc.
    event_type TEXT NOT NULL, -- e.g., 'invoice.paid', 'subscription.updated'
    event_id TEXT, -- Original event ID from provider
    payload TEXT NOT NULL, -- JSON payload
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 5,
    next_retry_at TIMESTAMP,
    last_error TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_webhook_retry_status ON webhook_retry_queue(status);
CREATE INDEX IF NOT EXISTS idx_webhook_retry_event ON webhook_retry_queue(event_id);

-- notification_delivery_log  (source: 257_notification_system.sql)
CREATE TABLE IF NOT EXISTS notification_delivery_log (
    id TEXT PRIMARY KEY,
    notification_id TEXT NOT NULL,
    channel TEXT NOT NULL, -- 'in_app', 'email', 'slack', 'teams', 'push'
    
    -- Delivery status
    status TEXT NOT NULL, -- 'pending', 'sent', 'delivered', 'failed', 'bounced', 'skipped'
    status_reason TEXT, -- Why skipped/failed
    
    -- Timestamps
    queued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    failed_at TIMESTAMP,
    
    -- Error details
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Channel-specific
    external_id TEXT, -- Message ID from email/Slack/etc.
    
    -- Engagement (for email)
    opened_at TIMESTAMP,
    clicked_at TIMESTAMP,
    
    FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_delivery_log_notification ON notification_delivery_log(notification_id);
CREATE INDEX IF NOT EXISTS idx_delivery_log_channel ON notification_delivery_log(channel);
CREATE INDEX IF NOT EXISTS idx_delivery_log_status ON notification_delivery_log(status);

-- notification_preferences  (source: 257_notification_system.sql)
CREATE TABLE IF NOT EXISTS notification_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    
    -- Global settings
    global_enabled BOOLEAN DEFAULT TRUE,
    quiet_hours_enabled BOOLEAN DEFAULT FALSE,
    quiet_hours_start TEXT DEFAULT '22:00',
    quiet_hours_end TEXT DEFAULT '08:00',
    quiet_hours_timezone TEXT DEFAULT 'UTC',
    quiet_hours_weekends_only BOOLEAN DEFAULT FALSE,
    
    -- Email settings
    email_enabled BOOLEAN DEFAULT TRUE,
    email_digest_enabled BOOLEAN DEFAULT FALSE,
    email_digest_frequency TEXT DEFAULT 'daily', -- 'daily', 'weekly'
    email_digest_time TEXT DEFAULT '09:00',
    email_digest_day TEXT DEFAULT 'monday', -- For weekly
    
    -- Per-type settings (JSON)
    type_settings TEXT DEFAULT '{}', -- {notificationType: {enabled, channels[]}}
    
    -- Integration preferences
    slack_enabled BOOLEAN DEFAULT TRUE,
    slack_dm_enabled BOOLEAN DEFAULT TRUE,
    teams_enabled BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON notification_preferences(user_id);

-- interview_context_exports  (source: 295_interview_context.sql)
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

-- ----------------------------------------------------------------------------
-- DOMAIN: Management Reports / Status Reports
-- ----------------------------------------------------------------------------

-- management_reports  (source: 271_management_reports_extended.sql)
CREATE TABLE IF NOT EXISTS management_reports (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    project_id TEXT,
    report_type TEXT NOT NULL CHECK (report_type IN ('TEAM_MEETING', 'TEAM_WEEKLY', 'STEERING_COMMITTEE', 'PORTFOLIO_HEALTH', 'RAID')),
    scope TEXT NOT NULL DEFAULT 'PROJECT' CHECK (scope IN ('PROJECT', 'PORTFOLIO')),
    title TEXT NOT NULL,
    period_start DATE,
    period_end DATE,
    status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'FINAL', 'ARCHIVED')),
    generated_by TEXT NOT NULL,
    content JSON,
    ai_narrative TEXT,
    ai_warnings JSON,
    pdf_path TEXT,
    pptx_path TEXT,
    share_token TEXT UNIQUE,
    share_expires_at TIMESTAMPTZ,
    pmo_domain TEXT DEFAULT 'PERFORMANCE_MONITORING',
    iso21500_mapping TEXT DEFAULT 'Project Performance Measurement (Clause 4.4.22)',
    pmbok_mapping TEXT DEFAULT 'Measurement Performance Domain',
    prince2_mapping TEXT DEFAULT 'Highlight Report / Progress Theme',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    current_version INTEGER DEFAULT 1,
    approval_status TEXT DEFAULT 'NONE',
    requires_approval BOOLEAN DEFAULT FALSE,
    approval_config JSON,
    locked_at TIMESTAMPTZ,
    locked_by TEXT,
    finalized_at TIMESTAMPTZ,
    finalized_by TEXT,
    integrity_hash TEXT,
    previous_report_id TEXT,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_mr_organization ON management_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_mr_project ON management_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_mr_type ON management_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_mr_scope ON management_reports(scope);
CREATE INDEX IF NOT EXISTS idx_mr_status ON management_reports(status);
CREATE INDEX IF NOT EXISTS idx_mr_created ON management_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mr_share_token ON management_reports(share_token);
CREATE INDEX IF NOT EXISTS idx_mr_org_type_date ON management_reports(organization_id, report_type, created_at DESC);

-- management_report_approvals  (source: 064_management_reports_enterprise.sql)
CREATE TABLE IF NOT EXISTS management_report_approvals (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    version_id TEXT,
    approval_level INTEGER DEFAULT 1,     -- 1=PM, 2=PMO Lead, 3=Sponsor
    required_role TEXT NOT NULL,          -- MANAGER, PMO_LEAD, SPONSOR
    assigned_to TEXT,                     -- Specific user if assigned
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'SKIPPED')),
    decision_comment TEXT,
    decided_at TIMESTAMPTZ,
    decided_by TEXT,
    sla_due_at TIMESTAMPTZ,
    reminder_sent_at TIMESTAMPTZ,
    escalated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES management_reports(id) ON DELETE CASCADE,
    FOREIGN KEY (version_id) REFERENCES management_report_versions(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_mra_report ON management_report_approvals(report_id);
CREATE INDEX IF NOT EXISTS idx_mra_status ON management_report_approvals(status);
CREATE INDEX IF NOT EXISTS idx_mra_assigned ON management_report_approvals(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_mra_level ON management_report_approvals(report_id, approval_level);
CREATE INDEX IF NOT EXISTS idx_mra_sla ON management_report_approvals(sla_due_at);

-- management_report_audit_log  (source: 064_management_reports_enterprise.sql)
CREATE TABLE IF NOT EXISTS management_report_audit_log (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    version_id TEXT,
    action TEXT NOT NULL,                 -- CREATED, UPDATED, SUBMITTED, APPROVED, REJECTED, FINALIZED, SHARED, VIEWED, EXPORTED
    actor_id TEXT NOT NULL,
    actor_name TEXT,
    actor_email TEXT,
    details JSON,                         -- Action-specific details
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES management_reports(id) ON DELETE CASCADE,
    FOREIGN KEY (version_id) REFERENCES management_report_versions(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_mral_report ON management_report_audit_log(report_id);
CREATE INDEX IF NOT EXISTS idx_mral_action ON management_report_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_mral_actor ON management_report_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_mral_created ON management_report_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mral_report_action ON management_report_audit_log(report_id, action, created_at DESC);

-- management_report_comments  (source: 064_management_reports_enterprise.sql)
CREATE TABLE IF NOT EXISTS management_report_comments (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    version_id TEXT,
    section_id TEXT,                      -- 'executiveSummary', 'kpis', 'risks', etc.
    parent_comment_id TEXT,               -- For reply threads
    content TEXT NOT NULL,
    mentions JSON,                        -- ["user_id_1", "user_id_2"]
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_by TEXT,
    resolved_at TIMESTAMPTZ,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES management_reports(id) ON DELETE CASCADE,
    FOREIGN KEY (version_id) REFERENCES management_report_versions(id) ON DELETE SET NULL,
    FOREIGN KEY (parent_comment_id) REFERENCES management_report_comments(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_mrc_report ON management_report_comments(report_id);
CREATE INDEX IF NOT EXISTS idx_mrc_section ON management_report_comments(report_id, section_id);
CREATE INDEX IF NOT EXISTS idx_mrc_parent ON management_report_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_mrc_created_by ON management_report_comments(created_by);

-- management_report_schedules  (source: 271_management_reports_extended.sql)
CREATE TABLE IF NOT EXISTS management_report_schedules (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    project_id TEXT,
    report_type TEXT NOT NULL CHECK (report_type IN ('TEAM_MEETING', 'TEAM_WEEKLY', 'STEERING_COMMITTEE', 'PORTFOLIO_HEALTH', 'RAID')),
    scope TEXT NOT NULL DEFAULT 'PROJECT' CHECK (scope IN ('PROJECT', 'PORTFOLIO')),
    frequency TEXT NOT NULL CHECK (frequency IN ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY')),
    day_of_week INTEGER,
    day_of_month INTEGER,
    time_of_day TEXT DEFAULT '09:00',
    timezone TEXT DEFAULT 'Europe/Warsaw',
    is_active BOOLEAN DEFAULT TRUE,
    last_generated_at TIMESTAMPTZ,
    next_scheduled_at TIMESTAMPTZ,
    recipients JSON,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_mrs_org ON management_report_schedules(organization_id);
CREATE INDEX IF NOT EXISTS idx_mrs_next ON management_report_schedules(next_scheduled_at);
CREATE INDEX IF NOT EXISTS idx_mrs_active ON management_report_schedules(is_active);

-- management_report_templates  (source: 271_management_reports_extended.sql)
CREATE TABLE IF NOT EXISTS management_report_templates (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    report_type TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    sections JSON,
    is_default BOOLEAN DEFAULT FALSE,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_mrt_org ON management_report_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_mrt_type ON management_report_templates(organization_id, report_type);

-- management_report_versions  (source: 064_management_reports_enterprise.sql)
CREATE TABLE IF NOT EXISTS management_report_versions (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    version_label TEXT,                   -- "1.0", "1.1", "2.0"
    content JSON NOT NULL,
    ai_narrative TEXT,
    ai_warnings JSON,
    change_summary TEXT,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES management_reports(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_mrv_report ON management_report_versions(report_id);
CREATE INDEX IF NOT EXISTS idx_mrv_version ON management_report_versions(report_id, version_number);
CREATE INDEX IF NOT EXISTS idx_mrv_created ON management_report_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mrv_created_by ON management_report_versions(created_by);

-- report_distributions  (source: 066_status_reports.sql)
CREATE TABLE IF NOT EXISTS report_distributions (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    recipient_id TEXT,
    recipient_email TEXT,
    recipient_type TEXT DEFAULT 'STAKEHOLDER', -- STAKEHOLDER, SPONSOR, TEAM, EXTERNAL
    distribution_method TEXT DEFAULT 'EMAIL', -- EMAIL, LINK, PDF
    sent_at TEXT,
    opened_at TEXT,
    link_token TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES status_reports(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_report_distributions_report ON report_distributions(report_id);

-- report_sections  (source: 041_report_sections.sql.sql)
CREATE TABLE IF NOT EXISTS report_sections (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    section_type TEXT NOT NULL CHECK(section_type IN (
        'cover_page',
        'executive_summary', 
        'methodology',
        'maturity_overview',
        'axis_detail',
        'area_detail',
        'gap_analysis',
        'initiatives',
        'roadmap',
        'appendix',
        'custom'
    )),
    axis_id TEXT,                    -- For axis_detail sections (e.g., 'processes', 'digitalProducts')
    area_id TEXT,                    -- For area_detail sections (e.g., '1A', '2B')
    title TEXT NOT NULL,
    content TEXT,                    -- Rich text content (HTML/Markdown)
    data_snapshot TEXT,              -- JSON with table data at generation time
    order_index INTEGER DEFAULT 0,
    is_ai_generated INTEGER DEFAULT 0,
    ai_model_used TEXT,              -- Track which AI model generated content
    last_edited_by TEXT,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(report_id) REFERENCES assessment_reports(id) ON DELETE CASCADE,
    FOREIGN KEY(last_edited_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_report_sections_report_id ON report_sections(report_id);
CREATE INDEX IF NOT EXISTS idx_report_sections_type ON report_sections(report_id, section_type);
CREATE INDEX IF NOT EXISTS idx_report_sections_order ON report_sections(report_id, order_index);
CREATE INDEX IF NOT EXISTS idx_report_sections_axis ON report_sections(report_id, axis_id);

-- report_section_history  (source: 066_status_reports.sql)
CREATE TABLE IF NOT EXISTS report_section_history (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    section_name TEXT NOT NULL, -- SCHEDULE, BUDGET, SCOPE, QUALITY, RISKS, RESOURCES
    status TEXT NOT NULL, -- GREEN, AMBER, RED
    previous_status TEXT,
    content TEXT,
    highlights TEXT, -- JSON array
    issues TEXT, -- JSON array
    action_items TEXT, -- JSON array
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES status_reports(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_report_section_history_report ON report_section_history(report_id);

-- ----------------------------------------------------------------------------
-- DOMAIN: My Work / Tools / Studio
-- ----------------------------------------------------------------------------

-- a3_documents  (source: 252_tools_system.sql)
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

-- process_flows  (source: 252_tools_system.sql)
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

-- user_activity  (source: 253_mywork_system.sql)
CREATE TABLE IF NOT EXISTS user_activity (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    
    -- Activity details
    activity_type TEXT NOT NULL, 
    -- Types: 'task_created', 'task_completed', 'task_updated', 
    -- 'decision_made', 'decision_created', 'comment_added',
    -- 'assessment_started', 'assessment_completed', 'initiative_created',
    -- 'report_generated', 'login', 'logout'
    
    activity_data TEXT, -- JSON with details
    description TEXT, -- Human-readable description
    
    -- Related entity
    entity_type TEXT, -- 'task', 'decision', 'initiative', 'assessment', 'project', 'report'
    entity_id TEXT,
    entity_name TEXT,
    
    -- Context
    project_id TEXT,
    project_name TEXT,
    
    -- Visibility
    is_public INTEGER DEFAULT 1, -- Visible to team members
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_user_activity_user ON user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_org ON user_activity(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_type ON user_activity(activity_type);
CREATE INDEX IF NOT EXISTS idx_user_activity_created ON user_activity(created_at);
CREATE INDEX IF NOT EXISTS idx_user_activity_entity ON user_activity(entity_type, entity_id);

-- studio_documents  (source: 081_studio_tables.sql)
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
    is_public BOOLEAN DEFAULT FALSE,
    share_token TEXT UNIQUE,
    
    -- Metadata
    thumbnail_url TEXT,
    tags_json TEXT DEFAULT '[]',
    
    -- Audit
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(linked_task_id) REFERENCES tasks(id) ON DELETE SET NULL,
    FOREIGN KEY(linked_project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY(linked_initiative_id) REFERENCES initiatives(id) ON DELETE SET NULL,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_studio_documents_org ON studio_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_studio_documents_type ON studio_documents(type);
CREATE INDEX IF NOT EXISTS idx_studio_documents_created_by ON studio_documents(created_by);
CREATE INDEX IF NOT EXISTS idx_studio_documents_linked_task ON studio_documents(linked_task_id);
CREATE INDEX IF NOT EXISTS idx_studio_documents_linked_project ON studio_documents(linked_project_id);
CREATE INDEX IF NOT EXISTS idx_studio_documents_linked_initiative ON studio_documents(linked_initiative_id);
CREATE INDEX IF NOT EXISTS idx_studio_documents_share_token ON studio_documents(share_token);

-- studio_snapshots  (source: 081_studio_tables.sql)
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
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(document_id) REFERENCES studio_documents(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_studio_snapshots_document ON studio_snapshots(document_id);
CREATE INDEX IF NOT EXISTS idx_studio_snapshots_version ON studio_snapshots(document_id, version);

-- ----------------------------------------------------------------------------
-- DOMAIN: Users / Profiles / Settings / Groups / MFA / SMS
-- ----------------------------------------------------------------------------

-- active_sessions  (source: 080_user_settings_extended.sql)
CREATE TABLE IF NOT EXISTS active_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    device TEXT, -- Parsed from user_agent: 'Chrome on MacOS', 'Safari on iPhone', etc.
    ip_address TEXT,
    last_active TIMESTAMPTZ,
    session_token TEXT, -- Hashed token for validation
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_active_sessions_user ON active_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_token ON active_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_active_sessions_expires ON active_sessions(expires_at);

-- user_activity_summary  (source: 015_enterprise_customers_module.sql)
CREATE TABLE IF NOT EXISTS user_activity_summary (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    login_count INTEGER DEFAULT 0,
    last_login_at TIMESTAMPTZ,
    ai_interactions INTEGER DEFAULT 0,
    tasks_created INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    projects_accessed INTEGER DEFAULT 0,
    features_used_json TEXT DEFAULT '[]',
    engagement_score REAL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    UNIQUE(user_id, organization_id, period_start)
);
CREATE INDEX IF NOT EXISTS idx_user_activity_user ON user_activity_summary(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_org ON user_activity_summary(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_period ON user_activity_summary(period_start DESC);

-- user_adoption_metrics  (source: 015_enterprise_customers_module.sql)
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
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    UNIQUE(user_id, organization_id, metric_date)
);
CREATE INDEX IF NOT EXISTS idx_user_adoption_user ON user_adoption_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_adoption_org ON user_adoption_metrics(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_adoption_date ON user_adoption_metrics(metric_date DESC);

-- user_goals  (source: 030_user_goals.sql.sql)
CREATE TABLE IF NOT EXISTS user_goals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    goal_id TEXT NOT NULL,  -- 'strategic_decision', 'team_alignment', 'executive_prep', 'explore'
    metadata TEXT,          -- JSON
    selected_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_goals_user ON user_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_user_goals_date ON user_goals(selected_at);

-- user_groups  (source: 015_enterprise_customers_module.sql)
CREATE TABLE IF NOT EXISTS user_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    group_type TEXT,
    organization_id TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_user_groups_org ON user_groups(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_groups_type ON user_groups(group_type);

-- user_group_members  (source: 015_enterprise_customers_module.sql)
CREATE TABLE IF NOT EXISTS user_group_members (
    group_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT DEFAULT 'member',
    added_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    added_by TEXT,
    PRIMARY KEY(group_id, user_id),
    FOREIGN KEY(group_id) REFERENCES user_groups(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(added_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_user_group_members_group ON user_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_user_group_members_user ON user_group_members(user_id);

-- user_mfa_methods  (source: 015_enterprise_customers_module.sql)
CREATE TABLE IF NOT EXISTS user_mfa_methods (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    method_type TEXT NOT NULL,
    secret TEXT,
    phone_number TEXT,
    backup_codes_json TEXT DEFAULT '[]',
    is_enabled INTEGER DEFAULT 0,
    is_primary INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_mfa_user ON user_mfa_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_user_mfa_enabled ON user_mfa_methods(user_id, is_enabled);

-- user_profiles  (source: 015_enterprise_customers_module.sql)
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
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user ON user_profiles(user_id);

-- user_profile_extended  (source: 130_user_profile_extended.sql)
CREATE TABLE IF NOT EXISTS user_profile_extended (
    user_id TEXT PRIMARY KEY,
    
    -- Bio & About
    short_bio TEXT,
    long_bio TEXT,
    skills TEXT, -- JSON array of skill strings
    certifications TEXT, -- JSON array of {name, issuer, date, url}
    years_experience INTEGER,
    education TEXT, -- JSON array of {institution, degree, field, year}
    
    -- Professional Details
    department TEXT,
    manager_id TEXT,
    employee_id TEXT,
    hire_date TEXT,
    contract_type TEXT DEFAULT 'full-time', -- full-time, part-time, contractor, freelance
    working_hours_start TEXT DEFAULT '09:00',
    working_hours_end TEXT DEFAULT '17:00',
    work_days TEXT DEFAULT '[1,2,3,4,5]', -- JSON array [0-6] where 0=Sunday
    
    -- Social Links
    twitter_handle TEXT,
    github_username TEXT,
    website_url TEXT,
    portfolio_url TEXT,
    custom_links TEXT, -- JSON array of {name, url, icon}
    
    -- Extended Contact Information
    work_phone TEXT,
    mobile_phone TEXT,
    office_address TEXT,
    office_building TEXT,
    office_floor TEXT,
    office_desk TEXT,
    skype_username TEXT,
    teams_username TEXT,
    slack_username TEXT,
    discord_username TEXT,
    zoom_personal_link TEXT,
    
    -- Profile Visibility Settings
    profile_visibility TEXT DEFAULT 'organization', -- public, organization, team, private
    show_email_publicly INTEGER DEFAULT 0,
    show_phone_publicly INTEGER DEFAULT 0,
    show_activity_status INTEGER DEFAULT 1,
    show_last_seen INTEGER DEFAULT 1,
    show_in_directory INTEGER DEFAULT 1,
    allow_mentions_from TEXT DEFAULT 'all', -- all, team, none
    allow_direct_messages_from TEXT DEFAULT 'all', -- all, team, none
    
    -- Email & Communication Preferences
    email_signature TEXT,
    email_signature_html TEXT,
    email_aliases TEXT, -- JSON array of email strings
    email_forwarding TEXT, -- JSON array of {email, enabled}
    out_of_office_enabled INTEGER DEFAULT 0,
    out_of_office_message TEXT,
    out_of_office_start TEXT,
    out_of_office_end TEXT,
    out_of_office_auto_reply INTEGER DEFAULT 0,
    email_digest_frequency TEXT DEFAULT 'daily', -- realtime, daily, weekly, never
    
    -- Profile Completion Tracking
    profile_completion_score INTEGER DEFAULT 0,
    profile_completion_details TEXT, -- JSON object tracking what's filled
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_user_profile_extended_department ON user_profile_extended(department);
CREATE INDEX IF NOT EXISTS idx_user_profile_extended_manager ON user_profile_extended(manager_id);
CREATE INDEX IF NOT EXISTS idx_user_profile_extended_visibility ON user_profile_extended(profile_visibility);

-- user_activation_status  (source: 029_journey_analytics.sql.sql)
CREATE TABLE IF NOT EXISTS user_activation_status (
    user_id TEXT PRIMARY KEY,
    current_phase TEXT DEFAULT 'A',
    phase_a_activated INTEGER DEFAULT 0,
    phase_b_activated INTEGER DEFAULT 0,
    phase_c_activated INTEGER DEFAULT 0,
    phase_d_activated INTEGER DEFAULT 0,
    phase_e_activated INTEGER DEFAULT 0,
    phase_f_activated INTEGER DEFAULT 0,
    first_event_at TEXT,
    last_event_at TEXT,
    total_ttv_ms INTEGER,  -- Time to Value in milliseconds
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- journey_events  (source: 029_journey_analytics.sql.sql)
CREATE TABLE IF NOT EXISTS journey_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT,
    event_type TEXT NOT NULL,  -- 'phase_entry', 'milestone', 'feature_use', 'tour_event'
    event_name TEXT NOT NULL,
    phase TEXT,                -- A, B, C, D, E, F
    metadata TEXT,             -- JSON
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_journey_user ON journey_events(user_id);
CREATE INDEX IF NOT EXISTS idx_journey_type ON journey_events(event_type);
CREATE INDEX IF NOT EXISTS idx_journey_event_name ON journey_events(event_name);
CREATE INDEX IF NOT EXISTS idx_journey_phase ON journey_events(phase);
CREATE INDEX IF NOT EXISTS idx_journey_created ON journey_events(created_at);
CREATE INDEX IF NOT EXISTS idx_journey_funnel ON journey_events(event_type, phase, created_at);

-- sms_verification_codes  (source: 107_sms_mfa.sql)
CREATE TABLE IF NOT EXISTS sms_verification_codes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    code TEXT NOT NULL, -- Hashed 6-digit code
    purpose TEXT NOT NULL CHECK(purpose IN ('phone_verify', 'mfa_login', 'mfa_setup', 'password_reset')),
    expires_at TEXT NOT NULL,
    used_at TEXT,
    attempts INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sms_codes_user ON sms_verification_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_sms_codes_phone ON sms_verification_codes(phone_number);
CREATE INDEX IF NOT EXISTS idx_sms_codes_expires ON sms_verification_codes(expires_at);

-- sms_delivery_log  (source: 107_sms_mfa.sql)
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
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_sms_log_user ON sms_delivery_log(user_id);
CREATE INDEX IF NOT EXISTS idx_sms_log_phone ON sms_delivery_log(phone_number);
CREATE INDEX IF NOT EXISTS idx_sms_log_status ON sms_delivery_log(status);

-- sms_rate_limits  (source: 107_sms_mfa.sql)
CREATE TABLE IF NOT EXISTS sms_rate_limits (
    id SERIAL PRIMARY KEY,
    phone_number TEXT NOT NULL,
    user_id TEXT,
    count INTEGER DEFAULT 1,
    window_start TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(phone_number, window_start)
);
CREATE INDEX IF NOT EXISTS idx_sms_rate_phone ON sms_rate_limits(phone_number);

-- ----------------------------------------------------------------------------
-- DOMAIN: API Keys / Usage
-- ----------------------------------------------------------------------------

-- api_key_usage  (source: 044_api_keys.sql)
CREATE TABLE IF NOT EXISTS api_key_usage (
    id TEXT PRIMARY KEY,
    api_key_id TEXT NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    
    -- Request info
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    
    -- Request metadata
    ip_address TEXT,
    user_agent TEXT,
    
    -- Rate limit info
    requests_remaining INTEGER,
    
    -- Errors (if any)
    error_code TEXT,
    error_message TEXT,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_key ON api_key_usage(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_date ON api_key_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_endpoint ON api_key_usage(endpoint);

-- usage_alerts_sent  (source: 240_usage_alerts_tracking.sql)
CREATE TABLE IF NOT EXISTS usage_alerts_sent (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    alert_type TEXT NOT NULL, -- 'token' or 'storage'
    threshold INTEGER NOT NULL, -- 80, 90, or 100
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, alert_type, threshold)
);
CREATE INDEX IF NOT EXISTS idx_usage_alerts_sent_org ON usage_alerts_sent(organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_alerts_sent_lookup ON usage_alerts_sent(organization_id, alert_type, threshold);

-- ============================================================================
-- UNTRANSLATED: (none)
-- All 194 orphaned tables were translatable to Postgres-clean idempotent DDL.
-- ============================================================================