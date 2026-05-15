-- ============================================
-- Migration 567 — Bundle 13: Finance A
-- T050: Financial Statement Ingestion & Standardization
-- T051: Financial Ratio Analysis
-- ============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- T050: FINANCIAL STATEMENTS (actual imported data)
-- ============================================

CREATE TABLE IF NOT EXISTS financial_statements (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL,
  entity_name TEXT,
  statement_type TEXT NOT NULL CHECK (statement_type IN ('P&L', 'BS', 'CF')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_label TEXT,
  currency TEXT DEFAULT 'PLN',
  scaling TEXT DEFAULT 'units' CHECK (scaling IN ('units', 'thousands', 'millions', 'billions')),
  source_file_name TEXT,
  source_file_path TEXT,
  source_import_id TEXT,
  parse_method TEXT CHECK (parse_method IN ('text_extraction', 'ocr', 'manual')),
  overall_confidence REAL DEFAULT 0,
  validation_status TEXT DEFAULT 'pending' CHECK (validation_status IN ('pending', 'pass', 'warnings', 'needs_review', 'failed')),
  validation_messages TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'imported', 'mapped', 'confirmed', 'archived')),
  notes TEXT,
  created_by TEXT,
  confirmed_by TEXT,
  confirmed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fs_org ON financial_statements(organization_id);
CREATE INDEX IF NOT EXISTS idx_fs_type ON financial_statements(statement_type);
CREATE INDEX IF NOT EXISTS idx_fs_period ON financial_statements(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_fs_status ON financial_statements(status);

-- Values extracted from financial statements
CREATE TABLE IF NOT EXISTS financial_statement_values (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  statement_id TEXT NOT NULL,
  canonical_line_id TEXT,
  original_label TEXT,
  value REAL,
  confidence REAL DEFAULT 0,
  source_page INTEGER,
  source_row INTEGER,
  is_manually_corrected BOOLEAN DEFAULT FALSE,
  corrected_by TEXT,
  corrected_at TIMESTAMP,
  mapping_status TEXT DEFAULT 'auto' CHECK (mapping_status IN ('auto', 'suggested', 'manual', 'unmapped')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (statement_id) REFERENCES financial_statements(id) ON DELETE CASCADE,
  FOREIGN KEY (canonical_line_id) REFERENCES financial_statement_lines(id)
);

CREATE INDEX IF NOT EXISTS idx_fsv_statement ON financial_statement_values(statement_id);
CREATE INDEX IF NOT EXISTS idx_fsv_line ON financial_statement_values(canonical_line_id);

-- Extend financial_statement_lines with additional canonical lines needed for ratios
INSERT INTO financial_statement_lines (id, statement_type, line_code, line_name, line_name_pl, sort_order, is_system) VALUES
  ('fsl-bs-total-assets', 'BS', 'TOTAL_ASSETS', 'Total Assets', 'Aktywa ogółem', 60, TRUE),
  ('fsl-bs-current-assets', 'BS', 'CURRENT_ASSETS', 'Current Assets', 'Aktywa obrotowe', 15, TRUE),
  ('fsl-bs-cash', 'BS', 'CASH', 'Cash & Cash Equivalents', 'Środki pieniężne', 5, TRUE),
  ('fsl-bs-total-liabilities', 'BS', 'TOTAL_LIABILITIES', 'Total Liabilities', 'Zobowiązania ogółem', 70, TRUE),
  ('fsl-bs-current-liabilities', 'BS', 'CURRENT_LIABILITIES', 'Current Liabilities', 'Zobowiązania krótkoterminowe', 35, TRUE),
  ('fsl-bs-long-term-debt', 'BS', 'LONG_TERM_DEBT', 'Long-term Debt', 'Zobowiązania długoterminowe', 75, TRUE),
  ('fsl-bs-equity', 'BS', 'EQUITY', 'Total Equity', 'Kapitał własny', 80, TRUE),
  ('fsl-pl-interest', 'P&L', 'INTEREST_EXPENSE', 'Interest Expense', 'Koszty odsetkowe', 65, TRUE),
  ('fsl-pl-depreciation', 'P&L', 'DEPRECIATION', 'Depreciation & Amortization', 'Amortyzacja', 55, TRUE),
  ('fsl-pl-tax', 'P&L', 'TAX_EXPENSE', 'Income Tax Expense', 'Podatek dochodowy', 68, TRUE),
  ('fsl-cf-financing', 'CF', 'CFF', 'Financing Cash Flow', 'Przepływy z finansowania', 25, TRUE),
  ('fsl-cf-investing', 'CF', 'CFI', 'Investing Cash Flow', 'Przepływy z inwestycji', 22, TRUE)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- T051: FINANCIAL RATIO BENCHMARKS
-- ============================================

CREATE TABLE IF NOT EXISTS financial_ratio_benchmarks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL,
  ratio_code TEXT NOT NULL,
  industry TEXT,
  region TEXT,
  company_size TEXT,
  period_year INTEGER,
  p25 REAL,
  median REAL,
  p75 REAL,
  target_min REAL,
  target_max REAL,
  source_label TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, ratio_code, industry, period_year)
);

CREATE INDEX IF NOT EXISTS idx_frb_org ON financial_ratio_benchmarks(organization_id);
CREATE INDEX IF NOT EXISTS idx_frb_ratio ON financial_ratio_benchmarks(ratio_code);

-- Computed ratio snapshots (cached results)
CREATE TABLE IF NOT EXISTS financial_ratio_snapshots (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL,
  statement_id TEXT NOT NULL,
  ratio_code TEXT NOT NULL,
  ratio_value REAL,
  status TEXT DEFAULT 'ok' CHECK (status IN ('ok', 'warn', 'critical', 'na')),
  coverage_pct REAL DEFAULT 100,
  missing_lines TEXT,
  computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (statement_id) REFERENCES financial_statements(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_frs_org ON financial_ratio_snapshots(organization_id);
CREATE INDEX IF NOT EXISTS idx_frs_stmt ON financial_ratio_snapshots(statement_id);
CREATE INDEX IF NOT EXISTS idx_frs_ratio ON financial_ratio_snapshots(ratio_code);
