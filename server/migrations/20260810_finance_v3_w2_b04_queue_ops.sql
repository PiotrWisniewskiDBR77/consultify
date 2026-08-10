-- Finance v3 — W2 queue contract closeout: WP-B04 gaps EM-3 (kill switch)
-- and EM-4 (per-org concurrency limit).
--
-- Source: docs/validation/finance-v3/generated/gate-b/WP-B04_jobs_runs_outputs_ADR.md
-- section 5.1/7.2/8. Measured missing (no DDL anywhere in Gate B/C) by
-- docs/validation/finance-v3/generated/gate-d/W9_FAULT_CONCURRENCY_TENANT_MATRIX_report.md
-- (EM-3, EM-4). Full closeout report:
-- docs/validation/finance-v3/generated/gate-d/W2_QUEUE_CONTRACT_report.md.
--
-- Additive only. Two new tables + two new SQL functions, referenced by
-- `computeJobService.claim()`'s claim-query (ADR section 5.1 sketch),
-- exactly as literally written there:
--   AND NOT is_org_compute_killed(organization_id, job_type)
--   AND (SELECT count(*) ... running ...) < org_concurrency_limit(organization_id, job_type)
--
-- Design decision (documented, not silently picked): the ADR punts
-- kill-switch storage to "a new table or extension of v8_feature_flags"
-- (section 7.2). v8_feature_flags is per-(organization_id, module) BOOLEAN
-- only — it cannot express "global kill" (organization_id IS NULL) or
-- per-job_type granularity, and this program's own operating memory flags a
-- live public/v8 schema-qualification split on that exact table on the demo
-- database (search_path without v8 silently reads an empty public.*). A
-- dedicated table with UNIQUE NULLS NOT DISTINCT (organization_id, job_type)
-- — a PostgreSQL 15 feature; this program pins postgresql@15 everywhere —
-- cleanly expresses the ADR's own stated granularity
-- "(organization_id NULL = global, job_type NULL = wszystkie typy)" without
-- reusing an ambiguous, differently-shaped table. Same reasoning applies to
-- the concurrency-limit table (no existing table has this shape at all).

BEGIN;

CREATE TABLE IF NOT EXISTS compute_kill_switches (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id   TEXT REFERENCES organizations(id), -- NULL = global (blocks every organization)
  job_type          TEXT,                              -- NULL = every job_type
  killed            BOOLEAN NOT NULL DEFAULT true,
  reason            TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        TEXT,

  CONSTRAINT compute_kill_switches_scope_uq UNIQUE NULLS NOT DISTINCT (organization_id, job_type)
);

CREATE OR REPLACE FUNCTION is_org_compute_killed(p_organization_id TEXT, p_job_type TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM compute_kill_switches
     WHERE killed = true
       AND (organization_id IS NULL OR organization_id = p_organization_id)
       AND (job_type IS NULL OR job_type = p_job_type)
  );
$$;

CREATE TABLE IF NOT EXISTS compute_org_concurrency_limits (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id   TEXT REFERENCES organizations(id), -- NULL = default across every organization
  job_type          TEXT,                              -- NULL = default across every job_type
  max_concurrent    INTEGER NOT NULL CHECK (max_concurrent > 0),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by        TEXT,

  CONSTRAINT compute_org_concurrency_limits_scope_uq UNIQUE NULLS NOT DISTINCT (organization_id, job_type)
);

-- Seed a deliberately generous global default so this migration is
-- behaviour-neutral for every existing caller that never configures a
-- limit explicitly. ADR section 12 point 2 explicitly leaves the concrete
-- number as "decyzja operacyjna, nie architektoniczna" — a LOW default was
-- rejected here specifically because canonicalServices.pg.test.ts's
-- "two concurrent claim() calls never claim the same job twice (SKIP
-- LOCKED)" test enqueues 4 jobs of ONE org+job_type and expects all 4
-- claimable across two concurrent claim() calls with no limit configured;
-- a low default would have silently turned on a behaviour change for an
-- existing, passing regression test. Tighten per org/job_type explicitly
-- via computeJobService.setOrgConcurrencyLimit() (or a direct INSERT here)
-- once real capacity numbers are measured (ADR section 12 point 1).
INSERT INTO compute_org_concurrency_limits (id, organization_id, job_type, max_concurrent, updated_by)
VALUES (gen_random_uuid()::text, NULL, NULL, 50, 'migration:20260810_finance_v3_w2_b04_queue_ops')
ON CONFLICT (organization_id, job_type) DO NOTHING;

CREATE OR REPLACE FUNCTION org_concurrency_limit(p_organization_id TEXT, p_job_type TEXT)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT max_concurrent FROM compute_org_concurrency_limits
   WHERE (organization_id = p_organization_id OR organization_id IS NULL)
     AND (job_type = p_job_type OR job_type IS NULL)
   ORDER BY (organization_id IS NOT NULL) DESC, (job_type IS NOT NULL) DESC
   LIMIT 1;
$$;

COMMIT;
