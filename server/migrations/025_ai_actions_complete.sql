-- Migration: 025_ai_actions_complete.sql
-- Step 9: AI Actions System - Complete Schema
-- Creates tables for action proposals, decisions, executions, and policy rules

-- =========================================
-- AI POLICY RULES (Step 9.8)
-- =========================================
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Global policy settings singleton
CREATE TABLE IF NOT EXISTS ai_policy_settings (
    id TEXT PRIMARY KEY DEFAULT 'global',
    policy_engine_enabled INTEGER DEFAULT 0,
    updated_by TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default global setting
INSERT OR IGNORE INTO ai_policy_settings (id, policy_engine_enabled) VALUES ('global', 0);

-- =========================================
-- AI ACTION PROPOSALS (Step 9.1)
-- =========================================
CREATE TABLE IF NOT EXISTS ai_action_proposals (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    proposal_type TEXT NOT NULL,
    action_type TEXT NOT NULL,
    scope TEXT DEFAULT 'ORG',
    risk_level TEXT DEFAULT 'LOW' CHECK(risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
    title TEXT NOT NULL,
    description TEXT,
    payload TEXT DEFAULT '{}',
    simulation_result TEXT,
    requires_approval INTEGER DEFAULT 1,
    origin_signal TEXT,
    status TEXT DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'EXECUTED')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME
);

-- =========================================
-- AI ACTION DECISIONS (Step 9.2)
-- =========================================
CREATE TABLE IF NOT EXISTS ai_action_decisions (
    id TEXT PRIMARY KEY,
    proposal_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    decision TEXT NOT NULL CHECK(decision IN ('APPROVED', 'REJECTED', 'MODIFIED')),
    decision_reason TEXT,
    modified_payload TEXT,
    proposal_snapshot TEXT NOT NULL,
    decided_by TEXT NOT NULL,
    policy_rule_id TEXT,
    auto_approved INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (proposal_id) REFERENCES ai_action_proposals(id)
);

-- =========================================
-- AI ACTION EXECUTIONS (Step 9.3)
-- =========================================
CREATE TABLE IF NOT EXISTS ai_action_executions (
    id TEXT PRIMARY KEY,
    decision_id TEXT NOT NULL,
    proposal_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    action_type TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED')),
    executed_by TEXT,
    result TEXT,
    error_code TEXT,
    error_message TEXT,
    idempotent_replay INTEGER DEFAULT 0,
    duration_ms INTEGER,
    correlation_id TEXT,
    job_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (decision_id) REFERENCES ai_action_decisions(id)
);

-- =========================================
-- ASYNC JOBS (Step 11)
-- =========================================
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME
);

-- =========================================
-- WORKQUEUE ASSIGNMENTS (Step 16)
-- =========================================
CREATE TABLE IF NOT EXISTS workqueue_assignments (
    id TEXT PRIMARY KEY,
    proposal_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    assigned_to_user_id TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'ACKED', 'DONE', 'EXPIRED')),
    sla_due_at DATETIME,
    created_by TEXT,
    acked_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(proposal_id, organization_id)
);

-- =========================================
-- NOTIFICATION OUTBOX (Step 16)
-- =========================================
CREATE TABLE IF NOT EXISTS notification_outbox (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT,
    channel TEXT DEFAULT 'IN_APP' CHECK(channel IN ('IN_APP', 'EMAIL', 'WEBHOOK')),
    notification_type TEXT NOT NULL,
    payload TEXT NOT NULL DEFAULT '{}',
    status TEXT DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'SENT', 'FAILED', 'SKIPPED')),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    dedupe_key TEXT,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sent_at DATETIME
);

-- =========================================
-- OUTCOME DEFINITIONS (Step 18)
-- =========================================
CREATE TABLE IF NOT EXISTS outcome_definitions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_key TEXT NOT NULL,
    metrics_tracked TEXT DEFAULT '{}',
    success_criteria TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, entity_type, entity_key)
);

-- =========================================
-- OUTCOME MEASUREMENTS (Step 18)
-- =========================================
CREATE TABLE IF NOT EXISTS outcome_measurements (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    definition_id TEXT NOT NULL,
    run_id TEXT,
    execution_id TEXT,
    baseline_snapshot TEXT,
    after_snapshot TEXT,
    delta TEXT,
    status TEXT DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'COMPLETE', 'FAILED')),
    success_evaluation TEXT,
    captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (definition_id) REFERENCES outcome_definitions(id)
);

-- =========================================
-- ROI MODELS (Step 18)
-- =========================================
CREATE TABLE IF NOT EXISTS roi_models (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT DEFAULT 'Default',
    assumptions TEXT NOT NULL DEFAULT '{}',
    is_default INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =========================================
-- CONNECTOR CONFIGS (Step 17)
-- =========================================
CREATE TABLE IF NOT EXISTS connector_configs (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    connector_key TEXT NOT NULL,
    encrypted_secrets TEXT,
    scopes TEXT DEFAULT '[]',
    sandbox_mode INTEGER DEFAULT 0,
    last_health_check DATETIME,
    health_status TEXT DEFAULT 'UNKNOWN',
    connected_by TEXT,
    connected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    disconnected_at DATETIME,
    UNIQUE(organization_id, connector_key)
);

-- =========================================
-- INDEXES FOR PERFORMANCE
-- =========================================

-- Policy rules
CREATE INDEX IF NOT EXISTS idx_policy_rules_org ON ai_policy_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_policy_rules_enabled ON ai_policy_rules(organization_id, enabled);

-- Proposals
CREATE INDEX IF NOT EXISTS idx_proposals_org ON ai_action_proposals(organization_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON ai_action_proposals(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_proposals_created ON ai_action_proposals(organization_id, created_at);

-- Decisions
CREATE INDEX IF NOT EXISTS idx_decisions_org ON ai_action_decisions(organization_id);
CREATE INDEX IF NOT EXISTS idx_decisions_proposal ON ai_action_decisions(proposal_id);
CREATE INDEX IF NOT EXISTS idx_decisions_created ON ai_action_decisions(organization_id, created_at);

-- Executions
CREATE INDEX IF NOT EXISTS idx_executions_org ON ai_action_executions(organization_id);
CREATE INDEX IF NOT EXISTS idx_executions_decision ON ai_action_executions(decision_id);
CREATE INDEX IF NOT EXISTS idx_executions_job ON ai_action_executions(job_id);
CREATE INDEX IF NOT EXISTS idx_executions_correlation ON ai_action_executions(correlation_id);

-- Async Jobs
CREATE INDEX IF NOT EXISTS idx_jobs_org ON async_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON async_jobs(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_type_entity ON async_jobs(type, entity_id);
CREATE INDEX IF NOT EXISTS idx_jobs_correlation ON async_jobs(correlation_id);

-- Workqueue
CREATE INDEX IF NOT EXISTS idx_workqueue_org ON workqueue_assignments(organization_id);
CREATE INDEX IF NOT EXISTS idx_workqueue_user ON workqueue_assignments(assigned_to_user_id, status);
CREATE INDEX IF NOT EXISTS idx_workqueue_sla ON workqueue_assignments(sla_due_at);

-- Notification Outbox
CREATE INDEX IF NOT EXISTS idx_outbox_org ON notification_outbox(organization_id);
CREATE INDEX IF NOT EXISTS idx_outbox_status ON notification_outbox(status, created_at);
CREATE INDEX IF NOT EXISTS idx_outbox_dedupe ON notification_outbox(dedupe_key);

-- Outcomes
CREATE INDEX IF NOT EXISTS idx_outcomes_org ON outcome_measurements(organization_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_run ON outcome_measurements(run_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_execution ON outcome_measurements(execution_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_status ON outcome_measurements(status);

-- Connectors
CREATE INDEX IF NOT EXISTS idx_connectors_org ON connector_configs(organization_id);
