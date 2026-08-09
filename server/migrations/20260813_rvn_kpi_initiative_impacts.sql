-- KPI-E005 — InitiativeKPIImpact (rvn_kpi_initiative_impacts).
--
-- Design: docs/product/results-vnext/KPI_E005_DESIGN.md §C, DDL copied
-- verbatim. Legacy `initiative_kpis` (SQLite-flavored, different engine
-- entirely) is NOT reused — confirmed not-applicable, only `initiatives.id`
-- (migrations-v2/001_baseline_20260413.sql:15856, TEXT) is a valid FK
-- target.
--
-- Visibility: this table does NOT get its own rvn_platform_resource_visibility
-- row — it inherits visibility from its kpi_id (resourceType:'kpi'), same as
-- KPI-E003's deviation cases/corrective actions. Initiative (legacy module)
-- does not participate in RVN ABAC; initiative_id is exposed without joining
-- to Initiative content (the Initiatives module guards its own content on
-- its own read path).

CREATE TABLE IF NOT EXISTS rvn_kpi_initiative_impacts (
  impact_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id            TEXT NOT NULL,
  kpi_id                   UUID NOT NULL REFERENCES rvn_kpi_definitions(kpi_id),
  initiative_id              TEXT NOT NULL REFERENCES initiatives(id),
  definition_version_id_at_commitment UUID NULL REFERENCES rvn_kpi_definition_versions(definition_version_id),

  status                  TEXT NOT NULL DEFAULT 'proposed'
                          CHECK (status IN ('proposed','committed','superseded','realized_reviewed','cancelled')),

  expected_contribution_value      NUMERIC NULL,
  expected_contribution_direction    TEXT NULL CHECK (expected_contribution_direction IN ('increase','decrease')),
  target_completion_date         DATE NULL,
  proposed_by               TEXT NOT NULL,
  proposed_at               TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Frozen at commitment (immutability enforced below).
  baseline_measurement_id        UUID NULL REFERENCES rvn_kpi_measurements(measurement_id),
  baseline_value_at_commitment      NUMERIC NULL,
  baseline_period_end          TIMESTAMPTZ NULL,
  committed_by               TEXT NULL,
  committed_at               TIMESTAMPTZ NULL,

  -- Reviewed attribution — decoupled from "expected" (invariant #10).
  reviewed_attribution_value       NUMERIC NULL,
  reviewed_attribution_measurement_id  UUID NULL REFERENCES rvn_kpi_measurements(measurement_id),
  review_rationale             TEXT NULL,
  reviewed_by                TEXT NULL,
  reviewed_at                TIMESTAMPTZ NULL,

  superseded_by_impact_id        UUID NULL REFERENCES rvn_kpi_initiative_impacts(impact_id),
  superseded_at              TIMESTAMPTZ NULL,

  row_version                INT NOT NULL DEFAULT 1,
  created_by                TEXT NOT NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rvn_kpi_initiative_impacts_kpi
  ON rvn_kpi_initiative_impacts(kpi_id, status);
CREATE INDEX IF NOT EXISTS idx_rvn_kpi_initiative_impacts_initiative
  ON rvn_kpi_initiative_impacts(organization_id, initiative_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_rvn_kpi_initiative_impacts_one_active
  ON rvn_kpi_initiative_impacts(kpi_id, initiative_id)
  WHERE status IN ('proposed','committed');

CREATE OR REPLACE FUNCTION rvn_kpi_initiative_impacts_protect_baseline()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('committed','superseded','realized_reviewed') THEN
    IF NEW.baseline_measurement_id IS DISTINCT FROM OLD.baseline_measurement_id
       OR NEW.baseline_value_at_commitment IS DISTINCT FROM OLD.baseline_value_at_commitment
       OR NEW.baseline_period_end IS DISTINCT FROM OLD.baseline_period_end
       OR NEW.definition_version_id_at_commitment IS DISTINCT FROM OLD.definition_version_id_at_commitment
       OR NEW.committed_by IS DISTINCT FROM OLD.committed_by
       OR NEW.committed_at IS DISTINCT FROM OLD.committed_at
    THEN
      RAISE EXCEPTION 'rvn_kpi_initiative_impacts: baseline is frozen after commitment (impact %)', OLD.impact_id
        USING ERRCODE = '23001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rvn_kpi_initiative_impacts_protect_baseline ON rvn_kpi_initiative_impacts;
CREATE TRIGGER trg_rvn_kpi_initiative_impacts_protect_baseline
  BEFORE UPDATE ON rvn_kpi_initiative_impacts
  FOR EACH ROW EXECUTE FUNCTION rvn_kpi_initiative_impacts_protect_baseline();
