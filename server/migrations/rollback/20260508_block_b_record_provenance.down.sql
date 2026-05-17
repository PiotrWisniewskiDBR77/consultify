-- Rollback for 20260508_block_b_record_provenance.sql
-- Drops tp_record_sources and removes confidence_score / validation_status from tp_records.
--
-- DESTRUCTIVE: all rows in tp_record_sources are lost.
-- Confirm zero feature-flag traffic on `featureRecordProvenanceEnabled` before running.
--
-- Usage on staging:
--   psql $STAGING_DATABASE_URL -f server/migrations/rollback/20260508_block_b_record_provenance.down.sql

BEGIN;

DROP INDEX IF EXISTS idx_tp_records_validation_status;
DROP INDEX IF EXISTS idx_tp_records_confidence_low;

ALTER TABLE tp_records
  DROP CONSTRAINT IF EXISTS tp_records_confidence_range_check,
  DROP CONSTRAINT IF EXISTS tp_records_validation_status_check;

ALTER TABLE tp_records
  DROP COLUMN IF EXISTS confidence_score,
  DROP COLUMN IF EXISTS validation_status;

DROP TABLE IF EXISTS tp_record_sources;

COMMIT;
