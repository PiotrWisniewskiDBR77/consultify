-- Migration 568: Financial Analysis (T052) + Budgeting (T053)
CREATE TABLE IF NOT EXISTS financial_analyses (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, project_id TEXT, title TEXT NOT NULL, description TEXT, status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','REVIEW','APPROVED')), analysis_type TEXT DEFAULT 'comprehensive', periods JSONB DEFAULT '[]', statement_data JSONB DEFAULT '{}', currency TEXT DEFAULT 'PLN', approved_by TEXT, approved_at TIMESTAMP, created_by TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_financial_analyses_org ON financial_analyses(organization_id);
CREATE INDEX IF NOT EXISTS idx_financial_analyses_status ON financial_analyses(status);
CREATE TABLE IF NOT EXISTS financial_analysis_ratios (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT, analysis_id TEXT NOT NULL REFERENCES financial_analyses(id) ON DELETE CASCADE, period TEXT, category TEXT CHECK (category IN ('liquidity','profitability','efficiency','leverage','growth')), ratio_code TEXT, ratio_name TEXT, value NUMERIC, benchmark_value NUMERIC, interpretation TEXT, created_at TIMESTAMP DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_financial_analysis_ratios_analysis ON financial_analysis_ratios(analysis_id);
CREATE TABLE IF NOT EXISTS financial_analysis_insights (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT, analysis_id TEXT NOT NULL REFERENCES financial_analyses(id) ON DELETE CASCADE, insight_type TEXT CHECK (insight_type IN ('driver','risk','action','quality_note','narrative')), title TEXT NOT NULL, description TEXT NOT NULL, citations JSONB DEFAULT '[]', priority INTEGER DEFAULT 0, linked_initiative_id TEXT, linked_kpi_id TEXT, status TEXT DEFAULT 'DRAFT', created_at TIMESTAMP DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_financial_analysis_insights_analysis ON financial_analysis_insights(analysis_id);
CREATE TABLE IF NOT EXISTS budgets (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, project_id TEXT, title TEXT NOT NULL, description TEXT, status TEXT DEFAULT 'DRAFT', period_start TEXT NOT NULL, period_end TEXT NOT NULL, granularity TEXT DEFAULT 'monthly' CHECK (granularity IN ('monthly','quarterly','annual')), currency TEXT DEFAULT 'PLN', baseline_source TEXT, assumptions JSONB DEFAULT '[]', approved_by TEXT, approved_at TIMESTAMP, version INTEGER DEFAULT 1, created_by TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_budgets_org ON budgets(organization_id);
CREATE INDEX IF NOT EXISTS idx_budgets_status ON budgets(status);
CREATE TABLE IF NOT EXISTS budget_lines (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT, budget_id TEXT NOT NULL REFERENCES budgets(id) ON DELETE CASCADE, line_code TEXT NOT NULL, line_name TEXT NOT NULL, statement_type TEXT CHECK (statement_type IN ('P&L','CF')), source TEXT DEFAULT 'manual' CHECK (source IN ('baseline','manual','driver','formula')), driver_kpi_id TEXT, driver_formula TEXT, baseline_value NUMERIC DEFAULT 0, is_locked BOOLEAN DEFAULT FALSE, display_order INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_budget_lines_budget ON budget_lines(budget_id);
CREATE TABLE IF NOT EXISTS budget_scenarios (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT, budget_id TEXT NOT NULL REFERENCES budgets(id) ON DELETE CASCADE, scenario_type TEXT DEFAULT 'base' CHECK (scenario_type IN ('base','optimistic','conservative')), name TEXT NOT NULL, description TEXT, adjustments JSONB DEFAULT '{}', projections JSONB DEFAULT '{}', summary_metrics JSONB DEFAULT '{}', is_active BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_budget_scenarios_budget ON budget_scenarios(budget_id);
CREATE TABLE IF NOT EXISTS budget_snapshots (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT, budget_id TEXT NOT NULL REFERENCES budgets(id) ON DELETE CASCADE, version INTEGER NOT NULL, snapshot_data JSONB NOT NULL, approved_by TEXT, created_at TIMESTAMP DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_budget_snapshots_budget ON budget_snapshots(budget_id);

-- FRESH-DB PARITY (2026-07-14): 20260624_finance_analysis_investment_category.sql
-- sorts BEFORE this file on a fresh replay, so its CHECK-widening is skipped
-- (guarded on table existence). Re-apply it here: drop whatever CHECK governs
-- `category` and re-add it with 'investment' included. Same end state as
-- staging/prod; this file is never re-run on already-migrated DBs.
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT con.conname
    INTO v_constraint_name
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
   WHERE rel.relname = 'financial_analysis_ratios'
     AND con.contype = 'c'
     AND pg_get_constraintdef(con.oid) ILIKE '%category%'
   LIMIT 1;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE financial_analysis_ratios DROP CONSTRAINT %I',
      v_constraint_name
    );
  END IF;

  ALTER TABLE financial_analysis_ratios
    ADD CONSTRAINT financial_analysis_ratios_category_check
    CHECK (category IN ('liquidity','profitability','efficiency','leverage','growth','investment'));
END $$;
