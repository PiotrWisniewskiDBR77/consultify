-- Migration: Decision Escalation and Delegation System
-- Adds escalation chain, delegation mechanics, and audit trails for decisions
-- SQLite compatible version

-- =============================================================================
-- 1. EXTEND DECISIONS TABLE - Escalation fields (SQLite compatible)
-- =============================================================================

-- Check and add columns one by one (SQLite doesn't support IF NOT EXISTS for ALTER)
-- These will fail silently if column already exists

-- Escalation tracking fields
ALTER TABLE decisions ADD COLUMN escalation_level INTEGER DEFAULT 0;
ALTER TABLE decisions ADD COLUMN escalated_at TEXT;
ALTER TABLE decisions ADD COLUMN escalated_by TEXT;
ALTER TABLE decisions ADD COLUMN escalation_reason TEXT;

-- SLA tracking fields
ALTER TABLE decisions ADD COLUMN sla_warning_at TEXT;
ALTER TABLE decisions ADD COLUMN sla_critical_at TEXT;
ALTER TABLE decisions ADD COLUMN last_reminder_sent_at TEXT;

-- Delegation tracking
ALTER TABLE decisions ADD COLUMN original_decider_id TEXT;
ALTER TABLE decisions ADD COLUMN delegation_count INTEGER DEFAULT 0;

-- Backup decider
ALTER TABLE decisions ADD COLUMN backup_decider_id TEXT;

-- =============================================================================
-- 2. DECISION ESCALATION CHAIN - Define escalation paths
-- =============================================================================

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
  created_at TEXT DEFAULT (datetime('now')),
  created_by TEXT,
  
  FOREIGN KEY (decision_id) REFERENCES decisions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_escalation_chain_decision ON decision_escalation_chain(decision_id);
CREATE INDEX IF NOT EXISTS idx_escalation_chain_org ON decision_escalation_chain(organization_id);
CREATE INDEX IF NOT EXISTS idx_escalation_chain_level ON decision_escalation_chain(decision_id, level);

-- =============================================================================
-- 3. DECISION ESCALATION LOG - Audit trail
-- =============================================================================

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
  created_at TEXT DEFAULT (datetime('now')),
  
  FOREIGN KEY (decision_id) REFERENCES decisions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_escalation_log_decision ON decision_escalation_log(decision_id);
CREATE INDEX IF NOT EXISTS idx_escalation_log_created ON decision_escalation_log(created_at);

-- =============================================================================
-- 4. DECISION DELEGATIONS - Transfer and input requests
-- =============================================================================

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
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  
  FOREIGN KEY (decision_id) REFERENCES decisions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_delegations_decision ON decision_delegations(decision_id);
CREATE INDEX IF NOT EXISTS idx_delegations_from_user ON decision_delegations(from_user_id);
CREATE INDEX IF NOT EXISTS idx_delegations_to_user ON decision_delegations(to_user_id);
CREATE INDEX IF NOT EXISTS idx_delegations_status ON decision_delegations(status);
CREATE INDEX IF NOT EXISTS idx_delegations_type ON decision_delegations(delegation_type);

-- =============================================================================
-- 5. DECISION CONSULTED OPINIONS - Input from consulted parties
-- =============================================================================

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
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  
  FOREIGN KEY (decision_id) REFERENCES decisions(id) ON DELETE CASCADE,
  FOREIGN KEY (delegation_id) REFERENCES decision_delegations(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_opinions_decision ON decision_consulted_opinions(decision_id);
CREATE INDEX IF NOT EXISTS idx_opinions_user ON decision_consulted_opinions(user_id);

-- =============================================================================
-- 6. DECISION STAKEHOLDERS - RACI matrix
-- =============================================================================

CREATE TABLE IF NOT EXISTS decision_stakeholders (
  id TEXT PRIMARY KEY,
  decision_id TEXT NOT NULL,
  organization_id TEXT,
  
  -- Stakeholder
  user_id TEXT NOT NULL,
  user_name TEXT,
  
  -- RACI role
  role TEXT NOT NULL,                 -- 'responsible', 'accountable', 'consulted', 'informed'
  
  -- Notification preferences
  notify_on_create INTEGER DEFAULT 1,
  notify_on_update INTEGER DEFAULT 1,
  notify_on_decision INTEGER DEFAULT 1,
  notify_on_escalation INTEGER DEFAULT 1,
  
  -- Status
  notified_at TEXT,
  acknowledged_at TEXT,
  
  -- Metadata
  created_at TEXT DEFAULT (datetime('now')),
  created_by TEXT,
  
  FOREIGN KEY (decision_id) REFERENCES decisions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_stakeholders_decision ON decision_stakeholders(decision_id);
CREATE INDEX IF NOT EXISTS idx_stakeholders_user ON decision_stakeholders(user_id);
CREATE INDEX IF NOT EXISTS idx_stakeholders_role ON decision_stakeholders(role);

-- =============================================================================
-- 7. DEFAULT ESCALATION TEMPLATES - Organization-level defaults
-- =============================================================================

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
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_escalation_templates_org ON decision_escalation_templates(organization_id);
