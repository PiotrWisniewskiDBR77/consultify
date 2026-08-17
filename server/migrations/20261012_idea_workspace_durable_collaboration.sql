-- IDEA-WORKSPACE-SUBPACKET-001: durable, tenant-scoped collaboration leases.
-- Presence/cursors remain ephemeral; edit exclusion and fencing are database truth.

CREATE TABLE IF NOT EXISTS idea_workspace_node_locks (
  organization_id TEXT NOT NULL,
  idea_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  holder_user_id TEXT NOT NULL,
  lease_owner TEXT NOT NULL,
  fencing_token BIGINT NOT NULL DEFAULT 1 CHECK (fencing_token > 0),
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, idea_id, node_id),
  CHECK (expires_at > acquired_at)
);

CREATE INDEX IF NOT EXISTS idx_idea_workspace_node_locks_expiry
  ON idea_workspace_node_locks (expires_at);

CREATE OR REPLACE FUNCTION enforce_idea_workspace_lock_tenant()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM my_ideas
    WHERE id = NEW.idea_id AND organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'idea workspace lock tenant mismatch';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_idea_workspace_node_locks_tenant ON idea_workspace_node_locks;
CREATE TRIGGER trg_idea_workspace_node_locks_tenant
BEFORE INSERT OR UPDATE ON idea_workspace_node_locks
FOR EACH ROW EXECUTE FUNCTION enforce_idea_workspace_lock_tenant();

CREATE TABLE IF NOT EXISTS idea_workspace_lock_events (
  id BIGSERIAL PRIMARY KEY,
  organization_id TEXT NOT NULL,
  idea_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  lease_owner TEXT NOT NULL,
  fencing_token BIGINT NOT NULL CHECK (fencing_token > 0),
  event_type TEXT NOT NULL CHECK (event_type IN ('ACQUIRED', 'RECLAIMED', 'RENEWED', 'RELEASED', 'FENCE_REJECTED')),
  correlation_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_idea_workspace_lock_events_scope
  ON idea_workspace_lock_events (organization_id, idea_id, node_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_idea_workspace_lock_events_tenant ON idea_workspace_lock_events;
CREATE TRIGGER trg_idea_workspace_lock_events_tenant
BEFORE INSERT ON idea_workspace_lock_events
FOR EACH ROW EXECUTE FUNCTION enforce_idea_workspace_lock_tenant();

CREATE OR REPLACE FUNCTION deny_idea_workspace_lock_event_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'idea_workspace_lock_events is append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_idea_workspace_lock_events_append_only ON idea_workspace_lock_events;
CREATE TRIGGER trg_idea_workspace_lock_events_append_only
BEFORE UPDATE OR DELETE ON idea_workspace_lock_events
FOR EACH ROW EXECUTE FUNCTION deny_idea_workspace_lock_event_mutation();
