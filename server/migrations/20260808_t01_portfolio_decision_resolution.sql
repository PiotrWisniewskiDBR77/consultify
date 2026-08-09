CREATE TABLE IF NOT EXISTS transformation_portfolio_decision_packs (
  pack_id TEXT PRIMARY KEY,
  transformation_case_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  proposal_id TEXT NOT NULL,
  decision_id TEXT,
  case_version INTEGER NOT NULL,
  supporting_evidence_json JSONB NOT NULL,
  contradicting_evidence_json JSONB NOT NULL,
  evidence_digest TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (proposal_id),
  UNIQUE (transformation_case_id, evidence_digest)
);

CREATE TABLE IF NOT EXISTS transformation_portfolio_decision_receipts (
  receipt_id TEXT PRIMARY KEY,
  transformation_case_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  decision_id TEXT NOT NULL,
  pack_id TEXT NOT NULL,
  evidence_digest TEXT NOT NULL,
  source_case_version INTEGER NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_digest TEXT NOT NULL,
  selected_option TEXT NOT NULL CHECK (selected_option IN ('go','no_go')),
  rationale TEXT NOT NULL,
  decided_by_user_id TEXT NOT NULL,
  authorization_type TEXT NOT NULL CHECK (authorization_type IN ('decision_maker','durable_delegation')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, idempotency_key),
  UNIQUE (decision_id)
);

CREATE INDEX IF NOT EXISTS idx_t01_decision_pack_case ON transformation_portfolio_decision_packs(organization_id, transformation_case_id);
CREATE INDEX IF NOT EXISTS idx_t01_decision_receipt_case ON transformation_portfolio_decision_receipts(organization_id, transformation_case_id);
