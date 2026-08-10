-- Rollback for 20260826_finance_v3_w2_rls_pilot_policies.sql
-- Drops the three pilot RLS policies and turns row security back off on the
-- pilot tables. Safe to run at any time: since the connecting role in every
-- known environment is a superuser (see the migration's own header and the
-- W2 report), the policies are inert for real traffic either way — this
-- rollback has no behavioral effect on the application, only on `psql \d`
-- output and on the negative-control test in tenantMatrix.pg.test.ts /
-- rlsPilot.pg.test.ts, which will need updating (or will start asserting the
-- "no policy" state) if this is run.
--
-- Usage:
--   psql $DATABASE_URL -f server/migrations/rollback/20260826_finance_v3_w2_rls_pilot_policies.down.sql

BEGIN;

DROP POLICY IF EXISTS tenant_isolation_compute_jobs ON compute_jobs;
ALTER TABLE compute_jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE compute_jobs NO FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_finance_valuation_sensitivity_grids
  ON finance_valuation_sensitivity_grids;
ALTER TABLE finance_valuation_sensitivity_grids DISABLE ROW LEVEL SECURITY;
ALTER TABLE finance_valuation_sensitivity_grids NO FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_finance_valuation_sensitivity_cells
  ON finance_valuation_sensitivity_cells;
ALTER TABLE finance_valuation_sensitivity_cells DISABLE ROW LEVEL SECURITY;
ALTER TABLE finance_valuation_sensitivity_cells NO FORCE ROW LEVEL SECURITY;

COMMIT;
