-- F2-E / variant B: durable organization-export snapshot and resumable materialization.
--
-- Additive only. No historical rows are changed and no export is started by this
-- migration.  `as_of` is the single cutoff pinned by the application when the
-- snapshot is created. Raw resume and lease tokens must never be persisted; only
-- their lowercase SHA-256 digests belong in this schema.

BEGIN;

CREATE TABLE IF NOT EXISTS organization_export_snapshots (
  snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  requested_by_user_id TEXT,
  as_of TIMESTAMPTZ NOT NULL,

  idempotency_key TEXT NOT NULL,
  request_sha256 TEXT NOT NULL CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
  resume_token_sha256 TEXT NOT NULL CHECK (resume_token_sha256 ~ '^[0-9a-f]{64}$'),

  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'RUNNING', 'FINALIZING', 'READY', 'FAILED', 'EXPIRED')),
  lease_owner TEXT,
  lease_token_sha256 TEXT CHECK (lease_token_sha256 IS NULL OR lease_token_sha256 ~ '^[0-9a-f]{64}$'),
  lease_expires_at TIMESTAMPTZ,
  lease_heartbeat_at TIMESTAMPTZ,
  fence BIGINT NOT NULL DEFAULT 0 CHECK (fence >= 0),

  checkpoint_part_ordinal INTEGER NOT NULL DEFAULT -1 CHECK (checkpoint_part_ordinal >= -1),
  checkpoint_json JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(checkpoint_json) = 'object'),

  artifact_filename TEXT,
  artifact_media_type TEXT,
  artifact_content_encoding TEXT,
  artifact_sha256 TEXT CHECK (artifact_sha256 IS NULL OR artifact_sha256 ~ '^[0-9a-f]{64}$'),
  artifact_bytes BIGINT CHECK (artifact_bytes IS NULL OR artifact_bytes >= 0),
  artifact_part_count INTEGER CHECK (artifact_part_count IS NULL OR artifact_part_count >= 0),
  artifact_metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(artifact_metadata) = 'object'),

  failure_code TEXT,
  failure_detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (organization_id, idempotency_key),
  UNIQUE (organization_id, snapshot_id),
  CHECK (
    (lease_owner IS NULL AND lease_token_sha256 IS NULL AND lease_expires_at IS NULL)
    OR
    (lease_owner IS NOT NULL AND lease_token_sha256 IS NOT NULL AND lease_expires_at IS NOT NULL)
  ),
  CHECK (
    status <> 'READY'
    OR (
      artifact_filename IS NOT NULL
      AND artifact_media_type IS NOT NULL
      AND artifact_sha256 IS NOT NULL
      AND artifact_bytes IS NOT NULL
      AND artifact_part_count IS NOT NULL
      AND completed_at IS NOT NULL
    )
  )
);

CREATE TABLE IF NOT EXISTS organization_export_snapshot_parts (
  organization_id TEXT NOT NULL,
  snapshot_id UUID NOT NULL,
  part_ordinal INTEGER NOT NULL CHECK (part_ordinal >= 0),
  part_key TEXT NOT NULL,
  source_cursor JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(source_cursor) = 'object'),
  content_encoding TEXT NOT NULL DEFAULT 'identity',
  payload BYTEA NOT NULL,
  payload_sha256 TEXT NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  payload_bytes BIGINT NOT NULL CHECK (payload_bytes >= 0),
  row_count BIGINT CHECK (row_count IS NULL OR row_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (snapshot_id, part_ordinal),
  UNIQUE (snapshot_id, part_key),
  FOREIGN KEY (organization_id, snapshot_id)
    REFERENCES organization_export_snapshots(organization_id, snapshot_id)
    ON DELETE RESTRICT,
  CHECK (payload_bytes = octet_length(payload)),
  CHECK (payload_sha256 = encode(digest(payload, 'sha256'), 'hex'))
);

CREATE INDEX IF NOT EXISTS idx_org_export_snapshots_queue
  ON organization_export_snapshots (status, lease_expires_at, created_at);

CREATE INDEX IF NOT EXISTS idx_org_export_snapshots_org_as_of
  ON organization_export_snapshots (organization_id, as_of DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_org_export_snapshot_parts_owner
  ON organization_export_snapshot_parts (organization_id, snapshot_id, part_ordinal);

COMMENT ON COLUMN organization_export_snapshots.as_of IS
  'Immutable application-level cutoff for every source read in this full organization snapshot.';
COMMENT ON COLUMN organization_export_snapshots.resume_token_sha256 IS
  'Lowercase SHA-256 digest only; the raw resume token must never be stored.';
COMMENT ON COLUMN organization_export_snapshots.fence IS
  'Monotonic fencing value incremented atomically on every successful lease claim.';
COMMENT ON COLUMN organization_export_snapshots.checkpoint_json IS
  'Durable source cursors written only by the current lease holder and fence.';
COMMENT ON COLUMN organization_export_snapshot_parts.payload_sha256 IS
  'Lowercase SHA-256 of the exact durable part bytes in payload.';

CREATE FUNCTION reject_organization_export_snapshot_identity_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.as_of IS DISTINCT FROM OLD.as_of
     OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
     OR NEW.request_sha256 IS DISTINCT FROM OLD.request_sha256
     OR NEW.resume_token_sha256 IS DISTINCT FROM OLD.resume_token_sha256
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'organization export snapshot identity and as_of are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_organization_export_snapshot_identity_immutable
  BEFORE UPDATE ON organization_export_snapshots
  FOR EACH ROW EXECUTE FUNCTION reject_organization_export_snapshot_identity_mutation();

CREATE FUNCTION reject_organization_export_snapshot_part_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'organization export snapshot parts are immutable';
END;
$$;

CREATE TRIGGER trg_organization_export_snapshot_parts_immutable
  BEFORE UPDATE OR DELETE ON organization_export_snapshot_parts
  FOR EACH ROW EXECUTE FUNCTION reject_organization_export_snapshot_part_mutation();

COMMIT;
