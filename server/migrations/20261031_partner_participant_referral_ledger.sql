-- PRT-MVP-LEDGER-001: non-economic, append-only participant/referral ledger.
-- Monetary accrual and payout remain excluded by AMD-PRT-ECONOMICS-002.

CREATE TABLE IF NOT EXISTS partner_participant_ledger (
  id UUID PRIMARY KEY,
  tenant_organization_id TEXT NOT NULL,
  partner_org_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type = 'referral.attributed'),
  participant_organization_id TEXT NOT NULL,
  source_kind TEXT NOT NULL CHECK (source_kind = 'partner_attribution'),
  source_id TEXT NOT NULL,
  source_version TEXT NOT NULL CHECK (btrim(source_version) <> ''),
  source_digest TEXT NOT NULL CHECK (source_digest ~ '^[a-f0-9]{64}$'),
  request_digest TEXT NOT NULL CHECK (request_digest ~ '^[a-f0-9]{64}$'),
  source_ref JSONB NOT NULL,
  actor_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL CHECK (btrim(idempotency_key) <> ''),
  occurred_at TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_organization_id, partner_org_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_partner_participant_ledger_partner_read
  ON partner_participant_ledger (tenant_organization_id, partner_org_id, occurred_at DESC, id DESC);

CREATE OR REPLACE FUNCTION partner_participant_ledger_append_only() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'partner_participant_ledger is append-only: % is not permitted (id=%)',
    TG_OP, OLD.id USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_partner_participant_ledger_append_only ON partner_participant_ledger;
CREATE TRIGGER trg_partner_participant_ledger_append_only
BEFORE UPDATE OR DELETE ON partner_participant_ledger
FOR EACH ROW EXECUTE FUNCTION partner_participant_ledger_append_only();

COMMENT ON TABLE partner_participant_ledger IS
  'Non-economic immutable Partner participant/referral facts. Never an accrual, commission or payout register.';
