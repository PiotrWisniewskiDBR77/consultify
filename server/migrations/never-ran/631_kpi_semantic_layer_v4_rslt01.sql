-- V4-RSLT-01: Metrics semantic layer — dimensions, slices, versioning
-- Extends kpi_definitions for Looker-style semantic model

CREATE TABLE IF NOT EXISTS kpi_definitions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'custom',
    unit TEXT NOT NULL DEFAULT 'count',
    unit_display TEXT,
    direction TEXT NOT NULL DEFAULT 'target',
    precision INTEGER DEFAULT 2,
    default_target REAL,
    default_baseline REAL,
    warning_threshold_percentage REAL DEFAULT 20,
    critical_threshold_percentage REAL DEFAULT 40,
    is_manual BOOLEAN DEFAULT TRUE,
    data_source_type TEXT,
    data_source_config TEXT,
    collection_frequency TEXT DEFAULT 'monthly',
    chart_type TEXT DEFAULT 'line',
    color TEXT,
    is_global BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kpi_org ON kpi_definitions(organization_id);
CREATE INDEX IF NOT EXISTS idx_kpi_category ON kpi_definitions(category);

ALTER TABLE kpi_definitions ADD COLUMN IF NOT EXISTS dimensions_json TEXT DEFAULT '[]';
ALTER TABLE kpi_definitions ADD COLUMN IF NOT EXISTS slices_json TEXT DEFAULT '[]';
ALTER TABLE kpi_definitions ADD COLUMN IF NOT EXISTS formula TEXT DEFAULT NULL;
ALTER TABLE kpi_definitions ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- dimensions_json: ["region", "product", "department"] — dimensions for slicing
-- slices_json: [{"dim": "region", "op": "eq", "val": "EU"}] — default filter preset
-- formula: optional expression for calculated KPIs (e.g. "revenue / costs")
