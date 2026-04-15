-- Deep Thinking Decision Audit Trail (Enterprise)
-- Full audit log for compliance and replay capability.
-- Records every stage of the decision-making process.

CREATE TABLE IF NOT EXISTS ai_decision_audit_log (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  conversation_id TEXT,
  
  -- Stage information
  stage TEXT NOT NULL CHECK(stage IN (
    'confirm_start', 'confirm_understanding', 'confirm_questions',
    'research_start', 'research_queries', 'research_sources', 'research_complete',
    'reasoning_start', 'reasoning_analysis', 'reasoning_complete',
    'synthesis_start', 'synthesis_options', 'synthesis_recommendation', 'synthesis_complete',
    'output_start', 'output_quality_check', 'output_revision', 'output_complete',
    'user_feedback', 'force_depth_trigger', 'abort'
  )),
  
  -- Stage content
  payload_json TEXT,           -- Stage-specific data
  input_snapshot TEXT,         -- What the AI saw at this stage
  output_snapshot TEXT,        -- What the AI produced at this stage
  
  -- Quality metrics at this stage
  dod_check_result TEXT,       -- JSON: DoD validation result if applicable
  confidence_at_stage REAL,    -- Confidence at this point
  
  -- Timing
  duration_ms INTEGER,         -- How long this stage took
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_audit_log_session
  ON ai_decision_audit_log (session_id, timestamp);

CREATE INDEX IF NOT EXISTS idx_audit_log_org_time
  ON ai_decision_audit_log (organization_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_stage
  ON ai_decision_audit_log (stage);
