-- ORG-BVP-001: immutable receipt proving which governed organization-context
-- snapshot a Chat/Idea proposal consumed. Existing proposal paths are not
-- rewritten; new governed paths must persist an exact snapshot id/version/hash.

CREATE TABLE IF NOT EXISTS organization_context_consumer_bindings (
  binding_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  consumer_kind TEXT NOT NULL CHECK (consumer_kind IN ('chat','idea')),
  consumer_record_id TEXT NOT NULL,
  proposal_id TEXT NOT NULL REFERENCES artifact_handoff_proposals(proposal_id) ON DELETE RESTRICT,
  snapshot_id TEXT NOT NULL,
  snapshot_version INTEGER NOT NULL CHECK (snapshot_version > 0),
  snapshot_content_hash TEXT NOT NULL CHECK (length(snapshot_content_hash) = 64),
  proposal_source_hash TEXT NOT NULL CHECK (length(proposal_source_hash) = 64),
  bound_by TEXT NOT NULL,
  bound_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, proposal_id)
);

CREATE INDEX IF NOT EXISTS idx_org_context_consumer_binding_snapshot
  ON organization_context_consumer_bindings
  (organization_id, snapshot_id, snapshot_version, consumer_kind);

CREATE OR REPLACE FUNCTION protect_org_context_consumer_binding()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'organization_context_consumer_bindings rows are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_org_context_consumer_binding_immutable
  ON organization_context_consumer_bindings;
CREATE TRIGGER trg_org_context_consumer_binding_immutable
  BEFORE UPDATE OR DELETE ON organization_context_consumer_bindings
  FOR EACH ROW EXECUTE FUNCTION protect_org_context_consumer_binding();

