-- CHAT-BVP-001: neutral, restart-safe delivery seam from approved Chat
-- proposals to the owner of the selected artifact kind. This table stores
-- the exact approved envelope; it deliberately does not create a document,
-- presentation, workbook or material row.

CREATE TABLE IF NOT EXISTS chat_handoff_owner_ingress (
  ingress_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  proposal_id TEXT NOT NULL REFERENCES artifact_handoff_proposals(proposal_id) ON DELETE RESTRICT,
  target_kind TEXT NOT NULL CHECK (target_kind IN ('document','presentation','workbook','material')),
  contract_version TEXT NOT NULL,
  source_version INTEGER NOT NULL CHECK (source_version > 0),
  source_content_hash TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  delivered_by TEXT NOT NULL,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, proposal_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_handoff_owner_ingress_available
  ON chat_handoff_owner_ingress (organization_id, target_kind, delivered_at, ingress_id);

CREATE TABLE IF NOT EXISTS chat_handoff_owner_claims (
  ingress_id TEXT PRIMARY KEY REFERENCES chat_handoff_owner_ingress(ingress_id) ON DELETE RESTRICT,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  claim_token TEXT NOT NULL,
  claimed_by TEXT NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lease_expires_at TIMESTAMPTZ NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 1 CHECK (attempt_count > 0),
  consumed_at TIMESTAMPTZ,
  handoff_receipt_id TEXT REFERENCES artifact_handoff_receipts(receipt_id) ON DELETE RESTRICT,
  CHECK ((consumed_at IS NULL AND handoff_receipt_id IS NULL)
      OR (consumed_at IS NOT NULL AND handoff_receipt_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_chat_handoff_owner_claims_lease
  ON chat_handoff_owner_claims (organization_id, lease_expires_at)
  WHERE consumed_at IS NULL;

CREATE OR REPLACE FUNCTION protect_chat_handoff_owner_ingress()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'chat_handoff_owner_ingress rows are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chat_handoff_owner_ingress_immutable
  ON chat_handoff_owner_ingress;
CREATE TRIGGER trg_chat_handoff_owner_ingress_immutable
  BEFORE UPDATE OR DELETE ON chat_handoff_owner_ingress
  FOR EACH ROW EXECUTE FUNCTION protect_chat_handoff_owner_ingress();
