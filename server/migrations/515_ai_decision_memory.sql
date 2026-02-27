-- Deep Thinking Decision Memory (Enterprise)
-- Tracks decisions made via Deep Thinking mode and their outcomes.
-- Enables organizational learning: "What happened last time we chose this?"

CREATE TABLE IF NOT EXISTS ai_decision_outcomes (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  conversation_id TEXT,
  
  -- Decision content
  decision_summary TEXT NOT NULL,
  problem_framing TEXT,
  options_considered TEXT,  -- JSON array of options
  chosen_option TEXT,
  recommendation_text TEXT,
  confidence_score REAL,    -- AI's stated confidence (0-100)
  
  -- Outcome tracking
  outcome_status TEXT DEFAULT 'pending' CHECK(outcome_status IN ('pending', 'positive', 'negative', 'neutral', 'mixed')),
  outcome_notes TEXT,
  outcome_metrics TEXT,     -- JSON object with measurable results
  follow_up_date DATE,
  
  -- Metadata
  industry_context TEXT,
  tags TEXT,                -- JSON array
  embedding BYTEA,          -- (Optional) binary embedding for similarity search
  
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_decision_outcomes_org_time
  ON ai_decision_outcomes (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_decision_outcomes_session
  ON ai_decision_outcomes (session_id);

CREATE INDEX IF NOT EXISTS idx_decision_outcomes_status
  ON ai_decision_outcomes (organization_id, outcome_status);

CREATE INDEX IF NOT EXISTS idx_decision_outcomes_follow_up
  ON ai_decision_outcomes (follow_up_date)
  WHERE follow_up_date IS NOT NULL AND outcome_status = 'pending';

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_decision_outcomes_updated_at ON ai_decision_outcomes;
CREATE TRIGGER trg_decision_outcomes_updated_at
BEFORE UPDATE ON ai_decision_outcomes
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();
