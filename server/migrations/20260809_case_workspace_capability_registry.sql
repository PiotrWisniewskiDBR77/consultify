-- CW-P03 (Case Workspace, EPIC E3 "Capability Registry and native module
-- commands") — two new tables: `case_workspace_capabilities` and
-- `case_workspace_capability_idempotency_keys`.
--
-- Collision-avoidance (same mandate as CW-P01's
-- 20260809_case_workspace_case_core.sql and CW-P02's
-- 20260809_case_workspace_case_plan_version.sql): docs/product/case-workspace/
-- acceptance/CODEBASE_CONVERGENCE_MAP.csv (area=capability-commands) records
-- that "capability"/"tool registry" already names FOUR unrelated things in
-- this codebase:
--   1. capabilityService.ts / capability.routes.ts — staffing/skills.
--   2. initiativeCapabilityMatrix.ts — Initiative edit-permission matrix.
--   3. toolGovernanceService.ts's `v8_tool_catalog` — AI function-calling
--      tool governance.
--   4. toolsOrgAdminService.ts's `v8_shared_tools_registry` — consulting
--      methodology frameworks (SWOT etc.) shown in DiscoveryToolsHub.tsx.
-- This migration does NOT alter any of those four tables/files (no ALTER
-- TABLE, no new column on any of them), does NOT touch `case_core` or
-- `case_plan_versions` (CW-P01/CW-P02's own tables — read-only reference
-- only, from the service layer, never from this migration), and does not
-- reference Finance or Results tables at all. It only adds two new tables,
-- both namespaced `case_workspace_*` per the coordinator's mandate, keyed to
-- each other only (no FK into case_core/case_plan_versions — see the
-- "platform-global, not tenant/case-scoped" note below).
--
-- Ground truth for the columns below:
--   CW-GR-015 (05_CANONICAL_GRAPH_CAPABILITIES_AND_APIS.md) — CapabilityDefinition
--     schema (capabilityId, version, ownerModule, providerType, operation,
--     inputSchemaRef, outputSchemaRef, operationClass, effectClass,
--     requiredRoles[], dataClassification, residency?, idempotencyStrategy,
--     reversibility, approvalRecommendation, eventsEmitted[], rateLimit?,
--     costPolicy?, timeoutDefaults, health, lifecycle, testFixtureRef,
--     createdAt) -> persisted as `case_workspace_capabilities` below, field
--     for field. CW-GR-015's own `version` is renamed `capability_version`
--     here to avoid colliding with the OCC `version` column (see next note);
--     this is the exact same naming-collision precedent CW-P02 already
--     established for case_plan_versions.plan_number vs. .version.
--   CW-RT-044 (04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md) — every command
--     carries an expected aggregate version where mutation races are
--     possible -> `version` column, incremented only by markCapabilityHealth
--     in this packet (the only mutating method after registerCapability;
--     schema/policy/effect-class fields are immutable post-registration —
--     see capabilityRegistryService.ts's top-of-file doc-comment).
--   CW-GR-016 (05_CANONICAL_GRAPH_CAPABILITIES_AND_APIS.md) — a capability is
--     only "active" once schema, policy and health are all present and a
--     working adapter exists. This packet has no adapter concept at all
--     (adapters are later E3 work per the packet scope carve-out), so
--     `lifecycle`/`health` here only enforce the registry-side half of that
--     gate (see capabilityRegistryService.ts's listActiveCapabilities() and
--     open_questions).
--   CW-GR-019 / CW-GR-021 (05_CANONICAL_GRAPH_CAPABILITIES_AND_APIS.md) —
--     CommandEnvelope carries idempotencyKey + actor; capability invocation
--     must enforce idempotency -> `case_workspace_capability_idempotency_keys`
--     is the check-and-record half of that (no execute/outcome half — this
--     packet builds no adapters/dispatcher, see open_questions).
--   CW-GR-020 (05_CANONICAL_GRAPH_CAPABILITIES_AND_APIS.md) — required
--     capability attributes incl. domain owner, owning command/query,
--     effective scope, required role, side effects/reversibility, emitted
--     events, error taxonomy, test fixture, readback query, expected target
--     version -> `owning_command_ref` and `readback_query` are added beyond
--     CW-GR-015's literal field list to satisfy this (see next note);
--     "effective scope" and "error taxonomy" have no canon-defined shape
--     anywhere in docs/product/case-workspace/*.md, so they are NOT given
--     dedicated columns and fall into the open-ended `metadata` JSON column
--     instead, pending product confirmation (see service open_questions).
--   CW-RT-010 / CW-CANON-08 / CW-DOD-C4 (04_DOMAIN_RUNTIME_AND_STATE_
--     MACHINES.md, 00_CASE_WORKSPACE_CANON.md, 14_COMPLETE_DOD_EPICS_
--     ACCEPTANCE_AND_CLAUDE_PROMPT.md) — human UI and Teresa must invoke the
--     SAME owning command for a given capability, never two parallel code
--     paths -> `owning_command_ref` records the literal command/query
--     identifier both callers must reference. This packet only records the
--     value; it does not verify at runtime that routes/dispatcher actually
--     agree with it (open_questions — belongs to whichever later packet
--     wires routes/dispatcher through this registry).
--   CW-GR-047 / CW-GR-048 (05_CANONICAL_GRAPH_CAPABILITIES_AND_APIS.md) —
--     capability health must carry an exact reason, and a readback query
--     must exist to prove a mutation's effect -> `health_detail` +
--     `health_checked_at` pair, and `readback_query` (nullable for
--     READ/NOTIFY-class capabilities with nothing to read back).
--   CW-DOD-C3 (14_COMPLETE_DOD_EPICS_ACCEPTANCE_AND_CLAUDE_PROMPT.md) —
--     secrets never enter persisted request/response logs -> the
--     idempotency ledger stores only a sha256 digest of the request payload,
--     never the raw payload (same digest-not-payload posture as
--     case_plan_versions.graph_digest / computeGraphDigest in CW-P02).
--
-- Scope/tenancy note (flagged as open_question for confirmation, see
-- capabilityRegistryService.ts): neither table below carries a case_id or
-- organization_id column. CW-GR-015's CapabilityDefinition schema lists no
-- tenant field, and the documented GET /api/capabilities?availability=&
-- ownerModule=&cursor= route (CW-GR-029) has no orgId filter parameter —
-- the registry is designed as platform-global (one shared catalog of
-- native-module commands), not scoped per Case/organization. This is
-- explicitly NOT the same thing as CW-P01/CW-P02's tables, which ARE
-- case-scoped via FK to case_core(case_id); the Capability Registry has no
-- FK to either of those tables for that reason. See CW-GR-030's "all list
-- endpoints are tenant-scoped" (open_questions in the service file) for the
-- caveat this needs confirming before it ships in a route.
--
-- Style follows 20260809_case_workspace_case_core.sql and
-- 20260809_case_workspace_case_plan_version.sql exactly: TEXT ids,
-- CHECK-constrained enum columns, TEXT timestamps via CURRENT_TIMESTAMP,
-- CREATE TABLE/INDEX IF NOT EXISTS throughout so this file is idempotent and
-- safe to re-run.

CREATE TABLE IF NOT EXISTS case_workspace_capabilities (
  -- Own row identity, minted `cwcap-${uuid}` — independent of the logical
  -- (capability_id, capability_version) key, same precedent as
  -- case_plan_versions.case_plan_version_id being independent of
  -- (case_id, plan_number).
  capability_registry_id TEXT PRIMARY KEY,

  -- CW-GR-015 capabilityId — stable logical id shared across versions (e.g.
  -- 'finance.invoice.create'). Addressed by
  -- GET /api/capabilities/:capabilityId/versions/:version (CW-GR-029).
  capability_id TEXT NOT NULL,

  -- CW-GR-015's `version` field, renamed to avoid colliding with the OCC
  -- `version` column below (see header note) — same naming-collision
  -- precedent as case_plan_versions.plan_number.
  capability_version TEXT NOT NULL,

  -- CW-GR-015 ownerModule / CW-GR-020 "domain owner" — the module service
  -- that owns this command's data and validation (e.g. 'finance',
  -- 'initiative').
  owner_module TEXT NOT NULL,

  -- CW-GR-015 providerType — which adapter family will execute this
  -- capability. Adapters themselves are later E3 work, out of scope here.
  provider_type TEXT NOT NULL
    CHECK (provider_type IN ('INTERNAL', 'MCP', 'HTTP_API', 'CONNECTOR', 'AGENT')),

  -- CW-GR-015 operation — the RPC/method name this capability exposes on its
  -- provider.
  operation TEXT NOT NULL,

  -- CW-GR-020 "owning command/query" and CW-RT-010/CW-CANON-08/CW-DOD-C4 —
  -- the literal application command/query identifier BOTH human UI and
  -- Teresa must invoke. Distinct from `operation`, which only names the
  -- provider-side method.
  owning_command_ref TEXT NOT NULL,

  -- CW-GR-015 inputSchemaRef / outputSchemaRef — pointers to the typed
  -- schemas, not the schemas themselves.
  input_schema_ref TEXT NOT NULL,
  output_schema_ref TEXT NOT NULL,

  -- CW-GR-015 operationClass.
  operation_class TEXT NOT NULL
    CHECK (operation_class IN ('READ', 'COMPUTE', 'PROPOSE', 'MUTATE', 'PUBLISH', 'NOTIFY')),

  -- CW-GR-015 effectClass — drives approval/autonomy policy for callers (E6,
  -- out of scope here).
  effect_class TEXT NOT NULL
    CHECK (effect_class IN (
      'SAFE_ADDITIVE', 'SAFE_UPDATE', 'SENSITIVE_UPDATE', 'DESTRUCTIVE', 'GOVERNANCE_TRANSITION'
    )),

  -- JSON array of role strings. CW-GR-015 requiredRoles[] / CW-GR-020
  -- "required role".
  required_roles TEXT NOT NULL DEFAULT '[]',

  -- CW-GR-015 dataClassification — free text pending a confirmed enum
  -- vocabulary (open_questions: canon names the field, never enumerates
  -- allowed values).
  data_classification TEXT NOT NULL,

  -- CW-GR-015 residency? — optional data-residency constraint.
  residency TEXT,

  -- CW-GR-015 idempotencyStrategy — free text description of how retries are
  -- deduplicated at the provider; canon gives no fixed vocabulary
  -- (open_questions).
  idempotency_strategy TEXT NOT NULL,

  -- CW-GR-015 reversibility / CW-GR-020 "side effects and reversibility" —
  -- free text pending confirmed enum (open_questions).
  reversibility TEXT NOT NULL,

  -- CW-GR-015 approvalRecommendation — reuses the existing ApprovalClass enum
  -- from server/src/types/executionSpine.ts (ApprovalClassValues) BY
  -- REFERENCE (read-only import in the service layer), not duplicated here
  -- as a second source of truth; this CHECK mirrors that enum's literal
  -- values.
  approval_recommendation TEXT NOT NULL
    CHECK (approval_recommendation IN ('auto_executable', 'policy_approvable', 'requires_human_approval')),

  -- JSON array of event type strings. CW-GR-015 eventsEmitted[] / CW-GR-020
  -- "emitted events".
  events_emitted TEXT NOT NULL DEFAULT '[]',

  -- JSON object, free-form. CW-GR-015 rateLimit? / costPolicy?.
  rate_limit TEXT,
  cost_policy TEXT,

  -- JSON object. CW-GR-015 timeoutDefaults.
  timeout_defaults TEXT NOT NULL DEFAULT '{}',

  -- CW-GR-020 "readback query" / CW-GR-048, CW-DOD-C4 — pointer to the query
  -- that proves the mutation's effect took place. Nullable for
  -- READ/NOTIFY-class capabilities with nothing to read back.
  readback_query TEXT,

  -- Current health status. CW-GR-015 health, CW-GR-047. Canon does not
  -- enumerate exact values — chosen minimally (open_questions).
  health TEXT NOT NULL DEFAULT 'UNKNOWN'
    CHECK (health IN ('HEALTHY', 'DEGRADED', 'UNHEALTHY', 'UNKNOWN')),
  -- Timestamp of the last markCapabilityHealth call.
  health_checked_at TEXT,
  -- Free-text reason for the current health state — feeds CW-GR-047's
  -- "exact reason" requirement.
  health_detail TEXT,

  -- CW-GR-015 lifecycle. Set once at registerCapability in this packet;
  -- transitioning it later (e.g. UNAVAILABLE -> ACTIVE once a real adapter
  -- exists) is explicit future-packet scope.
  lifecycle TEXT NOT NULL DEFAULT 'UNAVAILABLE'
    CHECK (lifecycle IN ('ACTIVE', 'DEPRECATED', 'UNAVAILABLE')),

  -- CW-GR-015 testFixtureRef / CW-GR-020 "test fixture".
  test_fixture_ref TEXT,

  -- JSON object, open extension point for CW-GR-020 attributes with no
  -- dedicated column yet (effective scope, error taxonomy) — see
  -- open_questions.
  metadata TEXT NOT NULL DEFAULT '{}',

  created_by_actor_id TEXT NOT NULL,

  -- Optimistic concurrency (CW-RT-044-style), incremented only by
  -- markCapabilityHealth in this packet — distinct from capability_version
  -- above, which is the domain semver ordinal, not a coordination counter.
  version INTEGER NOT NULL DEFAULT 1,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Exactly one row per (capability_id, capability_version) — CW-GR-029's
  -- GET /api/capabilities/:capabilityId/versions/:version addresses exactly
  -- one row via this pair. Once registered, a version's content is
  -- immutable; corrections mint a NEW capability_version row (mirrors
  -- CasePlanVersion's publish-immutability precedent from CW-P02).
  CONSTRAINT case_workspace_capabilities_id_version_unique UNIQUE (capability_id, capability_version)
);

-- Primary read path: list/lookup versions for one logical capability.
CREATE INDEX IF NOT EXISTS idx_case_workspace_capabilities_capability_id
  ON case_workspace_capabilities (capability_id);

-- GET /api/capabilities?ownerModule=... (CW-GR-029) filter path.
CREATE INDEX IF NOT EXISTS idx_case_workspace_capabilities_owner_module
  ON case_workspace_capabilities (owner_module);

-- listActiveCapabilities()'s lifecycle filter (CW-GR-016 registry-side gate).
CREATE INDEX IF NOT EXISTS idx_case_workspace_capabilities_lifecycle
  ON case_workspace_capabilities (lifecycle);

-- CW-GR-019/021: minimal ledger recording that a given
-- CommandEnvelope.idempotencyKey has been seen for a given registered
-- capability, so a retry with the same key and the same payload can be
-- recognized as a safe duplicate and a retry with the same key but a
-- different payload can be rejected (fails closed). Has no completion/
-- outcome column by design — only the out-of-scope adapter/dispatcher that
-- actually executes a capability knows the real result; see the service
-- file's open_questions for the TTL/expiry follow-up this implies.
CREATE TABLE IF NOT EXISTS case_workspace_capability_idempotency_keys (
  -- Own row identity, minted `cwcapidem-${uuid}`.
  idempotency_record_id TEXT PRIMARY KEY,

  -- Which exact registered capability version this idempotency check was
  -- against. FK-only, ON DELETE CASCADE so a deleted capability row cannot
  -- leave orphaned idempotency records.
  capability_registry_id TEXT NOT NULL
    REFERENCES case_workspace_capabilities(capability_registry_id) ON DELETE CASCADE,

  -- Caller-supplied CommandEnvelope.idempotencyKey (CW-GR-021).
  idempotency_key TEXT NOT NULL,

  -- CommandEnvelope.actor.actorId (CW-GR-021) — who invoked the check.
  actor_id TEXT NOT NULL,

  -- `sha256:<hex>` over the canonicalized request payload (same
  -- canonicalize-then-hash pattern as
  -- casePlanVersionService.computeGraphDigest, copied locally per this
  -- directory's own convention) — never the raw payload, so secrets never
  -- enter this table (CW-DOD-C3).
  request_digest TEXT NOT NULL,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT case_workspace_capability_idempotency_keys_unique
    UNIQUE (capability_registry_id, idempotency_key)
);

-- Primary read path: look up an existing idempotency record by its natural
-- key (also used by the ON CONFLICT target in recordIdempotencyKeyCheck).
CREATE INDEX IF NOT EXISTS idx_case_workspace_capability_idempotency_keys_registry_id
  ON case_workspace_capability_idempotency_keys (capability_registry_id);
