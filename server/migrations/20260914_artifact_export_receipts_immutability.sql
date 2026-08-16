-- MAT-MVP-EXPORT-001: an export receipt may move pending -> one terminal
-- provider outcome exactly once. Source identity and completed proof are
-- immutable thereafter, including for direct SQL bypasses.

CREATE OR REPLACE FUNCTION artifact_export_receipt_immutability_guard()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.artifact_kind IS DISTINCT FROM OLD.artifact_kind
     OR NEW.source_record_id IS DISTINCT FROM OLD.source_record_id
     OR NEW.source_version IS DISTINCT FROM OLD.source_version
     OR NEW.source_content_hash IS DISTINCT FROM OLD.source_content_hash
     OR NEW.output_format IS DISTINCT FROM OLD.output_format
     OR NEW.provider_key IS DISTINCT FROM OLD.provider_key
     OR NEW.provider_job_id IS DISTINCT FROM OLD.provider_job_id
     OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'artifact export receipt immutable source/provider fields cannot change'
      USING ERRCODE = '55000';
  END IF;

  IF OLD.status <> 'pending' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'artifact_export_receipts_success_check / terminal immutability: receipt is terminal (status=%)', OLD.status
      USING ERRCODE = '55000';
  END IF;
  IF OLD.status = 'pending' AND NEW.status = 'pending' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'pending artifact export receipt may only transition to a terminal outcome'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_artifact_export_receipt_immutability
  ON artifact_export_receipts;
CREATE TRIGGER trg_artifact_export_receipt_immutability
BEFORE UPDATE ON artifact_export_receipts
FOR EACH ROW EXECUTE FUNCTION artifact_export_receipt_immutability_guard();
