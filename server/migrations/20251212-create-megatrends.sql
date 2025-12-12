-- Migration script to create megatrends and custom_trends tables
-- This script works for both SQLite and PostgreSQL (basic SQL syntax)

CREATE TABLE IF NOT EXISTS megatrends (
    id TEXT PRIMARY KEY,
    industry TEXT NOT NULL,
    type TEXT NOT NULL, -- Technology / Business / Societal
    label TEXT NOT NULL,
    description TEXT,
    base_impact_score INTEGER NOT NULL,
    initial_ring TEXT NOT NULL -- Now / Watch / Horizon
);

CREATE TABLE IF NOT EXISTS custom_trends (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    industry TEXT NOT NULL,
    type TEXT NOT NULL,
    label TEXT NOT NULL,
    description TEXT,
    ring TEXT NOT NULL,
    FOREIGN KEY (company_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_megatrends_industry ON megatrends(industry);
CREATE INDEX IF NOT EXISTS idx_custom_trends_company ON custom_trends(company_id);
