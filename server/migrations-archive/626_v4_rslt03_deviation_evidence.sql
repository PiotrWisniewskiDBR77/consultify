-- V4-RSLT-03: Deviation loop - verify/close with evidence
ALTER TABLE kpi_deviation_cases ADD COLUMN IF NOT EXISTS evidence_text TEXT;
ALTER TABLE kpi_deviation_cases ADD COLUMN IF NOT EXISTS evidence_ref TEXT;
ALTER TABLE kpi_deviation_cases ADD COLUMN IF NOT EXISTS closed_by TEXT;
ALTER TABLE kpi_deviation_cases ADD COLUMN IF NOT EXISTS resolution_notes TEXT;
