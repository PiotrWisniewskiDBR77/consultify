-- IDEA-WORKSPACE-SUBPACKET-001: durable, tenant-scoped collaboration leases.
-- Presence/cursors remain ephemeral; edit exclusion and fencing are database truth.

-- Fail before the first mutation when a non-empty partial install cannot be
-- reconciled deterministically. Optional timestamp/id columns are additive;
-- identity/fencing columns must already be complete and any PK must have the
-- exact tenant/idea/node order.
DO $$
DECLARE
  rel REGCLASS;
  present_count INTEGER;
  pk_columns TEXT[];
  types_ok BOOLEAN;
BEGIN
  rel := to_regclass('idea_workspace_node_locks');
  IF rel IS NOT NULL THEN
    SELECT count(*) INTO present_count FROM pg_attribute
    WHERE attrelid=rel AND NOT attisdropped AND attname = ANY(ARRAY[
      'organization_id','idea_id','node_id','holder_user_id','lease_owner','fencing_token','acquired_at','expires_at'
    ]);
    IF EXISTS (SELECT 1 FROM idea_workspace_node_locks LIMIT 1) AND present_count <> 8 THEN
      RAISE EXCEPTION 'IDEA_WORKSPACE_LATE_PREFLIGHT: lock identity columns missing';
    END IF;
    SELECT count(a.attname)=8 AND COALESCE(bool_and(format_type(a.atttypid,a.atttypmod)=expected.typ),FALSE)
      INTO types_ok
    FROM (VALUES
      ('organization_id','text'),('idea_id','text'),('node_id','text'),('holder_user_id','text'),
      ('lease_owner','text'),('fencing_token','bigint'),('acquired_at','timestamp with time zone'),
      ('expires_at','timestamp with time zone')
    ) expected(name,typ)
    LEFT JOIN pg_attribute a ON a.attrelid=rel AND a.attname=expected.name AND NOT a.attisdropped;
    IF NOT types_ok THEN RAISE EXCEPTION 'IDEA_WORKSPACE_LATE_PREFLIGHT: lock identity column types incompatible'; END IF;
    IF present_count = 8 AND EXISTS (
      SELECT 1 FROM idea_workspace_node_locks WHERE organization_id IS NULL OR idea_id IS NULL OR
        node_id IS NULL OR holder_user_id IS NULL OR lease_owner IS NULL OR fencing_token IS NULL OR
        acquired_at IS NULL OR expires_at IS NULL LIMIT 1
    ) THEN RAISE EXCEPTION 'IDEA_WORKSPACE_LATE_PREFLIGHT: lock identity contains NULL'; END IF;
    SELECT array_agg(a.attname ORDER BY key.ordinality) INTO pk_columns
    FROM pg_constraint c CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY key(attnum, ordinality)
    JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=key.attnum
    WHERE c.conrelid=rel AND c.contype='p';
    IF pk_columns IS NOT NULL AND pk_columns <> ARRAY['organization_id','idea_id','node_id']::TEXT[] THEN
      RAISE EXCEPTION 'IDEA_WORKSPACE_LATE_PREFLIGHT: lock PK must be (organization_id,idea_id,node_id)';
    END IF;
  END IF;

  rel := to_regclass('idea_workspace_lock_events');
  IF rel IS NOT NULL THEN
    SELECT count(*) INTO present_count FROM pg_attribute
    WHERE attrelid=rel AND NOT attisdropped AND attname = ANY(ARRAY[
      'organization_id','idea_id','node_id','actor_user_id','lease_owner','fencing_token','event_type','correlation_id'
    ]);
    IF EXISTS (SELECT 1 FROM idea_workspace_lock_events LIMIT 1) AND present_count <> 8 THEN
      RAISE EXCEPTION 'IDEA_WORKSPACE_LATE_PREFLIGHT: event identity columns missing';
    END IF;
    SELECT count(a.attname)=8 AND COALESCE(bool_and(format_type(a.atttypid,a.atttypmod)=expected.typ),FALSE)
      INTO types_ok
    FROM (VALUES
      ('organization_id','text'),('idea_id','text'),('node_id','text'),('actor_user_id','text'),
      ('lease_owner','text'),('fencing_token','bigint'),('event_type','text'),('correlation_id','text')
    ) expected(name,typ)
    LEFT JOIN pg_attribute a ON a.attrelid=rel AND a.attname=expected.name AND NOT a.attisdropped;
    IF NOT types_ok THEN RAISE EXCEPTION 'IDEA_WORKSPACE_LATE_PREFLIGHT: event identity column types incompatible'; END IF;
    IF present_count = 8 AND EXISTS (
      SELECT 1 FROM idea_workspace_lock_events WHERE organization_id IS NULL OR idea_id IS NULL OR
        node_id IS NULL OR actor_user_id IS NULL OR lease_owner IS NULL OR fencing_token IS NULL OR
        event_type IS NULL OR correlation_id IS NULL LIMIT 1
    ) THEN RAISE EXCEPTION 'IDEA_WORKSPACE_LATE_PREFLIGHT: event identity contains NULL'; END IF;
    SELECT array_agg(a.attname ORDER BY key.ordinality) INTO pk_columns
    FROM pg_constraint c CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY key(attnum, ordinality)
    JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=key.attnum
    WHERE c.conrelid=rel AND c.contype='p';
    IF pk_columns IS NOT NULL AND pk_columns <> ARRAY['id']::TEXT[] THEN
      RAISE EXCEPTION 'IDEA_WORKSPACE_LATE_PREFLIGHT: event PK must be (id)';
    END IF;
  END IF;
END $$;

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

-- Late-safe reconciliation: a partially-created table must converge to the
-- same contract as a fresh install before indexes/triggers are installed.
ALTER TABLE idea_workspace_node_locks ADD COLUMN IF NOT EXISTS organization_id TEXT;
ALTER TABLE idea_workspace_node_locks ADD COLUMN IF NOT EXISTS idea_id TEXT;
ALTER TABLE idea_workspace_node_locks ADD COLUMN IF NOT EXISTS node_id TEXT;
ALTER TABLE idea_workspace_node_locks ADD COLUMN IF NOT EXISTS holder_user_id TEXT;
ALTER TABLE idea_workspace_node_locks ADD COLUMN IF NOT EXISTS lease_owner TEXT;
ALTER TABLE idea_workspace_node_locks ADD COLUMN IF NOT EXISTS fencing_token BIGINT DEFAULT 1;
ALTER TABLE idea_workspace_node_locks ADD COLUMN IF NOT EXISTS acquired_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE idea_workspace_node_locks ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE idea_workspace_node_locks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE idea_workspace_node_locks ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE idea_workspace_node_locks ALTER COLUMN idea_id SET NOT NULL;
ALTER TABLE idea_workspace_node_locks ALTER COLUMN node_id SET NOT NULL;
ALTER TABLE idea_workspace_node_locks ALTER COLUMN holder_user_id SET NOT NULL;
ALTER TABLE idea_workspace_node_locks ALTER COLUMN lease_owner SET NOT NULL;
ALTER TABLE idea_workspace_node_locks ALTER COLUMN fencing_token SET NOT NULL;
ALTER TABLE idea_workspace_node_locks ALTER COLUMN acquired_at SET NOT NULL;
ALTER TABLE idea_workspace_node_locks ALTER COLUMN expires_at SET NOT NULL;
ALTER TABLE idea_workspace_node_locks ALTER COLUMN updated_at SET NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='idea_workspace_node_locks'::regclass AND contype='p'
  ) THEN
    ALTER TABLE idea_workspace_node_locks ADD CONSTRAINT idea_workspace_node_locks_scope_pk
      PRIMARY KEY (organization_id, idea_id, node_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='idea_workspace_node_locks'::regclass AND conname='idea_workspace_node_locks_fence_positive') THEN
    ALTER TABLE idea_workspace_node_locks ADD CONSTRAINT idea_workspace_node_locks_fence_positive
      CHECK (fencing_token > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='idea_workspace_node_locks'::regclass AND conname='idea_workspace_node_locks_valid_window') THEN
    ALTER TABLE idea_workspace_node_locks ADD CONSTRAINT idea_workspace_node_locks_valid_window
      CHECK (expires_at > acquired_at);
  END IF;
END $$;

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

ALTER TABLE idea_workspace_lock_events ADD COLUMN IF NOT EXISTS id BIGSERIAL;
ALTER TABLE idea_workspace_lock_events ADD COLUMN IF NOT EXISTS organization_id TEXT;
ALTER TABLE idea_workspace_lock_events ADD COLUMN IF NOT EXISTS idea_id TEXT;
ALTER TABLE idea_workspace_lock_events ADD COLUMN IF NOT EXISTS node_id TEXT;
ALTER TABLE idea_workspace_lock_events ADD COLUMN IF NOT EXISTS actor_user_id TEXT;
ALTER TABLE idea_workspace_lock_events ADD COLUMN IF NOT EXISTS lease_owner TEXT;
ALTER TABLE idea_workspace_lock_events ADD COLUMN IF NOT EXISTS fencing_token BIGINT;
ALTER TABLE idea_workspace_lock_events ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE idea_workspace_lock_events ADD COLUMN IF NOT EXISTS correlation_id TEXT;
ALTER TABLE idea_workspace_lock_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE idea_workspace_lock_events ALTER COLUMN id SET NOT NULL;
ALTER TABLE idea_workspace_lock_events ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE idea_workspace_lock_events ALTER COLUMN idea_id SET NOT NULL;
ALTER TABLE idea_workspace_lock_events ALTER COLUMN node_id SET NOT NULL;
ALTER TABLE idea_workspace_lock_events ALTER COLUMN actor_user_id SET NOT NULL;
ALTER TABLE idea_workspace_lock_events ALTER COLUMN lease_owner SET NOT NULL;
ALTER TABLE idea_workspace_lock_events ALTER COLUMN fencing_token SET NOT NULL;
ALTER TABLE idea_workspace_lock_events ALTER COLUMN event_type SET NOT NULL;
ALTER TABLE idea_workspace_lock_events ALTER COLUMN correlation_id SET NOT NULL;
ALTER TABLE idea_workspace_lock_events ALTER COLUMN created_at SET NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='idea_workspace_lock_events'::regclass AND contype='p'
  ) THEN
    ALTER TABLE idea_workspace_lock_events ADD CONSTRAINT idea_workspace_lock_events_pk PRIMARY KEY (id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='idea_workspace_lock_events'::regclass AND conname='idea_workspace_lock_events_fence_positive') THEN
    ALTER TABLE idea_workspace_lock_events ADD CONSTRAINT idea_workspace_lock_events_fence_positive CHECK (fencing_token > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='idea_workspace_lock_events'::regclass AND conname='idea_workspace_lock_events_type_valid') THEN
    ALTER TABLE idea_workspace_lock_events ADD CONSTRAINT idea_workspace_lock_events_type_valid
      CHECK (event_type IN ('ACQUIRED','RECLAIMED','RENEWED','RELEASED','FENCE_REJECTED'));
  END IF;
END $$;

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

-- Retention/orphan policy: active leases remain available for fencing and
-- reclaim; only expired rows older than 24h or rows whose idea no longer
-- exists are safe to remove. This is intentionally bounded to lock state;
-- append-only audit events are retained.
DELETE FROM idea_workspace_node_locks lock_row
WHERE lock_row.expires_at < NOW() - INTERVAL '24 hours'
   OR NOT EXISTS (
     SELECT 1 FROM my_ideas idea
     WHERE idea.id=lock_row.idea_id AND idea.organization_id=lock_row.organization_id
   );
