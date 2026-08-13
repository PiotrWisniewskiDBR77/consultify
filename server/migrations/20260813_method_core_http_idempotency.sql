-- Shared Method Kernel — HTTP layer idempotency for session creation (P0).
--
-- `MethodEventStore.append` already gives `POST .../events` and the freeze
-- flow session-scoped idempotency via `method_events`' partial unique index.
-- `POST /api/method/sessions` (create) has no session row to key off of yet
-- when the SAME Idempotency-Key is replayed — this tiny table is that
-- pre-session anchor: (organization_id, idempotency_key) -> the session that
-- request actually created. A replay looks itself up here first and returns
-- the ALREADY-CREATED session instead of calling MethodSessionService again.
--
-- Fully additive + idempotent, matching 20260813_method_core_kernel.sql's
-- convention: only CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS method_session_create_idempotency (
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  session_id TEXT NOT NULL REFERENCES method_sessions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (organization_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS ix_method_session_create_idempotency_session
  ON method_session_create_idempotency(session_id);
