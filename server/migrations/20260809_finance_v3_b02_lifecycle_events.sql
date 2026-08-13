-- Finance v3 — Gate C (WP-C01): WP-B02 lifecycle audit log.
--
-- Source: docs/validation/finance-v3/generated/gate-b/WP-B02_lifecycle_concurrency_ADR.md
-- section 5.1 step (d) and GATE_B_INTEGRATION_RECONCILIATION.md section 4 ("artifact_lifecycle_events
-- jest wlasnoscia B02, nie B01 — poprawnie zaprojektowane jako osobna tabela").
--
-- artifact_lifecycle_events is the append-only audit log referenced by B02's atomic approval
-- transaction (step d), by B02's reopen algorithm (section 6.2 step 7), and by B06's retention
-- execution job (section 5.3, action='RETENTION_EXECUTED'). B02 does not fully specify a DDL for
-- it (the ADR is a state-machine/contract document, not a schema document) — the columns below are
-- the minimal set needed to record every transition in section 3.2's table (T1..T12) plus the two
-- forward-referenced actions from B06 (EMERGENCY_APPROVAL, RETENTION_EXECUTED).
--
-- Additive only.

BEGIN;

CREATE TABLE IF NOT EXISTS artifact_lifecycle_events (
  event_id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id        TEXT NOT NULL REFERENCES organizations(id),
  artifact_id              TEXT NOT NULL,
  business_version_id       TEXT,

  action                     TEXT NOT NULL CHECK (action IN (
                                'CREATE', 'SUBMIT_FOR_REVIEW', 'WITHDRAW', 'START_REVIEW', 'REQUEST_CHANGES',
                                'RESUME_EDITING', 'APPROVE', 'SUPERSEDE', 'ARCHIVE', 'INVALIDATE', 'REOPEN',
                                'EMERGENCY_APPROVAL', 'RETENTION_EXECUTED'
                              )),
  from_status                 TEXT,
  to_status                    TEXT,

  actor_id                      TEXT,
  reason                          TEXT,
  idempotency_key                  TEXT,
  snapshot_id                       TEXT, -- forward reference to WP-B04/B06 compute snapshot, no FK (same rationale as B01 2.2)
  risk_tier                          TEXT,
  metadata                            JSONB,

  created_at                           TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_artifact_lifecycle_events_artifact_org
    FOREIGN KEY (artifact_id, organization_id)
    REFERENCES finance_artifacts (artifact_id, organization_id),

  CONSTRAINT fk_artifact_lifecycle_events_bv_org
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_artifact_lifecycle_events_artifact ON artifact_lifecycle_events(artifact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_artifact_lifecycle_events_bv ON artifact_lifecycle_events(business_version_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_artifact_lifecycle_events_org ON artifact_lifecycle_events(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_artifact_lifecycle_events_idempotency ON artifact_lifecycle_events(organization_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Append-only, same pattern already required for finance_lineage_edges (B03 3.1) and
-- finance_exceptions (B05 1.1) — an audit log that can be edited after the fact is not an audit
-- log. B02 5.1 step (d) says the INSERT is "nigdy UPDATE" but does not spell out DB-level
-- enforcement; this migration applies the same belt-and-suspenders trigger used elsewhere in
-- Gate B rather than relying purely on application discipline.
CREATE OR REPLACE FUNCTION artifact_lifecycle_events_deny_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'artifact_lifecycle_events is append-only; % not permitted (event %)', TG_OP, COALESCE(OLD.event_id, NEW.event_id);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_artifact_lifecycle_events_deny_update ON artifact_lifecycle_events;
CREATE TRIGGER trg_artifact_lifecycle_events_deny_update
  BEFORE UPDATE ON artifact_lifecycle_events
  FOR EACH ROW EXECUTE FUNCTION artifact_lifecycle_events_deny_mutation();

DROP TRIGGER IF EXISTS trg_artifact_lifecycle_events_deny_delete ON artifact_lifecycle_events;
CREATE TRIGGER trg_artifact_lifecycle_events_deny_delete
  BEFORE DELETE ON artifact_lifecycle_events
  FOR EACH ROW EXECUTE FUNCTION artifact_lifecycle_events_deny_mutation();

COMMIT;
