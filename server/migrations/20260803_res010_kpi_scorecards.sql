-- RES-10: canonical Results scorecard owner.
--
-- A "scorecard" groups existing `initiative_kpis` rows into a named card
-- (department x period) — per Piotr's spec (KARTY KPI, D-04): an organization
-- has MANY cards (different departments, different periods), and the same
-- KPI can sit on more than one card (e.g. margin on both the Finance card
-- and the Board card), hence a join table rather than a column on
-- `initiative_kpis`.
--
-- `kpi_scorecards` is the canonical scorecard object; `kpi_scorecard_items`
-- is the many-to-many join to `initiative_kpis`. `server/src/services/
-- results/kpiScorecardService.ts` is the ONLY writer for both tables.
--
-- OWNERSHIP (RES-10): this is the Results-owned scorecard contract, distinct
-- from Initiatives' `goals` table (`initiativeGovernanceService.ts`).
--
-- TENANT ISOLATION: `organization_id` is NOT NULL on BOTH tables — deliberately
-- redundant on `kpi_scorecard_items` (not inferred solely via the join to
-- `kpi_scorecards`/`initiative_kpis`). The RES-10 tenant-leak postmortem found
-- exactly this shape of bug in `goal_initiative_links`, which has NO
-- organization_id column at all: a caller from another org could reach an
-- unscoped join-table read. This migration does not repeat that mistake.
--
-- ORDERING: `server/scripts/migrate.postgres.ts` sorts filenames
-- lexicographically, so "2026..." files run before 3-digit legacy filenames
-- (e.g. "565_...") — same pre-existing migration-runner behavior documented
-- in `20260803_res002_kpi_definition_versions.sql`. `initiative_kpis` itself
-- is guaranteed to exist by the time this file runs ("061_initiative_
-- lifecycle.sql" creates it and "061" sorts before any "2026..." filename),
-- but two columns this migration's queries need — `is_on_target` and
-- `progress_percentage` — are normally added later by "565_..." / "787_...",
-- which may not have run yet. Defensively guarded below, same pattern as
-- RES-02's own guard section. `is_on_target` is INTEGER (0/1), not BOOLEAN —
-- matches the real column type added by 565/20260719_baseline_gap.sql; do
-- not compare it to a boolean literal.
--
-- Idempotent: every DDL statement uses IF NOT EXISTS, safe to re-run.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE initiative_kpis
  ADD COLUMN IF NOT EXISTS is_on_target INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS progress_percentage REAL DEFAULT 0;

CREATE TABLE IF NOT EXISTS kpi_scorecards (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  department TEXT,
  period_label TEXT,
  period_start DATE,
  period_end DATE,
  status TEXT NOT NULL DEFAULT 'active',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kpi_scorecards_org ON kpi_scorecards(organization_id);

CREATE TABLE IF NOT EXISTS kpi_scorecard_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  scorecard_id TEXT NOT NULL REFERENCES kpi_scorecards(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL,
  kpi_id TEXT NOT NULL REFERENCES initiative_kpis(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (scorecard_id, kpi_id)
);

-- Historical demo/staging schemas may already contain the legacy join table
-- without tenant ownership or foreign keys. CREATE TABLE IF NOT EXISTS is a
-- no-op in that case, so upgrade the existing shape explicitly. Ownership is
-- derived only from the canonical parent scorecard; unresolved rows abort the
-- migration instead of being assigned to an arbitrary organization.
ALTER TABLE kpi_scorecard_items
  ADD COLUMN IF NOT EXISTS organization_id TEXT;

UPDATE kpi_scorecard_items AS item
SET organization_id = scorecard.organization_id
FROM kpi_scorecards AS scorecard
WHERE item.scorecard_id = scorecard.id
  AND item.organization_id IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM kpi_scorecard_items WHERE organization_id IS NULL) THEN
    RAISE EXCEPTION
      'RES-10 tenant backfill failed: kpi_scorecard_items contains rows without a resolvable scorecard organization';
  END IF;
END $$;

ALTER TABLE kpi_scorecard_items
  ALTER COLUMN organization_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'kpi_scorecard_items_scorecard_id_fkey'
      AND conrelid = 'kpi_scorecard_items'::regclass
  ) THEN
    ALTER TABLE kpi_scorecard_items
      ADD CONSTRAINT kpi_scorecard_items_scorecard_id_fkey
      FOREIGN KEY (scorecard_id) REFERENCES kpi_scorecards(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'kpi_scorecard_items_kpi_id_fkey'
      AND conrelid = 'kpi_scorecard_items'::regclass
  ) THEN
    ALTER TABLE kpi_scorecard_items
      ADD CONSTRAINT kpi_scorecard_items_kpi_id_fkey
      FOREIGN KEY (kpi_id) REFERENCES initiative_kpis(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_kpi_scorecard_items_org ON kpi_scorecard_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_kpi_scorecard_items_scorecard ON kpi_scorecard_items(scorecard_id);
CREATE INDEX IF NOT EXISTS idx_kpi_scorecard_items_kpi ON kpi_scorecard_items(kpi_id);
