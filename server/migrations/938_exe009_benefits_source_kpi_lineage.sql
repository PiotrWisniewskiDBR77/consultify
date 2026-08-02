-- EXE-09: preserve Initiative KPI lineage without violating the legacy KPI FK.
--
-- initiative_benefits.kpi_id references kpi_definitions(id), while the
-- Execution closure writer reads initiative_kpis(id). Those are independent
-- registries, so copying the latter into the former causes a real FK failure.
-- Keep the legacy link nullable and record the actual source in a dedicated,
-- correctly constrained column.

ALTER TABLE initiative_benefits
  ADD COLUMN IF NOT EXISTS source_initiative_kpi_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'initiative_benefits_source_initiative_kpi_id_fkey'
       AND conrelid = 'initiative_benefits'::regclass
  ) THEN
    ALTER TABLE initiative_benefits
      ADD CONSTRAINT initiative_benefits_source_initiative_kpi_id_fkey
      FOREIGN KEY (source_initiative_kpi_id)
      REFERENCES initiative_kpis(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Migration 936's NULL-kpi fallback index predates the lineage column. Once
-- planned Initiative KPI benefits intentionally use legacy kpi_id = NULL, its
-- old predicate would incorrectly allow only one planned KPI per initiative.
DROP INDEX IF EXISTS idx_initiative_benefits_closure_fallback_dedup;
CREATE UNIQUE INDEX idx_initiative_benefits_closure_fallback_dedup
  ON initiative_benefits (initiative_id, source_tag)
  WHERE kpi_id IS NULL
    AND source_initiative_kpi_id IS NULL
    AND source_tag = 'M14_CLOSURE_HANDOFF';

CREATE UNIQUE INDEX IF NOT EXISTS uq_initiative_benefits_closure_source_kpi
  ON initiative_benefits (initiative_id, source_initiative_kpi_id, source_tag)
  WHERE source_tag = 'M14_CLOSURE_HANDOFF'
    AND source_initiative_kpi_id IS NOT NULL;
