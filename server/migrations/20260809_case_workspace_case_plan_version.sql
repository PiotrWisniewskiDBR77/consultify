-- CW-P02 (Case Workspace, EPIC E2 "Case contract, plan versions and canonical
-- graph") — two new tables: `case_plan_versions` and `case_plan_view_state`.
--
-- Collision-avoidance (same mandate as CW-P01's
-- 20260809_case_workspace_case_core.sql): at least 15 branches/worktrees are
-- concurrently active. This migration does NOT alter `case_core`, `projects`,
-- Finance or Results in any way (no ALTER TABLE, no new column on any of
-- them). It only adds two new tables, keyed by FK to case_core(case_id).
-- case_core is read via a plain FK + ON DELETE CASCADE, and the service layer
-- (casePlanVersionService.ts) only ever SELECTs it (a `SELECT ... FOR UPDATE`
-- to confirm the case exists and to serialize concurrent draft creation),
-- never INSERT/UPDATE/DELETE — including case_core.current_plan_version_id,
-- which this packet deliberately never writes (see the service file's
-- top-of-file doc-comment and open_questions).
--
-- Filename note: `20260809_case_workspace_case_core.sql` already claims
-- today's date on this branch; this file keeps the same date prefix (per the
-- approved design) since both land in the same day's migration batch and
-- filenames only need to sort after case_core's, which
-- `..._case_core.sql` < `..._case_plan_version.sql` already satisfies
-- lexicographically.
--
-- Ground truth for the columns below:
--   CW-01-010 (01_PRODUCT_CANON_AND_MODES.md) — Plan Definition is an
--     editable draft, distinct from the immutable Plan Version -> `status`
--     gates mutability (DRAFT is the only status updatePlanDraft may write
--     to), never two competing schemas for draft vs. published.
--   CW-01-011 (01_PRODUCT_CANON_AND_MODES.md) — Plan Version is an immutable
--     approved definition; every Run names the exact version -> published
--     rows are never rewritten; `case_plan_versions` is the row Runs (E4, out
--     of scope here) will point at by case_plan_version_id.
--   CW-00-020-INV5 (13_CLAUDE_MULTI_AGENT_IMPLEMENTATION_MASTER_PLAN.md) —
--     plan versions are immutable after publication -> service-layer status
--     gate rejects semantic mutation once status leaves DRAFT; published_at
--     is set exactly once and never touched again.
--   CW-00-020-INV6 (13_CLAUDE_MULTI_AGENT_IMPLEMENTATION_MASTER_PLAN.md) —
--     every Run binds an exact plan version and semantic digest -> at most
--     one PUBLISHED row per case_id at any instant (partial unique index
--     below), each row carrying its own graph_digest.
--   CW-RT-016 (04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md) — CasePlanVersion
--     aggregate schema (casePlanVersionId, caseId, version, sourceProcess-
--     VersionId?, graphDigest, changeReason?, createdBy, ...). NOTE: CW-RT-016
--     calls the plan ordinal `version`, which collides with the CW-RT-044 /
--     case_core-established meaning of `version` as an optimistic-concurrency
--     counter. This migration keeps `version` as the OCC counter (consistent
--     with case_core.version) and names the domain ordinal `plan_number`
--     instead — flagged for confirmation before it is exposed in any public
--     API shape (see casePlanVersionService.ts open_questions).
--   CW-RT-017 (04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md) — replanning inserts
--     a new CasePlanVersion row (never edits a published row in place);
--     `supersedes_plan_version_id` records the explicit lineage.
--   CW-RT-029/030/031 (04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md) — Plan
--     Version lifecycle DRAFT -> IN_REVIEW -> PUBLISHED -> SUPERSEDED |
--     WITHDRAWN, with IN_REVIEW -> DRAFT ("changes requested") also
--     reachable; UX mapping Szkic|Do przeglądu|Opublikowany|Wycofany.
--     Enforced in service code (ALLOWED_TRANSITIONS map), not by a DB
--     trigger — same convention as case_core.case_status.
--   CW-GR-001 / CW-CANON-05 / CW-00-020-INV8 (05_CANONICAL_GRAPH_
--     CAPABILITIES_AND_APIS.md) — exactly one canonical graph per plan
--     version; Simple/Expert/List (E7, paused at the W2-V0 gate) all read/
--     write the same `semantic_graph` column once built -> no competing
--     process-model column exists on this table.
--   CW-GR-005/006/025/045 (05_CANONICAL_GRAPH_CAPABILITIES_AND_APIS.md) —
--     view layout/viewport/collapsed-state is presentation data, structurally
--     separate from semantic content, and layout-only edits must never move
--     the semantic digest -> `case_plan_view_state` is a distinct table with
--     no column that can touch `semantic_graph`/`graph_digest`, making this a
--     structural guarantee rather than an application-discipline one.
--   CW-GR-008 (05_CANONICAL_GRAPH_CAPABILITIES_AND_APIS.md) — CanonicalGraph
--     shape (schemaVersion, graphId, entryNodeIds[], terminalNodeIds[],
--     nodes[], edges[], variables[], inputSchemaRef?, outputSchemaRef?,
--     limits, metadata) -> persisted verbatim (JSON) in `semantic_graph`.
--   CW-GR-024 (05_CANONICAL_GRAPH_CAPABILITIES_AND_APIS.md) — API surface
--     incl. GET|PUT /api/plan-versions/:planVersionId/view-state?view=
--     simple|expert|list -> `view_type` CHECK constraint below.
--   CW-GR-036 (05_CANONICAL_GRAPH_CAPABILITIES_AND_APIS.md) — publish-
--     blocking validation checklist; the LOCAL_STRUCTURAL subset this packet
--     can compute is implemented read-only in
--     casePlanVersionService.validatePlanVersion() over the persisted
--     semantic_graph, no dedicated column needed.
--   CW-RT-044 (04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md) — every command
--     carries an expected aggregate version where mutation races are
--     possible -> `version` column on case_plan_versions, incremented by
--     every mutating service method. Deliberately NOT added to
--     case_plan_view_state: layout is presentation data, not coordination-
--     sensitive content (last-write-wins by design; see the service file's
--     open_questions for the concurrent-multi-tab caveat).
--   canon invariant #13 (CW-00-020-INV13, same as case_core) — history is
--     append-only -> review_history is a JSON array, appended to, never
--     rewritten (enforced in casePlanVersionService.ts, not by a DB
--     constraint).
--
-- Style follows 20260809_case_workspace_case_core.sql exactly: TEXT ids,
-- CHECK-constrained enum columns, TEXT timestamps via CURRENT_TIMESTAMP,
-- CREATE TABLE/INDEX IF NOT EXISTS throughout so this file is idempotent and
-- safe to re-run.

CREATE TABLE IF NOT EXISTS case_plan_versions (
  -- Own identity, minted `planv-${uuid}` — independent of case_id, same
  -- precedent as case_core.case_id being independent of project_id.
  case_plan_version_id TEXT PRIMARY KEY,

  -- FK-only, read-only reference into case_core per this packet's
  -- collision-avoidance mandate (CW-RT-016 caseId, CW-01-004). ON DELETE
  -- CASCADE so a deleted Case cannot leave an orphaned plan version.
  case_id TEXT NOT NULL
    REFERENCES case_core(case_id) ON DELETE CASCADE,

  -- CW-RT-016's `version` field, renamed to `plan_number` to avoid colliding
  -- with the OCC `version` column below (see header note). Immutable 1,2,3...
  -- ordinal of this plan among all CasePlanVersions of the Case, set once at
  -- creation and never rewritten.
  plan_number INTEGER NOT NULL,

  -- Ref-only to a future ProcessVersion (E12, no table in this packet), no
  -- FK — same pattern as case_core.autonomy_policy_ref.
  source_process_version_id TEXT,

  -- Self-referential replan lineage (CW-RT-017), set once at creation and
  -- never rewritten. Distinct from the mechanical PUBLISHED -> SUPERSEDED
  -- transition, which is driven by "is there currently a PUBLISHED row for
  -- this case_id" (see publishPlanVersion), not by this pointer.
  supersedes_plan_version_id TEXT
    REFERENCES case_plan_versions(case_plan_version_id),
  CONSTRAINT case_plan_versions_no_self_supersede
    CHECK (supersedes_plan_version_id IS NULL OR supersedes_plan_version_id <> case_plan_version_id),

  -- CW-RT-030/031 lifecycle. Enforced via an ALLOWED_TRANSITIONS map in
  -- casePlanVersionService.ts, same style as case_core.case_status.
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'SUPERSEDED', 'WITHDRAWN')),

  -- JSON-serialized CanonicalGraph (CW-GR-008). The ONLY place semantic
  -- node/edge/binding/policy content lives (CW-GR-001/CW-CANON-05/INV8) —
  -- never contains view-state/layout, which lives only in
  -- case_plan_view_state below.
  semantic_graph TEXT NOT NULL,

  -- `sha256:<hex>` over the canonicalized semantic_graph — see
  -- casePlanVersionService.ts's digest algorithm doc-comment.
  -- CW-RT-016 graphDigest, CW-00-020-INV6, CW-GR-041/044/045.
  graph_digest TEXT NOT NULL,

  -- Why THIS version exists, set once at creation (esp. for replans) —
  -- distinct from review_history's per-event reasons.
  change_reason TEXT,

  -- Append-only JSON array of
  -- {event: PROPOSED|CHANGES_REQUESTED|PUBLISHED|WITHDRAWN, actorId, at,
  -- reason?} — same append-only convention as
  -- case_core.governance_tier_history. Needed because DRAFT<->IN_REVIEW can
  -- loop multiple times (CW-RT-030/031).
  review_history TEXT NOT NULL DEFAULT '[]',

  -- Latest DRAFT -> IN_REVIEW transition (overwritten each re-propose cycle;
  -- full history stays in review_history).
  proposed_at TEXT,
  proposed_by_actor_id TEXT,

  -- Set exactly once, on IN_REVIEW -> PUBLISHED, never touched again
  -- (CW-RT-029 "published content is immutable" applies to this row too).
  published_at TEXT,
  published_by_actor_id TEXT,
  CONSTRAINT case_plan_versions_published_at_consistency
    CHECK ((status IN ('PUBLISHED', 'SUPERSEDED', 'WITHDRAWN')) = (published_at IS NOT NULL)),

  -- Set by publishPlanVersion() on the PREVIOUS PUBLISHED row for the same
  -- case_id, in the same transaction as the new row's publish. This is the
  -- sole path by which SUPERSEDED is ever reached.
  superseded_at TEXT,
  CONSTRAINT case_plan_versions_superseded_at_consistency
    CHECK (status <> 'SUPERSEDED' OR superseded_at IS NOT NULL),

  -- Set by withdrawPlanVersion(), PUBLISHED -> WITHDRAWN only.
  withdrawn_at TEXT,
  CONSTRAINT case_plan_versions_withdrawn_at_consistency
    CHECK (status <> 'WITHDRAWN' OR withdrawn_at IS NOT NULL),
  withdrawn_by_actor_id TEXT,
  -- Required by the service (not the DB) when withdrawing — also appended
  -- into review_history.
  withdrawal_reason TEXT,

  created_by_actor_id TEXT NOT NULL,

  -- Optimistic concurrency (CW-RT-044, CW-GR-025 expectedVersion, CW-RT-061 /
  -- CW-GR-044 409-on-stale), bumped on EVERY mutating call including status
  -- transitions — identical convention to case_core.version. NOT the same
  -- thing as plan_number.
  version INTEGER NOT NULL DEFAULT 1,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT case_plan_versions_case_plan_number_unique UNIQUE (case_id, plan_number)
);

-- Primary read path: list/lookup plan versions for one Case.
CREATE INDEX IF NOT EXISTS idx_case_plan_versions_case_id
  ON case_plan_versions (case_id);

-- CW-00-020-INV6 / CW-DOD-B4 / CW-CANON-06: at most one PUBLISHED row per
-- case_id at any instant. Enforced here (not just in service logic) so the
-- future Run-binding packet (E4, out of scope for this packet) always has an
-- unambiguous "current plan" to point at.
CREATE UNIQUE INDEX IF NOT EXISTS uq_case_plan_versions_one_published_per_case
  ON case_plan_versions (case_id)
  WHERE status = 'PUBLISHED';

-- Replan lineage lookups (diffPlanVersions default baseline).
CREATE INDEX IF NOT EXISTS idx_case_plan_versions_supersedes
  ON case_plan_versions (supersedes_plan_version_id);

-- CW-GR-005: per-view (Simple/Expert/List) presentation data for one
-- CasePlanVersion's semantic_graph — viewport/scroll, node layout positions,
-- collapsed groups, last-selected stepId (CW-02-016). Structurally separate
-- from case_plan_versions so a layout-only write is mechanically incapable of
-- touching semantic_graph or graph_digest, and can be written regardless of
-- the owning plan version's status (even PUBLISHED/SUPERSEDED — it is not
-- semantic content, so CW-RT-029's immutability of "published content" does
-- not apply to it).
CREATE TABLE IF NOT EXISTS case_plan_view_state (
  case_plan_version_id TEXT NOT NULL
    REFERENCES case_plan_versions(case_plan_version_id) ON DELETE CASCADE,

  view_type TEXT NOT NULL
    CHECK (view_type IN ('SIMPLE', 'EXPERT', 'LIST')),

  -- JSON: viewport/scroll, node layout positions, collapsed groups,
  -- last-selected stepId. Free-form per view_type, owned entirely by the
  -- view implementations (E7, out of scope for this packet) — this packet
  -- only persists/returns it opaquely.
  view_state TEXT NOT NULL DEFAULT '{}',

  -- Last-write-wins timestamp — no OCC column here by design (layout is
  -- presentation data, not coordination-sensitive content; see the service
  -- file's open_questions for the concurrent-multi-tab caveat).
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by_actor_id TEXT,

  PRIMARY KEY (case_plan_version_id, view_type)
);
