-- V4-ORG-01: Benchmark datasets (minimal — seed percentiles)
-- V4-ENT-04: org_policies (retention, legal hold)

-- Benchmark datasets (framework + industry + percentiles)
CREATE TABLE IF NOT EXISTS benchmark_datasets (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  framework TEXT NOT NULL,
  industry TEXT NOT NULL,
  region TEXT,
  company_size TEXT,
  p25 REAL, p50 REAL, p75 REAL, p90 REAL,
  cohort_size INTEGER DEFAULT 0,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_benchmark_datasets_framework ON benchmark_datasets(framework);
CREATE INDEX IF NOT EXISTS idx_benchmark_datasets_industry ON benchmark_datasets(industry);

-- Org policies (retention, legal hold, residency)
CREATE TABLE IF NOT EXISTS org_policies (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL UNIQUE,
  retention_days INTEGER,
  legal_hold_enabled INTEGER DEFAULT 0,
  residency_region TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_org_policies_org ON org_policies(organization_id);
