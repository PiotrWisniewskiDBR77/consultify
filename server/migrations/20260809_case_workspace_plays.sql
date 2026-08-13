-- CW-P08 (Case Workspace, EPIC E12 "Reusable Plays") — two new tables:
-- `process_definitions` and `process_versions`.
--
-- Collision-avoidance (same mandate as CW-P01's
-- 20260809_case_workspace_case_core.sql / CW-P02's
-- 20260809_case_workspace_case_plan_version.sql): at least 15
-- branches/worktrees are concurrently active. This migration does NOT alter
-- `case_plan_versions`, `case_core`, `projects`, any other `case_workspace_*`
-- table, or Finance/Results in any way (no ALTER TABLE, no new column on any
-- of them). It only adds two wholly new tables. Notably it does NOT add the
-- real FK on case_plan_versions.source_process_version_id -> this table's
-- process_versions(process_version_id) — that nullable, unenforced TEXT
-- column already exists from CW-P02, explicitly reserved in that migration's
-- own comments for this future table, but wiring the real FK requires
-- altering case_plan_versions' migration, which this packet's mandate does
-- not permit. A later packet will likely add that FK now that both tables
-- exist. The only touch points with pre-existing schema are a read-only FK
-- from process_versions into process_definitions (both new tables, no
-- collision) and, at the service layer only (playService.ts), a read-only
-- cross-service call into casePlanVersionService.createPlanDraft plus an
-- internal SELECT on organization_members for the authorized-publisher
-- check — no schema touch for either.
--
-- Ground truth for the columns below (docs/product/case-workspace/
-- acceptance/FUNCTIONAL_REQUIREMENT_COVERAGE.csv, epics column contains
-- "E12" — 7 rows):
--   CW-00-018 (00_CASE_WORKSPACE_CANON.md:90) — every user may create
--     private Play drafts; publishing to team/org requires an authorized
--     publisher or review; published Play versions are immutable ->
--     process_definitions.visibility defaults to 'PRIVATE' and is only ever
--     widened by shareProcessDefinition() after its authorized-publisher
--     check passes (playService.ts); process_versions content is frozen the
--     instant a row leaves DRAFT (see *_at consistency constraints below).
--   CW-RT-014 (04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md:76) —
--     ProcessDefinition is the reusable Play identity; ProcessVersion is an
--     immutable published graph/configuration; publication records author,
--     reviewer, semantic graph digest, capability versions, policy and
--     required bindings -> process_definitions is the identity row (no
--     graph content at all); process_versions carries semantic_graph,
--     graph_digest, capability_versions, policy_ref, required_bindings,
--     created_by_actor_id ("author") and reviewed_by_actor_id ("reviewer").
--   CW-RT-015 (04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md:82) — every
--     authorized user may create/test a private draft; project/team/org
--     publication requires an authorized process owner, administrator or
--     reviewer -> createProcessDefinition() forces visibility='PRIVATE'
--     server-side unconditionally; shareProcessDefinition() gates widening
--     on isAuthorizedPublisher() (see playService.ts open_questions for the
--     partial mapping of "process owner, administrator or reviewer" onto
--     organization_members.role IN ('OWNER','ADMIN') alone).
--   CW-RT-028 (04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md:213) — ProcessVersion
--     state machine: DRAFT -> IN_REVIEW -> PUBLISHED -> DEPRECATED ->
--     ARCHIVED; IN_REVIEW -> DRAFT -> `status` CHECK constraint below;
--     enforced via an ALLOWED_TRANSITIONS map in playService.ts, same
--     convention as case_plan_versions.status.
--   CW-RT-029 (04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md:218) — published
--     content is immutable; deprecation prevents new Runs (here: new
--     instantiation) unless an explicit policy exception exists and never
--     deletes historical evidence -> published_at/deprecated_at/archived_at
--     are each set exactly once and never rewritten; deprecateProcessVersion/
--     archiveProcessVersion never touch semantic_graph/graph_digest/
--     capability_versions/policy_ref/required_bindings, and no row is ever
--     deleted by this packet's service methods.
--   CW-GR-029 (05_CANONICAL_GRAPH_CAPABILITIES_AND_APIS.md:206) —
--     Capability Registry and Plays API surface, incl. POST
--     /api/process-definitions, GET /api/process-definitions?scope=&cursor=,
--     POST .../versions, POST .../versions/:versionId/review, POST
--     .../versions/:versionId/publish -> process_definitions.visibility
--     backs `scope=`; process_versions.version_number backs the
--     GET .../versions/:version address space (kept distinct from the OCC
--     `version` column, see the naming-collision note below).
--   CW-GR-030 (05_CANONICAL_GRAPH_CAPABILITIES_AND_APIS.md:215) — all list
--     endpoints are tenant-scoped, paginated and return authoritative
--     availability/lifecycle state; shared publish requires the reviewed
--     role -> process_definitions.organization_id is NOT NULL and mandatory
--     on every list filter (service layer); publishProcessVersion() in
--     playService.ts requires review_decision='APPROVED' recorded by a prior
--     reviewProcessVersion() call on the SAME row — status='IN_REVIEW' alone
--     is never sufficient, which is this migration's concrete mechanism for
--     CW-GR-030's explicit warning against conflating IN_REVIEW with
--     authorization (review_decision CHECK constraint below).
--
-- Deliberate divergence from case_plan_versions (see design's
-- invariants_enforced): NO partial-unique "one PUBLISHED per aggregate"
-- index exists here. A reusable Play's older PUBLISHED versions must stay
-- addressable/instantiate-able for Cases that already reference them, and
-- CW-RT-028's stated state machine has no SUPERSEDED state — so, unlike
-- case_plan_versions, multiple PUBLISHED process_versions rows may coexist
-- for one process_definition_id by design.
--
-- `version_number` (CW-RT-014's domain ordinal) vs. `version` (the OCC
-- counter) mirrors the exact plan_number/version naming split
-- 20260809_case_workspace_case_plan_version.sql already flagged for
-- case_plan_versions — same open question, not resolved differently here
-- (see playService.ts open_questions).
--
-- Style follows 20260809_case_workspace_case_core.sql /
-- 20260809_case_workspace_case_plan_version.sql exactly: TEXT ids,
-- CHECK-constrained enum columns, TEXT timestamps via CURRENT_TIMESTAMP,
-- CREATE TABLE/INDEX IF NOT EXISTS throughout so this file is idempotent and
-- safe to re-run.

CREATE TABLE IF NOT EXISTS process_definitions (
  -- Own identity, minted `procdef-${uuid}` — independent of organization_id,
  -- same precedent as case_plan_version_id being independent of case_id.
  process_definition_id TEXT PRIMARY KEY,

  -- Tenant scope for every list/filter route (CW-GR-030 "all list endpoints
  -- are tenant-scoped").
  organization_id TEXT NOT NULL
    REFERENCES organizations(id),

  name TEXT NOT NULL,
  description TEXT,

  -- CW-00-018/CW-RT-015 sharing scope. Always 'PRIVATE' at creation
  -- (createProcessDefinition() forces this server-side); only
  -- shareProcessDefinition() may widen it, and only after its
  -- isAuthorizedPublisher() check passes and >=1 PUBLISHED process_version
  -- exists for this definition.
  visibility TEXT NOT NULL DEFAULT 'PRIVATE'
    CHECK (visibility IN ('PRIVATE', 'TEAM', 'ORGANIZATION')),

  -- Only meaningful when visibility='TEAM'. No confirmed "team"
  -- entity/table exists anywhere in this codebase's schema yet (open
  -- question, see playService.ts) — kept FK-less pending confirmation, same
  -- ref-only pattern as case_core.autonomy_policy_ref.
  team_id TEXT,

  -- Creator / process owner. Deliberately NOT sufficient on its own to
  -- authorize shareProcessDefinition() (service-layer check) — otherwise
  -- CW-00-018's authorization requirement would be vacuous, since every
  -- creator already owns their own private draft.
  owner_actor_id TEXT NOT NULL,

  -- Set by shareProcessDefinition() on the (possibly repeated) widening
  -- transition. Audit trail, not a state-machine timestamp — visibility has
  -- no CHECK-enforced *_at consistency the way process_versions.status does.
  shared_at TEXT,
  shared_by_actor_id TEXT,

  created_by_actor_id TEXT NOT NULL,

  -- Optimistic concurrency (CW-RT-044-style), bumped by every mutating
  -- method (today: only shareProcessDefinition) — identical convention to
  -- case_core.version / case_plan_versions.version.
  version INTEGER NOT NULL DEFAULT 1,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Primary read path: tenant-scoped list/lookup of Plays for one org.
CREATE INDEX IF NOT EXISTS idx_process_definitions_organization_id
  ON process_definitions (organization_id);

-- listProcessDefinitions(organizationId, {ownerActorId}) filter path.
CREATE INDEX IF NOT EXISTS idx_process_definitions_owner_actor_id
  ON process_definitions (owner_actor_id);

CREATE TABLE IF NOT EXISTS process_versions (
  -- Own identity, minted `procv-${uuid}`.
  process_version_id TEXT PRIMARY KEY,

  -- FK -> process_definitions(process_definition_id) ON DELETE CASCADE. Both
  -- tables are wholly new in this packet, so this FK is not a collision with
  -- any pre-existing migration.
  process_definition_id TEXT NOT NULL
    REFERENCES process_definitions(process_definition_id) ON DELETE CASCADE,

  -- CW-RT-014's domain ordinal (1,2,3...) per definition, set once at
  -- creation and never rewritten. Named distinctly from the OCC `version`
  -- column below to avoid the exact naming collision
  -- 20260809_case_workspace_case_plan_version.sql already flagged for
  -- case_plan_versions.plan_number vs. .version (see header note above).
  version_number INTEGER NOT NULL,

  -- CW-RT-028 state machine. Enforced via an ALLOWED_TRANSITIONS map in
  -- playService.ts, same convention as case_plan_versions.status. No
  -- SUPERSEDED state here (deliberate divergence, see header note above).
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'DEPRECATED', 'ARCHIVED')),

  -- JSON-serialized CanonicalGraph (CW-GR-008 shape, the same type
  -- casePlanVersionService.ts's CanonicalGraph already defines) — the graph
  -- an instantiated CasePlanVersion is seeded from
  -- (playService.instantiateProcessVersion).
  semantic_graph TEXT NOT NULL,

  -- `sha256:<hex>` over the canonicalized semantic_graph, via the identical
  -- canonicalize-then-hash algorithm as
  -- casePlanVersionService.computeGraphDigest — copied locally in
  -- playService.ts per this directory's own convention (see
  -- capabilityRegistryService.computeRequestDigest for precedent), not
  -- imported. CW-RT-014 "semantic graph digest".
  graph_digest TEXT NOT NULL,

  -- JSON array of capability pins this Play depends on (CW-RT-014
  -- "capability versions"). Shape unconfirmed by canon — open question, see
  -- playService.ts.
  capability_versions TEXT NOT NULL DEFAULT '[]',

  -- Ref-only pointer to a policy record (CW-RT-014 "policy"), no FK — same
  -- pattern as case_core.autonomy_policy_ref.
  policy_ref TEXT,

  -- JSON array describing inputs a Case must supply at instantiation time
  -- (CW-RT-014 "required bindings"). Shape unconfirmed — open question.
  required_bindings TEXT NOT NULL DEFAULT '[]',

  -- Why this version was cut, set once at creation — mirrors
  -- case_plan_versions.change_reason.
  change_reason TEXT,

  -- Append-only JSON array of
  -- {event: PROPOSED|CHANGES_REQUESTED|PUBLISHED|DEPRECATED|ARCHIVED,
  -- actorId, at, reason?} — same append-only convention as
  -- case_plan_versions.review_history, extended with DEPRECATED/ARCHIVED
  -- events for CW-RT-028's longer terminal chain.
  review_history TEXT NOT NULL DEFAULT '[]',

  -- Latest DRAFT -> IN_REVIEW transition (overwritten each re-propose
  -- cycle; full history stays in review_history).
  proposed_at TEXT,
  proposed_by_actor_id TEXT,

  -- Set by reviewProcessVersion(); reset to NULL whenever the row returns to
  -- DRAFT via the CHANGES_REQUESTED path, so a stale approval can never
  -- authorize publishing edited content. CW-RT-014's "reviewer" record —
  -- the explicit authorization record CW-GR-030 requires.
  reviewed_at TEXT,
  reviewed_by_actor_id TEXT,
  review_decision TEXT
    CHECK (review_decision IS NULL OR review_decision IN ('APPROVED', 'CHANGES_REQUESTED')),

  -- Set exactly once, on IN_REVIEW -> PUBLISHED, never touched again
  -- (CW-RT-029 "published content is immutable" applies to this row too).
  -- publishProcessVersion() requires review_decision='APPROVED' on this same
  -- row in addition to status='IN_REVIEW' — status alone is never
  -- sufficient (CW-GR-030's explicit warning against conflating IN_REVIEW
  -- with authorization; enforced in playService.ts, not by a DB constraint,
  -- since review_decision is nullable and mutable while still IN_REVIEW).
  published_at TEXT,
  published_by_actor_id TEXT,
  CONSTRAINT process_versions_published_at_consistency
    CHECK ((status IN ('PUBLISHED', 'DEPRECATED', 'ARCHIVED')) = (published_at IS NOT NULL)),

  -- Set by deprecateProcessVersion(), PUBLISHED -> DEPRECATED only. Row and
  -- all history remain untouched otherwise (CW-RT-029 "never deletes
  -- historical evidence").
  deprecated_at TEXT,
  deprecated_by_actor_id TEXT,
  -- Required by the service (not the DB) when deprecating — also appended
  -- into review_history.
  deprecation_reason TEXT,
  CONSTRAINT process_versions_deprecated_at_consistency
    CHECK (status NOT IN ('DEPRECATED', 'ARCHIVED') OR deprecated_at IS NOT NULL),

  -- Set by archiveProcessVersion(), DEPRECATED -> ARCHIVED only.
  archived_at TEXT,
  archived_by_actor_id TEXT,
  CONSTRAINT process_versions_archived_at_consistency
    CHECK (status <> 'ARCHIVED' OR archived_at IS NOT NULL),

  -- CW-RT-014's "author".
  created_by_actor_id TEXT NOT NULL,

  -- Optimistic concurrency (CW-RT-044-style), bumped by every mutating
  -- method including status transitions — identical convention to
  -- case_plan_versions.version. NOT the same thing as version_number.
  version INTEGER NOT NULL DEFAULT 1,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT process_versions_definition_version_number_unique
    UNIQUE (process_definition_id, version_number)
);

-- Primary read path: list/lookup Play versions for one ProcessDefinition,
-- newest version_number first.
CREATE INDEX IF NOT EXISTS idx_process_versions_process_definition_id
  ON process_versions (process_definition_id);

-- shareProcessDefinition()'s ">=1 PUBLISHED process_version exists" check
-- and instantiateProcessVersion()'s PUBLISHED-only read path.
CREATE INDEX IF NOT EXISTS idx_process_versions_status
  ON process_versions (process_definition_id, status);

-- Deliberately NO unique index restricting PUBLISHED rows per
-- process_definition_id here (see header note above) — multiple PUBLISHED
-- process_versions may coexist for one Play by design, unlike
-- uq_case_plan_versions_one_published_per_case.
