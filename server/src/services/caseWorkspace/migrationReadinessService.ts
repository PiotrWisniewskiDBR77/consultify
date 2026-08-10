/**
 * Case Workspace — Migration & Legacy Retirement Readiness service (CW-P11,
 * EPIC E13 "Migration and legacy retirement readiness").
 *
 * Backs the three tables added in
 * server/migrations/20260809_case_workspace_migration_readiness.sql:
 * `case_workspace_feature_flag_definitions` (an immutable hierarchy catalog
 * of rollout flags, self-referencing via parent_flag_key),
 * `case_workspace_feature_flags` (one mutable per-organization state row per
 * flag) and `case_workspace_legacy_quarantine` (an append-only ledger of
 * legacy records a migration rehearsal could not map).
 *
 * Per docs/product/case-workspace/acceptance/CODEBASE_CONVERGENCE_MAP.csv
 * (area=migrations-flags-outbox), a DB-backed, per-organization feature flag
 * mechanism already exists: server/src/services/v8/featureFlagService.ts,
 * reading v8.v8_feature_flags / v8_feature_flags (organization_id, module,
 * enabled). This packet EXTENDS that table's column/query shape
 * (organization_id, module-shaped key, enabled, updated_at/updated_by,
 * `INSERT ... ON CONFLICT DO UPDATE` upsert) rather than reusing it — this
 * file never SELECTs/INSERTs/UPDATEs v8.v8_feature_flags or
 * v8_feature_flags, and imports nothing from featureFlagService.ts.
 * server/src/config/FeatureFlags.ts (the boot-time, process.env-backed,
 * process-wide singleton) is a different layer entirely — global build-time
 * kill-switches, not per-org/per-cohort rollout state — and is likewise
 * untouched by this file (see open_questions #1 below).
 *
 * Per the packet's own collision-avoidance mandate, this service never
 * references case_core, case_plan_versions, case_workspace_capabilities,
 * case_workspace_run_bindings, case_workspace_action_proposals,
 * case_workspace_waits, case_workspace_history_events,
 * case_workspace_value_measurements, case_workspace_execution_*,
 * case_workspace_artifact_links, case_workspace_plays, Finance or Results.
 *
 * Scope for THIS packet: (1) a case_workspace-scoped feature-flag mechanism
 * with a real, queryable parent/child hierarchy so "disable the smallest
 * flag" (CW-DOD-J3) is a structural relationship, not a naming convention,
 * and (2) a durable, append-only legacy-record quarantine ledger so an
 * unmapped migration-rehearsal record is never silently dropped
 * (CW-DOD-J5). It does NOT build the actual migration/rehearsal SCRIPT that
 * would call recordQuarantinedLegacyRecord() — that is an operational
 * script, explicitly out of scope for this service-layer packet (see
 * open_questions #5). It does NOT build the legacy AgentPlan adapter itself
 * or the retirement-readiness judgment logic that would consume
 * countQuarantinedByReasonCode()'s evidence (CW-00-020-INV14, CW-DOD-J6 —
 * see open_questions #6).
 *
 * req_id coverage (docs/product/case-workspace/acceptance/
 * FUNCTIONAL_REQUIREMENT_COVERAGE.csv, filter epics contains "E13" AND
 * row_id starts with "CW-"):
 *
 *   registerFlagDefinition                       -> CW-DOD-J1, CW-DOD-J3
 *   getFlagDefinition                             -> CW-DOD-J3
 *   listFlagChildren                              -> CW-DOD-J3
 *   listFlagDescendants                           -> CW-DOD-J3
 *   setOrgFlagState                               -> CW-DOD-J1
 *   getCurrentOrgFlagState                        -> CW-DOD-J1
 *   listCurrentOrgFlags                           -> CW-DOD-J2
 *   isFlagEnabledForEntity                        -> CW-DOD-J1, CW-DOD-J2
 *   findSmallestEnabledDescendant                 -> CW-DOD-J3
 *   rollbackFlag                                  -> CW-DOD-J3, CW-DOD-J4
 *   recordQuarantinedLegacyRecord                 -> CW-DOD-J5
 *   getQuarantinedLegacyRecord                    -> CW-DOD-J5
 *   listQuarantinedLegacyRecordsForRehearsalRun    -> CW-DOD-J5, CW-DOD-J6
 *   listQuarantinedLegacyRecordsForSource          -> CW-DOD-J5
 *   countQuarantinedByReasonCode                   -> CW-DOD-J6
 *
 * Cross-cutting invariants held by this service (see the migration file's
 * header for the exact canon citations):
 *   - case_workspace_feature_flag_definitions.default_enabled has a DB
 *     CHECK forbidding TRUE, and registerFlagDefinition()'s own input type
 *     has no field to override it — a flag can never be registered to
 *     default ON (CW-DOD-J1);
 *   - case_workspace_feature_flags has zero rows for a new
 *     (organizationId, flagKey) pair until an explicit setOrgFlagState()
 *     call; getCurrentOrgFlagState() returns null in that case and every
 *     caller reads null as disabled, in every environment — unlike
 *     featureFlagService.isV8Enabled()/isV8ShadowMode()'s non-production
 *     zero-rows-means-enabled fallback, no implicit-enable path exists here
 *     at all (CW-DOD-J1's "server-authoritative");
 *   - parent_flag_key is a real self-referencing FK, not a naming
 *     convention; findSmallestEnabledDescendant() answers "which is the
 *     smallest enabled flag" (CW-DOD-J3) via a WITH RECURSIVE read over it;
 *   - rollbackFlag() performs exactly one UPDATE on exactly one
 *     (organizationId, flagKey) row (via setOrgFlagState()) and never
 *     writes to any other flag row, case_workspace_history_events,
 *     case_workspace_value_measurements or case_core — "preserves
 *     audit/effects" (CW-DOD-J3) by simply never touching them;
 *   - case_workspace_legacy_quarantine has no UPDATE/DELETE method anywhere
 *     in this file and no updated_at column — append-only by structural
 *     omission, the identical convention case_workspace_history_events uses
 *     in caseHistoryService.ts;
 *   - recordQuarantinedLegacyRecord() requires
 *     quarantineReasonCode/quarantineReasonDetail/recoveryPathRef all
 *     non-blank — a legacy record can never be quarantined without a reason
 *     and a recovery pointer (CW-DOD-J5);
 *   - case_workspace_legacy_quarantine.attempted_case_id carries no FK into
 *     case_core — mirrors case_workspace_history_events.case_id's FK-less
 *     design for the identical reason: the row exists precisely because a
 *     mapping could not be established;
 *   - the migration is CREATE TABLE/INDEX IF NOT EXISTS only; no ALTER, no
 *     DROP, against any pre-existing table (CW-DOD-J4);
 *   - dedupe_key + `ON CONFLICT (dedupe_key) DO NOTHING` + re-SELECT
 *     idempotent-replay on case_workspace_legacy_quarantine, and
 *     `ON CONFLICT (organization_id, flag_key) DO UPDATE` on
 *     case_workspace_feature_flags, mirror
 *     caseHistoryService.insertHistoryEvent() /
 *     casePlanVersionService.putViewState()'s established idempotent/upsert
 *     conventions exactly.
 *
 * OPEN QUESTIONS (flagged in the approved design, carried forward here — not
 * resolved by this packet, product/API-owner confirmation needed):
 *   1. Whether a process-level boot-time kill-switch (mirroring
 *      featureFlags.ENABLE_V8_GLOBAL in FeatureFlags.ts) should also gate
 *      case_workspace_feature_flags reads is undecided — this packet builds
 *      only the DB-backed per-org/per-cohort layer per the coordinator's
 *      directive to extend featureFlagService.ts's pattern; a global static
 *      kill-switch is a separate FeatureFlags.ts change, out of scope here.
 *   2. Route/API wiring (who is allowed to call
 *      registerFlagDefinition/setOrgFlagState/rollbackFlag, under what admin
 *      permission) is not built in this service-layer packet — same posture
 *      as every prior CW-P01-10 packet's own open_questions.
 *   3. Tenant/membership fail-closed checks are not performed at this
 *      service layer (no orgId/membership guard parameter on any method) —
 *      same established convention as every prior CW-P packet.
 *   4. cohort and quarantine_reason_code are deliberately open TEXT
 *      catalogs (documented as TS constants below, not DB CHECK lists) —
 *      confirm this tradeoff versus a curated CHECK-constrained list, which
 *      is this directory's usual convention for enum-shaped columns.
 *   5. The actual migration-rehearsal SCRIPT that would call
 *      recordQuarantinedLegacyRecord() is explicitly out of this packet's
 *      scope per the task; this design assumes a future script supplies
 *      rehearsalRunId/sourceRecordSnapshot faithfully, which is not
 *      verified here.
 *   6. CW-00-020-INV14 ("legacy AgentPlan may be an adapter, never a second
 *      authoritative runtime") and CW-DOD-J6 ("retirement prerequisites all
 *      current/evidenced") are only partially served by this packet — it
 *      provides the durable quarantine evidence store and its query
 *      surface, not the AgentPlan adapter itself or the readiness judgment
 *      logic that would consume that evidence.
 *   7. findSmallestEnabledDescendant()'s cycle-prevention for
 *      parent_flag_key relies on a service-level ancestor walk at
 *      registerFlagDefinition() time, not a DB constraint (Postgres CHECK
 *      cannot express general cycle-freedom) — confirm this is acceptable,
 *      matching the same service-enforced-not-DB-enforced convention
 *      case_core uses for its own status transitions.
 *   8. allow_list_json's entity-id semantics (case_id vs actor_id vs
 *      something else) are left caller-defined per flag_key;
 *      isFlagEnabledForEntity() is agnostic to what "entity" means —
 *      confirm whether a fixed entity-kind column is wanted instead of an
 *      untyped JSON array.
 */

import { v4 as uuidv4 } from 'uuid';

import {
  type PgTransactionClient,
  queryAll,
  queryOne,
  withPgTransaction,
} from '../../utils/queryHelpers.js';
import { CaseWorkspaceAuthError, requireOrgMember, requireOrgRole } from './caseWorkspaceAuthContext.js';

// ---------------------------------------------------------------------------
// Public types — Flag Definitions
// ---------------------------------------------------------------------------

interface CaseWorkspaceFeatureFlagDefinitionRow {
  flag_key: string;
  parent_flag_key: string | null;
  description: string;
  default_enabled: boolean;
  created_at: string;
  created_by: string;
}

export interface FlagDefinition {
  flagKey: string;
  parentFlagKey: string | null;
  description: string;
  defaultEnabled: boolean;
  createdAt: string;
  createdBy: string;
}

export interface RegisterFlagDefinitionInput {
  flagKey: string;
  parentFlagKey?: string | null;
  description: string;
  createdBy: string;
}

// ---------------------------------------------------------------------------
// Public types — Org Flag State
// ---------------------------------------------------------------------------

interface CaseWorkspaceFeatureFlagRow {
  flag_id: string;
  organization_id: string;
  flag_key: string;
  enabled: boolean;
  cohort: string | null;
  rollout_percentage: number;
  allow_list_json: string;
  updated_at: string;
  updated_by: string | null;
}

export interface FeatureFlagState {
  flagId: string;
  organizationId: string;
  flagKey: string;
  enabled: boolean;
  cohort: string | null;
  rolloutPercentage: number;
  allowList: string[];
  updatedAt: string;
  updatedBy: string | null;
}

export interface SetOrgFlagStateInput {
  organizationId: string;
  flagKey: string;
  enabled: boolean;
  cohort?: string | null;
  rolloutPercentage?: number;
  allowList?: string[];
  updatedBy: string;
}

// ---------------------------------------------------------------------------
// Public types — Legacy Quarantine
// ---------------------------------------------------------------------------

/**
 * Documented catalog of quarantine_reason_code values this packet's own
 * callers are expected to use. NOT a DB CHECK enum (open_questions #4) —
 * mirrors event_type's open-catalog convention in caseHistoryService.ts.
 * recordQuarantinedLegacyRecord() itself only requires
 * quarantineReasonCode to be a non-blank string.
 */
export const QUARANTINE_REASON_CODES = [
  'NO_CASE_MATCH',
  'AMBIGUOUS_MATCH',
  'MISSING_ORG_SCOPE',
  'SCHEMA_MISMATCH',
  'DUPLICATE_CANDIDATE',
] as const;

export type KnownQuarantineReasonCode = (typeof QUARANTINE_REASON_CODES)[number];

interface CaseWorkspaceLegacyQuarantineRow {
  quarantine_id: string;
  organization_id: string;
  rehearsal_run_id: string;
  source_system: string;
  source_table: string;
  source_id: string;
  attempted_case_id: string | null;
  quarantine_reason_code: string;
  quarantine_reason_detail: string;
  recovery_path_ref: string;
  source_record_snapshot: string;
  detected_at: string;
  recorded_at: string;
  dedupe_key: string | null;
}

export interface QuarantinedLegacyRecord {
  quarantineId: string;
  organizationId: string;
  rehearsalRunId: string;
  sourceSystem: string;
  sourceTable: string;
  sourceId: string;
  attemptedCaseId: string | null;
  quarantineReasonCode: string;
  quarantineReasonDetail: string;
  recoveryPathRef: string;
  sourceRecordSnapshot: Record<string, unknown>;
  detectedAt: string;
  recordedAt: string;
  dedupeKey: string | null;
}

export interface RecordQuarantinedLegacyRecordInput {
  organizationId: string;
  rehearsalRunId: string;
  sourceSystem: string;
  sourceTable: string;
  sourceId: string;
  attemptedCaseId?: string | null;
  quarantineReasonCode: string;
  quarantineReasonDetail: string;
  recoveryPathRef: string;
  sourceRecordSnapshot?: Record<string, unknown> | null;
  detectedAt: string;
  dedupeKey?: string | null;
}

// ---------------------------------------------------------------------------
// Local helpers (mirrors caseHistoryService.ts/casePlanVersionService.ts/
// runBindingService.ts/proposalApprovalService.ts/
// waitSubscriptionService.ts's own local helpers — not imported from there,
// each service file in this directory keeps its own copy per that file's
// existing convention).
// ---------------------------------------------------------------------------

function requireNonBlank(value: string | null | undefined, reason: string): string {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(reason);
  return normalized;
}

function mapFlagDefinitionRow(row: CaseWorkspaceFeatureFlagDefinitionRow): FlagDefinition {
  return {
    flagKey: row.flag_key,
    parentFlagKey: row.parent_flag_key,
    description: row.description,
    defaultEnabled: Boolean(row.default_enabled),
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

function mapFeatureFlagRow(row: CaseWorkspaceFeatureFlagRow): FeatureFlagState {
  let allowList: string[] = [];
  try {
    const parsed: unknown = JSON.parse(row.allow_list_json || '[]');
    if (Array.isArray(parsed)) {
      allowList = parsed.filter((value): value is string => typeof value === 'string');
    }
  } catch {
    allowList = [];
  }
  return {
    flagId: row.flag_id,
    organizationId: row.organization_id,
    flagKey: row.flag_key,
    enabled: Boolean(row.enabled),
    cohort: row.cohort,
    rolloutPercentage: Number(row.rollout_percentage),
    allowList,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

function mapLegacyQuarantineRow(row: CaseWorkspaceLegacyQuarantineRow): QuarantinedLegacyRecord {
  let sourceRecordSnapshot: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(row.source_record_snapshot || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      sourceRecordSnapshot = parsed as Record<string, unknown>;
    }
  } catch {
    sourceRecordSnapshot = {};
  }
  return {
    quarantineId: row.quarantine_id,
    organizationId: row.organization_id,
    rehearsalRunId: row.rehearsal_run_id,
    sourceSystem: row.source_system,
    sourceTable: row.source_table,
    sourceId: row.source_id,
    attemptedCaseId: row.attempted_case_id,
    quarantineReasonCode: row.quarantine_reason_code,
    quarantineReasonDetail: row.quarantine_reason_detail,
    recoveryPathRef: row.recovery_path_ref,
    sourceRecordSnapshot,
    detectedAt: row.detected_at,
    recordedAt: row.recorded_at,
    dedupeKey: row.dedupe_key,
  };
}

/**
 * Deterministic 0-99 bucket for a string, via a 32-bit FNV-1a hash. Pure, no
 * randomness, no DB access — the same (flagKey, entityId) pair always maps
 * to the same bucket, so a percentage increase in setOrgFlagState() only
 * ever ADDS entities to a rollout, never removes one that was already in.
 */
function stableHashBucket(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return Math.abs(hash) % 100;
}

// ---------------------------------------------------------------------------
// Service methods — Flag Definitions
// ---------------------------------------------------------------------------

/**
 * CW-DOD-J1, CW-DOD-J3. Validates flagKey/description/createdBy non-blank.
 * Idempotent by flag_key: an existing definition with matching
 * parentFlagKey+description is returned unchanged (definitions are
 * immutable — no update method exists anywhere in this file); a conflicting
 * re-registration throws flag_definition_conflict. If parentFlagKey is
 * given, verifies it already exists (throws
 * flag_definition_parent_not_found) and walks its ancestor chain to reject
 * flagKey appearing in it (throws flag_definition_cycle_detected) — a
 * service-level check, since Postgres CHECK cannot express general
 * cycle-freedom (open_questions #7). Inserts with default_enabled
 * hard-coded to FALSE; this function's own input type has no field for it
 * at all, and the migration's CHECK constraint backs this structurally
 * (CW-DOD-J1).
 */
export async function registerFlagDefinition(
  input: RegisterFlagDefinitionInput,
  callerOrganizationId: string
): Promise<FlagDefinition> {
  const flagKey = requireNonBlank(input.flagKey, 'flag_definition_key_required');
  const description = requireNonBlank(input.description, 'flag_definition_description_required');
  const createdBy = requireNonBlank(input.createdBy, 'flag_definition_created_by_required');
  const parentFlagKey = input.parentFlagKey ?? null;

  await requireOrgRole(
    createdBy,
    requireNonBlank(callerOrganizationId, 'flag_definition_caller_organization_id_required'),
    'ADMIN'
  );

  return withPgTransaction(async (client) => {
    const existingResult = await client.query<CaseWorkspaceFeatureFlagDefinitionRow>(
      `SELECT * FROM case_workspace_feature_flag_definitions WHERE flag_key = ?`,
      [flagKey]
    );
    const existing = existingResult.rows[0];
    if (existing) {
      const existingParent = existing.parent_flag_key ?? null;
      if (existingParent === parentFlagKey && existing.description === description) {
        return mapFlagDefinitionRow(existing);
      }
      throw new Error('flag_definition_conflict');
    }

    if (parentFlagKey) {
      await requireFlagDefinitionExists(client, parentFlagKey, 'flag_definition_parent_not_found');
      await assertNoAncestorCycle(client, flagKey, parentFlagKey);
    }

    const now = new Date().toISOString();
    const inserted = await client.query<CaseWorkspaceFeatureFlagDefinitionRow>(
      `INSERT INTO case_workspace_feature_flag_definitions (
         flag_key, parent_flag_key, description, default_enabled, created_at, created_by
       ) VALUES (?, ?, ?, FALSE, ?, ?)
       RETURNING *`,
      [flagKey, parentFlagKey, description, now, createdBy]
    );
    return mapFlagDefinitionRow(inserted.rows[0]);
  });
}

async function requireFlagDefinitionExists(
  client: PgTransactionClient,
  flagKey: string,
  reason: string
): Promise<void> {
  const result = await client.query<{ flag_key: string }>(
    `SELECT flag_key FROM case_workspace_feature_flag_definitions WHERE flag_key = ?`,
    [flagKey]
  );
  if (!result.rows[0]) throw new Error(reason);
}

/**
 * Walks parentFlagKey's own ancestor chain (via parent_flag_key) up to the
 * root, and throws flag_definition_cycle_detected if candidateFlagKey
 * appears anywhere in it. A defensive `seen` guard stops the walk if a
 * pre-existing cycle is somehow encountered, rather than looping forever.
 */
async function assertNoAncestorCycle(
  client: PgTransactionClient,
  candidateFlagKey: string,
  parentFlagKey: string
): Promise<void> {
  let cursor: string | null = parentFlagKey;
  const seen = new Set<string>();
  while (cursor) {
    if (cursor === candidateFlagKey) throw new Error('flag_definition_cycle_detected');
    if (seen.has(cursor)) break;
    seen.add(cursor);
    const result = await client.query<{ parent_flag_key: string | null }>(
      `SELECT parent_flag_key FROM case_workspace_feature_flag_definitions WHERE flag_key = ?`,
      [cursor]
    );
    cursor = result.rows[0]?.parent_flag_key ?? null;
  }
}

/** CW-DOD-J3. Plain read, no lock. */
export async function getFlagDefinition(
  flagKey: string,
  actorUserId: string,
  organizationId: string
): Promise<FlagDefinition | null> {
  const key = requireNonBlank(flagKey, 'flag_definition_key_required');
  await requireOrgMember(
    requireNonBlank(actorUserId, 'flag_definition_actor_required'),
    requireNonBlank(organizationId, 'flag_definition_organization_id_required')
  );
  const row = await queryOne<CaseWorkspaceFeatureFlagDefinitionRow>(
    `SELECT * FROM case_workspace_feature_flag_definitions WHERE flag_key = ?`,
    [key]
  );
  return row ? mapFlagDefinitionRow(row) : null;
}

/** CW-DOD-J3. Plain read, no lock — direct children only. */
export async function listFlagChildren(
  parentFlagKey: string,
  actorUserId: string,
  organizationId: string
): Promise<FlagDefinition[]> {
  const key = requireNonBlank(parentFlagKey, 'flag_definition_parent_key_required');
  await requireOrgMember(
    requireNonBlank(actorUserId, 'flag_definition_actor_required'),
    requireNonBlank(organizationId, 'flag_definition_organization_id_required')
  );
  const rows = await queryAll<CaseWorkspaceFeatureFlagDefinitionRow>(
    `SELECT * FROM case_workspace_feature_flag_definitions WHERE parent_flag_key = ? ORDER BY flag_key ASC`,
    [key]
  );
  return rows.map(mapFlagDefinitionRow);
}

/**
 * CW-DOD-J3. WITH RECURSIVE walk of the full subtree beneath flagKey
 * (excludes flagKey itself), each row tagged with its depth (direct
 * children = 1). Pure DB read, no writes — the literal, queryable answer to
 * "who is beneath this flag in the rollout hierarchy".
 */
export async function listFlagDescendants(
  flagKey: string,
  actorUserId: string,
  organizationId: string
): Promise<Array<FlagDefinition & { depth: number }>> {
  const key = requireNonBlank(flagKey, 'flag_definition_key_required');
  await requireOrgMember(
    requireNonBlank(actorUserId, 'flag_definition_actor_required'),
    requireNonBlank(organizationId, 'flag_definition_organization_id_required')
  );
  const rows = await queryAll<CaseWorkspaceFeatureFlagDefinitionRow & { depth: number | string }>(
    `WITH RECURSIVE descendants AS (
       SELECT flag_key, parent_flag_key, description, default_enabled, created_at,
              created_by, 1 AS depth
         FROM case_workspace_feature_flag_definitions
         WHERE parent_flag_key = ?
       UNION ALL
       SELECT d.flag_key, d.parent_flag_key, d.description, d.default_enabled, d.created_at,
              d.created_by, descendants.depth + 1
         FROM case_workspace_feature_flag_definitions d
         INNER JOIN descendants ON d.parent_flag_key = descendants.flag_key
     )
     SELECT * FROM descendants ORDER BY depth ASC, flag_key ASC`,
    [key]
  );
  return rows.map((row) => ({ ...mapFlagDefinitionRow(row), depth: Number(row.depth) }));
}

// ---------------------------------------------------------------------------
// Service methods — Org Flag State
// ---------------------------------------------------------------------------

/**
 * CW-DOD-J1. Validates organizationId/flagKey/updatedBy non-blank,
 * rolloutPercentage in [0,100] (default 0), and that flagKey exists in
 * case_workspace_feature_flag_definitions (pre-check for a clean error
 * ahead of the FK — throws feature_flag_definition_not_found). UPSERTs the
 * single (organization_id, flag_key) row via
 * `INSERT ... ON CONFLICT (organization_id, flag_key) DO UPDATE` — the
 * exact upsert shape casePlanVersionService.putViewState() and
 * featureFlagService.setV8OrgFlag() both use, extended with
 * cohort/rollout_percentage/allow_list_json. The FIRST-ever row for any
 * (organization_id, flag_key) pair is enabled=false unless this very call
 * explicitly passes enabled:true — there is no implicit-enable path
 * anywhere (CW-DOD-J1's "default OFF, server-authoritative": this is the
 * only write path into the table, so no client bypass exists).
 */
export async function setOrgFlagState(input: SetOrgFlagStateInput): Promise<FeatureFlagState> {
  const organizationId = requireNonBlank(input.organizationId, 'feature_flag_organization_id_required');
  const flagKey = requireNonBlank(input.flagKey, 'feature_flag_key_required');
  const updatedBy = requireNonBlank(input.updatedBy, 'feature_flag_updated_by_required');

  const rolloutPercentage = input.rolloutPercentage ?? 0;
  if (!Number.isInteger(rolloutPercentage) || rolloutPercentage < 0 || rolloutPercentage > 100) {
    throw new Error('feature_flag_rollout_percentage_invalid');
  }

  const enabled = input.enabled === true;
  const cohort = input.cohort ?? null;
  const allowList = Array.isArray(input.allowList) ? input.allowList : [];

  await requireOrgRole(updatedBy, organizationId, 'ADMIN');

  return withPgTransaction(async (client) => {
    await requireFlagDefinitionExists(client, flagKey, 'feature_flag_definition_not_found');

    const flagId = `cwff-${uuidv4()}`;
    const now = new Date().toISOString();

    const upserted = await client.query<CaseWorkspaceFeatureFlagRow>(
      `INSERT INTO case_workspace_feature_flags (
         flag_id, organization_id, flag_key, enabled, cohort, rollout_percentage,
         allow_list_json, updated_at, updated_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (organization_id, flag_key)
       DO UPDATE SET enabled = EXCLUDED.enabled,
                      cohort = EXCLUDED.cohort,
                      rollout_percentage = EXCLUDED.rollout_percentage,
                      allow_list_json = EXCLUDED.allow_list_json,
                      updated_at = EXCLUDED.updated_at,
                      updated_by = EXCLUDED.updated_by
       RETURNING *`,
      [flagId, organizationId, flagKey, enabled, cohort, rolloutPercentage, JSON.stringify(allowList), now, updatedBy]
    );
    return mapFeatureFlagRow(upserted.rows[0]);
  });
}

/**
 * CW-DOD-J1. Plain SELECT on the UNIQUE(organization_id, flag_key) row. No
 * row -> null, always read as disabled by callers. Deliberately never falls
 * back to "enabled=true when zero rows" in non-production the way
 * isV8Enabled()/isV8ShadowMode() do — that fallback is a documented
 * dev-vs-demo discrepancy source per CODEBASE_CONVERGENCE_MAP.csv;
 * CW-DOD-J1's "server-authoritative" is read here as ruling it out in every
 * environment for this table.
 */
export async function getCurrentOrgFlagState(
  organizationId: string,
  flagKey: string,
  actorUserId: string
): Promise<FeatureFlagState | null> {
  const orgId = requireNonBlank(organizationId, 'feature_flag_organization_id_required');
  const key = requireNonBlank(flagKey, 'feature_flag_key_required');
  await requireOrgMember(requireNonBlank(actorUserId, 'feature_flag_actor_required'), orgId);
  const row = await queryOne<CaseWorkspaceFeatureFlagRow>(
    `SELECT * FROM case_workspace_feature_flags WHERE organization_id = ? AND flag_key = ?`,
    [orgId, key]
  );
  return row ? mapFeatureFlagRow(row) : null;
}

/**
 * CW-DOD-J2. Plain SELECT WHERE organization_id = ? [AND cohort = ?] —
 * every flag this org has any state row for, optionally scoped to one
 * rollout wave (e.g. cohort='internal') so an operator can check whether
 * the internal cohort's flags are all green before widening.
 */
export async function listCurrentOrgFlags(
  organizationId: string,
  filters: { cohort?: string } | undefined,
  actorUserId: string
): Promise<FeatureFlagState[]> {
  const orgId = requireNonBlank(organizationId, 'feature_flag_organization_id_required');
  await requireOrgMember(requireNonBlank(actorUserId, 'feature_flag_actor_required'), orgId);
  const conditions = ['organization_id = ?'];
  const params: unknown[] = [orgId];
  if (filters?.cohort) {
    conditions.push('cohort = ?');
    params.push(requireNonBlank(filters.cohort, 'feature_flag_cohort_filter_invalid'));
  }
  const rows = await queryAll<CaseWorkspaceFeatureFlagRow>(
    `SELECT * FROM case_workspace_feature_flags
       WHERE ${conditions.join(' AND ')}
       ORDER BY flag_key ASC`,
    params
  );
  return rows.map(mapFeatureFlagRow);
}

/**
 * CW-DOD-J1, CW-DOD-J2. PURE, no DB access — mirrors
 * caseHistoryService.computeMetricValueOutcomeState()'s pure-read-time-
 * overlay convention. null or state.enabled===false -> false. entityId
 * present in state.allowList -> true (explicit allow-list, independent of
 * percentage). Otherwise a deterministic stable hash of
 * `${state.flagKey}:${entityId}` mod 100 compared against
 * state.rolloutPercentage -> true/false, so a given entity's membership
 * never flips as unrelated entities are added and a percentage increase
 * only ever adds entities, never removes one.
 */
export function isFlagEnabledForEntity(
  state: FeatureFlagState | null,
  entityId: string
): boolean {
  if (!state || state.enabled !== true) return false;
  const id = String(entityId ?? '').trim();
  if (!id) return false;
  if (state.allowList.includes(id)) return true;
  if (state.rolloutPercentage <= 0) return false;
  if (state.rolloutPercentage >= 100) return true;
  return stableHashBucket(`${state.flagKey}:${id}`) < state.rolloutPercentage;
}

/**
 * CW-DOD-J3. Composes listFlagDescendants(rootFlagKey) (plus rootFlagKey
 * itself at depth 0) with getCurrentOrgFlagState() per node; keeps only
 * nodes enabled=true for this org that have no enabled child in the subtree
 * (a "leaf of enabled-ness"); returns them sorted depth DESC
 * (deepest/narrowest first). This is the literal, DB-backed, queryable
 * answer to "which is the smallest enabled flag" (CW-DOD-J3) via the real
 * parent_flag_key relationship, not a naming convention.
 */
export async function findSmallestEnabledDescendant(
  organizationId: string,
  rootFlagKey: string,
  actorUserId: string
): Promise<Array<{ flagKey: string; depth: number }>> {
  const orgId = requireNonBlank(organizationId, 'feature_flag_organization_id_required');
  const rootKey = requireNonBlank(rootFlagKey, 'flag_definition_key_required');
  const actor = requireNonBlank(actorUserId, 'feature_flag_actor_required');
  await requireOrgMember(actor, orgId);

  const rootDefinition = await getFlagDefinition(rootKey, actor, orgId);
  if (!rootDefinition) throw new Error('flag_definition_not_found');

  const descendants = await listFlagDescendants(rootKey, actor, orgId);
  const allNodes: Array<{ flagKey: string; parentFlagKey: string | null; depth: number }> = [
    { flagKey: rootDefinition.flagKey, parentFlagKey: rootDefinition.parentFlagKey, depth: 0 },
    ...descendants.map((d) => ({ flagKey: d.flagKey, parentFlagKey: d.parentFlagKey, depth: d.depth })),
  ];

  const statesByFlagKey = new Map<string, FeatureFlagState | null>();
  for (const node of allNodes) {
    statesByFlagKey.set(node.flagKey, await getCurrentOrgFlagState(orgId, node.flagKey, actor));
  }

  const childrenByParent = new Map<string, string[]>();
  for (const node of allNodes) {
    if (!node.parentFlagKey) continue;
    const siblings = childrenByParent.get(node.parentFlagKey) ?? [];
    siblings.push(node.flagKey);
    childrenByParent.set(node.parentFlagKey, siblings);
  }

  const result: Array<{ flagKey: string; depth: number }> = [];
  for (const node of allNodes) {
    const state = statesByFlagKey.get(node.flagKey);
    if (!state || state.enabled !== true) continue;
    const children = childrenByParent.get(node.flagKey) ?? [];
    const hasEnabledChild = children.some((childFlagKey) => {
      const childState = statesByFlagKey.get(childFlagKey);
      return childState?.enabled === true;
    });
    if (!hasEnabledChild) {
      result.push({ flagKey: node.flagKey, depth: node.depth });
    }
  }

  return result.sort((a, b) => b.depth - a.depth);
}

/**
 * CW-DOD-J3, CW-DOD-J4. Thin wrapper over setOrgFlagState({ ..., enabled:
 * false }), carrying the current row's cohort/rolloutPercentage/allowList
 * through unchanged (rollback flips only enabled) — throws
 * feature_flag_state_not_found if no state row exists yet for this org/flag
 * pair. Issues exactly one UPDATE on exactly one (organization_id,
 * flag_key) row — it never writes to any other flag's row, never writes to
 * case_workspace_history_events, case_workspace_value_measurements, or
 * case_core, so whatever those tables already recorded while the flag was
 * on remains untouched ("preserves audit/effects"). Callers are expected to
 * pass findSmallestEnabledDescendant()'s top result as flagKey.
 */
export async function rollbackFlag(
  organizationId: string,
  flagKey: string,
  updatedBy: string
): Promise<FeatureFlagState> {
  const orgId = requireNonBlank(organizationId, 'feature_flag_organization_id_required');
  const key = requireNonBlank(flagKey, 'feature_flag_key_required');
  const actor = requireNonBlank(updatedBy, 'feature_flag_updated_by_required');

  const current = await getCurrentOrgFlagState(orgId, key, actor);
  if (!current) throw new Error('feature_flag_state_not_found');

  return setOrgFlagState({
    organizationId: orgId,
    flagKey: key,
    enabled: false,
    cohort: current.cohort,
    rolloutPercentage: current.rolloutPercentage,
    allowList: current.allowList,
    updatedBy: actor,
  });
}

// ---------------------------------------------------------------------------
// Service methods — Legacy Quarantine
// ---------------------------------------------------------------------------

/**
 * CW-DOD-J5. Validates organizationId/rehearsalRunId/sourceSystem/
 * sourceTable/sourceId/quarantineReasonCode/quarantineReasonDetail/
 * recoveryPathRef/detectedAt all non-blank — throws rather than accepting a
 * partial row, so an unmapped record can never be logged without both a
 * reason and a recovery pointer. Issues
 * `INSERT ... ON CONFLICT (dedupe_key) DO NOTHING RETURNING *`, identical
 * idempotent-replay shape to caseHistoryService.insertHistoryEvent()
 * (re-SELECT by dedupe_key on 0 rows when dedupeKey is set). No case_core
 * read, no FK check on attemptedCaseId — the row's purpose is exactly a
 * mapping that could not be established.
 */
export async function recordQuarantinedLegacyRecord(
  input: RecordQuarantinedLegacyRecordInput,
  actorUserId: string
): Promise<QuarantinedLegacyRecord> {
  const organizationId = requireNonBlank(input.organizationId, 'legacy_quarantine_organization_id_required');
  await requireOrgMember(requireNonBlank(actorUserId, 'legacy_quarantine_actor_required'), organizationId);
  const rehearsalRunId = requireNonBlank(input.rehearsalRunId, 'legacy_quarantine_rehearsal_run_id_required');
  const sourceSystem = requireNonBlank(input.sourceSystem, 'legacy_quarantine_source_system_required');
  const sourceTable = requireNonBlank(input.sourceTable, 'legacy_quarantine_source_table_required');
  const sourceId = requireNonBlank(input.sourceId, 'legacy_quarantine_source_id_required');
  const quarantineReasonCode = requireNonBlank(
    input.quarantineReasonCode,
    'legacy_quarantine_reason_code_required'
  );
  const quarantineReasonDetail = requireNonBlank(
    input.quarantineReasonDetail,
    'legacy_quarantine_reason_detail_required'
  );
  const recoveryPathRef = requireNonBlank(input.recoveryPathRef, 'legacy_quarantine_recovery_path_ref_required');
  const detectedAt = requireNonBlank(input.detectedAt, 'legacy_quarantine_detected_at_required');

  return withPgTransaction(async (client) => {
    const quarantineId = `cwlq-${uuidv4()}`;
    const now = new Date().toISOString();
    const dedupeKey = input.dedupeKey ?? null;
    const snapshotJson = JSON.stringify(input.sourceRecordSnapshot ?? {});

    const inserted = await client.query<CaseWorkspaceLegacyQuarantineRow>(
      `INSERT INTO case_workspace_legacy_quarantine (
         quarantine_id, organization_id, rehearsal_run_id, source_system,
         source_table, source_id, attempted_case_id, quarantine_reason_code,
         quarantine_reason_detail, recovery_path_ref, source_record_snapshot,
         detected_at, recorded_at, dedupe_key
       ) VALUES (
         ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       )
       ON CONFLICT (dedupe_key) DO NOTHING
       RETURNING *`,
      [
        quarantineId,
        organizationId,
        rehearsalRunId,
        sourceSystem,
        sourceTable,
        sourceId,
        input.attemptedCaseId ?? null,
        quarantineReasonCode,
        quarantineReasonDetail,
        recoveryPathRef,
        snapshotJson,
        detectedAt,
        now,
        dedupeKey,
      ]
    );

    const row = inserted.rows[0];
    if (row) return mapLegacyQuarantineRow(row);

    // 0 rows only happens when dedupeKey is set and already claimed by a
    // prior insert (NULL dedupe_key values never collide under UNIQUE).
    // Idempotent replay: return the existing row unchanged.
    if (!dedupeKey) throw new Error('legacy_quarantine_insert_failed');
    const existingResult = await client.query<CaseWorkspaceLegacyQuarantineRow>(
      `SELECT * FROM case_workspace_legacy_quarantine WHERE dedupe_key = ?`,
      [dedupeKey]
    );
    const existing = existingResult.rows[0];
    if (!existing) throw new Error('legacy_quarantine_idempotency_record_not_found');
    return mapLegacyQuarantineRow(existing);
  });
}

/** CW-DOD-J5. Plain read, no lock. */
export async function getQuarantinedLegacyRecord(
  quarantineId: string,
  actorUserId: string
): Promise<QuarantinedLegacyRecord | null> {
  const id = requireNonBlank(quarantineId, 'legacy_quarantine_id_required');
  const actor = requireNonBlank(actorUserId, 'legacy_quarantine_actor_required');
  const row = await queryOne<CaseWorkspaceLegacyQuarantineRow>(
    `SELECT * FROM case_workspace_legacy_quarantine WHERE quarantine_id = ?`,
    [id]
  );
  if (!row) return null;
  try {
    await requireOrgMember(actor, row.organization_id);
  } catch (err) {
    if (err instanceof CaseWorkspaceAuthError) return null;
    throw err;
  }
  return mapLegacyQuarantineRow(row);
}

/**
 * CW-DOD-J5, CW-DOD-J6. Plain read, no lock, ordered by recorded_at ASC
 * (with a quarantine_id tie-break for stability) — the full quarantine
 * report for one migration-rehearsal execution. Cursor-based pagination on
 * afterId, never OFFSET, mirroring
 * caseHistoryService.listCaseHistoryEventsForCase()'s convention: when
 * afterId is supplied, its recorded_at is looked up first and results are
 * filtered to strictly after that (recorded_at, quarantine_id) pair.
 */
export async function listQuarantinedLegacyRecordsForRehearsalRun(
  rehearsalRunId: string,
  pagination: { afterId?: string; limit?: number } | undefined,
  actorUserId: string,
  callerOrganizationId: string
): Promise<QuarantinedLegacyRecord[]> {
  const runId = requireNonBlank(rehearsalRunId, 'legacy_quarantine_rehearsal_run_id_required');
  await requireOrgMember(
    requireNonBlank(actorUserId, 'legacy_quarantine_actor_required'),
    requireNonBlank(callerOrganizationId, 'legacy_quarantine_caller_organization_id_required')
  );
  const conditions = ['rehearsal_run_id = ?', 'organization_id = ?'];
  const params: unknown[] = [runId, callerOrganizationId];

  if (pagination?.afterId) {
    const afterId = requireNonBlank(pagination.afterId, 'legacy_quarantine_after_id_invalid');
    const afterRow = await queryOne<{ recorded_at: string }>(
      `SELECT recorded_at FROM case_workspace_legacy_quarantine WHERE quarantine_id = ?`,
      [afterId]
    );
    if (afterRow) {
      conditions.push('(recorded_at > ? OR (recorded_at = ? AND quarantine_id > ?))');
      params.push(afterRow.recorded_at, afterRow.recorded_at, afterId);
    }
  }

  const limit = pagination?.limit ?? 200;
  params.push(limit);

  const rows = await queryAll<CaseWorkspaceLegacyQuarantineRow>(
    `SELECT * FROM case_workspace_legacy_quarantine
       WHERE ${conditions.join(' AND ')}
       ORDER BY recorded_at ASC, quarantine_id ASC
       LIMIT ?`,
    params
  );
  return rows.map(mapLegacyQuarantineRow);
}

/**
 * CW-DOD-J5. Plain read, no lock, WHERE source_table = ? AND source_id = ?
 * ORDER BY recorded_at ASC — every quarantine attempt ever logged against
 * one specific legacy row, across however many rehearsal runs found it
 * unmappable.
 */
export async function listQuarantinedLegacyRecordsForSource(
  sourceTable: string,
  sourceId: string,
  actorUserId: string,
  callerOrganizationId: string
): Promise<QuarantinedLegacyRecord[]> {
  const table = requireNonBlank(sourceTable, 'legacy_quarantine_source_table_required');
  const id = requireNonBlank(sourceId, 'legacy_quarantine_source_id_required');
  await requireOrgMember(
    requireNonBlank(actorUserId, 'legacy_quarantine_actor_required'),
    requireNonBlank(callerOrganizationId, 'legacy_quarantine_caller_organization_id_required')
  );
  const rows = await queryAll<CaseWorkspaceLegacyQuarantineRow>(
    `SELECT * FROM case_workspace_legacy_quarantine
       WHERE source_table = ? AND source_id = ? AND organization_id = ?
       ORDER BY recorded_at ASC`,
    [table, id, callerOrganizationId]
  );
  return rows.map(mapLegacyQuarantineRow);
}

/**
 * CW-DOD-J6. `SELECT quarantine_reason_code, COUNT(*) ... WHERE
 * rehearsal_run_id = ? GROUP BY quarantine_reason_code` — the queryable
 * evidence summary a retirement-readiness reviewer reads. This method
 * supplies evidence, it does not itself judge readiness.
 */
export async function countQuarantinedByReasonCode(
  rehearsalRunId: string,
  actorUserId: string,
  callerOrganizationId: string
): Promise<Array<{ reasonCode: string; count: number }>> {
  const runId = requireNonBlank(rehearsalRunId, 'legacy_quarantine_rehearsal_run_id_required');
  await requireOrgMember(
    requireNonBlank(actorUserId, 'legacy_quarantine_actor_required'),
    requireNonBlank(callerOrganizationId, 'legacy_quarantine_caller_organization_id_required')
  );
  const rows = await queryAll<{ quarantine_reason_code: string; count: number | string }>(
    `SELECT quarantine_reason_code, COUNT(*) AS count
       FROM case_workspace_legacy_quarantine
       WHERE rehearsal_run_id = ? AND organization_id = ?
       GROUP BY quarantine_reason_code
       ORDER BY quarantine_reason_code ASC`,
    [runId, callerOrganizationId]
  );
  return rows.map((row) => ({ reasonCode: row.quarantine_reason_code, count: Number(row.count) }));
}
