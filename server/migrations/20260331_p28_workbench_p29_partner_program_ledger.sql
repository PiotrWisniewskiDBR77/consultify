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

-- partner_org_id is TEXT and deliberately carries NO foreign key.
--
-- The previous revision declared `REFERENCES partner_organizations(id)` on the
-- claim that "the canonical fresh schema exposes partner_organizations.id as
-- TEXT". That claim is false: the producer that actually runs in the strict
-- order, 215_partner_portal.sql, declares `id UUID PRIMARY KEY`. Postgres
-- cannot implement a TEXT -> UUID foreign key, so on a genuinely fresh
-- database this migration aborted and every migration ordered after it never
-- ran. 798_partner_certifications_00base.sql, which does define the column as
-- TEXT, is a no-op on a fresh build because CREATE TABLE IF NOT EXISTS finds
-- the table already created by 215.
--
-- TEXT without the constraint is what the application actually uses:
-- ensurePartnerProgramSchema() in server/src/services/partnerProgramLedgerService.ts
-- creates this table at runtime as `partner_org_id TEXT NOT NULL` with no
-- foreign key, and that is the shape live environments already hold. Keeping
-- the column TEXT makes the migrated schema and the runtime schema identical.
-- The missing referential constraint is tracked as a known integrity gap, not
-- resolved here, because changing the column type would make freshly built
-- environments diverge from the deployed ones.
CREATE TABLE IF NOT EXISTS partner_program_ledger (
  id TEXT PRIMARY KEY,
  partner_org_id TEXT NOT NULL,
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
