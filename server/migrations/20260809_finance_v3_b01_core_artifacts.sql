-- Finance v3 — Gate C (WP-C01): WP-B01 canonical artifact/version/revision schema.
--
-- Source of truth for shape/naming: docs/validation/finance-v3/generated/gate-b/WP-B01_artifact_schema_ADR.md
-- (Zalacznik A DDL sketch) reconciled against
-- docs/validation/finance-v3/generated/gate-b/GATE_B_INTEGRATION_RECONCILIATION.md sections 1-3
-- (finance_ prefix + business_version_id naming is canonical; the extra columns B02/B03 need on
-- finance_business_versions are added here, in the table that owns it, rather than as a later
-- ALTER, since this is the first migration to ever create the table).
--
-- Additive only. Does not modify, rename or drop any of the existing ~60 Finance tables from
-- Gate A, nor any other table in the schema.
--
-- Implementation notes / deliberate divergences from the literal ADR sketch (documented in
-- docs/validation/finance-v3/generated/gate-c/WP-C01_migration_report.md):
--   1. All identifiers use TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text, not UUID, matching
--      organizations(id) (TEXT) and the convention already used by all 60 live Finance tables
--      (WP-B01 ADR itself flags UUID-vs-TEXT as a risk to reconcile — this migration resolves it
--      by following the live-schema convention).
--   2. finance_business_versions includes both the base WP-B01 columns AND the columns
--      GATE_B_INTEGRATION_RECONCILIATION.md section 2 says are missing (risk_tier, submitted_by/at,
--      archived_by/at, superseded_at, reopen_reason/reopened_by/reopened_at, freshness_reason,
--      stale_since) AND the `version` optimistic-concurrency counter WP-B02 section 4.1 requires
--      (independent from version_no) — adding all of this in the founding migration avoids a
--      later ALTER just to catch up with a same-Gate-B dependency.
--   3. The immutability trigger's "which columns may still change on an APPROVED row" check is
--      rewritten as an allow-list diff over to_jsonb(OLD)/to_jsonb(NEW) instead of the ADR
--      sketch's hardcoded 7-column deny-list. The literal ADR sketch would silently miss any
--      column added later by B02/B03/B05/B06 reconciliation (risk_tier, freshness_reason,
--      result_quality, version_kind, ...) since none of those are in its hardcoded check.

BEGIN;

-- 0. Shared financial value status type (WP-B01 section 2.7) — convention for future Gate D
--    domain value tables (statement lines, model outputs, scenario cells...). Not a table on its
--    own; no Gate D tables are created here.
DO $$ BEGIN
  CREATE TYPE finance_value_status AS ENUM (
    'PRESENT_ZERO', 'PRESENT_NONZERO', 'MISSING', 'NA', 'NOT_APPLICABLE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1. finance_artifacts — identity, not content (WP-B01 section 2.1)
CREATE TABLE IF NOT EXISTS finance_artifacts (
  artifact_id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id              TEXT NOT NULL REFERENCES organizations(id),
  artifact_type                TEXT NOT NULL CHECK (artifact_type IN (
                                  'STATEMENT_PACK', 'HISTORICAL_ANALYSIS', 'BASELINE_MODEL',
                                  'PREDICTION_SCENARIO', 'VALUATION_CASE', 'REPORT_EXPORT'
                                )),
  natural_key                  TEXT,
  current_business_version_id  TEXT,
  created_by                   TEXT,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at                  TIMESTAMPTZ,
  archived_reason              TEXT,

  CONSTRAINT uq_finance_artifacts_org UNIQUE (artifact_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_finance_artifacts_org_type ON finance_artifacts(organization_id, artifact_type);

-- 2. finance_engine_manifests — code identity, NOT org-scoped (WP-B01 section 2.5)
CREATE TABLE IF NOT EXISTS finance_engine_manifests (
  engine_manifest_id      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  engine_name              TEXT NOT NULL,
  engine_version           TEXT NOT NULL,
  code_commit_sha          TEXT NOT NULL,
  formula_taxonomy_version TEXT,
  market_data_asof         TIMESTAMPTZ, -- superseded by finance_compute_snapshots (WP-B06); kept, additive-only
  config_hash              TEXT NOT NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_finance_engine_manifest UNIQUE (engine_name, engine_version, code_commit_sha, config_hash)
);

-- Legacy sentinel (WP-B01 section 2.5) so engine_manifest_id can stay NOT NULL without special-casing backfill.
INSERT INTO finance_engine_manifests (engine_name, engine_version, code_commit_sha, config_hash)
  VALUES ('LEGACY_UNKNOWN', '0', 'unknown', 'unknown')
ON CONFLICT (engine_name, engine_version, code_commit_sha, config_hash) DO NOTHING;

-- 3. finance_business_versions — immutable milestone (vN). See header note 2 for the extra columns.
CREATE TABLE IF NOT EXISTS finance_business_versions (
  business_version_id    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  artifact_id             TEXT NOT NULL,
  organization_id          TEXT NOT NULL,
  version_no                INTEGER NOT NULL,
  version                    INTEGER NOT NULL DEFAULT 1, -- CAS counter (WP-B02 4.1), independent from version_no
  status                      TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
                                 'DRAFT', 'READY_FOR_REVIEW', 'IN_REVIEW', 'APPROVED',
                                 'NEEDS_CHANGES', 'SUPERSEDED', 'ARCHIVED', 'INVALIDATED'
                               )),
  freshness                    TEXT NOT NULL DEFAULT 'NEVER_COMPUTED' CHECK (freshness IN (
                                 'NEVER_COMPUTED', 'CURRENT', 'STALE_SOURCE', 'STALE_ASSUMPTIONS', 'COMPUTE_FAILED'
                               )),
  freshness_reason              TEXT,          -- WP-B03 section 7 / GATE_B section 2
  stale_since                    TIMESTAMPTZ,   -- WP-B03 section 7 / GATE_B section 2

  source_working_revision_id      TEXT,         -- FK added below once finance_working_revisions exists
  parent_version_id                TEXT REFERENCES finance_business_versions(business_version_id),
  superseded_by_version_id          TEXT REFERENCES finance_business_versions(business_version_id),
  superseded_at                      TIMESTAMPTZ, -- GATE_B section 2

  -- Forward references to WP-B04 compute tables — deliberately no FK yet (WP-B01 2.2 / section 4 risk).
  compute_snapshot_id                 TEXT,
  compute_run_id                       TEXT,
  engine_manifest_id                    TEXT NOT NULL REFERENCES finance_engine_manifests(engine_manifest_id),
  content_semantic_hash                  TEXT,

  risk_tier                               TEXT CHECK (risk_tier IN ('LOW', 'MATERIAL', 'HIGH_RISK')), -- GATE_B section 2 / B02 7.2

  submitted_by                             TEXT, -- GATE_B section 2 / B02 5.1 T2
  submitted_at                              TIMESTAMPTZ,

  approved_by                                TEXT,
  approved_at                                 TIMESTAMPTZ,
  approval_note                                TEXT,

  archived_by                                   TEXT, -- GATE_B section 2
  archived_at                                    TIMESTAMPTZ,

  invalidated_reason                              TEXT,
  immutable_since                                  TIMESTAMPTZ,

  reopen_reason                                     TEXT, -- GATE_B section 2 / B02 6.2 — describes THIS row (vN+1)
  reopened_by                                        TEXT,
  reopened_at                                         TIMESTAMPTZ,

  created_by                                           TEXT,
  created_at                                            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                                             TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_finance_bv_artifact_org
    FOREIGN KEY (artifact_id, organization_id)
    REFERENCES finance_artifacts (artifact_id, organization_id),

  -- Direct answer to Gate A's missing UNIQUE(model_id, version) / UNIQUE(valuation_id, version).
  CONSTRAINT uq_finance_bv_artifact_version UNIQUE (artifact_id, version_no),

  -- WP-B03 section 4 / GATE_B section 3 — required for finance_lineage_edges tenant-safe composite FK.
  CONSTRAINT uq_finance_bv_id_org UNIQUE (business_version_id, organization_id)
);

-- At most one APPROVED business version per artifact at any time (WP-B01 2.2).
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_bv_one_approved
  ON finance_business_versions (artifact_id)
  WHERE status = 'APPROVED';

-- Exactly one open (non-terminal) child per parent version (WP-B02 6.3 preferred mechanism —
-- stops two concurrent "Reopen" clicks from creating two vN+1 rows for the same vN).
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_bv_one_open_child
  ON finance_business_versions (parent_version_id)
  WHERE parent_version_id IS NOT NULL
    AND status NOT IN ('SUPERSEDED', 'ARCHIVED', 'INVALIDATED');

CREATE INDEX IF NOT EXISTS idx_finance_bv_artifact ON finance_business_versions(artifact_id, version_no);
CREATE INDEX IF NOT EXISTS idx_finance_bv_org_status ON finance_business_versions(organization_id, status);

-- 4. finance_working_revisions — mutable Draft, append-only checkpoints (WP-B01 section 2.3)
CREATE TABLE IF NOT EXISTS finance_working_revisions (
  working_revision_id       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  artifact_id                 TEXT NOT NULL,
  organization_id              TEXT NOT NULL,
  business_version_id           TEXT REFERENCES finance_business_versions(business_version_id),
  source_business_version_id     TEXT REFERENCES finance_business_versions(business_version_id), -- B02 6.2 step 5
  revision_seq                    BIGINT NOT NULL,
  version                          INTEGER NOT NULL DEFAULT 1, -- CAS counter (WP-B02 4.1), own counter
  content_semantic_hash             TEXT,
  compute_run_id                     TEXT, -- forward reference to WP-B04, no FK yet
  is_current                          BOOLEAN NOT NULL DEFAULT true,
  crash_recovery_checkpoint            BOOLEAN NOT NULL DEFAULT false,
  edited_by                             TEXT,
  edited_at                              TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_finance_wr_artifact_org
    FOREIGN KEY (artifact_id, organization_id)
    REFERENCES finance_artifacts (artifact_id, organization_id),

  CONSTRAINT uq_finance_wr_artifact_seq UNIQUE (artifact_id, revision_seq),
  CONSTRAINT uq_finance_wr_id_org UNIQUE (working_revision_id, organization_id)
);

-- Exactly one "live" Draft per artifact (WP-B01 2.3).
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_wr_one_current
  ON finance_working_revisions (artifact_id)
  WHERE is_current;

CREATE INDEX IF NOT EXISTS idx_finance_wr_artifact ON finance_working_revisions(artifact_id, revision_seq DESC);

-- Deferred FKs now that both sides exist (WP-B01 Zalacznik A — "domykamy odroczone FK").
ALTER TABLE finance_business_versions DROP CONSTRAINT IF EXISTS fk_finance_bv_source_wr;
ALTER TABLE finance_business_versions
  ADD CONSTRAINT fk_finance_bv_source_wr
  FOREIGN KEY (source_working_revision_id)
  REFERENCES finance_working_revisions (working_revision_id);

ALTER TABLE finance_artifacts DROP CONSTRAINT IF EXISTS fk_finance_artifacts_current_bv;
ALTER TABLE finance_artifacts
  ADD CONSTRAINT fk_finance_artifacts_current_bv
  FOREIGN KEY (current_business_version_id)
  REFERENCES finance_business_versions (business_version_id);

-- 5. finance_artifact_aliases — legacy -> canonical bridge (WP-B01 section 2.6)
CREATE TABLE IF NOT EXISTS finance_artifact_aliases (
  alias_id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  legacy_table           TEXT NOT NULL,
  legacy_id                TEXT NOT NULL,
  legacy_version             TEXT,
  artifact_id                 TEXT NOT NULL,
  organization_id              TEXT NOT NULL,
  business_version_id           TEXT REFERENCES finance_business_versions(business_version_id),
  mapping_confidence              TEXT NOT NULL CHECK (mapping_confidence IN (
                                     'AUTO_MIGRATE', 'MIGRATE_WITH_WARNING', 'QUARANTINE', 'EXCLUDE_WITH_REASON'
                                   )),
  mapping_reason                    TEXT,
  created_by                          TEXT,
  created_at                           TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_finance_alias_artifact_org
    FOREIGN KEY (artifact_id, organization_id)
    REFERENCES finance_artifacts (artifact_id, organization_id),

  CONSTRAINT uq_finance_alias_legacy UNIQUE (legacy_table, legacy_id, legacy_version)
);

CREATE INDEX IF NOT EXISTS idx_finance_alias_artifact ON finance_artifact_aliases(artifact_id);
CREATE INDEX IF NOT EXISTS idx_finance_alias_org ON finance_artifact_aliases(organization_id);
CREATE INDEX IF NOT EXISTS idx_finance_alias_legacy_table ON finance_artifact_aliases(legacy_table);

-- 6. Immutability enforcement (WP-B01 section 2.4) — DB constraint hybrid trigger.
-- See header note 3 for why this diffs to_jsonb(OLD)/to_jsonb(NEW) against an allow-list instead
-- of reproducing the ADR sketch's hardcoded 7-column deny-list.
CREATE OR REPLACE FUNCTION finance_bv_enforce_immutability() RETURNS TRIGGER AS $$
DECLARE
  allowed_keys TEXT[] := ARRAY[
    'status', 'superseded_by_version_id', 'invalidated_reason', 'updated_at',
    'archived_by', 'archived_at', 'superseded_at',
    'freshness', 'freshness_reason', 'stale_since'
  ];
  old_j JSONB;
  new_j JSONB;
BEGIN
  -- "Approved without snapshot" is never allowed (Gate A finding).
  IF NEW.status = 'APPROVED' AND NEW.compute_snapshot_id IS NULL THEN
    RAISE EXCEPTION 'finance_business_versions: cannot APPROVE % without compute_snapshot_id', NEW.business_version_id;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'APPROVED' THEN
    IF NEW.status NOT IN ('APPROVED', 'SUPERSEDED', 'ARCHIVED', 'INVALIDATED') THEN
      RAISE EXCEPTION 'finance_business_versions: % is APPROVED and immutable; only SUPERSEDED/ARCHIVED/INVALIDATED transitions allowed', OLD.business_version_id;
    END IF;

    old_j := to_jsonb(OLD);
    new_j := to_jsonb(NEW);
    IF (SELECT jsonb_object_agg(k, old_j -> k) FROM jsonb_object_keys(old_j) AS k WHERE NOT (k = ANY(allowed_keys)))
       IS DISTINCT FROM
       (SELECT jsonb_object_agg(k, new_j -> k) FROM jsonb_object_keys(new_j) AS k WHERE NOT (k = ANY(allowed_keys)))
    THEN
      RAISE EXCEPTION 'finance_business_versions: % is APPROVED; only status and its associated metadata columns may change', OLD.business_version_id;
    END IF;

    IF NEW.status = 'INVALIDATED' AND (NEW.invalidated_reason IS NULL OR NEW.invalidated_reason = '') THEN
      RAISE EXCEPTION 'finance_business_versions: INVALIDATED requires invalidated_reason (DEC-FIN-007)';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_bv_immutability ON finance_business_versions;
CREATE TRIGGER trg_finance_bv_immutability
  BEFORE UPDATE ON finance_business_versions
  FOR EACH ROW EXECUTE FUNCTION finance_bv_enforce_immutability();

-- 7. Denormalized cache finance_artifacts.current_business_version_id (WP-B01 Zalacznik A section 7)
CREATE OR REPLACE FUNCTION finance_artifacts_sync_current_bv() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'APPROVED' THEN
    UPDATE finance_artifacts
      SET current_business_version_id = NEW.business_version_id
      WHERE artifact_id = NEW.artifact_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_artifacts_sync_current_bv ON finance_business_versions;
CREATE TRIGGER trg_finance_artifacts_sync_current_bv
  AFTER INSERT OR UPDATE ON finance_business_versions
  FOR EACH ROW EXECUTE FUNCTION finance_artifacts_sync_current_bv();

COMMIT;
