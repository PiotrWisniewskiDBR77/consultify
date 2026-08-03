-- P28 Assessment workbench persistence (Postgres / shared migration ledger)
-- P29 Partner program: canonical lifecycle runtime + append-only ledger (contract FINAL 29)

ALTER TABLE assessments ADD COLUMN IF NOT EXISTS p28_workbench_v1 TEXT DEFAULT NULL;

COMMENT ON COLUMN assessments.p28_workbench_v1 IS 'P28 workbench state JSON (ScoreProposal, InterpretationProposal, PromotionTrace; no silent scoring)';

CREATE TABLE IF NOT EXISTS partner_program_runtime (
  partner_org_id TEXT PRIMARY KEY,
  lifecycle_phase TEXT NOT NULL DEFAULT 'onboard'
    CHECK (lifecycle_phase IN ('onboard', 'activate', 'earn', 'payout')),
  onboard_checklist_json TEXT NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_transition_at TIMESTAMPTZ,
  last_transition_actor TEXT,
  last_transition_actor_id TEXT,
  last_transition_note TEXT
);

-- partner_org_id is UUID here (not TEXT) to match partner_organizations.id
-- (215_partner_portal.sql: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`)
-- -- Postgres has no implicit FK type coercion, so a TEXT column here could
-- never actually create this table (strict-schema repair, 2026-08; same
-- semantics, correct column type).
CREATE TABLE IF NOT EXISTS partner_program_ledger (
  id TEXT PRIMARY KEY,
  partner_org_id UUID NOT NULL REFERENCES partner_organizations(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL,
  amount NUMERIC(18, 4) DEFAULT 0 NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  occurred_at TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_ref TEXT NOT NULL DEFAULT '{}',
  actor TEXT NOT NULL,
  actor_id TEXT,
  correlation_id TEXT,
  idempotency_key TEXT,
  reason_code TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT partner_program_ledger_idempotency_unique UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_partner_program_ledger_partner_occurred
  ON partner_program_ledger(partner_org_id, occurred_at DESC);

COMMENT ON TABLE partner_program_runtime IS 'P29 single truth for partner lifecycle phase (partner portal + operator tower)';
COMMENT ON TABLE partner_program_ledger IS 'P29 append-only earnings/payout/hold ledger; balances are derived';
