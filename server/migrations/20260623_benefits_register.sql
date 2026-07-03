-- M14/F6 (6.1) — Benefits Register + handoff M14 → M15 (closure).
--
-- A benefit is a tracked outcome (KPI/ROI) that an initiative is expected to
-- deliver. At initiative closure (M14) the realized KPI/ROI delta is handed
-- off into the benefits register so that the benefit keeps being *tracked*
-- after the initiative itself is closed (M15 = sustainment / value capture).
--
-- This replaces the previous "preview only" closure handoff (which computed a
-- benefit shape but never persisted it) with a real, org-scoped row.
--
-- Design notes:
--   - id TEXT PK (uuid) — append-friendly; one row per tracked benefit.
--   - status DEFAULT 'tracking' — lifecycle of the benefit itself
--     (tracking → realized → at_risk → missed → retired).
--   - source records provenance, e.g. 'M14_CLOSURE_HANDOFF' for rows created
--     by the closure handoff vs 'MANUAL' for user-created benefits.
--   - org-index for list-by-org; org+initiative index for the per-initiative
--     register view and for handoff idempotency lookups.

CREATE TABLE IF NOT EXISTS benefits_register (
  id               TEXT PRIMARY KEY,
  organization_id  TEXT NOT NULL,
  initiative_id    TEXT,
  name             TEXT NOT NULL,
  owner_id         TEXT,
  kpi_name         TEXT,
  baseline_value   REAL,
  target_value     REAL,
  current_value    REAL,
  cadence          TEXT,
  status           TEXT NOT NULL DEFAULT 'tracking',
  source           TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_benefits_register_org
  ON benefits_register(organization_id);

CREATE INDEX IF NOT EXISTS idx_benefits_register_org_initiative
  ON benefits_register(organization_id, initiative_id);
