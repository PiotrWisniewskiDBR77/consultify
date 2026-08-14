-- ═══════════════════════════════════════════════════════════════════════
-- KOLEJNOŚĆ: ten plik jest krokiem 1/4 rodziny `20260813_method_core_*`.
--
-- Numer w nazwie NIE jest ozdobą. Runner (`server/scripts/migrate.postgres.ts`,
-- `compareMigrationOrder`) sortuje pliki o tej samej dacie LEKSYKALNIE po nazwie.
-- Bez tego numeru kolejność była: http_idempotency → kernel → demo_status →
-- outputs, czyli KONSUMENT PRZED PRODUCENTEM w dwóch miejscach naraz:
--   • `..._http_idempotency` ma FK do `method_sessions`, którą tworzy `..._kernel`
--   • `..._demo_status` robi ALTER na `method_outputs`, którą tworzy `..._outputs`
--
-- Skutek: instalacja OD ZERA padała na
-- `relation "method_sessions" does not exist`. Biegi przyrostowe tego NIE
-- pokazywały, bo każdy plik dochodził osobno, już po swoim producencie.
--
-- Dodając kolejny plik do tej rodziny — nadaj mu następny numer.
-- ═══════════════════════════════════════════════════════════════════════

-- Shared Method Kernel — runtime tables (Method Assessment Core, agent A2).
--
-- Method-agnostic persistence layer behind src/method-core/contracts/*.
-- Assessment, Tools and Audits all read/write through these tables via the
-- kernel services in server/src/method-core/ — no DRD/SIRI/ADMA rule lives
-- here, only the shared shape.
--
-- Fully additive + idempotent: only CREATE TABLE IF NOT EXISTS and
-- CREATE INDEX IF NOT EXISTS. No DROP, no ALTER of existing columns, no
-- DELETE. Safe to re-run on a shared database.
--
-- Every table is org-scoped (organization_id NOT NULL, FK to organizations).

-- ---------------------------------------------------------------------------
-- method_packs — registry of compiled Method Packs (DRD/SIRI/ADMA/... live
-- as data here, never as kernel code).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS method_packs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  pack_id TEXT NOT NULL,
  version TEXT NOT NULL,
  name TEXT NOT NULL,
  readiness TEXT NOT NULL DEFAULT 'draft',
  licence_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  manifest_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, pack_id, version)
);

CREATE INDEX IF NOT EXISTS ix_method_packs_org ON method_packs(organization_id);

-- ---------------------------------------------------------------------------
-- method_sessions — one state machine, three front doors (assessment /
-- tools / audits). See src/method-core/contracts/session.ts for the closed
-- transition table this row's `state` must obey.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS method_sessions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT,
  module TEXT NOT NULL CHECK (module IN ('assessment', 'tools', 'audits')),
  method_pack_id TEXT NOT NULL,
  method_pack_version TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'draft',
  domain_stage TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('guided_manual', 'teresa_led')),
  owner_user_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  frozen_snapshot_id TEXT,
  revision_of_session_id TEXT REFERENCES method_sessions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_method_sessions_org ON method_sessions(organization_id);
CREATE INDEX IF NOT EXISTS ix_method_sessions_project ON method_sessions(project_id);
CREATE INDEX IF NOT EXISTS ix_method_sessions_revision_of ON method_sessions(revision_of_session_id);

-- ---------------------------------------------------------------------------
-- method_session_roles — process roles layered on top of app/project roles.
-- The kernel never builds its own people directory; it only records who
-- holds which process role on which session.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS method_session_roles (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES method_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (session_id, user_id, role)
);

CREATE INDEX IF NOT EXISTS ix_method_session_roles_session ON method_session_roles(session_id);
CREATE INDEX IF NOT EXISTS ix_method_session_roles_user ON method_session_roles(user_id);

-- ---------------------------------------------------------------------------
-- method_events — the append-only 18-event work chain. Nothing here is ever
-- UPDATEd or DELETEd by the kernel; a correction is a new row that carries
-- `supersedes`. Idempotent replay is enforced by the partial unique index
-- below (same session + same idempotency key -> at most one row).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS method_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES method_sessions(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  unit_id TEXT,
  level INTEGER,
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('human', 'teresa', 'system')),
  actor_user_id TEXT,
  method_pack_version TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  supersedes TEXT,
  idempotency_key TEXT,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS ix_method_events_session ON method_events(session_id);
CREATE INDEX IF NOT EXISTS ix_method_events_org ON method_events(organization_id);
CREATE INDEX IF NOT EXISTS ix_method_events_supersedes ON method_events(supersedes);

-- Idempotency: replaying the same (session, idempotency_key) must resolve to
-- the SAME row, never a second one. Partial index because most events carry
-- no idempotency key at all.
CREATE UNIQUE INDEX IF NOT EXISTS ux_method_events_session_idempotency
  ON method_events(session_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ---------------------------------------------------------------------------
-- method_evidence — evidence ladder E0..E4, independent of level fulfilment
-- and of assessor confidence (ASSESSMENT_EVIDENCE_AND_SCORING_CONTRACT.md §5).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS method_evidence (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES method_sessions(id) ON DELETE CASCADE,
  unit_id TEXT,
  evidence_type TEXT NOT NULL,
  strength TEXT NOT NULL CHECK (strength IN ('E0', 'E1', 'E2', 'E3', 'E4')),
  title TEXT,
  source TEXT,
  locator TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  observed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_method_evidence_session ON method_evidence(session_id);
CREATE INDEX IF NOT EXISTS ix_method_evidence_unit ON method_evidence(unit_id);

-- ---------------------------------------------------------------------------
-- method_teresa_previews — Step 2 of Intent -> Preview -> Commit -> Settle.
-- A commit (see MethodCommitRequest) always resolves through this table;
-- `consumed_at`/`consumed_by` enforce single-use, `expires_at` enforces the
-- staleness window.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS method_teresa_previews (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES method_sessions(id) ON DELETE CASCADE,
  capability_id TEXT NOT NULL,
  intent_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  preview_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  quality_verdict TEXT NOT NULL CHECK (quality_verdict IN ('valid', 'needs_human_review', 'invalid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  consumed_by TEXT
);

CREATE INDEX IF NOT EXISTS ix_method_teresa_previews_session ON method_teresa_previews(session_id);

-- ---------------------------------------------------------------------------
-- method_snapshots — immutable payload captured on freeze. Reopening a
-- frozen session (frozen -> active) must never mutate a row here; it only
-- ever adds a new session revision that points at a fresh snapshot later.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS method_snapshots (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES method_sessions(id) ON DELETE CASCADE,
  method_pack_version TEXT NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_method_snapshots_session ON method_snapshots(session_id);
