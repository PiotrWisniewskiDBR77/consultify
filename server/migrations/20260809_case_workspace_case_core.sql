-- CW-P01 (Case Workspace, EPIC E1 "Case Core") — new `case_core` table.
--
-- Collision-avoidance (docs/product/case-workspace/15_FULL_EXECUTION_LAUNCH_MANIFEST_2026-08-09.md
-- section 3): at least 15 branches/worktrees are concurrently active, several
-- touching `projects` (its own routes/migrations), Finance and Results
-- directly. This migration does NOT alter `projects` (no ALTER TABLE, no
-- column added to it) and does not reference Finance or Results tables at
-- all. It only adds one new table, keyed 1:1 to `projects.id` via a UNIQUE
-- NOT NULL `project_id` FK — see docs/product/case-workspace/acceptance/
-- CODEBASE_CONVERGENCE_MAP.csv (area=mywork-chat, E1: "`projects` table is
-- the closest existing 'Case' entity ... EXTEND not replace").
--
-- Ground truth for the columns below:
--   CW-RT-012 (04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md:56) — Case aggregate
--     schema (caseId, organizationId, projectId?, profile, governanceTier,
--     status, contractedClosureType, governanceTierHistory[], ..., version).
--   CW-RT-026 (04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md:200) — Case state
--     machine: DRAFT -> ACTIVE <-> BLOCKED; {DRAFT,ACTIVE,BLOCKED} -> {CLOSED,
--     FAILED,CANCELLED}. Enforced in service code (transitionStatus), not by
--     a DB trigger — see caseCoreService.ts.
--   CW-RT-027 (04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md:204) — CLOSED records
--     one immutable CaseClosureRecord (closure_type/closed_at/
--     closed_by_actor_id/closure_evidence_ref); a closed Case is never
--     rewritten or reopened.
--   CW-00-016 / CW-00-017 (00_CASE_WORKSPACE_CANON.md:84,86) — Delivery,
--     Decision, Implementation and Outcome are separate closure levels
--     (e.g. IMPLEMENTATION_COMPLETED / OUTCOME_PENDING must be representable
--     simultaneously) -> four independent *_status columns, never merged.
--   CW-GR-023 (05_CANONICAL_GRAPH_CAPABILITIES_AND_APIS.md:155) — Case API
--     surface, incl. POST /api/cases/:caseId/governance-tier.
--   CW-DOD-B1 (14_COMPLETE_DOD_EPICS_ACCEPTANCE_AND_CLAUDE_PROMPT.md:231) —
--     profile and governance tier are separate, independently persisted
--     columns (not coupled).
--   CW-01-026-INV1 (01_PRODUCT_CANON_AND_MODES.md:154) — one tenant/
--     organization context per Case -> organization_id NOT NULL, denormalized
--     from `projects.organization_id` (verified equal at createCase time),
--     so tenant-scoped reads never join into the concurrently-mutated
--     `projects` table.
--   OD-01 (11_OWNER_DECISION_REGISTER.md:10) — one Case, no separate
--     Engagement/Job object -> UNIQUE(project_id) enforces exactly one
--     case_core row per project.
--   OD-05 (11_OWNER_DECISION_REGISTER.md:14) — three selectable autonomy
--     levels per Case, middle level default -> autonomy_policy default
--     'ASK_MATERIAL_ACTIONS'.
--   CW-RT-044 (04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md:310) — every command
--     carries an expected aggregate version where mutation races are
--     possible -> `version` column, incremented by every mutating service
--     method.
--   canon invariant #13 (CW-00-020-INV13) — history is append-only ->
--     governance_tier_history is a JSON array, appended to, never rewritten
--     (enforced in caseCoreService.ts, not by a DB constraint).
--
-- `case_id` is minted independently of `project_id` (own UUID PK) rather
-- than aliasing project_id, per CW-RT-012 modeling Case as its own aggregate
-- identity (caseId, with projectId as an optional reference field). See the
-- design's open_questions for the follow-up needed at the API boundary
-- (whether callers should ever see project_id vs case_id) — out of scope
-- for this packet, which only lands the persistence layer.
--
-- Style follows this repo's 2026-08 migrations (e.g.
-- 20260808_v8_agent_resource_governance.sql, 20260809_t01_u03_owner_backed_
-- execution.sql): TEXT ids, CHECK-constrained enum columns, TEXT timestamps
-- via CURRENT_TIMESTAMP, CREATE TABLE/INDEX IF NOT EXISTS throughout so this
-- file is idempotent and safe to re-run.

CREATE TABLE IF NOT EXISTS case_core (
  case_id TEXT PRIMARY KEY,

  -- 1:1 keying into `projects`, per this packet's collision-avoidance
  -- mandate — read-only reference, never an ALTER TARGET. ON DELETE CASCADE
  -- so a deleted project cannot leave an orphaned case_core row.
  project_id TEXT NOT NULL UNIQUE
    REFERENCES projects(id) ON DELETE CASCADE,

  -- Denormalized copy of projects.organization_id (CW-01-026-INV1), verified
  -- equal to the linked project's own organization_id at createCase time and
  -- never mutated afterward.
  organization_id TEXT NOT NULL
    REFERENCES organizations(id),

  case_profile TEXT NOT NULL DEFAULT 'LIGHT'
    CHECK (case_profile IN ('LIGHT', 'STANDARD', 'TRANSFORMATION', 'MONITORING')),

  governance_tier TEXT NOT NULL DEFAULT 'LIGHTWEIGHT'
    CHECK (governance_tier IN ('LIGHTWEIGHT', 'STANDARD', 'CONTROLLED')),

  -- Append-only JSON array of {tier, changedAt, changedByActorId, reason}.
  -- Appended to by updateGovernanceTier; prior entries are never rewritten.
  governance_tier_history TEXT NOT NULL DEFAULT '[]',

  autonomy_policy TEXT NOT NULL DEFAULT 'ASK_MATERIAL_ACTIONS'
    CHECK (autonomy_policy IN ('ASK_EACH_ACTION', 'ASK_MATERIAL_ACTIONS', 'EXECUTE_APPROVED_PLAN')),

  -- Forward-compatible pointer to an org-level max-autonomy policy record
  -- (E6, NOT_IMPLEMENTED anywhere in this codebase yet) — no FK on purpose.
  autonomy_policy_ref TEXT,

  case_status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (case_status IN ('DRAFT', 'ACTIVE', 'BLOCKED', 'CLOSED', 'FAILED', 'CANCELLED')),

  contracted_closure_type TEXT NOT NULL
    CHECK (contracted_closure_type IN (
      'DELIVERY_COMPLETED', 'DECISION_COMPLETED', 'IMPLEMENTATION_COMPLETED',
      'OUTCOME_VALIDATED', 'COMPLETED_PARTIAL'
    )),

  -- Four independent closure axes (CW-00-016/CW-00-017) — deliberately never
  -- folded into case_status or into each other.
  delivery_status TEXT NOT NULL DEFAULT 'NOT_APPLICABLE'
    CHECK (delivery_status IN ('NOT_APPLICABLE', 'PENDING', 'COMPLETED')),
  decision_status TEXT NOT NULL DEFAULT 'NOT_APPLICABLE'
    CHECK (decision_status IN ('NOT_APPLICABLE', 'PENDING', 'COMPLETED')),
  implementation_status TEXT NOT NULL DEFAULT 'NOT_APPLICABLE'
    CHECK (implementation_status IN ('NOT_APPLICABLE', 'PENDING', 'COMPLETED')),
  outcome_status TEXT NOT NULL DEFAULT 'NOT_APPLICABLE'
    CHECK (outcome_status IN ('NOT_APPLICABLE', 'PENDING', 'VALIDATED')),

  -- CaseClosureRecord (CW-RT-027) — set at most once, by recordClosure; the
  -- service layer rejects any further write once closure_type is populated.
  closure_type TEXT
    CHECK (closure_type IS NULL OR closure_type IN (
      'DELIVERY_COMPLETED', 'DECISION_COMPLETED', 'IMPLEMENTATION_COMPLETED',
      'OUTCOME_VALIDATED', 'COMPLETED_PARTIAL'
    )),
  closed_at TEXT,
  closed_by_actor_id TEXT,
  closure_evidence_ref TEXT,

  sponsor_user_id TEXT
    REFERENCES users(id) ON DELETE SET NULL,
  acceptance_criteria_ref TEXT,
  budget_policy_ref TEXT,
  current_plan_version_id TEXT,

  created_by_actor_id TEXT NOT NULL,

  -- Optimistic concurrency (CW-RT-044) — incremented by every mutating
  -- service method, independent of any versioning `projects` itself may have.
  version INTEGER NOT NULL DEFAULT 1,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

-- project_id already carries a UNIQUE constraint (and thus an implicit
-- unique index) above; this plain index is the one the design explicitly
-- calls for, for the read path (getCase({projectId}), tenant/backfill scans)
-- that does not need uniqueness enforcement, only a fast lookup.
CREATE INDEX IF NOT EXISTS idx_case_core_project_id
  ON case_core (project_id);

-- Tenant-scoped list surfaces (listCasesForOrganization) read organization_id
-- directly off this table rather than joining into `projects`.
CREATE INDEX IF NOT EXISTS idx_case_core_organization_id
  ON case_core (organization_id);
