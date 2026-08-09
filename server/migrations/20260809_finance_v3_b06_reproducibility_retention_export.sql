-- Finance v3 — Gate C (WP-C01): WP-B06 reproducibility, restatement, retention and export.
--
-- Source: docs/validation/finance-v3/generated/gate-b/WP-B06_reproducibility_retention_export_ADR.md
--
-- Additive only. No retention period / jurisdiction / post_retention_action value is hardcoded
-- here — finance_retention_policies.retention_status defaults to 'PENDING_OWNER_DECISION', exactly
-- as the ADR requires (section 5.1, section 9 point 1): the mechanism is shipped, the legal/owner
-- decision is not made by this migration.
--
-- Note: this migration does NOT implement the ADR's recommended amendment to deprecate
-- finance_engine_manifests.market_data_asof (section 3.1) — that column is additive-safe to leave
-- in place, and the ADR itself says the amendment "requires the WP-B01 owner's agreement... not a
-- change WP-B06 can unilaterally commit to someone else's ADR" (section 8). Left as-is; documented
-- in the migration report as an open cross-ADR item, not silently resolved.

BEGIN;

-- Amendment to finance_engine_manifests (WP-B06 section 3.1) — engine-level rounding convention.
ALTER TABLE finance_engine_manifests
  ADD COLUMN IF NOT EXISTS rounding_convention TEXT NOT NULL DEFAULT 'BANKERS_ROUNDING_2DP';

-- finance_compute_snapshots — reproducibility context per frozen compute run (WP-B06 section 3.2,
-- closes the finance_compute_snapshots gap left open by B02 section 5.1 step (b)).
CREATE TABLE IF NOT EXISTS finance_compute_snapshots (
  compute_snapshot_id      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  artifact_id                TEXT NOT NULL,
  organization_id              TEXT NOT NULL,
  working_revision_id            TEXT NOT NULL REFERENCES finance_working_revisions(working_revision_id),
  compute_run_id                   TEXT, -- forward reference to WP-B04, no FK (B01 2.2 rationale)
  engine_manifest_id                 TEXT NOT NULL REFERENCES finance_engine_manifests(engine_manifest_id),
  fiscal_calendar_id                   TEXT, -- forward reference, owner WP not yet assigned (B06 section 10.3)
  fx_snapshot_id                         TEXT, -- forward reference, owner WP not yet assigned
  market_data_snapshot_id                  TEXT, -- forward reference, owner WP not yet assigned
  locale                                     TEXT,
  timezone                                     TEXT,
  as_of                                          TIMESTAMPTZ NOT NULL,
  content_semantic_hash                            TEXT,
  created_by                                         TEXT,
  created_at                                           TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_finance_compute_snapshots_artifact_org
    FOREIGN KEY (artifact_id, organization_id)
    REFERENCES finance_artifacts (artifact_id, organization_id),

  CONSTRAINT uq_finance_compute_snapshots_revision_run UNIQUE (working_revision_id, compute_run_id)
);

CREATE INDEX IF NOT EXISTS idx_finance_compute_snapshots_artifact ON finance_compute_snapshots(artifact_id, created_at DESC);

CREATE OR REPLACE FUNCTION finance_compute_snapshots_deny_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'finance_compute_snapshots is append-only; % not permitted (row %)', TG_OP,
    COALESCE(OLD.compute_snapshot_id, NEW.compute_snapshot_id);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_compute_snapshots_deny_update ON finance_compute_snapshots;
CREATE TRIGGER trg_finance_compute_snapshots_deny_update
  BEFORE UPDATE ON finance_compute_snapshots
  FOR EACH ROW EXECUTE FUNCTION finance_compute_snapshots_deny_mutation();

DROP TRIGGER IF EXISTS trg_finance_compute_snapshots_deny_delete ON finance_compute_snapshots;
CREATE TRIGGER trg_finance_compute_snapshots_deny_delete
  BEFORE DELETE ON finance_compute_snapshots
  FOR EACH ROW EXECUTE FUNCTION finance_compute_snapshots_deny_mutation();

-- Deferred FK: finance_business_versions.compute_snapshot_id -> finance_compute_snapshots (WP-B06 section 3.2/3.3)
ALTER TABLE finance_business_versions DROP CONSTRAINT IF EXISTS fk_finance_bv_compute_snapshot;
ALTER TABLE finance_business_versions
  ADD CONSTRAINT fk_finance_bv_compute_snapshot
  FOREIGN KEY (compute_snapshot_id) REFERENCES finance_compute_snapshots(compute_snapshot_id);

-- Original / restated / management-adjusted lineage (WP-B06 section 4.1)
ALTER TABLE finance_business_versions
  ADD COLUMN IF NOT EXISTS version_kind TEXT NOT NULL DEFAULT 'ORIGINAL'
    CHECK (version_kind IN ('ORIGINAL', 'RESTATED', 'MANAGEMENT_ADJUSTED'));
ALTER TABLE finance_business_versions
  ADD COLUMN IF NOT EXISTS restatement_reason TEXT;
ALTER TABLE finance_business_versions
  ADD COLUMN IF NOT EXISTS restatement_class TEXT
    CHECK (restatement_class IN ('ERROR_CORRECTION', 'ACCOUNTING_POLICY_CHANGE', 'RECLASSIFICATION', 'OTHER'));

ALTER TABLE finance_business_versions DROP CONSTRAINT IF EXISTS chk_finance_bv_restatement_reason;
ALTER TABLE finance_business_versions
  ADD CONSTRAINT chk_finance_bv_restatement_reason
  CHECK (version_kind != 'RESTATED' OR (restatement_reason IS NOT NULL AND restatement_class IS NOT NULL));

-- finance_retention_policies (WP-B06 section 5.1) — configurable, no hardcoded periods/jurisdictions.
CREATE TABLE IF NOT EXISTS finance_retention_policies (
  retention_policy_id     TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id           TEXT, -- NULL = platform default, per-org row overrides
  artifact_type              TEXT NOT NULL, -- finance_artifacts.artifact_type value, or 'EXPORT'
  jurisdiction                TEXT,
  applies_to_status           TEXT NOT NULL DEFAULT 'ANY'
                                CHECK (applies_to_status IN ('ANY', 'APPROVED', 'SUPERSEDED', 'ARCHIVED', 'INVALIDATED')),

  retention_status           TEXT NOT NULL DEFAULT 'PENDING_OWNER_DECISION'
                                CHECK (retention_status IN ('CONFIGURED', 'PENDING_OWNER_DECISION', 'RETAIN_INDEFINITELY')),
  retention_period            INTERVAL, -- NULL until retention_status = 'CONFIGURED'
  retention_basis               TEXT,
  post_retention_action           TEXT
                                    CHECK (post_retention_action IN ('ANONYMIZE', 'HARD_DELETE', 'MOVE_TO_COLD_ARCHIVE')
                                           OR post_retention_action IS NULL),

  legal_hold_overrides_expiry       BOOLEAN NOT NULL DEFAULT true,

  effective_from                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  superseded_by_policy_id               TEXT REFERENCES finance_retention_policies(retention_policy_id),
  created_by                              TEXT NOT NULL,
  created_at                                TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_finance_retention_scope
    UNIQUE (organization_id, artifact_type, jurisdiction, applies_to_status, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_finance_retention_org_type ON finance_retention_policies(organization_id, artifact_type);

-- finance_legal_holds (WP-B06 section 5.2)
CREATE TABLE IF NOT EXISTS finance_legal_holds (
  legal_hold_id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id         TEXT NOT NULL REFERENCES organizations(id),
  artifact_id              TEXT,
  business_version_id      TEXT,
  matter_reference          TEXT NOT NULL,
  reason                     TEXT NOT NULL,
  status                     TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RELEASED')),
  imposed_by                  TEXT NOT NULL,
  imposed_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_by                   TEXT,
  released_at                    TIMESTAMPTZ,
  released_reason                 TEXT,

  CONSTRAINT chk_finance_legal_hold_scope
    CHECK ((artifact_id IS NOT NULL AND business_version_id IS NULL)
        OR (artifact_id IS NULL AND business_version_id IS NOT NULL)),
  CONSTRAINT chk_finance_legal_hold_release
    CHECK (status = 'ACTIVE' OR (released_by IS NOT NULL AND released_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_finance_legal_hold_artifact_active
  ON finance_legal_holds(artifact_id) WHERE status = 'ACTIVE' AND artifact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_finance_legal_hold_version_active
  ON finance_legal_holds(business_version_id) WHERE status = 'ACTIVE' AND business_version_id IS NOT NULL;

-- finance_export_manifests (WP-B06 section 6.1) — immutable, version-pinned.
CREATE TABLE IF NOT EXISTS finance_export_manifests (
  export_manifest_id       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id             TEXT NOT NULL REFERENCES organizations(id),
  export_format                 TEXT NOT NULL CHECK (export_format IN ('PDF', 'XLSX', 'PPTX', 'CSV', 'JSON')),
  status                         TEXT NOT NULL DEFAULT 'GENERATING'
                                    CHECK (status IN ('GENERATING', 'READY', 'FAILED', 'EXPIRED', 'REVOKED')),

  primary_artifact_id            TEXT NOT NULL,
  primary_business_version_id     TEXT NOT NULL,

  locale                           TEXT NOT NULL,
  timezone                          TEXT NOT NULL,
  unit                               TEXT NOT NULL,
  as_of                               TIMESTAMPTZ NOT NULL,
  rounding_convention_used            TEXT NOT NULL,
  rounding_convention_overridden       BOOLEAN NOT NULL DEFAULT false,

  content_semantic_hash                 TEXT NOT NULL,
  file_hash_sha256                       TEXT, -- NULL until status = 'READY'

  storage_object_key                      TEXT, -- NULL until status = 'READY'; NOT a live signed URL, see B06 6.4
  storage_bytes                            BIGINT,
  default_signed_url_ttl_seconds            INTEGER NOT NULL DEFAULT 86400,

  generated_by                               TEXT NOT NULL,
  generated_at                                TIMESTAMPTZ,
  failure_reason                               TEXT,
  revoked_by                                    TEXT,
  revoked_at                                     TIMESTAMPTZ,
  revoked_reason                                  TEXT,

  created_at                                       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_finance_export_primary_artifact_org
    FOREIGN KEY (primary_artifact_id, organization_id)
    REFERENCES finance_artifacts (artifact_id, organization_id),

  CONSTRAINT fk_finance_export_primary_bv_org
    FOREIGN KEY (primary_business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id),

  CONSTRAINT chk_finance_export_ready_requires_hash
    CHECK (status <> 'READY' OR (file_hash_sha256 IS NOT NULL AND storage_object_key IS NOT NULL AND generated_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_finance_export_org_status ON finance_export_manifests(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_finance_export_primary_version ON finance_export_manifests(primary_business_version_id);

-- Export only from an APPROVED source version (WP-B06 section 6.2).
CREATE OR REPLACE FUNCTION finance_export_require_approved_source() RETURNS TRIGGER AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM finance_business_versions WHERE business_version_id = NEW.primary_business_version_id;
  IF v_status IS DISTINCT FROM 'APPROVED' THEN
    RAISE EXCEPTION 'finance_export_manifests: primary_business_version_id % must be APPROVED, is %', NEW.primary_business_version_id, v_status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_export_require_approved ON finance_export_manifests;
CREATE TRIGGER trg_finance_export_require_approved
  BEFORE INSERT ON finance_export_manifests
  FOR EACH ROW EXECUTE FUNCTION finance_export_require_approved_source();

-- Immutable once READY, same trigger pattern as finance_business_versions (WP-B01 2.4), reused per WP-B06 section 6.1.
CREATE OR REPLACE FUNCTION finance_export_enforce_immutability() RETURNS TRIGGER AS $$
DECLARE
  allowed_keys TEXT[] := ARRAY[
    'status', 'file_hash_sha256', 'storage_object_key', 'storage_bytes',
    'generated_at', 'failure_reason', 'revoked_by', 'revoked_at', 'revoked_reason'
  ];
  old_j JSONB;
  new_j JSONB;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IN ('EXPIRED', 'REVOKED') THEN
    RAISE EXCEPTION 'finance_export_manifests: % is terminal (%); no further updates allowed', OLD.export_manifest_id, OLD.status;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'READY' THEN
    IF NEW.status NOT IN ('READY', 'EXPIRED', 'REVOKED') THEN
      RAISE EXCEPTION 'finance_export_manifests: % is READY; only EXPIRED/REVOKED transitions allowed', OLD.export_manifest_id;
    END IF;

    old_j := to_jsonb(OLD);
    new_j := to_jsonb(NEW);
    IF (SELECT jsonb_object_agg(k, old_j -> k) FROM jsonb_object_keys(old_j) AS k WHERE NOT (k = ANY(allowed_keys)))
       IS DISTINCT FROM
       (SELECT jsonb_object_agg(k, new_j -> k) FROM jsonb_object_keys(new_j) AS k WHERE NOT (k = ANY(allowed_keys)))
    THEN
      RAISE EXCEPTION 'finance_export_manifests: % is READY; only status/file metadata may change', OLD.export_manifest_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_export_immutability ON finance_export_manifests;
CREATE TRIGGER trg_finance_export_immutability
  BEFORE UPDATE ON finance_export_manifests
  FOR EACH ROW EXECUTE FUNCTION finance_export_enforce_immutability();

-- finance_export_manifest_sources — N:1 aggregation, Report/Export is always a DAG leaf (WP-B06 section 6.3)
CREATE TABLE IF NOT EXISTS finance_export_manifest_sources (
  export_manifest_id      TEXT NOT NULL REFERENCES finance_export_manifests(export_manifest_id),
  business_version_id       TEXT NOT NULL,
  role                        TEXT, -- 'PRIMARY' | 'COMPARATIVE_PRIOR_PERIOD' | 'BENCHMARK'
  PRIMARY KEY (export_manifest_id, business_version_id)
);

-- finance_export_evidence_items — evidence appendix (WP-B06 section 6.5)
CREATE TABLE IF NOT EXISTS finance_export_evidence_items (
  evidence_item_id        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  export_manifest_id        TEXT NOT NULL REFERENCES finance_export_manifests(export_manifest_id),
  evidence_type               TEXT NOT NULL CHECK (evidence_type IN (
                                 'SOURCE_LINEAGE_VERSION', 'EXCEPTION_LEDGER_ENTRY',
                                 'COMPUTE_SNAPSHOT', 'REVIEW_APPROVAL_RECORD', 'ADVISOR_FINDING'
                               )),
  ref_id                       TEXT NOT NULL,
  description                   TEXT,
  included_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_finance_export_evidence UNIQUE (export_manifest_id, evidence_type, ref_id)
);

COMMIT;
