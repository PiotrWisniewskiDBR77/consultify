-- V8.1 Wave 2 — Sheet as first-class output_type on canonical artifact registry
-- Extends CHECK constraints so governed table-platform exports can persist as sheet artifacts.

ALTER TABLE v8_output_artifacts DROP CONSTRAINT IF EXISTS v8_output_artifacts_output_type_check;
ALTER TABLE v8_output_artifacts ADD CONSTRAINT v8_output_artifacts_output_type_check
  CHECK (output_type IN ('report', 'presentation', 'sheet'));

ALTER TABLE v8_publish_records DROP CONSTRAINT IF EXISTS v8_publish_records_artifact_type_check;
ALTER TABLE v8_publish_records ADD CONSTRAINT v8_publish_records_artifact_type_check
  CHECK (artifact_type IN ('report', 'presentation', 'finance_output', 'results_artifact', 'sheet'));
