-- Day 158: additive identity bridge between legacy KPI registries and the
-- Results VNext canonical KPI root. This table does not change either root
-- and deliberately contains no name/unit based matching mechanism.

CREATE TABLE IF NOT EXISTS kpi_crosswalk (
  crosswalk_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   TEXT NOT NULL,
  source_system     TEXT NOT NULL,
  source_id         TEXT NOT NULL,
  canonical_kpi_id  UUID NOT NULL REFERENCES rvn_kpi_definitions(kpi_id) ON DELETE RESTRICT,
  match_basis       TEXT NOT NULL CHECK (match_basis IN ('manual', 'owner_confirmed')),
  created_by        TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, source_system, source_id)
);

CREATE INDEX IF NOT EXISTS idx_kpi_crosswalk_canonical
  ON kpi_crosswalk (organization_id, canonical_kpi_id);

CREATE INDEX IF NOT EXISTS idx_kpi_crosswalk_source
  ON kpi_crosswalk (organization_id, source_system, source_id);
