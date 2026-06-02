-- P17-B: ArtifactRun explicit preflight + failure packaging fields
-- Adds persisted preflight envelope and materialization origin pointers to prevent "ghost artifacts".

ALTER TABLE v8_artifact_runs
  ADD COLUMN IF NOT EXISTS preflight_state TEXT;

ALTER TABLE v8_artifact_runs
  ADD COLUMN IF NOT EXISTS preflight_json TEXT;

ALTER TABLE v8_artifact_runs
  ADD COLUMN IF NOT EXISTS materialization_origin_runtime TEXT;

ALTER TABLE v8_artifact_runs
  ADD COLUMN IF NOT EXISTS materialization_origin_record_id TEXT;

ALTER TABLE v8_artifact_runs
  ADD COLUMN IF NOT EXISTS failure_package_json TEXT;

