/**
 * Case Workspace — Capability Registry service (CW-P03, EPIC E3 "Capability
 * Registry and native module commands").
 *
 * Backs the `case_workspace_capabilities` and
 * `case_workspace_capability_idempotency_keys` tables added in
 * server/migrations/20260809_case_workspace_capability_registry.sql. Per the
 * packet's collision-avoidance mandate (docs/product/case-workspace/
 * acceptance/CODEBASE_CONVERGENCE_MAP.csv, area=capability-commands), this
 * service is deliberately distinct from and never touches:
 *   1. capabilityService.ts / capability.routes.ts — staffing/skills.
 *   2. initiativeCapabilityMatrix.ts — Initiative edit-permission matrix.
 *   3. toolGovernanceService.ts's `v8_tool_catalog` — AI function-calling
 *      tool governance.
 *   4. toolsOrgAdminService.ts's `v8_shared_tools_registry` — consulting
 *      methodology frameworks (SWOT etc.) shown in DiscoveryToolsHub.tsx.
 * It also never writes `case_core`/`case_plan_versions` (CW-P01/CW-P02's own
 * tables) or Finance/Results, and it builds no adapters
 * (InternalCommandAdapter/McpCapabilityAdapter/HttpApiCapabilityAdapter/
 * ConnectorCapabilityAdapter/AgentCapabilityAdapter/LegacyToolAdapter) — this
 * is registry persistence and lookup/registration only, per the packet's
 * explicit scope carve-out. `approval_recommendation` reuses the existing
 * ApprovalClass enum from server/src/types/executionSpine.ts BY REFERENCE
 * (read-only import below), not a duplicated vocabulary.
 *
 * req_id coverage (docs/product/case-workspace/acceptance/
 * FUNCTIONAL_REQUIREMENT_COVERAGE.csv, epics column contains "E3"):
 *
 *   registerCapability         -> CW-GR-015, CW-GR-020, CW-DOD-C1, CW-GR-029, MIG-016
 *   getCapabilityVersion       -> CW-GR-029, CW-GR-046
 *   getCapabilityByRegistryId  -> CW-GR-029
 *   listCapabilities           -> CW-GR-029, CW-GR-030
 *   listActiveCapabilities     -> CW-GR-016, CW-GR-046, MIG-016
 *   markCapabilityHealth       -> CW-GR-015, CW-GR-016, CW-GR-047
 *   recordIdempotencyKeyCheck  -> CW-GR-019, CW-GR-021
 *
 * Cross-cutting invariants held by every method here (see the migration
 * file's header for the exact canon citations):
 *   - exactly one row per (capability_id, capability_version); once
 *     registered, a version's schema/policy/effect-class fields are
 *     immutable — corrections mint a NEW capability_version row, never an
 *     in-place rewrite (mirrors CasePlanVersion's publish-immutability
 *     precedent from CW-P02);
 *   - `version` is the optimistic-concurrency counter (bumped only by
 *     markCapabilityHealth in this packet); `capability_version` is the
 *     unrelated domain semver ordinal from CW-GR-015's `version` field —
 *     same naming split CW-P02 already established between
 *     case_plan_versions.version (OCC) and .plan_number (domain ordinal);
 *   - every mutating method uses loadForUpdate + `WHERE ... AND version =
 *     expectedVersion`; a 0-row UPDATE throws a *_version_conflict error
 *     with no partial write, matching caseCoreService.ts/
 *     casePlanVersionService.ts convention exactly;
 *   - case_workspace_capabilities and
 *     case_workspace_capability_idempotency_keys carry no case_id/
 *     organization_id column — the registry is platform-global, never
 *     tenant-scoped (open_questions #1);
 *   - idempotency records store only a sha256 digest of the request payload
 *     (never the raw payload) scoped per (capability_registry_id,
 *     idempotency_key) — secrets never enter this table (CW-DOD-C3);
 *   - a reused idempotency key with a mismatched request digest fails closed
 *     with idempotency_key_conflict rather than silently returning a
 *     stale/duplicate result.
 *
 * OPEN QUESTIONS (flagged in the approved design, carried forward here — not
 * resolved by this packet, product/API-owner confirmation needed):
 *   1. Capability Registry scope: designed as platform-global (no
 *      organization_id/case_id column) because CW-GR-015's
 *      CapabilityDefinition schema lists no tenant field and
 *      GET /api/capabilities?availability=&ownerModule=&cursor= has no orgId
 *      filter param — but CW-GR-030's "all list endpoints are tenant-scoped"
 *      sits under the same 7.5 heading as /api/process-definitions (which IS
 *      explicitly org-scoped via scope=private|team|organization). Confirm
 *      with product/API owner whether capabilities need an org-level
 *      enablement overlay later (conceptually analogous to
 *      toolGovernanceService's ConsumerToolPolicy in the unrelated V8
 *      tool-governance domain, but NOT reusing that table, per the
 *      collision-avoidance mandate) before this design ships in a route.
 *   2. capability_version (CW-GR-015's literal `version` field) vs. this
 *      table's own OCC `version` column repeats, verbatim, the exact
 *      version-naming collision CW-P02 already flagged for
 *      case_plan_versions.plan_number/.version. Confirm before any public
 *      API shape exposes two differently-named "version" concepts for the
 *      same resource family.
 *   3. CW-GR-020 lists "effective scope", "error taxonomy" and "expected
 *      target version" as required capability attributes; none has a
 *      canon-defined shape or enum anywhere in docs/product/case-workspace/
 *      *.md. This design stores them nowhere but the open-ended `metadata`
 *      JSON column rather than guessing a schema — needs product
 *      confirmation before promotion to real typed columns.
 *   4. data_classification, idempotency_strategy, reversibility, and health
 *      are stored as free text/a locally-invented enum (health:
 *      HEALTHY|DEGRADED|UNHEALTHY|UNKNOWN) because canon names these
 *      CW-GR-015 fields but never enumerates their allowed values anywhere
 *      in the ground-truth docs. Confirm exact vocabularies before any UI
 *      renders them as fixed choices.
 *   5. CW-GR-016's full "active" gate requires a working adapter, not just
 *      registry-row completeness; this packet has no adapter table/concept
 *      at all (adapters are explicitly later E3 work), so
 *      listActiveCapabilities() can only enforce the registry-side half of
 *      that gate. Flag for whoever owns the adapter-registration follow-up
 *      packet.
 *   6. recordIdempotencyKeyCheck only records that a key was seen and
 *      detects conflicting reuse of the same key with a different payload;
 *      it has no "complete/finalize with outcome" counterpart, since only
 *      the (out-of-scope) command dispatcher that actually executes the
 *      capability knows the real outcome. A key left mid-execution by a
 *      crash is stuck as "seen" forever under this design — confirm whether
 *      a TTL/expiry or an explicit completion call is needed before any
 *      caller relies on this for safe retries, and who owns adding it.
 *   7. owning_command_ref (added beyond CW-GR-015's literal field list, to
 *      satisfy CW-GR-020/CW-RT-010/CW-CANON-08/CW-DOD-C4's "human UI and
 *      Teresa call the same owning command") is recorded as an opaque string
 *      with no enforcement in this packet — nothing here verifies that the
 *      human-UI route and the Teresa tool dispatcher actually reference the
 *      same value at runtime. That verification belongs to whichever later
 *      packet wires routes/dispatcher through this registry.
 */

import { createHash } from 'crypto';

import { v4 as uuidv4 } from 'uuid';

import {
  type PgTransactionClient,
  queryAll,
  queryOne,
  withPgTransaction,
} from '../../utils/queryHelpers.js';
import { ApprovalClassValues, type ApprovalClass } from '../../types/executionSpine.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type CapabilityProviderType = 'INTERNAL' | 'MCP' | 'HTTP_API' | 'CONNECTOR' | 'AGENT';
export type CapabilityOperationClass = 'READ' | 'COMPUTE' | 'PROPOSE' | 'MUTATE' | 'PUBLISH' | 'NOTIFY';
export type CapabilityEffectClass =
  | 'SAFE_ADDITIVE'
  | 'SAFE_UPDATE'
  | 'SENSITIVE_UPDATE'
  | 'DESTRUCTIVE'
  | 'GOVERNANCE_TRANSITION';
export type CapabilityHealth = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN';
export type CapabilityLifecycle = 'ACTIVE' | 'DEPRECATED' | 'UNAVAILABLE';

export interface CaseActor {
  actorUserId: string;
}

interface CapabilityRegistryRow {
  capability_registry_id: string;
  capability_id: string;
  capability_version: string;
  owner_module: string;
  provider_type: CapabilityProviderType;
  operation: string;
  owning_command_ref: string;
  input_schema_ref: string;
  output_schema_ref: string;
  operation_class: CapabilityOperationClass;
  effect_class: CapabilityEffectClass;
  required_roles: string;
  data_classification: string;
  residency: string | null;
  idempotency_strategy: string;
  reversibility: string;
  approval_recommendation: ApprovalClass;
  events_emitted: string;
  rate_limit: string | null;
  cost_policy: string | null;
  timeout_defaults: string;
  readback_query: string | null;
  health: CapabilityHealth;
  health_checked_at: string | null;
  health_detail: string | null;
  lifecycle: CapabilityLifecycle;
  test_fixture_ref: string | null;
  metadata: string;
  created_by_actor_id: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface CapabilityRegistryEntry {
  capabilityRegistryId: string;
  capabilityId: string;
  capabilityVersion: string;
  ownerModule: string;
  providerType: CapabilityProviderType;
  operation: string;
  owningCommandRef: string;
  inputSchemaRef: string;
  outputSchemaRef: string;
  operationClass: CapabilityOperationClass;
  effectClass: CapabilityEffectClass;
  requiredRoles: string[];
  dataClassification: string;
  residency: string | null;
  idempotencyStrategy: string;
  reversibility: string;
  approvalRecommendation: ApprovalClass;
  eventsEmitted: string[];
  rateLimit: Record<string, unknown> | null;
  costPolicy: Record<string, unknown> | null;
  timeoutDefaults: Record<string, unknown>;
  readbackQuery: string | null;
  health: CapabilityHealth;
  healthCheckedAt: string | null;
  healthDetail: string | null;
  lifecycle: CapabilityLifecycle;
  testFixtureRef: string | null;
  metadata: Record<string, unknown>;
  createdByActorId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterCapabilityInput {
  capabilityId: string;
  capabilityVersion: string;
  ownerModule: string;
  providerType: CapabilityProviderType;
  operation: string;
  owningCommandRef: string;
  inputSchemaRef: string;
  outputSchemaRef: string;
  operationClass: CapabilityOperationClass;
  effectClass: CapabilityEffectClass;
  requiredRoles?: string[];
  dataClassification: string;
  residency?: string | null;
  idempotencyStrategy: string;
  reversibility: string;
  approvalRecommendation: ApprovalClass;
  eventsEmitted?: string[];
  rateLimit?: Record<string, unknown> | null;
  costPolicy?: Record<string, unknown> | null;
  timeoutDefaults?: Record<string, unknown>;
  readbackQuery?: string | null;
  health?: CapabilityHealth;
  lifecycle?: CapabilityLifecycle;
  testFixtureRef?: string | null;
  metadata?: Record<string, unknown>;
  createdByActorId: string;
}

interface IdempotencyKeyRow {
  idempotency_record_id: string;
  capability_registry_id: string;
  idempotency_key: string;
  actor_id: string;
  request_digest: string;
  created_at: string;
}

export interface RecordIdempotencyKeyCheckResult {
  isDuplicate: boolean;
  recordedAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROVIDER_TYPES: readonly CapabilityProviderType[] = ['INTERNAL', 'MCP', 'HTTP_API', 'CONNECTOR', 'AGENT'];
const OPERATION_CLASSES: readonly CapabilityOperationClass[] = [
  'READ',
  'COMPUTE',
  'PROPOSE',
  'MUTATE',
  'PUBLISH',
  'NOTIFY',
];
const EFFECT_CLASSES: readonly CapabilityEffectClass[] = [
  'SAFE_ADDITIVE',
  'SAFE_UPDATE',
  'SENSITIVE_UPDATE',
  'DESTRUCTIVE',
  'GOVERNANCE_TRANSITION',
];
const HEALTH_VALUES: readonly CapabilityHealth[] = ['HEALTHY', 'DEGRADED', 'UNHEALTHY', 'UNKNOWN'];
const LIFECYCLE_VALUES: readonly CapabilityLifecycle[] = ['ACTIVE', 'DEPRECATED', 'UNAVAILABLE'];

// ---------------------------------------------------------------------------
// Local helpers (mirrors caseCoreService.ts/casePlanVersionService.ts's own
// local helpers — not imported from there, each service file in this
// directory keeps its own copy per that file's existing convention).
// ---------------------------------------------------------------------------

function requireNonBlank(value: string | null | undefined, reason: string): string {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(reason);
  return normalized;
}

function requireEnum<T extends string>(
  value: T | null | undefined,
  allowed: readonly T[],
  reason: string
): T {
  if (!value || !allowed.includes(value)) throw new Error(reason);
  return value;
}

function parseJsonArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw || '[]');
    if (Array.isArray(parsed)) return parsed.map((item) => String(item));
  } catch {
    // fall through to []
  }
  return [];
}

function parseJsonObject(raw: string | null): Record<string, unknown> | null {
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fall through
  }
  return {};
}

function mapRow(row: CapabilityRegistryRow): CapabilityRegistryEntry {
  return {
    capabilityRegistryId: row.capability_registry_id,
    capabilityId: row.capability_id,
    capabilityVersion: row.capability_version,
    ownerModule: row.owner_module,
    providerType: row.provider_type,
    operation: row.operation,
    owningCommandRef: row.owning_command_ref,
    inputSchemaRef: row.input_schema_ref,
    outputSchemaRef: row.output_schema_ref,
    operationClass: row.operation_class,
    effectClass: row.effect_class,
    requiredRoles: parseJsonArray(row.required_roles),
    dataClassification: row.data_classification,
    residency: row.residency,
    idempotencyStrategy: row.idempotency_strategy,
    reversibility: row.reversibility,
    approvalRecommendation: row.approval_recommendation,
    eventsEmitted: parseJsonArray(row.events_emitted),
    rateLimit: parseJsonObject(row.rate_limit),
    costPolicy: parseJsonObject(row.cost_policy),
    timeoutDefaults: parseJsonObject(row.timeout_defaults) ?? {},
    readbackQuery: row.readback_query,
    health: row.health,
    healthCheckedAt: row.health_checked_at,
    healthDetail: row.health_detail,
    lifecycle: row.lifecycle,
    testFixtureRef: row.test_fixture_ref,
    metadata: parseJsonObject(row.metadata) ?? {},
    createdByActorId: row.created_by_actor_id,
    version: Number(row.version),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Request digest (CW-DOD-C3). Same canonicalize-then-sha256 pattern as
// casePlanVersionService.computeGraphDigest, copied locally per this
// directory's own convention — deliberately simpler (plain deterministic
// JSON.stringify over a recursively key-sorted clone) since idempotency
// payloads have no nodes[]/edges[]/variables[]-shaped arrays to reorder.
// ---------------------------------------------------------------------------

function sortKeysDeep(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.map((item) => sortKeysDeep(item));
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .map(([key, v]) => [key, sortKeysDeep(v)] as const)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const result: Record<string, unknown> = {};
    for (const [key, v] of entries) result[key] = v;
    return result;
  }
  return value;
}

/**
 * `sha256:<hex>` over the canonicalized request payload — never persists the
 * raw payload itself (CW-DOD-C3). Same node:crypto call already used at
 * casePlanVersionService.computeGraphDigest.
 */
export function computeRequestDigest(requestPayload: unknown): string {
  const canonical = sortKeysDeep(requestPayload ?? null);
  const json = JSON.stringify(canonical);
  return `sha256:${createHash('sha256').update(json, 'utf8').digest('hex')}`;
}

// ---------------------------------------------------------------------------
// Row loaders
// ---------------------------------------------------------------------------

async function loadForUpdate(
  client: PgTransactionClient,
  capabilityRegistryId: string
): Promise<CapabilityRegistryRow> {
  const result = await client.query<CapabilityRegistryRow>(
    `SELECT * FROM case_workspace_capabilities WHERE capability_registry_id = ? FOR UPDATE`,
    [capabilityRegistryId]
  );
  const row = result.rows[0];
  if (!row) throw new Error('capability_not_found');
  return row;
}

// ---------------------------------------------------------------------------
// Service methods
// ---------------------------------------------------------------------------

/**
 * CW-GR-015 (CapabilityDefinition), CW-GR-020 (required capability
 * attributes), CW-DOD-C1, CW-GR-029, MIG-016.
 *
 * Validates required enum/non-blank fields, including approvalRecommendation
 * against the imported ApprovalClassValues (read-only reference to
 * server/src/types/executionSpine.ts, not a duplicated vocabulary). Inside
 * withPgTransaction, pre-checks for an existing (capability_id,
 * capability_version) row and throws capability_already_registered for a
 * friendlier error before the UNIQUE constraint fires; then INSERTs a new
 * immutable row (version=1, lifecycle defaults to 'UNAVAILABLE', health
 * defaults to 'UNKNOWN' unless the caller asserts otherwise). A given
 * (capability_id, capability_version) pair is registered at most once —
 * corrections require a NEW capability_version, never an in-place edit of a
 * shipped definition.
 */
export async function registerCapability(input: RegisterCapabilityInput): Promise<CapabilityRegistryEntry> {
  const capabilityId = requireNonBlank(input.capabilityId, 'capability_id_required');
  const capabilityVersion = requireNonBlank(input.capabilityVersion, 'capability_version_required');
  const ownerModule = requireNonBlank(input.ownerModule, 'capability_owner_module_required');
  const operation = requireNonBlank(input.operation, 'capability_operation_required');
  const owningCommandRef = requireNonBlank(input.owningCommandRef, 'capability_owning_command_ref_required');
  const inputSchemaRef = requireNonBlank(input.inputSchemaRef, 'capability_input_schema_ref_required');
  const outputSchemaRef = requireNonBlank(input.outputSchemaRef, 'capability_output_schema_ref_required');
  const dataClassification = requireNonBlank(input.dataClassification, 'capability_data_classification_required');
  const idempotencyStrategy = requireNonBlank(input.idempotencyStrategy, 'capability_idempotency_strategy_required');
  const reversibility = requireNonBlank(input.reversibility, 'capability_reversibility_required');
  const createdByActorId = requireNonBlank(input.createdByActorId, 'capability_created_by_actor_required');

  const providerType = requireEnum(input.providerType, PROVIDER_TYPES, 'capability_provider_type_invalid');
  const operationClass = requireEnum(input.operationClass, OPERATION_CLASSES, 'capability_operation_class_invalid');
  const effectClass = requireEnum(input.effectClass, EFFECT_CLASSES, 'capability_effect_class_invalid');
  const approvalRecommendation = requireEnum(
    input.approvalRecommendation,
    ApprovalClassValues,
    'capability_approval_recommendation_invalid'
  );
  const health = requireEnum(input.health ?? 'UNKNOWN', HEALTH_VALUES, 'capability_health_invalid');
  const lifecycle = requireEnum(input.lifecycle ?? 'UNAVAILABLE', LIFECYCLE_VALUES, 'capability_lifecycle_invalid');

  return withPgTransaction(async (client) => {
    const existing = await client.query<{ capability_registry_id: string }>(
      `SELECT capability_registry_id FROM case_workspace_capabilities
        WHERE capability_id = ? AND capability_version = ?`,
      [capabilityId, capabilityVersion]
    );
    if (existing.rows[0]) throw new Error('capability_already_registered');

    const capabilityRegistryId = `cwcap-${uuidv4()}`;
    const now = new Date().toISOString();

    const inserted = await client.query<CapabilityRegistryRow>(
      `INSERT INTO case_workspace_capabilities (
         capability_registry_id, capability_id, capability_version, owner_module,
         provider_type, operation, owning_command_ref, input_schema_ref,
         output_schema_ref, operation_class, effect_class, required_roles,
         data_classification, residency, idempotency_strategy, reversibility,
         approval_recommendation, events_emitted, rate_limit, cost_policy,
         timeout_defaults, readback_query, health, health_checked_at,
         health_detail, lifecycle, test_fixture_ref, metadata,
         created_by_actor_id, version, created_at, updated_at
       ) VALUES (
         ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
         ?, ?, ?, ?, ?, 1, ?, ?
       )
       RETURNING *`,
      [
        capabilityRegistryId,
        capabilityId,
        capabilityVersion,
        ownerModule,
        providerType,
        operation,
        owningCommandRef,
        inputSchemaRef,
        outputSchemaRef,
        operationClass,
        effectClass,
        JSON.stringify(input.requiredRoles ?? []),
        dataClassification,
        input.residency ?? null,
        idempotencyStrategy,
        reversibility,
        approvalRecommendation,
        JSON.stringify(input.eventsEmitted ?? []),
        input.rateLimit ? JSON.stringify(input.rateLimit) : null,
        input.costPolicy ? JSON.stringify(input.costPolicy) : null,
        JSON.stringify(input.timeoutDefaults ?? {}),
        input.readbackQuery ?? null,
        health,
        null,
        null,
        lifecycle,
        input.testFixtureRef ?? null,
        JSON.stringify(input.metadata ?? {}),
        createdByActorId,
        now,
        now,
      ]
    );
    return mapRow(inserted.rows[0]);
  });
}

/**
 * CW-GR-029 (GET /api/capabilities/:capabilityId/versions/:version),
 * CW-GR-046. Plain read by the natural key, no lock.
 */
export async function getCapabilityVersion(
  capabilityId: string,
  capabilityVersion: string
): Promise<CapabilityRegistryEntry | null> {
  const row = await queryOne<CapabilityRegistryRow>(
    `SELECT * FROM case_workspace_capabilities WHERE capability_id = ? AND capability_version = ?`,
    [
      requireNonBlank(capabilityId, 'capability_id_required'),
      requireNonBlank(capabilityVersion, 'capability_version_required'),
    ]
  );
  return row ? mapRow(row) : null;
}

/**
 * CW-GR-029. Plain read by the row's own PK — used internally by
 * markCapabilityHealth/recordIdempotencyKeyCheck callers and any future
 * route that already holds the row id.
 */
export async function getCapabilityByRegistryId(
  capabilityRegistryId: string
): Promise<CapabilityRegistryEntry | null> {
  const row = await queryOne<CapabilityRegistryRow>(
    `SELECT * FROM case_workspace_capabilities WHERE capability_registry_id = ?`,
    [requireNonBlank(capabilityRegistryId, 'capability_registry_id_required')]
  );
  return row ? mapRow(row) : null;
}

/**
 * CW-GR-029 (GET /api/capabilities?availability=&ownerModule=&cursor=),
 * CW-GR-030. Filtered list ordered by capability_id ASC, capability_version
 * DESC — cursor pagination is left for the future route packet to add via
 * keyset on capability_registry_id. Platform-global, no tenant filter (see
 * open_questions #1).
 */
export async function listCapabilities(filters?: {
  ownerModule?: string;
  lifecycle?: CapabilityLifecycle;
  capabilityId?: string;
}): Promise<CapabilityRegistryEntry[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters?.ownerModule) {
    conditions.push('owner_module = ?');
    params.push(requireNonBlank(filters.ownerModule, 'capability_owner_module_required'));
  }
  if (filters?.lifecycle) {
    conditions.push('lifecycle = ?');
    params.push(requireEnum(filters.lifecycle, LIFECYCLE_VALUES, 'capability_lifecycle_invalid'));
  }
  if (filters?.capabilityId) {
    conditions.push('capability_id = ?');
    params.push(requireNonBlank(filters.capabilityId, 'capability_id_required'));
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await queryAll<CapabilityRegistryRow>(
    `SELECT * FROM case_workspace_capabilities
       ${whereClause}
      ORDER BY capability_id ASC, capability_version DESC`,
    params
  );
  return rows.map(mapRow);
}

/**
 * CW-GR-016 (a capability is "active" once schema, policy and health are
 * present and a working adapter exists), CW-GR-046, MIG-016.
 *
 * Thin wrapper over listCapabilities filtered to lifecycle='ACTIVE' AND
 * health <> 'UNHEALTHY' — the registry-side half of CW-GR-016's "active"
 * gate (schema/policy/health presence is already guaranteed by NOT NULL
 * columns at insert time; the adapter-presence half of CW-GR-016 is out of
 * this packet's scope, see open_questions #5).
 */
export async function listActiveCapabilities(filters?: {
  ownerModule?: string;
}): Promise<CapabilityRegistryEntry[]> {
  const all = await listCapabilities({ ownerModule: filters?.ownerModule, lifecycle: 'ACTIVE' });
  return all.filter((entry) => entry.health !== 'UNHEALTHY');
}

/**
 * CW-GR-015, CW-GR-016, CW-GR-047 ("exact reason" for health status).
 *
 * loadForUpdate + `WHERE ... AND version = expectedVersion` OCC update of
 * health/health_detail/health_checked_at only — never touches
 * schema/policy/effect-class columns, which are immutable post-registration.
 * A 0-row UPDATE throws capability_version_conflict.
 */
export async function markCapabilityHealth(
  capabilityRegistryId: string,
  health: CapabilityHealth,
  actor: CaseActor,
  detail: string | null,
  expectedVersion: number
): Promise<CapabilityRegistryEntry> {
  const id = requireNonBlank(capabilityRegistryId, 'capability_registry_id_required');
  requireNonBlank(actor?.actorUserId, 'capability_actor_required');
  requireEnum(health, HEALTH_VALUES, 'capability_health_invalid');
  if (typeof expectedVersion !== 'number') throw new Error('capability_expected_version_required');

  return withPgTransaction(async (client) => {
    // Confirms the row exists before attempting the OCC update, same
    // loadForUpdate + WHERE ... AND version = ? convention as
    // caseCoreService.ts/casePlanVersionService.ts.
    await loadForUpdate(client, id);

    const now = new Date().toISOString();
    const updated = await client.query<CapabilityRegistryRow>(
      `UPDATE case_workspace_capabilities
          SET health = ?, health_detail = ?, health_checked_at = ?,
              version = version + 1, updated_at = ?
        WHERE capability_registry_id = ? AND version = ?
        RETURNING *`,
      [health, detail ?? null, now, now, id, expectedVersion]
    );
    if (!updated.rows[0]) throw new Error('capability_version_conflict');
    return mapRow(updated.rows[0]);
  });
}

/**
 * CW-GR-019 (enforce idempotency), CW-GR-021 (CommandEnvelope.idempotencyKey
 * + actor).
 *
 * Computes requestDigest via computeRequestDigest (sha256 over the
 * canonicalized payload, never the raw payload — CW-DOD-C3). Pre-checks
 * capabilityRegistryId exists for a friendlier error than the FK constraint.
 * Issues `INSERT ... ON CONFLICT (capability_registry_id, idempotency_key)
 * DO NOTHING RETURNING *`; a returned row means isDuplicate=false (first
 * time this key was seen). No returned row means it SELECTs the existing
 * row: matching request_digest returns isDuplicate=true (safe replay —
 * caller must not re-execute); a mismatched digest throws
 * idempotency_key_conflict (fails closed rather than returning a stale
 * result for a different payload).
 */
export async function recordIdempotencyKeyCheck(input: {
  capabilityRegistryId: string;
  idempotencyKey: string;
  requestPayload: unknown;
  actorId: string;
}): Promise<RecordIdempotencyKeyCheckResult> {
  const capabilityRegistryId = requireNonBlank(input.capabilityRegistryId, 'capability_registry_id_required');
  const idempotencyKey = requireNonBlank(input.idempotencyKey, 'capability_idempotency_key_required');
  const actorId = requireNonBlank(input.actorId, 'capability_actor_required');
  const requestDigest = computeRequestDigest(input.requestPayload);

  return withPgTransaction(async (client) => {
    const capabilityExists = await client.query<{ capability_registry_id: string }>(
      `SELECT capability_registry_id FROM case_workspace_capabilities WHERE capability_registry_id = ?`,
      [capabilityRegistryId]
    );
    if (!capabilityExists.rows[0]) throw new Error('capability_not_found');

    const now = new Date().toISOString();
    const idempotencyRecordId = `cwcapidem-${uuidv4()}`;

    const inserted = await client.query<IdempotencyKeyRow>(
      `INSERT INTO case_workspace_capability_idempotency_keys (
         idempotency_record_id, capability_registry_id, idempotency_key,
         actor_id, request_digest, created_at
       ) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (capability_registry_id, idempotency_key) DO NOTHING
       RETURNING *`,
      [idempotencyRecordId, capabilityRegistryId, idempotencyKey, actorId, requestDigest, now]
    );
    if (inserted.rows[0]) {
      return { isDuplicate: false, recordedAt: inserted.rows[0].created_at };
    }

    const existingResult = await client.query<IdempotencyKeyRow>(
      `SELECT * FROM case_workspace_capability_idempotency_keys
        WHERE capability_registry_id = ? AND idempotency_key = ?`,
      [capabilityRegistryId, idempotencyKey]
    );
    const existing = existingResult.rows[0];
    if (!existing) throw new Error('capability_idempotency_record_not_found');
    if (existing.request_digest !== requestDigest) {
      throw new Error('idempotency_key_conflict');
    }
    return { isDuplicate: true, recordedAt: existing.created_at };
  });
}
