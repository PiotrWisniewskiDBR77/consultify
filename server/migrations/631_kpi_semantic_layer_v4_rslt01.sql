-- V4-RSLT-01: Metrics semantic layer — dimensions, slices, versioning
-- Extends kpi_definitions for Looker-style semantic model

ALTER TABLE kpi_definitions ADD COLUMN IF NOT EXISTS dimensions_json TEXT DEFAULT '[]';
ALTER TABLE kpi_definitions ADD COLUMN IF NOT EXISTS slices_json TEXT DEFAULT '[]';
ALTER TABLE kpi_definitions ADD COLUMN IF NOT EXISTS formula TEXT DEFAULT NULL;
ALTER TABLE kpi_definitions ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- dimensions_json: ["region", "product", "department"] — dimensions for slicing
-- slices_json: [{"dim": "region", "op": "eq", "val": "EU"}] — default filter preset
-- formula: optional expression for calculated KPIs (e.g. "revenue / costs")
