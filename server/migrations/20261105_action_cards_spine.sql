-- P9 / DEC-397: canonical action-card spine. Additive only.
CREATE TABLE IF NOT EXISTS action_cards (
  id UUID PRIMARY KEY,
  organization_id TEXT NOT NULL,
  source_kind TEXT NOT NULL CHECK (source_kind IN (
    'kpi_deviation', 'execution_delay', 'audit_finding', 'finance_variance', 'meeting_action'
  )),
  source_id TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  goal_met BOOLEAN NOT NULL,
  action_required BOOLEAN NOT NULL,
  problem TEXT NOT NULL,
  root_cause TEXT NOT NULL,
  action_text TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  due_date DATE NOT NULL,
  comment TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT action_cards_period_order CHECK (period_end >= period_start),
  CONSTRAINT action_cards_source_unique UNIQUE (organization_id, source_kind, source_id)
);

CREATE INDEX IF NOT EXISTS idx_action_cards_owner_open
  ON action_cards (organization_id, owner_user_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_action_cards_source
  ON action_cards (organization_id, source_kind, source_id);
