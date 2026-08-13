-- OKR-E002 — Materialized Set schema.
--
-- Design: docs/product/results-vnext/OKR_E002_DESIGN.md §3.
-- Builds on OKR-E001's server/migrations/20260822_rvn_okr_program_cycle.sql
-- (okr_vnext_programs/okr_vnext_cycles), re-verified against that file's
-- actual landed columns before writing this migration (design doc's own
-- standing re-verification requirement).
--
-- Decision D1: Sets are ABAC resources (unlike Program/Cycle, which use
-- plain RBAC per OKR-E001 P2) — no domain-owned visibility_mode/
-- visibility_policy_id column here; visibility rows live in the platform's
-- rvn_platform_resource_visibility / rvn_platform_resource_acl, exactly
-- like KPI/ROI.
--
-- Decision D3: uniqueness tuple (organization_id, program_id, cycle_id,
-- scope_type, scope_id, owner_user_id) WHERE status <> 'cancelled'.
-- 'cancelled' frees the slot; 'closed' deliberately does NOT.
--
-- Decision D4: scope_id TEXT NOT NULL. For scope_type='company',
-- scope_id = organization_id (sentinel, caller-supplied explicitly, never
-- server-defaulted). For 'team', a team_members.team_id. For 'individual',
-- the target user's id. For 'business_unit' (D16), an opaque caller-supplied
-- TEXT with no referential integrity — matches legacy okr_cycles.dept_id's
-- own precedent.

-- ============================================================
-- okr_vnext_sets — root aggregate #3. Materialized Cycle × scope × owner.
-- ============================================================
CREATE TABLE IF NOT EXISTS okr_vnext_sets (
  set_id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id            TEXT NOT NULL,
  program_id                 UUID NOT NULL REFERENCES okr_vnext_programs(program_id),
  cycle_id                   UUID NOT NULL REFERENCES okr_vnext_cycles(cycle_id),

  scope_type                 TEXT NOT NULL
                                CHECK (scope_type IN ('company','business_unit','team','individual')),
  -- D4: for scope_type='company', scope_id = organization_id (sentinel).
  -- For 'business_unit', an opaque caller-supplied identifier (D16) — no
  -- canonical registry exists in this product yet.
  scope_id                   TEXT NOT NULL,

  owner_user_id               TEXT NOT NULL,
  reviewer_user_id             TEXT NULL,
  title                        TEXT NOT NULL,

  -- Full lifecycle forward-declared (plan §4.4). 'not_required'/'required'
  -- reserved with zero E002 code path (D2). 'review'/'closed' reserved for
  -- OKR-E004/E007 — no E002 transition reaches them.
  status                       TEXT NOT NULL DEFAULT 'draft'
                                 CHECK (status IN (
                                   'not_required','required','draft','submitted',
                                   'changes_requested','approved','active','review',
                                   'closed','cancelled'
                                 )),

  submitted_by                 TEXT NULL,
  submitted_at                 TIMESTAMPTZ NULL,
  approved_by                  TEXT NULL,
  approved_at                  TIMESTAMPTZ NULL,
  changes_requested_by         TEXT NULL,
  changes_requested_at         TIMESTAMPTZ NULL,
  changes_requested_reason     TEXT NULL,

  -- D5/D6: two independent counters. current_version bumps only via
  -- recordOkrSetMaterialChange. approved_version mirrors the
  -- sequence_number of the latest approval snapshot.
  current_version               INT NOT NULL DEFAULT 1,
  approved_version              INT NULL,
  latest_approved_snapshot_id   UUID NULL,  -- FK ALTERed below

  -- Reserved for OKR-E003/E004 rollups — NOT populated, NOT read, by any
  -- E002 command. Same "reserve now" discipline as
  -- rvn_kpi_definitions.response_policy_id.
  overall_progress              NUMERIC NULL,
  overall_confidence            TEXT NULL CHECK (overall_confidence IN ('high','medium','low','numeric')),
  attention_state                TEXT NOT NULL DEFAULT 'none'
                                   CHECK (attention_state IN ('none','watch','action_required','escalated')),
  last_checkin_at                TIMESTAMPTZ NULL,
  next_checkin_due_at            TIMESTAMPTZ NULL,

  row_version                    INT NOT NULL DEFAULT 1,
  created_by                     TEXT NOT NULL,
  created_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by                     TEXT NULL,
  updated_at                     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_okr_vnext_sets_org_cycle_status
  ON okr_vnext_sets(organization_id, cycle_id, status);
CREATE INDEX IF NOT EXISTS idx_okr_vnext_sets_org_owner
  ON okr_vnext_sets(organization_id, owner_user_id);
CREATE INDEX IF NOT EXISTS idx_okr_vnext_sets_org_scope
  ON okr_vnext_sets(organization_id, scope_type, scope_id);

-- OKR-F-004-AC-01. Cancelled frees the slot; closed does not (D3).
CREATE UNIQUE INDEX IF NOT EXISTS ux_okr_vnext_sets_one_per_scope_cycle_owner
  ON okr_vnext_sets(organization_id, program_id, cycle_id, scope_type, scope_id, owner_user_id)
  WHERE status <> 'cancelled';

-- ============================================================
-- okr_vnext_approved_snapshots — immutable, one row per approval (D5, D8)
-- ============================================================
CREATE TABLE IF NOT EXISTS okr_vnext_approved_snapshots (
  snapshot_id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id                       UUID NOT NULL REFERENCES okr_vnext_sets(set_id),
  organization_id              TEXT NOT NULL,

  sequence_number               INT NOT NULL,

  approved_by                   TEXT NOT NULL,
  approved_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),

  content_hash                  TEXT NOT NULL,
  snapshot_payload              JSONB NOT NULL,  -- Set fields + objectives:[] (D8)

  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
  -- No row_version, no UPDATE path — immutable by construction, matching
  -- rvn_roi_approval_snapshots exactly.
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_okr_vnext_approved_snapshots_set_seq
  ON okr_vnext_approved_snapshots(set_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_okr_vnext_approved_snapshots_set
  ON okr_vnext_approved_snapshots(organization_id, set_id, sequence_number DESC);

REVOKE UPDATE, DELETE ON okr_vnext_approved_snapshots FROM PUBLIC;

DO $$
BEGIN
  ALTER TABLE okr_vnext_sets
    ADD CONSTRAINT fk_okr_vnext_sets_latest_approved_snapshot
    FOREIGN KEY (latest_approved_snapshot_id)
    REFERENCES okr_vnext_approved_snapshots(snapshot_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- okr_vnext_set_versions — OKRMaterialChange, append-only (D5, D6)
-- ============================================================
-- Written ONLY by recordOkrSetMaterialChange (status='active' guard).
-- Never overwrites okr_vnext_approved_snapshots (F-005-AC-02).
CREATE TABLE IF NOT EXISTS okr_vnext_set_versions (
  version_id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id                        UUID NOT NULL REFERENCES okr_vnext_sets(set_id),
  organization_id                TEXT NOT NULL,

  version_number                  INT NOT NULL,

  field_name                       TEXT NOT NULL
                                     CHECK (field_name IN ('title','owner_user_id','reviewer_user_id')),
  before_value                     TEXT NULL,
  after_value                      TEXT NULL,
  reason                           TEXT NOT NULL,

  requested_by                     TEXT NOT NULL,
  requested_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Reserved (plan §4.8), zero enforcing command in E002 — the recommit
  -- workflow is unbuilt and unowned (D17), stated not silent.
  reviewer_user_id                  TEXT NULL,
  recommit_status                   TEXT NULL CHECK (recommit_status IN ('pending','recommitted','waived')),
  recommit_by                       TEXT NULL,
  recommit_at                       TIMESTAMPTZ NULL,

  created_at                        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_okr_vnext_set_versions_set_seq
  ON okr_vnext_set_versions(set_id, version_number);
CREATE INDEX IF NOT EXISTS idx_okr_vnext_set_versions_set
  ON okr_vnext_set_versions(organization_id, set_id, version_number DESC);

REVOKE UPDATE, DELETE ON okr_vnext_set_versions FROM PUBLIC;
