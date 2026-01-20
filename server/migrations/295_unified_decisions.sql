-- FLOW-DECISION-003: Unified Decision Management
-- Migration: 295_unified_decisions.sql
-- Purpose: Add unified context fields and escalation rules table

-- ==========================================
-- UNIFIED CONTEXT FIELDS
-- ==========================================

-- Add context_type and context_id for unified decision linking
-- context_type: 'initiative', 'task', 'analysis', 'assessment', 'tool', 'project'
-- context_id: UUID reference to the context object

-- Note: These columns may already exist from initiative_id, task_id columns
-- This adds an explicit context_type for easier filtering

ALTER TABLE decisions ADD COLUMN IF NOT EXISTS context_type TEXT;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS context_id TEXT;

-- Update existing records to populate context_type and context_id
UPDATE decisions 
SET context_type = 'task', context_id = task_id 
WHERE task_id IS NOT NULL AND context_type IS NULL;

UPDATE decisions 
SET context_type = 'initiative', context_id = initiative_id 
WHERE initiative_id IS NOT NULL AND context_type IS NULL;

UPDATE decisions 
SET context_type = 'project', context_id = project_id 
WHERE project_id IS NOT NULL AND context_type IS NULL;

-- Create indexes for context queries
CREATE INDEX IF NOT EXISTS idx_decisions_context_type ON decisions(context_type);
CREATE INDEX IF NOT EXISTS idx_decisions_context_id ON decisions(context_id);
CREATE INDEX IF NOT EXISTS idx_decisions_context_combined ON decisions(context_type, context_id);

-- ==========================================
-- ESCALATION RULES TABLE
-- ==========================================

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

-- ==========================================
-- ESCALATION NOTIFICATIONS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS escalation_notifications (
    id TEXT PRIMARY KEY,
    decision_id TEXT NOT NULL,
    escalation_level TEXT NOT NULL, -- 'amber', 'red'
    notification_type TEXT NOT NULL, -- 'email', 'in_app', 'slack'
    recipient_user_id TEXT NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP,
    
    -- Content
    title TEXT,
    message TEXT,
    
    FOREIGN KEY (decision_id) REFERENCES decisions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_escalation_notifications_decision ON escalation_notifications(decision_id);
CREATE INDEX IF NOT EXISTS idx_escalation_notifications_recipient ON escalation_notifications(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_escalation_notifications_level ON escalation_notifications(escalation_level);

-- ==========================================
-- DECISION BLOCKING RULES TABLE
-- ==========================================
-- Defines what a decision blocks (gates)

CREATE TABLE IF NOT EXISTS decision_blocking_rules (
    id TEXT PRIMARY KEY,
    decision_type TEXT NOT NULL, -- Decision type that blocks
    blocked_transition TEXT NOT NULL, -- Status transition that is blocked (e.g., 'REVIEW->APPROVED')
    blocked_entity_type TEXT NOT NULL, -- 'initiative', 'task', etc.
    message TEXT, -- Message to show when blocked
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_decision_blocking_rules_type ON decision_blocking_rules(decision_type);
CREATE INDEX IF NOT EXISTS idx_decision_blocking_rules_entity ON decision_blocking_rules(blocked_entity_type);

-- ==========================================
-- INSERT DEFAULT ESCALATION RULES
-- ==========================================

-- Note: These are templates, actual rules should be created per organization
-- INSERT INTO escalation_rules (id, organization_id, name, context_type, decision_type, amber_threshold_days, red_threshold_days, auto_escalate, notify_on_amber, notify_on_red, escalate_to_role)
-- VALUES 
--   ('rule-initiative-default', 'ORG_ID', 'Initiative Decisions Default', 'initiative', NULL, 3, 7, 1, 1, 1, 'PMO'),
--   ('rule-task-blocker', 'ORG_ID', 'Task Blocker Decisions', 'task', 'BLOCKER_RESOLUTION', 1, 3, 1, 1, 1, 'PROJECT_LEAD'),
--   ('rule-phase-transition', 'ORG_ID', 'Phase Transition Gates', NULL, 'PHASE_TRANSITION', 2, 5, 1, 1, 1, 'SPONSOR');

-- ==========================================
-- INSERT DEFAULT BLOCKING RULES
-- ==========================================

INSERT OR IGNORE INTO decision_blocking_rules (id, decision_type, blocked_transition, blocked_entity_type, message)
VALUES 
  ('block-init-review', 'INITIATIVE_APPROVAL', 'REVIEW->APPROVED', 'initiative', 'Initiative approval decision required before proceeding'),
  ('block-init-planning', 'PHASE_TRANSITION', 'APPROVED->PLANNING', 'initiative', 'Phase transition decision required before planning'),
  ('block-exec-start', 'PHASE_TRANSITION', 'PLANNING->EXECUTING', 'initiative', 'Phase transition decision required before execution'),
  ('block-task-unblock', 'BLOCKER_RESOLUTION', 'BLOCKED->IN_PROGRESS', 'task', 'Blocker resolution decision required'),
  ('block-budget-approval', 'BUDGET', '*->EXECUTING', 'initiative', 'Budget approval decision required'),
  ('block-scope-change', 'SCOPE_CHANGE', '*->*', 'initiative', 'Scope change decision required');

-- ==========================================
-- VIEW: DECISIONS WITH ESCALATION STATUS
-- ==========================================

CREATE VIEW IF NOT EXISTS v_decisions_escalation_status AS
SELECT 
    d.*,
    CASE 
        WHEN d.deadline IS NULL THEN 'none'
        WHEN julianday('now') - julianday(d.deadline) > 7 THEN 'red'
        WHEN julianday('now') - julianday(d.deadline) > 0 THEN 'amber'
        ELSE 'none'
    END as computed_escalation_level,
    CAST(MAX(0, julianday('now') - julianday(d.deadline)) AS INTEGER) as days_overdue,
    (SELECT COUNT(*) FROM decision_impacts di WHERE di.decision_id = d.id AND di.is_blocker = 1) as blocked_items_count,
    owner.first_name || ' ' || owner.last_name as owner_name,
    requester.first_name || ' ' || requester.last_name as requester_name
FROM decisions d
LEFT JOIN users owner ON d.decision_maker_id = owner.id
LEFT JOIN users requester ON d.created_by = requester.id
WHERE d.status IN ('pending', 'escalated');

-- ==========================================
-- VIEW: ESCALATION SUMMARY BY ORGANIZATION
-- ==========================================

CREATE VIEW IF NOT EXISTS v_escalation_summary AS
SELECT 
    d.organization_id,
    COUNT(*) as total_pending,
    SUM(CASE WHEN d.status = 'escalated' THEN 1 ELSE 0 END) as escalated_count,
    SUM(CASE 
        WHEN d.deadline IS NOT NULL AND julianday('now') - julianday(d.deadline) > 7 THEN 1 
        ELSE 0 
    END) as red_alert_count,
    SUM(CASE 
        WHEN d.deadline IS NOT NULL AND julianday('now') - julianday(d.deadline) > 0 
            AND julianday('now') - julianday(d.deadline) <= 7 THEN 1 
        ELSE 0 
    END) as amber_alert_count,
    SUM((SELECT COUNT(*) FROM decision_impacts di WHERE di.decision_id = d.id AND di.is_blocker = 1)) as total_blocked_items,
    AVG(CAST(julianday('now') - julianday(d.created_at) AS INTEGER)) as avg_waiting_days
FROM decisions d
WHERE d.status IN ('pending', 'escalated')
GROUP BY d.organization_id;
