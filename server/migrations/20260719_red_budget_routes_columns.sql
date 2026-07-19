-- RED: schema-drift — `budgets` vs the flat CRUD in server/src/routes/budget.routes.ts
-- (mounted live at /api/budget, Gateway.ts:1148).
--
-- Those routes (GET/POST/PUT/DELETE at root + GET /summary) assume a flat project-budget
-- row shape (category / planned_amount / actual_amount) that predates migration
-- 570_finance_analysis_budgeting_t052_t053, which redesigned `budgets` into a header object
-- (title/status/period_start/period_end/granularity/assumptions/approved_by/version) with
-- child tables budget_lines / budget_scenarios / budget_snapshots / budget_initiative_links.
-- That richer model is the one actually used today by the live economics/budgets feature
-- (src/components/Benefits/BudgetWorkspace.tsx -> /api/economics/budgets).
--
-- No frontend caller hits the flat /api/budget CRUD (grep: only a deploy-gate smoke test —
-- tests/e2e/smoke/deploy-gate-api-execution-benefits-finance.spec.ts — and a self-mocking L3
-- unit test that creates its own fantasy SQLite `budgets` table exercise it). But the router
-- IS mounted and the smoke gate asserts "no 5xx", so real Postgres calls must not
-- 42703 (undefined column) or NOT-NULL fail.
--
-- Fix: additive-only columns, unused by and non-colliding with the economics/budget_lines
-- flow (nothing else reads category/planned_amount/actual_amount on this table), plus a
-- default for `title` so INSERTs that omit it (the legacy flat contract never sets title)
-- still satisfy NOT NULL.
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS planned_amount REAL DEFAULT 0;
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS actual_amount REAL DEFAULT 0;
ALTER TABLE budgets ALTER COLUMN title SET DEFAULT 'Untitled Budget';
