-- CHAT-BVP-TARGET-MAPPINGS-002: durable owner execution state for approved
-- chat handoffs. The target itself is always written by its canonical owner.
CREATE TABLE IF NOT EXISTS chat_target_mapping_receipts (
  ingress_id TEXT PRIMARY KEY REFERENCES chat_handoff_owner_ingress(ingress_id) ON DELETE RESTRICT,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  target_kind TEXT NOT NULL CHECK (target_kind IN ('document','presentation','workbook','artifact_origin')),
  command_schema_version TEXT NOT NULL,
  request_digest TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','running','succeeded','failed')),
  lease_token TEXT,
  lease_owner TEXT,
  lease_expires_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  target_record_id TEXT,
  target_version TEXT,
  output_digest TEXT,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((state = 'succeeded' AND target_record_id IS NOT NULL AND output_digest IS NOT NULL)
      OR state <> 'succeeded')
);
CREATE INDEX IF NOT EXISTS idx_chat_target_mapping_available
  ON chat_target_mapping_receipts(organization_id, state, lease_expires_at);

CREATE TABLE IF NOT EXISTS chat_target_mapping_attempts (
  attempt_id TEXT PRIMARY KEY,
  ingress_id TEXT NOT NULL REFERENCES chat_target_mapping_receipts(ingress_id) ON DELETE RESTRICT,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  lease_token TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('claimed','succeeded','failed','reclaimed')),
  detail_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION protect_chat_target_mapping_attempts() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'chat_target_mapping_attempts rows are append-only'; END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_chat_target_mapping_attempts_append_only ON chat_target_mapping_attempts;
CREATE TRIGGER trg_chat_target_mapping_attempts_append_only BEFORE UPDATE OR DELETE
ON chat_target_mapping_attempts FOR EACH ROW EXECUTE FUNCTION protect_chat_target_mapping_attempts();
