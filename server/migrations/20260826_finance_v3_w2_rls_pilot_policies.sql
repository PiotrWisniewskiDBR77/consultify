-- =============================================================================
-- Finance v3 — W2 RLS PILOT: row-level-security tenant enforcement on a
-- narrow, representative table set (EM-9).
--
-- Source: docs/validation/finance-v3/generated/gate-d/W2_RLS_TENANT_ENFORCEMENT_report.md
-- (this same work package — read it FIRST, it is the diagnosis this migration
-- implements the conclusion of). Companion: W9_FAULT_CONCURRENCY_TENANT_MATRIX
-- §4/§4.2/§7 (EM-9), P0_TENANT_ISOLATION_FIX_report.md (application-level fix
-- that closed the same leak class from the service side).
--
-- ADDITIVE ONLY. No DROP/RENAME/ALTER ... TYPE on any existing column or row.
-- Rollback: server/migrations/rollback/20260826_finance_v3_w2_rls_pilot_policies.down.sql
--
-- ⚠️  READ THIS BEFORE ASSUMING THIS MIGRATION "TURNS ON" TENANT ISOLATION ⚠️
--
-- PostgreSQL row security is ALWAYS bypassed for the connection's current
-- role when that role is a superuser or has BYPASSRLS — this is true even
-- with FORCE ROW LEVEL SECURITY, and even for the table owner unless FORCE is
-- set (superuser bypass cannot be overridden by FORCE at all; see
-- https://www.postgresql.org/docs/15/ddl-rowsecurity.html). Measured directly
-- against this migration's own target cluster (see the W2 report §1): the
-- only role that exists is `postgres`, it is a superuser
-- (rolsuper=t, rolbypassrls=t), and it owns every table these policies apply
-- to. As long as the application and migrations connect as this role — which
-- is the case in every environment this work package could reach, and which
-- matches the still-OPEN "least-privileged rola DB" item from Gate A
-- (WP-A04_security_closure.md §7, "poza zakresem repo") — these policies are
-- INERT for real traffic. They do not protect anything today. They exist so
-- that:
--   (a) the mechanism is proven correct (see the report's three-state
--       negative control: WITH policy as a non-superuser test role / WITHOUT
--       policy / DISABLED — only the middle state should leak), and
--   (b) turning on real protection later is a role/DATABASE_URL change on
--       Railway, not a second migration.
-- Do not read "migration exists" as "tenant boundary exists at the DB layer".
-- It does not, until the connecting role changes.
--
-- SCOPE — three tables, chosen because they are the ones the W9 fault matrix
-- found ACTUALLY LEAKING before the P0 application-level fix landed:
--   - compute_jobs                          (cross-org cancel — W9-C leak)
--   - finance_valuation_sensitivity_grids   (parent of the leaking cells)
--   - finance_valuation_sensitivity_cells   (cross-org 25-cell delete — W9-C-4)
-- NOT every finance*/compute* table gets a policy in this pilot. In
-- particular, global catalogs such as finance_analysis_kpi_catalog
-- (organization_id NULLABLE, seeded rows have organization_id IS NULL by
-- design — they are shared across all tenants) are DELIBERATELY EXCLUDED: a
-- naive `organization_id = current_setting(...)` policy would hide every
-- global row from every tenant, which is a regression, not a fix. Extending
-- this pilot to catalog-shaped tables needs a policy shape that also allows
-- `organization_id IS NULL`, which is out of scope for this pilot.
--
-- IDENTITY SOURCE: `current_setting('app.organization_id', true)` — the
-- `true` (missing_ok) argument makes this return NULL instead of raising when
-- unset, and `organization_id = NULL` is never TRUE, so a connection that
-- never sets this GUC sees zero rows (fail closed), not every row. The
-- application is responsible for issuing `SET LOCAL app.organization_id = …`
-- inside the same transaction as the query — see
-- `withPinnedPostgresTransaction`'s new optional `organizationId` parameter
-- in server/src/database/PostgresDatabase.ts, added by this same work
-- package. `SET LOCAL` (never bare `SET`) is required because this codebase's
-- connections come from a shared `pg.Pool`: a bare `SET` would survive past
-- COMMIT/ROLLBACK and leak into whichever unrelated request the pool hands
-- that physical connection to next — exactly the cross-tenant leak this
-- migration exists to prevent, reintroduced one layer up.
--
-- organization_id on all three tables is `text`, NOT NULL (verified against
-- information_schema in the W2 report) — no cast is needed in the policy
-- expression.
--
-- FORCE ROW LEVEL SECURITY: applied on all three. Without FORCE, a table
-- OWNER (as opposed to other roles) still bypasses RLS by default; FORCE
-- closes that specific gap for any future non-superuser owner. It does
-- nothing for the superuser case above — nothing can.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- compute_jobs
-- ---------------------------------------------------------------------------
ALTER TABLE compute_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE compute_jobs FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_compute_jobs ON compute_jobs
  USING (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id = current_setting('app.organization_id', true));

-- ---------------------------------------------------------------------------
-- finance_valuation_sensitivity_grids
-- ---------------------------------------------------------------------------
ALTER TABLE finance_valuation_sensitivity_grids ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_valuation_sensitivity_grids FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_finance_valuation_sensitivity_grids
  ON finance_valuation_sensitivity_grids
  USING (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id = current_setting('app.organization_id', true));

-- ---------------------------------------------------------------------------
-- finance_valuation_sensitivity_cells
-- ---------------------------------------------------------------------------
ALTER TABLE finance_valuation_sensitivity_cells ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_valuation_sensitivity_cells FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_finance_valuation_sensitivity_cells
  ON finance_valuation_sensitivity_cells
  USING (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id = current_setting('app.organization_id', true));

COMMIT;
