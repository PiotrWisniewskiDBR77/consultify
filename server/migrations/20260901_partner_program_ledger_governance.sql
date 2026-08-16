-- Partner program ledger governance.
-- Additive hardening: scoped idempotency, explicit policy lineage and
-- database-enforced append-only history. Corrections/reversals/disputes are
-- new facts referring to an earlier fact; they never rewrite that fact.

ALTER TABLE partner_program_ledger
  ADD COLUMN IF NOT EXISTS rule_version TEXT,
  ADD COLUMN IF NOT EXISTS related_entry_id TEXT,
  ADD COLUMN IF NOT EXISTS dispute_status TEXT;

UPDATE partner_program_ledger
   SET rule_version = 'legacy-unversioned'
 WHERE rule_version IS NULL;

ALTER TABLE partner_program_ledger
  ALTER COLUMN rule_version SET DEFAULT 'legacy-unversioned',
  ALTER COLUMN rule_version SET NOT NULL;

ALTER TABLE partner_program_ledger
  DROP CONSTRAINT IF EXISTS partner_program_ledger_idempotency_unique,
  DROP CONSTRAINT IF EXISTS partner_program_ledger_idempotency_key_key;

ALTER TABLE partner_program_ledger
  DROP CONSTRAINT IF EXISTS partner_program_ledger_entry_type_check;
ALTER TABLE partner_program_ledger
  ADD CONSTRAINT partner_program_ledger_entry_type_check CHECK (entry_type IN (
    'accrual.posted', 'accrual.adjustment', 'accrual.reversal',
    'hold.placed', 'hold.released', 'payout.requested', 'payout.approved',
    'payout.executed', 'payout.failed', 'payout.reconciled',
    'dispute.opened', 'dispute.resolved', 'lifecycle.transition'
  ));

CREATE UNIQUE INDEX IF NOT EXISTS uq_partner_program_ledger_tenant_idempotency
  ON partner_program_ledger(partner_org_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_partner_program_ledger_related_entry
  ON partner_program_ledger(partner_org_id, related_entry_id)
  WHERE related_entry_id IS NOT NULL;

CREATE OR REPLACE FUNCTION partner_program_ledger_guard() RETURNS TRIGGER AS $$
DECLARE
  related_partner_org_id TEXT;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    RAISE EXCEPTION 'partner_program_ledger is append-only: % is not permitted (id=%)',
      TG_OP, OLD.id USING ERRCODE = '55000';
  END IF;

  IF NEW.entry_type IN (
    'accrual.posted', 'accrual.adjustment', 'accrual.reversal',
    'hold.placed', 'hold.released',
    'payout.requested', 'payout.approved', 'payout.executed',
    'payout.failed', 'payout.reconciled',
    'dispute.opened', 'dispute.resolved'
  ) AND (NEW.rule_version IS NULL OR btrim(NEW.rule_version) = '' OR NEW.rule_version = 'legacy-unversioned') THEN
    RAISE EXCEPTION 'rule_version is required for governed ledger entry type %', NEW.entry_type
      USING ERRCODE = '23514';
  END IF;

  IF NEW.entry_type IN ('accrual.adjustment', 'accrual.reversal', 'dispute.opened', 'dispute.resolved')
     AND NEW.related_entry_id IS NULL THEN
    RAISE EXCEPTION 'related_entry_id is required for ledger entry type %', NEW.entry_type
      USING ERRCODE = '23514';
  END IF;

  IF NEW.related_entry_id IS NOT NULL THEN
    SELECT partner_org_id INTO related_partner_org_id
      FROM partner_program_ledger WHERE id = NEW.related_entry_id;
    IF related_partner_org_id IS NULL THEN
      RAISE EXCEPTION 'related ledger entry % does not exist', NEW.related_entry_id
        USING ERRCODE = '23503';
    END IF;
    IF related_partner_org_id <> NEW.partner_org_id THEN
      RAISE EXCEPTION 'related ledger entry belongs to another partner organization'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.entry_type = 'dispute.opened' AND NEW.dispute_status IS DISTINCT FROM 'open' THEN
    RAISE EXCEPTION 'dispute.opened requires dispute_status=open' USING ERRCODE = '23514';
  END IF;
  IF NEW.entry_type = 'dispute.resolved' AND NEW.dispute_status NOT IN ('upheld', 'rejected', 'withdrawn') THEN
    RAISE EXCEPTION 'dispute.resolved requires a terminal dispute_status' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_partner_program_ledger_guard ON partner_program_ledger;
CREATE TRIGGER trg_partner_program_ledger_guard
BEFORE INSERT OR UPDATE OR DELETE ON partner_program_ledger
FOR EACH ROW EXECUTE FUNCTION partner_program_ledger_guard();

COMMENT ON COLUMN partner_program_ledger.rule_version IS
  'Caller-supplied commercial policy/rule version; legacy-unversioned is retained only for historical rows.';
COMMENT ON COLUMN partner_program_ledger.related_entry_id IS
  'Prior immutable fact corrected, reversed or disputed by this entry.';
COMMENT ON COLUMN partner_program_ledger.dispute_status IS
  'open for dispute.opened; upheld/rejected/withdrawn for dispute.resolved.';
