-- V8.1 Artifact Substrate Wave 1
-- Safe extension of the existing v8_output_artifacts registry.
-- Reuses report/presentation native runtimes while adding shared identity,
-- origin links, and ACL envelope for Outputs Library / My Work.

ALTER TABLE v8_output_artifacts
  ADD COLUMN IF NOT EXISTS artifact_family TEXT
  CHECK (artifact_family IN ('document', 'presentation', 'sheet'));

ALTER TABLE v8_output_artifacts
  ADD COLUMN IF NOT EXISTS title_snapshot TEXT;

ALTER TABLE v8_output_artifacts
  ADD COLUMN IF NOT EXISTS owner_user_id TEXT;

ALTER TABLE v8_output_artifacts
  ADD COLUMN IF NOT EXISTS canonical_home TEXT NOT NULL DEFAULT 'outputs_library';

ALTER TABLE v8_output_artifacts
  ADD COLUMN IF NOT EXISTS visibility_scope TEXT NOT NULL DEFAULT 'organization'
  CHECK (visibility_scope IN ('private', 'project', 'organization', 'review_shared', 'demo'));

ALTER TABLE v8_output_artifacts
  ADD COLUMN IF NOT EXISTS project_id TEXT;

ALTER TABLE v8_output_artifacts
  ADD COLUMN IF NOT EXISTS context_snapshot_id TEXT;

ALTER TABLE v8_output_artifacts
  ADD COLUMN IF NOT EXISTS execution_run_id TEXT;

ALTER TABLE v8_output_artifacts
  ADD COLUMN IF NOT EXISTS origin_summary_json TEXT;

CREATE INDEX IF NOT EXISTS idx_v81_artifacts_org_visibility
  ON v8_output_artifacts(organization_id, visibility_scope);

CREATE INDEX IF NOT EXISTS idx_v81_artifacts_owner
  ON v8_output_artifacts(owner_user_id)
  WHERE owner_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_v81_artifacts_project
  ON v8_output_artifacts(project_id)
  WHERE project_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS v8_artifact_origin_links (
  link_id           TEXT PRIMARY KEY,
  artifact_id       TEXT NOT NULL,
  organization_id   TEXT NOT NULL,
  origin_runtime    TEXT NOT NULL
                    CHECK (origin_runtime IN ('report', 'presentation', 'sheet', 'native_artifact')),
  origin_record_id  TEXT NOT NULL,
  is_primary_origin INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_v81_origin_unique
  ON v8_artifact_origin_links(organization_id, origin_runtime, origin_record_id);

CREATE INDEX IF NOT EXISTS idx_v81_origin_artifact
  ON v8_artifact_origin_links(artifact_id, organization_id);

CREATE TABLE IF NOT EXISTS v8_artifact_access_grants (
  grant_id         TEXT PRIMARY KEY,
  artifact_id      TEXT NOT NULL,
  organization_id  TEXT NOT NULL,
  grant_kind       TEXT NOT NULL
                   CHECK (grant_kind IN ('user', 'role')),
  user_id          TEXT,
  role_key         TEXT,
  created_by       TEXT NOT NULL,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v81_access_artifact
  ON v8_artifact_access_grants(artifact_id, organization_id);

CREATE INDEX IF NOT EXISTS idx_v81_access_user
  ON v8_artifact_access_grants(user_id, organization_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_v81_access_role
  ON v8_artifact_access_grants(role_key, organization_id)
  WHERE role_key IS NOT NULL;
