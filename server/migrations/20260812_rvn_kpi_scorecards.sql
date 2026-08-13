-- KPI-E004 — Scorecards (rvn_kpi_scorecards / rvn_kpi_scorecard_items /
-- rvn_kpi_scorecard_review_snapshots / rvn_kpi_scorecard_review_snapshot_measurements).
--
-- Design: 02_KPI_IMPLEMENTATION_PLAN.md §3.1 (Scorecard/ScorecardItem/
-- ScorecardReviewSnapshot YAML), §7.4 (API routes), §8 (event catalog),
-- §14 P0 risk row "Restricted KPI leaks in Scorecard totals" (see decision
-- #6 above for how this is closed). EPIC_LEDGER_LIVE.md KPI-E004: 5 AC —
-- (1) one KPI in many scorecards without duplicating truth, (2) ScorecardItem
-- never writes to KPI tables, (3) immutable snapshot with content_hash +
-- supersession, (4) non-leak aggregation, (5) 7-section Scorecard Tool.
-- Builds on 20260809_rvn_platform_*.sql and 20260810_rvn_kpi_core.sql —
-- same conventions (organization_id everywhere, row_version for CAS, TEXT
-- ids, TIMESTAMPTZ, gen_random_uuid() defaults).
--
-- PREREQUISITE (not in this file): RVN_RESOURCE_TYPES / CanonicalObjectTypeValues
-- must have 'kpi_scorecard' appended before any application code in §B/§C
-- below can call buildVisibilityScopedCte/getActiveVisibilityPolicy with it.
-- (Landed separately — server/src/services/resultsVnext/platform/resourceTypes.ts
-- and server/src/types/myWorkRoofPackage.ts, Package 0 of this rollout.)

CREATE TABLE IF NOT EXISTS rvn_kpi_scorecards (
  scorecard_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      TEXT NOT NULL,
  name               TEXT NOT NULL,
  description          TEXT NULL,
  scope_type          TEXT NOT NULL
                      CHECK (scope_type IN
                        ('organization','business_unit','team','process','individual','custom')),
  scope_id            TEXT NULL,
  owner_user_id        TEXT NOT NULL,
  review_frequency      TEXT NOT NULL
                      CHECK (review_frequency IN ('weekly','monthly','quarterly','annual','custom')),
  -- No 'pending_approval' — a Scorecard is a curation/membership object,
  -- not a governed contract requiring maker-checker.
  lifecycle_status      TEXT NOT NULL DEFAULT 'draft'
                      CHECK (lifecycle_status IN ('draft','active','suspended','archived')),
  row_version          INT NOT NULL DEFAULT 1,
  created_by          TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rvn_kpi_scorecards_org_status
  ON rvn_kpi_scorecards(organization_id, lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_rvn_kpi_scorecards_owner
  ON rvn_kpi_scorecards(organization_id, owner_user_id);

-- rvn_kpi_scorecard_items — pure membership reference. AC #1/#2. Carries NO
-- KPI-fact column (no actual_value, no cached status) — every render reads
-- rvn_kpi_measurements fresh through kpi_id. This is what makes AC #2
-- structurally true, not just a discipline.
CREATE TABLE IF NOT EXISTS rvn_kpi_scorecard_items (
  item_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scorecard_id        UUID NOT NULL REFERENCES rvn_kpi_scorecards(scorecard_id),
  kpi_id             UUID NOT NULL REFERENCES rvn_kpi_definitions(kpi_id),
  organization_id      TEXT NOT NULL,
  role              TEXT NOT NULL DEFAULT 'supporting'
                      CHECK (role IN ('primary','supporting')),
  sort_order          INT NOT NULL DEFAULT 0,
  display_config       JSONB NULL,
  added_by           TEXT NOT NULL,
  added_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- AC #1 is cross-scorecard (same kpi_id legitimately has one row per OTHER
  -- scorecard). This UNIQUE is the within-scorecard half: no duplicate KPI
  -- on one card.
  UNIQUE (scorecard_id, kpi_id)
);

CREATE INDEX IF NOT EXISTS idx_rvn_kpi_scorecard_items_scorecard_sort
  ON rvn_kpi_scorecard_items(scorecard_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_rvn_kpi_scorecard_items_kpi
  ON rvn_kpi_scorecard_items(kpi_id);

-- rvn_kpi_scorecard_review_snapshots — immutable published view. AC #3.
CREATE TABLE IF NOT EXISTS rvn_kpi_scorecard_review_snapshots (
  snapshot_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scorecard_id            UUID NOT NULL REFERENCES rvn_kpi_scorecards(scorecard_id),
  organization_id          TEXT NOT NULL,
  review_period_start        TIMESTAMPTZ NOT NULL,
  review_period_end          TIMESTAMPTZ NOT NULL,
  -- Shape: { items: [{ kpiId, definitionVersionId, itemRole, measurementId,
  -- actualValue, unit, performanceStatus, dataQualityStatus, periodStart,
  -- periodEnd }], statusCounts: { safe, warning, critical, missing } }.
  -- NULL while status='draft'.
  snapshot_payload          JSONB NULL,
  status                 TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','published','superseded')),
  content_hash             TEXT NULL,
  published_by             TEXT NULL,
  published_at             TIMESTAMPTZ NULL,
  superseded_by_snapshot_id     UUID NULL REFERENCES rvn_kpi_scorecard_review_snapshots(snapshot_id),
  superseded_at             TIMESTAMPTZ NULL,
  row_version              INT NOT NULL DEFAULT 1,
  created_by              TEXT NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rvn_kpi_scorecard_snapshots_scorecard_status
  ON rvn_kpi_scorecard_review_snapshots(scorecard_id, status);
CREATE INDEX IF NOT EXISTS idx_rvn_kpi_scorecard_snapshots_published_at
  ON rvn_kpi_scorecard_review_snapshots(scorecard_id, published_at DESC);

-- AC #3 defense-in-depth: at most ONE live published snapshot per scorecard.
CREATE UNIQUE INDEX IF NOT EXISTS ux_rvn_kpi_scorecard_snapshots_one_published
  ON rvn_kpi_scorecard_review_snapshots(scorecard_id)
  WHERE status = 'published';

-- Immutability trigger — same shape as
-- trg_rvn_kpi_definition_versions_protect_approved. Allows exactly the
-- supersession bookkeeping through after publish; everything else frozen.
CREATE OR REPLACE FUNCTION rvn_kpi_scorecard_snapshots_protect_published()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'published' THEN
    IF NEW.scorecard_id IS DISTINCT FROM OLD.scorecard_id
       OR NEW.review_period_start IS DISTINCT FROM OLD.review_period_start
       OR NEW.review_period_end IS DISTINCT FROM OLD.review_period_end
       OR NEW.snapshot_payload IS DISTINCT FROM OLD.snapshot_payload
       OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
       OR NEW.published_by IS DISTINCT FROM OLD.published_by
       OR NEW.published_at IS DISTINCT FROM OLD.published_at
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
    THEN
      RAISE EXCEPTION
        'rvn_kpi_scorecard_review_snapshots: snapshot % is published — only status/superseded_by_snapshot_id/superseded_at (and row_version/updated_at bookkeeping) may change',
        OLD.snapshot_id
        USING ERRCODE = '23001';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'superseded' THEN
      RAISE EXCEPTION
        'rvn_kpi_scorecard_review_snapshots: snapshot % is published — may only transition to superseded',
        OLD.snapshot_id
        USING ERRCODE = '23001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rvn_kpi_scorecard_snapshots_protect_published ON rvn_kpi_scorecard_review_snapshots;
CREATE TRIGGER trg_rvn_kpi_scorecard_snapshots_protect_published
  BEFORE UPDATE ON rvn_kpi_scorecard_review_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION rvn_kpi_scorecard_snapshots_protect_published();

-- Join table replacing the plan's literal source_measurement_ids: uuid[]
-- (same reasoning as KPI-E003 decision #6: Postgres does not validate FKs
-- inside arrays).
CREATE TABLE IF NOT EXISTS rvn_kpi_scorecard_review_snapshot_measurements (
  snapshot_id      UUID NOT NULL REFERENCES rvn_kpi_scorecard_review_snapshots(snapshot_id),
  measurement_id    UUID NOT NULL REFERENCES rvn_kpi_measurements(measurement_id),
  PRIMARY KEY (snapshot_id, measurement_id)
);

CREATE INDEX IF NOT EXISTS idx_rvn_kpi_scorecard_snapshot_measurements_measurement
  ON rvn_kpi_scorecard_review_snapshot_measurements(measurement_id);
