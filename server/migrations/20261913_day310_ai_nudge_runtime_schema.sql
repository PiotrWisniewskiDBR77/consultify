-- Day 310: move proactive-nudge persistence out of request-time service code.
-- Additive only; shapes preserve the previously deployed runtime contracts.
CREATE TABLE IF NOT EXISTS ai_nudge_activity (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  entity_id TEXT,
  action TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_nudge_actions (
  nudge_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  acted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (nudge_id, user_id)
);

CREATE TABLE IF NOT EXISTS ai_nudge_suppressions (
  user_id TEXT NOT NULL,
  nudge_type TEXT NOT NULL,
  suppressed_until TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, nudge_type)
);
