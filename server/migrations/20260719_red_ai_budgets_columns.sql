-- RED: schema-drift — `ai_budgets`.
-- Tabela bywa tworzona lazy przez aiBudgetService.ensureTables() (CREATE TABLE IF NOT EXISTS),
-- ALE gdy istnieje już starsza, uboższa wersja (id/organization_id/user_id/budget_type/
-- budget_limit/current_usage/is_active/created_at/updated_at), to IF NOT EXISTS jest no-op i
-- NOWE kolumny z DDL nigdy nie dochodzą. Skutek: createBudget() INSERT (period, period_start,
-- period_end, warning_threshold, hard_limit, rollover_enabled, rollover_percentage, created_by)
-- oraz resetBudget()/checkBudget() padają: "column period does not exist" — cichy fail zarządzania
-- budżetem AI (Business Case / cost-control).
--
-- Fix (dwa tory, oba idempotentne):
--   1) CREATE TABLE IF NOT EXISTS — świeże bazy dostają pełny schemat od razu.
--   2) ADD COLUMN IF NOT EXISTS — bazy ze starą, uboższą tabelą dostają brakujące kolumny.
CREATE TABLE IF NOT EXISTS ai_budgets (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT,
  budget_type TEXT NOT NULL DEFAULT 'cost',
  period TEXT NOT NULL DEFAULT 'monthly',
  period_start TEXT,
  period_end TEXT,
  budget_limit REAL NOT NULL DEFAULT 0,
  warning_threshold REAL DEFAULT 0.8,
  hard_limit INTEGER DEFAULT 1,
  current_usage REAL DEFAULT 0,
  current_month_usage REAL DEFAULT 0,
  last_reset_at TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  exceeded_at TEXT,
  rollover_enabled INTEGER DEFAULT 0,
  rollover_percentage REAL DEFAULT 0,
  rollover_amount REAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT
);

ALTER TABLE ai_budgets ADD COLUMN IF NOT EXISTS period TEXT NOT NULL DEFAULT 'monthly';
ALTER TABLE ai_budgets ADD COLUMN IF NOT EXISTS period_start TEXT;
ALTER TABLE ai_budgets ADD COLUMN IF NOT EXISTS period_end TEXT;
ALTER TABLE ai_budgets ADD COLUMN IF NOT EXISTS warning_threshold REAL DEFAULT 0.8;
ALTER TABLE ai_budgets ADD COLUMN IF NOT EXISTS hard_limit INTEGER DEFAULT 1;
ALTER TABLE ai_budgets ADD COLUMN IF NOT EXISTS current_month_usage REAL DEFAULT 0;
ALTER TABLE ai_budgets ADD COLUMN IF NOT EXISTS last_reset_at TEXT;
ALTER TABLE ai_budgets ADD COLUMN IF NOT EXISTS exceeded_at TEXT;
ALTER TABLE ai_budgets ADD COLUMN IF NOT EXISTS rollover_enabled INTEGER DEFAULT 0;
ALTER TABLE ai_budgets ADD COLUMN IF NOT EXISTS rollover_percentage REAL DEFAULT 0;
ALTER TABLE ai_budgets ADD COLUMN IF NOT EXISTS rollover_amount REAL DEFAULT 0;
ALTER TABLE ai_budgets ADD COLUMN IF NOT EXISTS created_by TEXT;

-- Drugi tor driftu tej samej tabeli: starsza `ai_budgets` ma is_active INTEGER,
-- ale kod traktuje ją jako BOOLEAN wszędzie — INSERT `VALUES (...,true,...)` oraz
-- WHERE `is_active = true` (aiBudgetService 203/310/362/386). Na kolumnie integer:
-- "operator does not exist: integer = boolean" → getActiveBudgets/createBudget/
-- resetBudget cicho padają (cały moduł budżetów AI martwy). Kanon (DDL) = BOOLEAN.
-- Konwersja idempotentna (odpala się tylko gdy kolumna jest jeszcze integer).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_budgets' AND column_name = 'is_active' AND data_type = 'integer'
  ) THEN
    ALTER TABLE ai_budgets ALTER COLUMN is_active DROP DEFAULT;
    ALTER TABLE ai_budgets ALTER COLUMN is_active TYPE BOOLEAN USING (is_active <> 0);
    ALTER TABLE ai_budgets ALTER COLUMN is_active SET DEFAULT TRUE;
  END IF;
END $$;
