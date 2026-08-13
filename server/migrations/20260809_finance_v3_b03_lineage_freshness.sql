-- Finance v3 — Gate C (WP-C01): WP-B03 lineage DAG and freshness propagation.
--
-- Source: docs/validation/finance-v3/generated/gate-b/WP-B03_lineage_staleness_ADR.md, translated
-- from the ADR's hypothetical business_versions/id naming to the canonical
-- finance_business_versions/business_version_id per GATE_B_INTEGRATION_RECONCILIATION.md section 1.
--
-- Additive only.
--
-- Implementation notes (documented in the WP-C01 migration report):
--   1. TEXT ids, not UUID (see B01 migration header note 1 — same reconciliation applies here).
--   2. edge_type's CHECK enum includes VERSION_TO_MANAGEMENT_ADJUSTED_VARIANT even though that
--      value is only introduced later, by WP-B06 section 4.5 — added here upfront because Postgres
--      CHECK-based enums require a DROP/ADD CONSTRAINT to extend later, and B06 explicitly
--      documents this value as a sibling/variant exception to B03's own cycle-prevention rule; it
--      is simpler and less risky to accommodate it in the original CHECK than to alter it in a
--      later migration.
--   3. Cycle prevention (B03 section 4) is implemented as documented (stage_rank(target) >
--      stage_rank(source)), but the trigger DERIVES source_artifact_type/target_artifact_type from
--      finance_artifacts via finance_business_versions rather than trusting the caller-supplied
--      denormalized columns outright — it validates the supplied values match the looked-up truth
--      and raises if not. This closes a gap in the literal ADR sketch, where a caller could set
--      source_artifact_type/target_artifact_type to arbitrary values to defeat the rank check.
--   4. Append-only enforcement (B03 section 3.1) is specified in the ADR as a DB-role GRANT
--      (INSERT/SELECT only, no UPDATE/DELETE for the application role). This migration set does
--      not stand up a separate, narrower application role (out of scope for WP-C01, and a
--      superuser test connection would bypass GRANT-based restrictions entirely, making them
--      untestable in the isolated harness used to validate this migration). A BEFORE
--      UPDATE/DELETE deny trigger is added in addition, so the append-only guarantee is enforced
--      and testable regardless of which role/connection performs the write — same pattern already
--      used for finance_exceptions (B05) and finance_compute_snapshots/finance_export_manifests (B06).

BEGIN;

CREATE OR REPLACE FUNCTION finance_artifact_stage_rank(p_artifact_type TEXT) RETURNS INTEGER AS $$
BEGIN
  RETURN CASE p_artifact_type
    WHEN 'STATEMENT_PACK' THEN 0
    WHEN 'HISTORICAL_ANALYSIS' THEN 1
    WHEN 'BASELINE_MODEL' THEN 2
    WHEN 'PREDICTION_SCENARIO' THEN 3
    WHEN 'VALUATION_CASE' THEN 4
    WHEN 'REPORT_EXPORT' THEN 5
    ELSE NULL
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE TABLE IF NOT EXISTS finance_lineage_edges (
  id                       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id            TEXT NOT NULL REFERENCES organizations(id),

  source_version_id            TEXT NOT NULL,
  source_artifact_type           TEXT NOT NULL CHECK (source_artifact_type IN (
                                    'STATEMENT_PACK', 'HISTORICAL_ANALYSIS', 'BASELINE_MODEL',
                                    'PREDICTION_SCENARIO', 'VALUATION_CASE', 'REPORT_EXPORT'
                                  )),
  target_version_id              TEXT NOT NULL,
  target_artifact_type             TEXT NOT NULL CHECK (target_artifact_type IN (
                                      'STATEMENT_PACK', 'HISTORICAL_ANALYSIS', 'BASELINE_MODEL',
                                      'PREDICTION_SCENARIO', 'VALUATION_CASE', 'REPORT_EXPORT'
                                    )),
  edge_type                        TEXT NOT NULL CHECK (edge_type IN (
                                      'STATEMENT_TO_ANALYSIS', 'STATEMENT_TO_MODEL', 'ANALYSIS_TO_MODEL',
                                      'MODEL_TO_SCENARIO', 'MODEL_TO_VALUATION', 'SCENARIO_TO_VALUATION',
                                      'VERSION_TO_REPORT', 'VERSION_TO_MANAGEMENT_ADJUSTED_VARIANT'
                                    )),
  transformation_kind                TEXT NOT NULL CHECK (transformation_kind IN (
                                        'COMPUTE', 'MANUAL_LINK', 'PROMOTION', 'RESTATEMENT_CARRY',
                                        'REOPEN_CARRY', 'RETRACTION'
                                      )),
  assumption_snapshot_hash              TEXT,
  assumption_snapshot_id                  TEXT,
  compute_run_id                            TEXT, -- forward reference to WP-B04, no FK (B01 2.2 rationale)
  author_id                                  TEXT NOT NULL,
  created_at                                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_finance_lineage_source
    FOREIGN KEY (source_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id),
  CONSTRAINT fk_finance_lineage_target
    FOREIGN KEY (target_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id),

  CONSTRAINT no_self_loop CHECK (source_version_id <> target_version_id),
  CONSTRAINT uq_finance_lineage_edge UNIQUE (source_version_id, target_version_id, edge_type),

  -- WP-B03 section 3.3 — assumption_snapshot_hash required where target actually computes from assumptions.
  CONSTRAINT chk_finance_lineage_assumption_hash CHECK (
    (edge_type IN ('ANALYSIS_TO_MODEL', 'MODEL_TO_SCENARIO', 'MODEL_TO_VALUATION', 'SCENARIO_TO_VALUATION')
       AND assumption_snapshot_hash IS NOT NULL)
    OR edge_type IN ('STATEMENT_TO_ANALYSIS', 'STATEMENT_TO_MODEL', 'VERSION_TO_REPORT', 'VERSION_TO_MANAGEMENT_ADJUSTED_VARIANT')
  )
);

CREATE INDEX IF NOT EXISTS idx_finance_lineage_ancestors ON finance_lineage_edges(organization_id, target_version_id);
CREATE INDEX IF NOT EXISTS idx_finance_lineage_descendants ON finance_lineage_edges(organization_id, source_version_id);
CREATE INDEX IF NOT EXISTS idx_finance_lineage_siblings ON finance_lineage_edges(source_version_id, edge_type);

-- Cycle prevention (WP-B03 section 4). See header note 3.
CREATE OR REPLACE FUNCTION finance_lineage_prevent_cycle() RETURNS TRIGGER AS $$
DECLARE
  actual_source_type TEXT;
  actual_target_type TEXT;
  source_rank INTEGER;
  target_rank INTEGER;
BEGIN
  SELECT fa.artifact_type INTO actual_source_type
    FROM finance_business_versions fbv JOIN finance_artifacts fa ON fa.artifact_id = fbv.artifact_id
    WHERE fbv.business_version_id = NEW.source_version_id;
  SELECT fa.artifact_type INTO actual_target_type
    FROM finance_business_versions fbv JOIN finance_artifacts fa ON fa.artifact_id = fbv.artifact_id
    WHERE fbv.business_version_id = NEW.target_version_id;

  IF actual_source_type IS DISTINCT FROM NEW.source_artifact_type THEN
    RAISE EXCEPTION 'finance_lineage_edges: source_artifact_type % does not match actual artifact_type % for version %',
      NEW.source_artifact_type, actual_source_type, NEW.source_version_id;
  END IF;
  IF actual_target_type IS DISTINCT FROM NEW.target_artifact_type THEN
    RAISE EXCEPTION 'finance_lineage_edges: target_artifact_type % does not match actual artifact_type % for version %',
      NEW.target_artifact_type, actual_target_type, NEW.target_version_id;
  END IF;

  IF NEW.edge_type = 'VERSION_TO_MANAGEMENT_ADJUSTED_VARIANT' THEN
    -- Sibling/variant annotation (WP-B06 4.5), explicitly exempt from the downstream-flow rank rule.
    RETURN NEW;
  END IF;

  source_rank := finance_artifact_stage_rank(actual_source_type);
  target_rank := finance_artifact_stage_rank(actual_target_type);

  IF source_rank IS NULL OR target_rank IS NULL THEN
    RAISE EXCEPTION 'finance_lineage_edges: unknown artifact_type rank for source=% target=%', actual_source_type, actual_target_type;
  END IF;

  IF target_rank <= source_rank THEN
    RAISE EXCEPTION 'finance_lineage_edges: target stage_rank (%) must be greater than source stage_rank (%) for edge_type %',
      target_rank, source_rank, NEW.edge_type;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_lineage_prevent_cycle ON finance_lineage_edges;
CREATE TRIGGER trg_finance_lineage_prevent_cycle
  BEFORE INSERT ON finance_lineage_edges
  FOR EACH ROW EXECUTE FUNCTION finance_lineage_prevent_cycle();

-- Append-only (WP-B03 section 3.1). See header note 4.
CREATE OR REPLACE FUNCTION finance_lineage_edges_deny_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'finance_lineage_edges is append-only; % not permitted (row %)', TG_OP, COALESCE(OLD.id, NEW.id);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_lineage_edges_deny_update ON finance_lineage_edges;
CREATE TRIGGER trg_finance_lineage_edges_deny_update
  BEFORE UPDATE ON finance_lineage_edges
  FOR EACH ROW EXECUTE FUNCTION finance_lineage_edges_deny_mutation();

DROP TRIGGER IF EXISTS trg_finance_lineage_edges_deny_delete ON finance_lineage_edges;
CREATE TRIGGER trg_finance_lineage_edges_deny_delete
  BEFORE DELETE ON finance_lineage_edges
  FOR EACH ROW EXECUTE FUNCTION finance_lineage_edges_deny_mutation();

-- finance_lineage_freshness_events — append-only propagation ledger (WP-B03 section 6.3 step 2)
CREATE TABLE IF NOT EXISTS finance_lineage_freshness_events (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id         TEXT NOT NULL REFERENCES organizations(id),
  triggering_edge_id        TEXT REFERENCES finance_lineage_edges(id),
  triggering_version_id       TEXT,
  target_version_id             TEXT NOT NULL,
  previous_state                  TEXT,
  new_state                         TEXT NOT NULL,
  reason_code                        TEXT NOT NULL, -- NEW_SOURCE_VERSION / SOURCE_INVALIDATED / ASSUMPTION_REGISTRY_CHANGED / COMPUTE_ERROR / RESTATED_*
  created_at                          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_freshness_events_target ON finance_lineage_freshness_events(target_version_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_freshness_events_org ON finance_lineage_freshness_events(organization_id, created_at DESC);

COMMIT;
