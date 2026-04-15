-- V8 Finance Integration & Promotion — core primitives
-- WP-W6-OUT-03: Ingestion pipeline, economics linkage, dual-gate promotion,
-- delta escalation (W6-9), cloud-linked source refresh (W6-10)

-- Finance document ingestion pipeline
CREATE TABLE IF NOT EXISTS v8_finance_document_ingestions (
  ingestion_id            TEXT PRIMARY KEY,
  organization_id         TEXT NOT NULL,
  document_ref            TEXT NOT NULL,
  recognition_confidence  REAL CHECK (recognition_confidence IS NULL OR (recognition_confidence >= 0 AND recognition_confidence <= 1)),
  readiness_state         TEXT NOT NULL CHECK (readiness_state IN (
    'uploaded', 'recognized', 'confidence_assessed', 'ready', 'review_required'
  )),
  first_model_ref         TEXT,
  created_at              TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_fin_ingest_org
  ON v8_finance_document_ingestions(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_fin_ingest_state
  ON v8_finance_document_ingestions(readiness_state, organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_fin_ingest_doc
  ON v8_finance_document_ingestions(document_ref, organization_id);

-- Initiative economics linkages (finance-initiative bridge)
CREATE TABLE IF NOT EXISTS v8_initiative_economics_linkages (
  linkage_id        TEXT PRIMARY KEY,
  organization_id   TEXT NOT NULL,
  finance_model_ref TEXT NOT NULL,
  initiative_id     TEXT NOT NULL,
  linkage_type      TEXT NOT NULL CHECK (linkage_type IN (
    'budget', 'forecast', 'actual', 'variance'
  )),
  status            TEXT NOT NULL CHECK (status IN (
    'not_started', 'local_only', 'linked_to_finance_model',
    'linked_to_finance_scenario', 'linked_to_roi_tracking',
    'stale_vs_finance_model'
  )),
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_econ_link_org
  ON v8_initiative_economics_linkages(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_econ_link_initiative
  ON v8_initiative_economics_linkages(initiative_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_econ_link_finance
  ON v8_initiative_economics_linkages(finance_model_ref, organization_id);

-- Dual-gate promotion records (Decision W6-8)
CREATE TABLE IF NOT EXISTS v8_promotion_gates (
  gate_id                 TEXT PRIMARY KEY,
  organization_id         TEXT NOT NULL,
  source_artifact_ref     TEXT NOT NULL,
  target_initiative_id    TEXT NOT NULL,
  permission_gate_result  TEXT NOT NULL CHECK (permission_gate_result IN (
    'approved', 'rejected', 'review_required'
  )),
  quality_gate_result     TEXT NOT NULL CHECK (quality_gate_result IN (
    'approved', 'rejected', 'review_required'
  )),
  provenance_preserved    INTEGER NOT NULL DEFAULT 0,
  stale_state_checked     INTEGER NOT NULL DEFAULT 0,
  overall_result          TEXT NOT NULL CHECK (overall_result IN (
    'approved', 'rejected', 'review_required'
  )),
  created_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_promo_gate_org
  ON v8_promotion_gates(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_promo_gate_target
  ON v8_promotion_gates(target_initiative_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_promo_gate_source
  ON v8_promotion_gates(source_artifact_ref, organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_promo_gate_result
  ON v8_promotion_gates(overall_result, organization_id)
  WHERE overall_result IN ('rejected', 'review_required');

-- Unreconciled delta escalation (Decision W6-9)
CREATE TABLE IF NOT EXISTS v8_unreconciled_delta_escalations (
  escalation_id       TEXT PRIMARY KEY,
  organization_id     TEXT NOT NULL,
  initiative_id       TEXT NOT NULL,
  finance_ref         TEXT NOT NULL,
  delta_magnitude     REAL NOT NULL CHECK (delta_magnitude >= 0),
  delta_duration      INTEGER NOT NULL CHECK (delta_duration >= 0),
  materiality_level   TEXT NOT NULL CHECK (materiality_level IN (
    'low', 'medium', 'high', 'critical'
  )),
  escalated_to_cfo    INTEGER NOT NULL DEFAULT 0,
  threshold_breached  INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_delta_esc_org
  ON v8_unreconciled_delta_escalations(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_delta_esc_initiative
  ON v8_unreconciled_delta_escalations(initiative_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_delta_esc_cfo
  ON v8_unreconciled_delta_escalations(escalated_to_cfo, organization_id)
  WHERE escalated_to_cfo = 1;

-- Cloud-linked source refresh tracking (Decision W6-10)
CREATE TABLE IF NOT EXISTS v8_cloud_linked_source_refreshes (
  refresh_id            TEXT PRIMARY KEY,
  organization_id       TEXT NOT NULL,
  promoted_artifact_ref TEXT NOT NULL,
  source_model_ref      TEXT NOT NULL,
  source_updated_at     TEXT NOT NULL,
  stale_warning_shown   INTEGER NOT NULL DEFAULT 0,
  re_review_path        TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_src_refresh_org
  ON v8_cloud_linked_source_refreshes(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_src_refresh_artifact
  ON v8_cloud_linked_source_refreshes(promoted_artifact_ref, organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_src_refresh_source
  ON v8_cloud_linked_source_refreshes(source_model_ref, organization_id);
