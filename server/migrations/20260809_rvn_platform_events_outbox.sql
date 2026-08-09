-- RN-G1 Platform Foundation — event envelope + transactional outbox.
--
-- Design: docs/product/results-vnext/RN_G1_PLATFORM_DESIGN.md §A.
-- Three tables: event log (source of truth, immutable) / outbox (per-consumer
-- delivery queue) / projection checkpoints (replay position per read-model).
--
-- `aggregate_type` is intentionally WITHOUT a CHECK constraint — validated in
-- application code against the shared TS list (RVN_RESOURCE_TYPES /
-- CanonicalObjectTypeValues, see §C.3) instead. This avoids the fate of the
-- 3x-duplicated CHECK on v8_canonical_object_states (see
-- 20260809_rvn_platform_canonical_object_type_extend.sql).

CREATE TABLE IF NOT EXISTS rvn_platform_events (
  event_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence               BIGINT GENERATED ALWAYS AS IDENTITY,
  schema_version          SMALLINT NOT NULL DEFAULT 1,
  event_type              TEXT NOT NULL,
  aggregate_type           TEXT NOT NULL,
  aggregate_id            TEXT NOT NULL,
  organization_id          TEXT NOT NULL,
  actor_user_id            TEXT NULL,
  actor_effective_role       TEXT NOT NULL,
  command_id              UUID NOT NULL,
  correlation_id            UUID NOT NULL,
  causation_id             UUID NULL,
  occurred_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  policy_version            TEXT NOT NULL,
  before_state             JSONB NULL,
  after_state              JSONB NULL,
  state_hash              TEXT NOT NULL,
  reason                  TEXT NULL,
  evidence_refs             JSONB NOT NULL DEFAULT '[]',
  source                  TEXT NOT NULL,
  idempotency_key            TEXT NOT NULL,
  expected_version           INT NULL,
  resulting_version           INT NOT NULL,
  payload                 JSONB NOT NULL DEFAULT '{}'
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_rvn_events_idem ON rvn_platform_events(organization_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_rvn_events_aggregate ON rvn_platform_events(organization_id, aggregate_type, aggregate_id, sequence);
CREATE INDEX IF NOT EXISTS idx_rvn_events_occurred ON rvn_platform_events(organization_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_rvn_events_correlation ON rvn_platform_events(correlation_id);

-- Immutability is DB-level, not convention: revoke UPDATE/DELETE so a bug or
-- a careless script cannot mutate history after INSERT.
--
-- -- DEVIATION FROM DESIGN: the design asks to match "the existing per-table
-- REVOKE pattern in this repo, if any". A repo-wide search
-- (`grep -rn "REVOKE\|GRANT " server/migrations/`) found no per-table
-- REVOKE/GRANT DDL anywhere in server/migrations/ — only a commented-out
-- example (`-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES ...`) in
-- 043_multi_framework_assessments_complete.sql, and unrelated `grant_type`
-- data columns (CHECK IN ('GRANT','REVOKE')) in 048_content_module_permissions.sql
-- / 900_prod_missing_tables_hotfix.sql / org_user_permissions. There is no
-- named application DB role to target either (no `CREATE ROLE` /
-- `consultinity_app` grant found). Per the design doc's own fallback
-- instruction ("jeśli repo nie ma per-tabela REVOKE nigdzie indziej,
-- udokumentować to jako nowy wzorzec"), this migration establishes the
-- pattern by revoking from PUBLIC. If/when this repo adopts a named
-- least-privilege application role, replace PUBLIC below with that role name
-- — revoking from PUBLIC only removes the default "everyone" grant and does
-- NOT protect against a superuser/owner connection (the app currently
-- connects as table owner in every environment this was checked against).
REVOKE UPDATE, DELETE ON rvn_platform_events FROM PUBLIC;

CREATE TABLE IF NOT EXISTS rvn_platform_outbox (
  outbox_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES rvn_platform_events(event_id),
  consumer_group    TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','claimed','dispatched','failed','dead_letter')),
  attempts        INT NOT NULL DEFAULT 0,
  max_attempts      INT NOT NULL DEFAULT 8,
  next_attempt_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_by       TEXT NULL,
  claimed_at       TIMESTAMPTZ NULL,
  claim_expires_at   TIMESTAMPTZ NULL,
  dispatched_at     TIMESTAMPTZ NULL,
  last_error       TEXT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, consumer_group)
);

CREATE INDEX IF NOT EXISTS idx_rvn_outbox_poll ON rvn_platform_outbox(status, next_attempt_at)
  WHERE status IN ('pending','failed');

CREATE TABLE IF NOT EXISTS rvn_platform_projection_checkpoints (
  projection_name       TEXT NOT NULL,
  organization_id        TEXT NOT NULL,
  last_applied_sequence     BIGINT NOT NULL DEFAULT 0,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (projection_name, organization_id)
);
