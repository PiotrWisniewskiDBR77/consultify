CREATE TABLE IF NOT EXISTS organization_self_service_deletion_receipts (
  receipt_id TEXT PRIMARY KEY,
  target_organization_id TEXT NOT NULL,
  target_organization_name TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  reason TEXT NOT NULL,
  request_digest TEXT NOT NULL,
  deleted_counts JSONB NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION reject_organization_deletion_receipt_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'organization self-service deletion receipts are immutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_organization_self_service_deletion_receipts_immutable
  ON organization_self_service_deletion_receipts;
CREATE TRIGGER trg_organization_self_service_deletion_receipts_immutable
BEFORE UPDATE OR DELETE ON organization_self_service_deletion_receipts
FOR EACH ROW EXECUTE FUNCTION reject_organization_deletion_receipt_mutation();

CREATE INDEX IF NOT EXISTS idx_org_self_service_deletion_receipts_target
  ON organization_self_service_deletion_receipts(target_organization_id, occurred_at DESC);
