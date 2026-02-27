-- Migration: Assessment Gate Decisions
-- Tracks workflow gate decisions with assignees and notification support
-- Part of Assessment Workflow v2 system

-- ============================================
-- Table: assessment_gate_decisions
-- Stores gate decision requests and their status
-- ============================================
CREATE TABLE IF NOT EXISTS assessment_gate_decisions (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  
  -- Gate type: which workflow transition this represents
  gate_type TEXT NOT NULL CHECK(gate_type IN (
    'REQUEST_REVIEW',      -- DRAFT → IN_REVIEW
    'APPROVE_REPORT',      -- IN_REVIEW → AWAITING_APPROVAL (report approval)
    'APPROVE_ASSESSMENT',  -- AWAITING_APPROVAL → APPROVED
    'GENERATE_INITIATIVES' -- APPROVED → generate initiatives
  )),
  
  -- Source and target status
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  
  -- Who should decide
  approver_role TEXT NOT NULL CHECK(approver_role IN ('admin', 'manager', 'editor', 'owner')),
  assignee_id TEXT,  -- specific user assigned to this gate (optional)
  
  -- Decision status
  status TEXT DEFAULT 'NOT_STARTED' CHECK(status IN (
    'NOT_STARTED',  -- Gate not yet reached
    'PENDING',      -- Waiting for decision
    'APPROVED',     -- Gate passed
    'REJECTED',     -- Gate rejected (sent back)
    'SKIPPED'       -- Gate skipped (admin override)
  )),
  
  -- Request tracking
  requested_at TIMESTAMPTZ,
  requested_by TEXT,
  request_comment TEXT,
  
  -- Decision tracking
  decided_at TIMESTAMPTZ,
  decided_by TEXT,
  decision_comment TEXT,
  
  -- Notification tracking
  notification_sent_at TIMESTAMPTZ,
  reminder_count INTEGER DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,
  
  -- Requirements snapshot (JSON) - captures DoD state at request time
  requirements_snapshot TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  
  -- One gate decision per gate type per assessment
  UNIQUE(assessment_id, gate_type),
  
  -- Foreign keys
  FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
);

-- Indexes for assessment_gate_decisions
CREATE INDEX IF NOT EXISTS idx_gate_decisions_assessment ON assessment_gate_decisions(assessment_id);
CREATE INDEX IF NOT EXISTS idx_gate_decisions_assignee ON assessment_gate_decisions(assignee_id);
CREATE INDEX IF NOT EXISTS idx_gate_decisions_status ON assessment_gate_decisions(status);
CREATE INDEX IF NOT EXISTS idx_gate_decisions_org ON assessment_gate_decisions(organization_id);
CREATE INDEX IF NOT EXISTS idx_gate_decisions_pending ON assessment_gate_decisions(status, assignee_id) 
  WHERE status = 'PENDING';

-- ============================================
-- Trigger: Auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gate_decisions_updated_at ON assessment_gate_decisions;
CREATE TRIGGER trg_gate_decisions_updated_at
BEFORE UPDATE ON assessment_gate_decisions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

-- ============================================
-- View: Pending gate decisions for user inbox
-- ============================================
CREATE OR REPLACE VIEW v_pending_gate_decisions AS
SELECT 
  gd.id,
  gd.assessment_id,
  gd.organization_id,
  gd.gate_type,
  gd.from_status,
  gd.to_status,
  gd.approver_role,
  gd.assignee_id,
  gd.status,
  gd.requested_at,
  gd.requested_by,
  gd.request_comment,
  gd.reminder_count,
  NULL::text as assessment_type,
  a.status as assessment_status,
  NULL::numeric as completion_percent,
  NULL::numeric as confidence_avg,
  COALESCE(NULLIF(trim(concat_ws(' ', u_req.first_name, u_req.last_name)), ''), u_req.email, u_req.id) as requester_name,
  u_req.email as requester_email,
  COALESCE(NULLIF(trim(concat_ws(' ', u_ass.first_name, u_ass.last_name)), ''), u_ass.email, u_ass.id) as assignee_name,
  u_ass.email as assignee_email,
  EXTRACT(DAY FROM (NOW() - gd.requested_at))::int as days_waiting
FROM assessment_gate_decisions gd
JOIN assessments a ON a.id = gd.assessment_id
LEFT JOIN users u_req ON u_req.id = gd.requested_by
LEFT JOIN users u_ass ON u_ass.id = gd.assignee_id
WHERE gd.status = 'PENDING';
