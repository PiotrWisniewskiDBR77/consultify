-- V8 Results / ROI Continuity — core tables
-- WP-W6-OUT-02: dual-mode KPI, deviation governance, ROI realization,
-- executive review packs, KPI-Finance reconciliation
--
-- Decision W6-5: Results starts reconciliation, Finance resolves.
-- Decision W6-6: Standalone mode governance in scope.
-- Decision W6-7: ExecutiveReviewPack is Results-native.

-- ==========================================
-- 1. KPI Definitions (dual-mode registry)
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_kpi_definitions (
  kpi_id                TEXT PRIMARY KEY,
  organization_id       TEXT NOT NULL,
  name                  TEXT NOT NULL,
  mode                  TEXT NOT NULL
                        CHECK (mode IN ('initiative_linked', 'standalone')),
  initiative_id         TEXT,
  metric_type           TEXT NOT NULL
                        CHECK (metric_type IN (
                          'currency', 'percentage', 'count', 'ratio',
                          'duration', 'score', 'index'
                        )),
  baseline_value        REAL,
  target_value          REAL,
  current_value         REAL,
  measurement_cadence   TEXT NOT NULL
                        CHECK (measurement_cadence IN (
                          'daily', 'weekly', 'biweekly', 'monthly',
                          'quarterly', 'annually'
                        )),
  status                TEXT NOT NULL DEFAULT 'design'
                        CHECK (status IN (
                          'design', 'baseline', 'active', 'measurement',
                          'review', 'deviation', 'improvement',
                          'benefits_realization'
                        )),
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_kpi_org
  ON v8_kpi_definitions(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_kpi_mode
  ON v8_kpi_definitions(organization_id, mode);
CREATE INDEX IF NOT EXISTS idx_v8_kpi_status
  ON v8_kpi_definitions(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_v8_kpi_initiative
  ON v8_kpi_definitions(organization_id, initiative_id)
  WHERE initiative_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_v8_kpi_created
  ON v8_kpi_definitions(organization_id, created_at);

-- ==========================================
-- 2. Deviation Records
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_deviation_records (
  deviation_id          TEXT PRIMARY KEY,
  organization_id       TEXT NOT NULL,
  kpi_id                TEXT NOT NULL,
  deviation_type        TEXT NOT NULL
                        CHECK (deviation_type IN (
                          'underperformance', 'overperformance',
                          'data_quality', 'measurement_gap'
                        )),
  severity              TEXT NOT NULL
                        CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  action_required       TEXT NOT NULL,
  escalated_to          TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (kpi_id) REFERENCES v8_kpi_definitions(kpi_id)
);

CREATE INDEX IF NOT EXISTS idx_v8_deviation_org
  ON v8_deviation_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_deviation_kpi
  ON v8_deviation_records(organization_id, kpi_id);
CREATE INDEX IF NOT EXISTS idx_v8_deviation_type
  ON v8_deviation_records(organization_id, deviation_type);
CREATE INDEX IF NOT EXISTS idx_v8_deviation_severity
  ON v8_deviation_records(organization_id, severity);
CREATE INDEX IF NOT EXISTS idx_v8_deviation_created
  ON v8_deviation_records(organization_id, created_at);

-- ==========================================
-- 3. ROI Realization Entries
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_roi_realization_entries (
  entry_id              TEXT PRIMARY KEY,
  organization_id       TEXT NOT NULL,
  kpi_id                TEXT NOT NULL,
  initiative_id         TEXT,
  realized_value        REAL NOT NULL,
  period                TEXT NOT NULL,
  provenance_ref        TEXT,
  verified_by           TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (kpi_id) REFERENCES v8_kpi_definitions(kpi_id)
);

CREATE INDEX IF NOT EXISTS idx_v8_roi_org
  ON v8_roi_realization_entries(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_roi_kpi
  ON v8_roi_realization_entries(organization_id, kpi_id);
CREATE INDEX IF NOT EXISTS idx_v8_roi_initiative
  ON v8_roi_realization_entries(organization_id, initiative_id)
  WHERE initiative_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_v8_roi_period
  ON v8_roi_realization_entries(organization_id, period);
CREATE INDEX IF NOT EXISTS idx_v8_roi_created
  ON v8_roi_realization_entries(organization_id, created_at);

-- ==========================================
-- 4. Executive Review Packs (Decision W6-7: Results-native)
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_executive_review_packs (
  pack_id               TEXT PRIMARY KEY,
  organization_id       TEXT NOT NULL,
  review_period         TEXT NOT NULL,
  kpi_summaries         TEXT NOT NULL DEFAULT '[]',
  deviation_highlights  TEXT NOT NULL DEFAULT '[]',
  roi_snapshot          TEXT NOT NULL DEFAULT '{}',
  status                TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'in_review', 'approved', 'shared')),
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_review_pack_org
  ON v8_executive_review_packs(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_review_pack_status
  ON v8_executive_review_packs(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_v8_review_pack_period
  ON v8_executive_review_packs(organization_id, review_period);
CREATE INDEX IF NOT EXISTS idx_v8_review_pack_created
  ON v8_executive_review_packs(organization_id, created_at);

-- ==========================================
-- 5. KPI-Finance Reconciliations (Decision W6-5)
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_kpi_finance_reconciliations (
  reconciliation_id     TEXT PRIMARY KEY,
  organization_id       TEXT NOT NULL,
  kpi_id                TEXT NOT NULL,
  finance_ref           TEXT NOT NULL,
  reconciliation_status TEXT NOT NULL DEFAULT 'pending'
                        CHECK (reconciliation_status IN (
                          'pending', 'reconciled', 'disputed', 'escalated'
                        )),
  initiated_by          TEXT NOT NULL
                        CHECK (initiated_by IN ('results', 'finance')),
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (kpi_id) REFERENCES v8_kpi_definitions(kpi_id)
);

CREATE INDEX IF NOT EXISTS idx_v8_reconciliation_org
  ON v8_kpi_finance_reconciliations(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_reconciliation_kpi
  ON v8_kpi_finance_reconciliations(organization_id, kpi_id);
CREATE INDEX IF NOT EXISTS idx_v8_reconciliation_status
  ON v8_kpi_finance_reconciliations(organization_id, reconciliation_status);
CREATE INDEX IF NOT EXISTS idx_v8_reconciliation_created
  ON v8_kpi_finance_reconciliations(organization_id, created_at);
