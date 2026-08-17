-- Results writer observability ledger (RES writer-observability packet).
--
-- PURPOSE
-- Measure REAL usage of the Results write surfaces so the legacy -> vNext
-- cutover decision rests on observed traffic instead of source-scanning.
-- This table is an OBSERVATION SIDE-CHANNEL: it never participates in, gates,
-- or alters a business write. No writer, endpoint or legacy table is removed
-- or disabled by this migration.
--
-- PRIVACY / SCOPE
-- Deliberately records only WHO (tenant + actor), WHAT SURFACE (writer family
-- + operation + endpoint), and WHEN/CORRELATION. It stores no KPI values, no
-- names, no request/response payloads and no business content of any kind.
--
-- APPEND-ONLY SEMANTICS (and why DELETE stays allowed)
-- An observation is immutable once written: the trigger below rejects UPDATE.
-- DELETE is deliberately NOT blocked. Retention/rollout for this ledger is an
-- explicit OWNER_DECISION that has not been made yet; a hard DELETE block
-- would pre-empt that decision and would additionally make disposable-database
-- test teardown impossible to verify (a residue check that cannot delete
-- cannot prove residue0). Immutability of a recorded fact and purgeability
-- under an owner-approved retention policy are different guarantees; this
-- table provides the first and leaves the second open.
--
-- NO FOREIGN KEYS
-- organization_id / actor_user_id are plain TEXT on purpose. A cascading FK
-- into an append-only ledger makes the parent row undeletable, which would
-- turn an observability side-channel into a constraint on real business data.

CREATE TABLE IF NOT EXISTS results_writer_observations (
  observation_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Tenant of the business write. Resolved server-side from the authenticated
  -- session (never from the request body — a spoofed body must not be able to
  -- attribute traffic to another tenant).
  organization_id TEXT NOT NULL,

  -- Actor of the business write, server-resolved. Nullable: some real writers
  -- run outside a request scope (post-transaction closure handoff, budget
  -- health export) where no interactive actor exists. NULL means "no actor",
  -- never "unknown user".
  actor_user_id TEXT,

  writer_family TEXT NOT NULL CHECK (writer_family IN (
    'legacy_kpi_crud',
    'kpi_reports',
    'vnext_kpi',
    'execution_results',
    'results_finance'
  )),

  -- Stable operation label (e.g. 'createKpi', 'recordMeasurement'). Together
  -- with writer_family this is the unit the cutover decision counts.
  operation TEXT NOT NULL,

  -- Mount-qualified route, or a 'service:' pseudo-endpoint for the two real
  -- writers that have no HTTP handler (Execution -> Results).
  endpoint TEXT NOT NULL,

  -- NOT NULL so the dedupe index below actually dedupes: Postgres treats NULLs
  -- as distinct, so a nullable correlation id would silently allow duplicate
  -- rows for the very retries this index exists to collapse. Callers pass the
  -- request's validated correlation id, or mint one when the request carried
  -- none (a request with no correlation identity has nothing to dedupe on, and
  -- this ledger does not pretend otherwise).
  correlation_id TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Retry of the SAME correlated operation records exactly one observation.
CREATE UNIQUE INDEX IF NOT EXISTS uq_results_writer_observation_correlated_op
  ON results_writer_observations(correlation_id, writer_family, operation);

-- Read pattern the cutover decision needs: usage per tenant/family over time.
CREATE INDEX IF NOT EXISTS idx_results_writer_observation_family_time
  ON results_writer_observations(writer_family, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_results_writer_observation_org_time
  ON results_writer_observations(organization_id, created_at DESC);

-- Immutability: a recorded observation is never rewritten.
CREATE OR REPLACE FUNCTION enforce_results_writer_observation_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION
    'results_writer_observations is append-only: UPDATE is not permitted (observation_id=%)',
    OLD.observation_id
    USING ERRCODE = 'restrict_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_results_writer_observation_immutable
  ON results_writer_observations;
CREATE TRIGGER trg_results_writer_observation_immutable
  BEFORE UPDATE ON results_writer_observations
  FOR EACH ROW EXECUTE FUNCTION enforce_results_writer_observation_immutable();
