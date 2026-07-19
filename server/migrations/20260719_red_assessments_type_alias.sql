-- RED: schema-drift — `assessments` ma tylko `assessment_type`, brak `type`.
-- Kod (assessment-hub.routes.ts:43, assessment-reports.routes.ts:406, reportGenerationService)
-- czyta `row.type || row.assessment_type`, a docs-teresa E2E robi wprost
-- `SELECT ... type FROM assessments` → Postgres: "column type does not exist"
-- (cichy fail przy odczycie/generacji Business Case / raportu z assessmentu).
--
-- Fix: kolumna GENERATED (STORED) lustrzana do assessment_type — zawsze zsynchronizowana,
-- read-only (żaden INSERT w kodzie nie pisze do `type`, wszystkie używają assessment_type),
-- więc nie koliduje z istniejącymi zapisami. Idempotentne.
ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS type TEXT GENERATED ALWAYS AS (assessment_type) STORED;
