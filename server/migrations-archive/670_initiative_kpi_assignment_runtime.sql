-- Initiative KPI assignment runtime
-- Adds explicit observation semantics for KPI tracked in Results with initiative context.

ALTER TABLE initiative_kpi_mappings
  ADD COLUMN IF NOT EXISTS definition_source TEXT DEFAULT 'initiative-custom';

ALTER TABLE initiative_kpi_mappings
  ADD COLUMN IF NOT EXISTS observation_phase TEXT DEFAULT 'post-implementation';

ALTER TABLE initiative_kpi_mappings
  ADD COLUMN IF NOT EXISTS tracked_in_realization BOOLEAN DEFAULT FALSE;

ALTER TABLE initiative_kpi_mappings
  ADD COLUMN IF NOT EXISTS tracked_post_implementation BOOLEAN DEFAULT TRUE;

ALTER TABLE initiative_kpi_mappings
  ADD COLUMN IF NOT EXISTS observation_status TEXT DEFAULT 'active';

ALTER TABLE initiative_kpi_mappings
  ADD COLUMN IF NOT EXISTS realization_baseline_value REAL;

ALTER TABLE initiative_kpi_mappings
  ADD COLUMN IF NOT EXISTS realization_target_value REAL;

ALTER TABLE initiative_kpi_mappings
  ADD COLUMN IF NOT EXISTS realization_measurement_frequency TEXT;

ALTER TABLE initiative_kpi_mappings
  ADD COLUMN IF NOT EXISTS post_implementation_baseline_value REAL;

ALTER TABLE initiative_kpi_mappings
  ADD COLUMN IF NOT EXISTS post_implementation_target_value REAL;

ALTER TABLE initiative_kpi_mappings
  ADD COLUMN IF NOT EXISTS post_implementation_measurement_frequency TEXT;

UPDATE initiative_kpi_mappings
SET definition_source = COALESCE(NULLIF(definition_source, ''), 'initiative-custom')
WHERE definition_source IS NULL OR definition_source = '';

UPDATE initiative_kpi_mappings
SET observation_phase = COALESCE(NULLIF(observation_phase, ''), 'post-implementation')
WHERE observation_phase IS NULL OR observation_phase = '';

UPDATE initiative_kpi_mappings
SET observation_status = COALESCE(NULLIF(observation_status, ''), 'active')
WHERE observation_status IS NULL OR observation_status = '';

UPDATE initiative_kpi_mappings
SET tracked_in_realization = CASE
  WHEN tracked_in_realization IS NULL THEN FALSE
  ELSE tracked_in_realization
END;

UPDATE initiative_kpi_mappings
SET tracked_post_implementation = CASE
  WHEN tracked_post_implementation IS NULL THEN TRUE
  ELSE tracked_post_implementation
END;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'initiative_kpi_mappings_definition_source_chk'
  ) THEN
    ALTER TABLE initiative_kpi_mappings
      ADD CONSTRAINT initiative_kpi_mappings_definition_source_chk
      CHECK (definition_source IN ('library', 'initiative-custom'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'initiative_kpi_mappings_observation_phase_chk'
  ) THEN
    ALTER TABLE initiative_kpi_mappings
      ADD CONSTRAINT initiative_kpi_mappings_observation_phase_chk
      CHECK (observation_phase IN ('realization', 'post-implementation', 'both'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'initiative_kpi_mappings_observation_status_chk'
  ) THEN
    ALTER TABLE initiative_kpi_mappings
      ADD CONSTRAINT initiative_kpi_mappings_observation_status_chk
      CHECK (observation_status IN ('active', 'paused', 'completed'));
  END IF;
END $$;
