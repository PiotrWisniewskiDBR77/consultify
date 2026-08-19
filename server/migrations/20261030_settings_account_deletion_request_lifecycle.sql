-- SET-MVP-DELETE-001 (approved restricted scope): race-safe request/cancel/status
-- lifecycle with immutable receipts. This migration does not execute deletion.

CREATE UNIQUE INDEX IF NOT EXISTS uq_gdpr_requests_one_active_deletion_per_user
  ON gdpr_requests (user_id)
  WHERE type = 'deletion' AND status IN ('pending', 'scheduled');

CREATE TABLE IF NOT EXISTS account_deletion_request_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT NOT NULL REFERENCES gdpr_requests(id) ON DELETE RESTRICT,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type IN ('requested', 'cancelled')),
  request_status TEXT NOT NULL CHECK (request_status IN ('pending', 'scheduled', 'cancelled')),
  scheduled_at TIMESTAMPTZ,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_account_deletion_request_receipts_owner
  ON account_deletion_request_receipts (organization_id, user_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION reject_account_deletion_receipt_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'account deletion request receipts are immutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_account_deletion_request_receipts_immutable
  ON account_deletion_request_receipts;
CREATE TRIGGER trg_account_deletion_request_receipts_immutable
BEFORE UPDATE OR DELETE ON account_deletion_request_receipts
FOR EACH ROW EXECUTE FUNCTION reject_account_deletion_receipt_mutation();

CREATE OR REPLACE FUNCTION record_account_deletion_request_lifecycle()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.type = 'deletion' AND TG_OP = 'INSERT' AND NEW.status IN ('pending', 'scheduled') THEN
    INSERT INTO account_deletion_request_receipts (
      request_id, organization_id, user_id, event_type, request_status, scheduled_at
    ) VALUES (
      NEW.id, NEW.organization_id, NEW.user_id, 'requested', NEW.status, NEW.scheduled_at
    );
  ELSIF NEW.type = 'deletion' AND TG_OP = 'UPDATE'
        AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelled' THEN
    INSERT INTO account_deletion_request_receipts (
      request_id, organization_id, user_id, event_type, request_status, scheduled_at
    ) VALUES (
      NEW.id, NEW.organization_id, NEW.user_id, 'cancelled', NEW.status, NEW.scheduled_at
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_account_deletion_request_lifecycle ON gdpr_requests;
CREATE TRIGGER trg_record_account_deletion_request_lifecycle
AFTER INSERT OR UPDATE ON gdpr_requests
FOR EACH ROW EXECUTE FUNCTION record_account_deletion_request_lifecycle();
