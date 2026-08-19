-- FLOW-TRANSFORM-MVP-001: immutable source -> canonical Candidate receipts.
-- Additive only. The Candidate authority remains initiative_candidates.

CREATE TABLE IF NOT EXISTS organization_snapshot_candidate_handoffs (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL,
  snapshot_id text NOT NULL,
  snapshot_version integer NOT NULL CHECK (snapshot_version > 0),
  snapshot_content_hash text NOT NULL CHECK (snapshot_content_hash ~ '^[0-9a-f]{64}$'),
  candidate_id text NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, snapshot_id),
  UNIQUE (organization_id, snapshot_version),
  UNIQUE (organization_id, candidate_id)
);

ALTER TABLE interview_candidate_handoffs
  ADD COLUMN IF NOT EXISTS snapshot_content_hash text;
ALTER TABLE interview_candidate_handoffs
  ADD COLUMN IF NOT EXISTS source_version text;

ALTER TABLE assessment_candidate_handoffs
  ADD COLUMN IF NOT EXISTS snapshot_content_hash text;
ALTER TABLE assessment_candidate_handoffs
  ADD COLUMN IF NOT EXISTS source_version text;

ALTER TABLE interview_candidate_handoffs
  DROP CONSTRAINT IF EXISTS ck_interview_candidate_handoff_lineage;
ALTER TABLE interview_candidate_handoffs
  ADD CONSTRAINT ck_interview_candidate_handoff_lineage CHECK (
    (snapshot_content_hash IS NULL AND source_version IS NULL)
    OR (snapshot_content_hash ~ '^[0-9a-f]{64}$' AND length(source_version) > 0)
  );

ALTER TABLE assessment_candidate_handoffs
  DROP CONSTRAINT IF EXISTS ck_assessment_candidate_handoff_lineage;
ALTER TABLE assessment_candidate_handoffs
  ADD CONSTRAINT ck_assessment_candidate_handoff_lineage CHECK (
    (snapshot_content_hash IS NULL AND source_version IS NULL)
    OR (snapshot_content_hash ~ '^[0-9a-f]{64}$' AND length(source_version) > 0)
  );

CREATE OR REPLACE FUNCTION deny_flow_source_receipt_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'FLOW_SOURCE_RECEIPT_IMMUTABLE' USING ERRCODE = '23514';
END;
$$;

DROP TRIGGER IF EXISTS trg_org_snapshot_candidate_handoff_immutable ON organization_snapshot_candidate_handoffs;
CREATE TRIGGER trg_org_snapshot_candidate_handoff_immutable
BEFORE UPDATE OR DELETE ON organization_snapshot_candidate_handoffs
FOR EACH ROW EXECUTE FUNCTION deny_flow_source_receipt_mutation();

DROP TRIGGER IF EXISTS trg_interview_candidate_handoff_immutable ON interview_candidate_handoffs;
CREATE TRIGGER trg_interview_candidate_handoff_immutable
BEFORE UPDATE OR DELETE ON interview_candidate_handoffs
FOR EACH ROW EXECUTE FUNCTION deny_flow_source_receipt_mutation();

DROP TRIGGER IF EXISTS trg_assessment_candidate_handoff_immutable ON assessment_candidate_handoffs;
CREATE TRIGGER trg_assessment_candidate_handoff_immutable
BEFORE UPDATE OR DELETE ON assessment_candidate_handoffs
FOR EACH ROW EXECUTE FUNCTION deny_flow_source_receipt_mutation();

CREATE TABLE IF NOT EXISTS flow_transform_lineage_receipts (
  receipt_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL,
  source_kind text NOT NULL CHECK (source_kind IN ('organization','interview','drd','swot')),
  source_receipt_id text NOT NULL,
  source_version text NOT NULL,
  source_content_hash text NOT NULL,
  candidate_id text NOT NULL,
  initiative_id text NOT NULL,
  execution_link_id uuid NOT NULL,
  results_case_id uuid NOT NULL,
  results_actual_snapshot_id uuid NOT NULL,
  finance_reconciliation_id uuid NOT NULL,
  finance_decision_id uuid NOT NULL,
  pir_id uuid NOT NULL,
  correlation_id uuid NOT NULL,
  identity_digest text NOT NULL CHECK (identity_digest ~ '^[0-9a-f]{64}$'),
  certified_by text NOT NULL,
  certified_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, source_kind, source_receipt_id),
  UNIQUE (organization_id, identity_digest),
  UNIQUE (organization_id, correlation_id)
);

DROP TRIGGER IF EXISTS trg_flow_transform_lineage_receipt_immutable ON flow_transform_lineage_receipts;
CREATE TRIGGER trg_flow_transform_lineage_receipt_immutable
BEFORE UPDATE OR DELETE ON flow_transform_lineage_receipts
FOR EACH ROW EXECUTE FUNCTION deny_flow_source_receipt_mutation();
