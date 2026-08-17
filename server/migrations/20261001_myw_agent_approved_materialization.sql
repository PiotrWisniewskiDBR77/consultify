CREATE TABLE IF NOT EXISTS myw_agent_materialization_proposals (
  proposal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  requester_id TEXT NOT NULL REFERENCES users(id),
  source_plan_id TEXT NOT NULL,
  source_version BIGINT NOT NULL CHECK (source_version > 0),
  source_hash TEXT NOT NULL CHECK (source_hash ~ '^[0-9a-f]{64}$'),
  target_kind TEXT NOT NULL CHECK (target_kind IN ('task','decision','notebook')),
  content JSONB NOT NULL,
  content_hash TEXT NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  idempotency_key TEXT NOT NULL,
  request_digest TEXT NOT NULL CHECK (request_digest ~ '^[0-9a-f]{64}$'),
  state TEXT NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING','APPROVED','REJECTED','EXPIRED','MATERIALIZED')),
  state_version INTEGER NOT NULL DEFAULT 1 CHECK (state_version > 0),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS myw_agent_materialization_approvals (
  approval_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL UNIQUE REFERENCES myw_agent_materialization_proposals(proposal_id),
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  approver_id TEXT NOT NULL REFERENCES users(id),
  decision TEXT NOT NULL CHECK (decision IN ('APPROVE','REJECT')),
  proposal_state_version INTEGER NOT NULL,
  source_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS myw_agent_materialization_receipts (
  receipt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL UNIQUE REFERENCES myw_agent_materialization_proposals(proposal_id),
  approval_id UUID NOT NULL UNIQUE REFERENCES myw_agent_materialization_approvals(approval_id),
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  target_kind TEXT NOT NULL CHECK (target_kind IN ('task','decision','notebook')),
  target_id TEXT,
  source_hash TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  command_version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','RUNNING','SUCCEEDED','FAILED')),
  output_digest TEXT,
  last_error_code TEXT,
  lease_owner TEXT,
  lease_expires_at TIMESTAMPTZ,
  materialized_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_myw_agent_materialized_target
  ON myw_agent_materialization_receipts(target_kind,target_id) WHERE target_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_decisions_org_idempotency
  ON decisions(organization_id,idempotency_key) WHERE idempotency_key IS NOT NULL;
ALTER TABLE notebook_pages ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE notebook_pages ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE notebook_pages ADD COLUMN IF NOT EXISTS source_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_notebook_pages_org_idempotency
  ON notebook_pages(organization_id,idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION myw_agent_proposal_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'myw_agent_materialization_proposal_is_append_only';
  END IF;
  IF OLD.organization_id IS DISTINCT FROM NEW.organization_id
     OR OLD.requester_id IS DISTINCT FROM NEW.requester_id
     OR OLD.source_plan_id IS DISTINCT FROM NEW.source_plan_id
     OR OLD.source_version IS DISTINCT FROM NEW.source_version
     OR OLD.source_hash IS DISTINCT FROM NEW.source_hash
     OR OLD.target_kind IS DISTINCT FROM NEW.target_kind
     OR OLD.content IS DISTINCT FROM NEW.content
     OR OLD.content_hash IS DISTINCT FROM NEW.content_hash
     OR OLD.idempotency_key IS DISTINCT FROM NEW.idempotency_key
     OR OLD.request_digest IS DISTINCT FROM NEW.request_digest
     OR OLD.expires_at IS DISTINCT FROM NEW.expires_at THEN
    RAISE EXCEPTION 'myw_agent_materialization_proposal_payload_is_immutable';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_myw_agent_proposal_guard ON myw_agent_materialization_proposals;
CREATE TRIGGER trg_myw_agent_proposal_guard BEFORE UPDATE OR DELETE ON myw_agent_materialization_proposals
FOR EACH ROW EXECUTE FUNCTION myw_agent_proposal_guard();

CREATE OR REPLACE FUNCTION myw_agent_append_only_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'myw_agent_materialization_record_is_append_only'; END $$;

DROP TRIGGER IF EXISTS trg_myw_agent_approval_append_only ON myw_agent_materialization_approvals;
CREATE TRIGGER trg_myw_agent_approval_append_only BEFORE UPDATE OR DELETE ON myw_agent_materialization_approvals
FOR EACH ROW EXECUTE FUNCTION myw_agent_append_only_guard();
CREATE OR REPLACE FUNCTION myw_agent_receipt_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' OR OLD.proposal_id IS DISTINCT FROM NEW.proposal_id
    OR OLD.approval_id IS DISTINCT FROM NEW.approval_id OR OLD.organization_id IS DISTINCT FROM NEW.organization_id
    OR OLD.target_kind IS DISTINCT FROM NEW.target_kind OR OLD.source_hash IS DISTINCT FROM NEW.source_hash
    OR OLD.content_hash IS DISTINCT FROM NEW.content_hash OR OLD.command_version IS DISTINCT FROM NEW.command_version
    OR OLD.materialized_by IS DISTINCT FROM NEW.materialized_by OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'myw_agent_materialization_receipt_payload_is_append_only';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_myw_agent_receipt_append_only ON myw_agent_materialization_receipts;
CREATE TRIGGER trg_myw_agent_receipt_append_only BEFORE UPDATE OR DELETE ON myw_agent_materialization_receipts
FOR EACH ROW EXECUTE FUNCTION myw_agent_receipt_guard();
