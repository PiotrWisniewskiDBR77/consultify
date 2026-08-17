-- Results writer observability ledger.
--
-- PURPOSE
-- Measure REAL usage of an EXPLICITLY ENUMERATED SUBSET of the Results write
-- surfaces (see `server/src/services/results/resultsWriterInventory.ts` for the
-- authoritative denominator, including which surfaces are deliberately NOT
-- observed and why). This is an observation SIDE-CHANNEL: it never participates
-- in, gates, or alters a business write, and it removes/disables nothing.
--
-- WHAT THIS LEDGER MEASURES: HANDLER INVOCATIONS, NOT UNIQUE BUSINESS MUTATIONS.
-- One row means "an observed writer surface was invoked and its business write
-- succeeded". A client that replays the same logical mutation under a NEW
-- correlation id is counted TWICE, on purpose — the ledger cannot know two
-- differently-correlated calls meant the same business intent. Do not read a
-- count here as a number of distinct rows written downstream.
--
-- ABSENCE IS NOT PROOF. Zero observations for a family means "no observed
-- invocation was successfully recorded", which is NOT the same as "no usage":
-- recording is best-effort (see the service's fail-open contract) and only the
-- inventory's OBSERVED subset is instrumented at all. This table must never be
-- used on its own as a zero-writer window or as cutover authority.
--
-- PRIVACY / SCOPE
-- Records only WHO (tenant + actor), WHAT SURFACE (writer family + operation +
-- endpoint) and WHEN/CORRELATION. No KPI values, no names, no request or
-- response payloads, no business content. There is deliberately no column that
-- could carry any.
--
-- APPEND-ONLY
-- Both UPDATE and DELETE are blocked by triggers below, so the term
-- "append-only" is literal rather than aspirational. An owner-governed purge
-- (retention is still an OWNER_DECISION) therefore requires an explicit,
-- deliberate act: disabling the precisely-named delete trigger. Automated test
-- teardown does exactly that, but only inside a disposable database and behind a
-- guard that asserts the database name, and it restores the trigger state
-- afterwards (see `resultsWriterObservation.pg.test.ts`).
--
-- LATE-SAFE / CONVERGENT
-- This file is written to converge a database that already has an EARLIER,
-- partial variant of this table — including the pre-corrective, NON-tenant-
-- scoped unique index `uq_results_writer_observation_correlated_op`, which was
-- wrong: identical correlation/family/operation in two tenants collapsed the
-- second tenant's row. Existing rows are preserved; historical collisions under
-- the corrected key are detected and reported loudly instead of being silently
-- deduplicated.
--
-- KNOWN LIMITATION (for the integrator): `server/scripts/migrate.postgres.ts`
-- selects pending work by filename + status only and does NOT compare the stored
-- checksum. An environment that already recorded this filename as `success`
-- under the earlier variant will therefore NOT re-run this corrected file, and
-- would keep the wrong index. No environment has applied it (this packet has
-- never been pushed or deployed), so the fix stays in this filename rather than
-- adding a second migration — but that assumption must be re-checked before any
-- promotion.
--
-- NO FOREIGN KEYS
-- organization_id / actor_user_id are plain TEXT on purpose: a cascading FK into
-- an append-only ledger would make the parent row undeletable, turning an
-- observability side-channel into a constraint on real business data.

CREATE TABLE IF NOT EXISTS results_writer_observations (
  observation_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL,
  actor_user_id TEXT,
  writer_family TEXT NOT NULL,
  operation TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Convergence for a pre-existing partial table: add anything missing, without
-- touching existing rows or column types.
ALTER TABLE results_writer_observations
  ADD COLUMN IF NOT EXISTS organization_id TEXT,
  ADD COLUMN IF NOT EXISTS actor_user_id TEXT,
  ADD COLUMN IF NOT EXISTS writer_family TEXT,
  ADD COLUMN IF NOT EXISTS operation TEXT,
  ADD COLUMN IF NOT EXISTS endpoint TEXT,
  ADD COLUMN IF NOT EXISTS correlation_id TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- The writer-family whitelist mirrors `ResultsWriterFamily` in
-- resultsWriterObservationService.ts. Added separately (not inline in CREATE
-- TABLE) so a converging table gets it too.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'results_writer_observations'::regclass
       AND conname  = 'results_writer_observations_writer_family_check'
  ) THEN
    ALTER TABLE results_writer_observations
      ADD CONSTRAINT results_writer_observations_writer_family_check
      CHECK (writer_family IN (
        'legacy_kpi_crud',
        'kpi_reports',
        'vnext_kpi',
        'execution_results',
        'results_finance'
      ));
  END IF;
END $$;

-- NOT NULL enforcement, applied only when the existing data already satisfies
-- it. A converging table holding a NULL in one of these columns is a real data
-- problem: report it instead of failing with a bare constraint error.
DO $$
DECLARE
  v_col text;
  v_bad bigint;
BEGIN
  FOREACH v_col IN ARRAY ARRAY['organization_id','writer_family','operation','endpoint','correlation_id']
  LOOP
    EXECUTE format('SELECT count(*) FROM results_writer_observations WHERE %I IS NULL', v_col)
      INTO v_bad;
    IF v_bad > 0 THEN
      RAISE EXCEPTION
        'results_writer_observations.% holds % NULL row(s); cannot enforce NOT NULL. Resolve or purge those rows under an owner-approved decision first.',
        v_col, v_bad;
    END IF;
    EXECUTE format('ALTER TABLE results_writer_observations ALTER COLUMN %I SET NOT NULL', v_col);
  END LOOP;
END $$;

-- Historical-collision preflight, BEFORE the corrected unique index is created.
-- Under the pre-corrective key a cross-tenant duplicate could not exist, but a
-- table converged from any other partial variant might hold one; creating the
-- index would then fail with an opaque error.
DO $$
DECLARE
  v_groups bigint;
  v_rows bigint;
  v_sample text;
BEGIN
  SELECT count(*), coalesce(sum(n), 0)
    INTO v_groups, v_rows
    FROM (
      SELECT count(*) AS n
        FROM results_writer_observations
       GROUP BY organization_id, correlation_id, writer_family, operation
      HAVING count(*) > 1
    ) dupes;

  IF v_groups > 0 THEN
    SELECT string_agg(
             format('org=%s corr=%s family=%s op=%s x%s', organization_id, correlation_id, writer_family, operation, n),
             '; ' ORDER BY n DESC)
      INTO v_sample
      FROM (
        SELECT organization_id, correlation_id, writer_family, operation, count(*) AS n
          FROM results_writer_observations
         GROUP BY organization_id, correlation_id, writer_family, operation
        HAVING count(*) > 1
         LIMIT 5
      ) top_dupes;

    RAISE EXCEPTION
      'results_writer_observations has % colliding group(s) covering % row(s) under the tenant-scoped key (organization_id, correlation_id, writer_family, operation); refusing to deduplicate observations automatically. Sample: %',
      v_groups, v_rows, v_sample;
  END IF;
END $$;

-- Retire the pre-corrective, tenant-BLIND unique index. Leaving it in place
-- would keep collapsing a second tenant's identically-correlated observation.
DROP INDEX IF EXISTS uq_results_writer_observation_correlated_op;

-- Corrected key: a retry of the same correlated operation WITHIN ONE TENANT
-- records exactly one row; the same correlation id in another tenant is a
-- distinct observation.
CREATE UNIQUE INDEX IF NOT EXISTS uq_results_writer_observation_tenant_correlated_op
  ON results_writer_observations(organization_id, correlation_id, writer_family, operation);

-- Read patterns the cutover analysis needs.
CREATE INDEX IF NOT EXISTS idx_results_writer_observation_family_time
  ON results_writer_observations(writer_family, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_results_writer_observation_org_time
  ON results_writer_observations(organization_id, created_at DESC);

-- Append-only: an observation is never rewritten and never silently removed.
CREATE OR REPLACE FUNCTION enforce_results_writer_observation_no_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION
    'results_writer_observations is append-only: UPDATE is not permitted (observation_id=%)',
    OLD.observation_id
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE OR REPLACE FUNCTION enforce_results_writer_observation_no_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION
    'results_writer_observations is append-only: DELETE is not permitted (observation_id=%). An owner-governed purge must explicitly disable trigger trg_results_writer_observation_no_delete.',
    OLD.observation_id
    USING ERRCODE = 'restrict_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_results_writer_observation_immutable
  ON results_writer_observations;
DROP TRIGGER IF EXISTS trg_results_writer_observation_no_update
  ON results_writer_observations;
CREATE TRIGGER trg_results_writer_observation_no_update
  BEFORE UPDATE ON results_writer_observations
  FOR EACH ROW EXECUTE FUNCTION enforce_results_writer_observation_no_update();

DROP TRIGGER IF EXISTS trg_results_writer_observation_no_delete
  ON results_writer_observations;
CREATE TRIGGER trg_results_writer_observation_no_delete
  BEFORE DELETE ON results_writer_observations
  FOR EACH ROW EXECUTE FUNCTION enforce_results_writer_observation_no_delete();

-- Final shape assertion, by conrelid rather than by name-guessing: if any of
-- the required structures is absent the migration fails here instead of leaving
-- a half-converged ledger that silently accepts wrong rows.
DO $$
DECLARE
  v_problems text[] := ARRAY[]::text[];
  v_cols text;
BEGIN
  SELECT string_agg(column_name || ':' || data_type, ',' ORDER BY column_name)
    INTO v_cols
    FROM information_schema.columns
   WHERE table_name = 'results_writer_observations';

  IF v_cols IS DISTINCT FROM
     'actor_user_id:text,correlation_id:text,created_at:timestamp with time zone,endpoint:text,observation_id:text,operation:text,organization_id:text,writer_family:text'
  THEN
    v_problems := v_problems || format('unexpected column/type set: %s', v_cols);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'results_writer_observations'::regclass
       AND contype = 'p'
  ) THEN
    v_problems := v_problems || 'missing PRIMARY KEY';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'results_writer_observations'::regclass
       AND contype = 'c'
       AND conname = 'results_writer_observations_writer_family_check'
  ) THEN
    v_problems := v_problems || 'missing writer_family CHECK constraint';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_index i
     WHERE i.indrelid = 'results_writer_observations'::regclass
       AND i.indisunique
       AND i.indexrelid = 'uq_results_writer_observation_tenant_correlated_op'::regclass
  ) THEN
    v_problems := v_problems || 'missing tenant-scoped unique index';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'uq_results_writer_observation_correlated_op'
  ) THEN
    v_problems := v_problems || 'pre-corrective tenant-blind unique index still present';
  END IF;

  IF (SELECT count(*) FROM pg_trigger
       WHERE tgrelid = 'results_writer_observations'::regclass
         AND NOT tgisinternal
         AND tgname IN ('trg_results_writer_observation_no_update',
                        'trg_results_writer_observation_no_delete')) <> 2
  THEN
    v_problems := v_problems || 'append-only triggers incomplete';
  END IF;

  IF array_length(v_problems, 1) > 0 THEN
    RAISE EXCEPTION 'results_writer_observations failed post-apply validation: %',
      array_to_string(v_problems, '; ');
  END IF;
END $$;
