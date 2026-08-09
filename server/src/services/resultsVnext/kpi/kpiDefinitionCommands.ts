/**
 * KPI-E001/E002 — definition-side commands.
 *
 * Design: docs/product/results-vnext/KPI_E001_E002_DESIGN.md §B (self-
 * approval denial example), decyzje #2/#4/#7/#11.
 * Schema: server/migrations/20260810_rvn_kpi_core.sql.
 *
 * Write pattern: `createKpiDraft` is the only CREATE (new `kpi_id` +
 * version 1) and goes through `executeAtomicCreate` (platform/atomicWrite.ts
 * §A.6). Every other command here mutates an EXISTING row (a definition
 * version, or the root `rvn_kpi_definitions` row) and goes through
 * `executeAtomicCommand` (§A.4) with that row's own `row_version` as the
 * optimistic-concurrency CAS — this is the reference pattern
 * `decisionCollaborationService.finalizeDecisionTransition` established
 * (see atomicWrite.ts's header comment) and `executeAtomicCommand` already
 * generalizes.
 *
 * DB access, event/state-hash construction, and the "capture inside
 * applyMutation via an outer-scope `let`, read from buildEvent" pattern for
 * values that only exist mid-transaction (e.g. the active visibility
 * policy's version) are this file's own convention — `buildEvent` only
 * receives `{ currentRow, result, nextVersion }` / `{ result }` per
 * atomicWrite.ts's typed signatures, not arbitrary transaction-local state,
 * so anything else needed there is closed over instead of threaded through
 * the public result type.
 */
import { createHash, randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

import {
  executeAtomicCommand,
  executeAtomicCreate,
  type AtomicCommandOutcome,
  type AtomicEventInput,
} from '../platform/atomicWrite.js';
import { getActiveVisibilityPolicy } from '../platform/visibilityResolver.js';

import {
  toKpiDefinition,
  toKpiDefinitionVersion,
  type KpiDefinition,
  type KpiDefinitionRow,
  type KpiDefinitionVersion,
  type KpiDefinitionVersionRow,
  type KpiStatus,
  type KpiTargetGeometry,
} from './kpiTypes.js';

// ==========================================
// SHARED CONSTANTS / HELPERS (also used by kpiMeasurementCommands.ts)
// ==========================================

/** `domain` value used for the `getActiveVisibilityPolicy` lookup (decyzja
 * #11) and for the `rvn_platform_resource_visibility.resource_type` value
 * (`RVN_RESOURCE_TYPES`, resourceTypes.ts) — both are the literal `'kpi'`
 * string, the same identifier this whole domain is registered under. */
export const KPI_VISIBILITY_DOMAIN = 'kpi';

export const KPI_EVENT_SOURCE = 'resultsVnext.kpi';

/**
 * `policyVersion` on every event built below other than `createKpiDraft`'s
 * (which legitimately resolves and records the ACTIVE visibility policy at
 * creation time, per decyzja #11) is the empty string, not a fetched value.
 * `eventEnvelope.ts` documents this field as "visibility/ABAC policy version
 * in effect at write time" for auditability of the ABAC decision that GATED
 * the write — `createKpiDraft` is the one command in this file whose write
 * is itself gated by a visibility-policy lookup (it creates the
 * `rvn_platform_resource_visibility` row). The other commands here mutate
 * an already-visible resource; re-resolving the active policy on every
 * edit/submit/approve/reject/lifecycle-transition write purely to fill this
 * audit field would add a DB round-trip to every one of them for a value
 * this package's design doc never asks for explicitly. Left as an
 * explicit, documented simplification rather than a silent gap — a future
 * package wiring these commands to real routes should revisit whether the
 * ABAC-audit trail needs it populated on every write, not just create.
 */
const POLICY_VERSION_NOT_TRACKED = '';

/** Deterministic integrity hash for an event's `afterState` (eventEnvelope.ts
 * `stateHash` — "integrity hash of after_state (or before+after), not
 * null"). No existing caller anywhere in `platform/*` computes this yet (the
 * whole module family was inert scaffolding before this package) — sha256
 * over the JSON-stable-stringified state is a standard, dependency-free
 * choice consistent with `evidence_refs`/`payload` already being JSONB. */
export function computeStateHash(state: Record<string, unknown> | null): string {
  const json = state === null ? 'null' : JSON.stringify(state);
  return createHash('sha256').update(json).digest('hex');
}

// ==========================================
// ERRORS
// ==========================================

/** Decyzja #11: `getActiveVisibilityPolicy` returning `null` must fail
 * closed, never assume a default. This is that fail-closed error. */
export class KpiNoActiveVisibilityPolicyError extends Error {
  code = 'NO_ACTIVE_VISIBILITY_POLICY';
  details: Record<string, unknown>;
  constructor(organizationId: string, domain: string) {
    super(
      `No active visibility policy for organization ${organizationId}, domain "${domain}" — cannot create a KPI without one`
    );
    this.name = 'KpiNoActiveVisibilityPolicyError';
    this.details = { organizationId, domain };
  }
}

/**
 * Design doc "Key points": "`approveDefinitionVersion` enforces
 * self-approval denial (`submitted_by` OR `created_by` == approver ->
 * `SelfApprovalDeniedError`) server-side, inside `applyMutation`, before any
 * write — not delegated to UI or a later check." Name and trigger condition
 * are pinned by the design doc; shape (code/details) mirrors this module
 * family's other typed errors.
 */
export class SelfApprovalDeniedError extends Error {
  code = 'SELF_APPROVAL_DENIED';
  details: Record<string, unknown>;
  constructor(definitionVersionId: string, approverId: string, reasonField: 'submitted_by' | 'created_by') {
    super(
      `User ${approverId} may not approve definition version ${definitionVersionId}: matches its own ${reasonField}`
    );
    this.name = 'SelfApprovalDeniedError';
    this.details = { definitionVersionId, approverId, reasonField };
  }
}

/** Generic invalid-state-transition guard (e.g. submitting an
 * already-submitted version, approving a draft that was never submitted,
 * activating a KPI with no approved version). Mirrors
 * `DecisionValidationError`'s role in `decisionCollaborationService.ts`. */
export class KpiDefinitionValidationError extends Error {
  code: string;
  details?: Record<string, unknown>;
  constructor(message: string, code = 'INVALID_TRANSITION', details?: Record<string, unknown>) {
    super(message);
    this.name = 'KpiDefinitionValidationError';
    this.code = code;
    this.details = details;
  }
}

// ==========================================
// SHARED ROW LOADERS
// ==========================================

async function loadDefinitionVersionForUpdate(
  client: PoolClient,
  definitionVersionId: string,
  organizationId: string
): Promise<KpiDefinitionVersionRow | undefined> {
  const result = await client.query<KpiDefinitionVersionRow>(
    `SELECT * FROM rvn_kpi_definition_versions
      WHERE definition_version_id = $1 AND organization_id = $2
      FOR UPDATE`,
    [definitionVersionId, organizationId]
  );
  return result.rows[0];
}

async function loadKpiDefinitionForUpdate(
  client: PoolClient,
  kpiId: string,
  organizationId: string
): Promise<KpiDefinitionRow | undefined> {
  const result = await client.query<KpiDefinitionRow>(
    `SELECT * FROM rvn_kpi_definitions
      WHERE kpi_id = $1 AND organization_id = $2
      FOR UPDATE`,
    [kpiId, organizationId]
  );
  return result.rows[0];
}

function versionRowVersion(row: KpiDefinitionVersionRow): number {
  return row.row_version;
}

function definitionRowVersion(row: KpiDefinitionRow): number {
  return row.row_version;
}

// ==========================================
// createKpiDraft
// ==========================================

export interface CreateKpiDraftInput {
  organizationId: string;
  kpiCode: string;
  name: string;
  description?: string | null;
  unit?: string | null;
  targetGeometry: KpiTargetGeometry;
  targetValue?: number | null;
  targetMin?: number | null;
  targetMax?: number | null;
  warningLow?: number | null;
  warningHigh?: number | null;
  criticalLow?: number | null;
  criticalHigh?: number | null;
  /** Only meaningful when `targetGeometry === 'binary'` — see
   * targetGeometryEvaluator.ts's evalBinary() and the migration's column
   * comment. */
  binarySuccessValue?: number | null;
  formulaText?: string | null;
  /** No FK, deferred (decyzja #5). */
  primaryProcessId?: string | null;
  /** No FK yet — KPI-E003 not in scope (decyzja #6). */
  responsePolicyId?: string | null;
  ownerUserId?: string | null;
  /**
   * Only meaningful when the active visibility policy's `default_scope_type`
   * is a scope that needs a concrete target (e.g. `'team'` -> a team id).
   * Not part of the design doc's pinned decisions — this command's own
   * minimal surface for populating `rvn_platform_resource_visibility.scope_id`
   * at creation time; `null` is valid for OPEN_ORG/PRIVATE/MANAGEMENT_CHAIN
   * policies, which ignore it.
   */
  scopeId?: string | null;
  sensitivity?: string | null;
  createdBy: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

export interface CreateKpiDraftResult {
  kpi: KpiDefinition;
  definitionVersion: KpiDefinitionVersion;
}

export async function createKpiDraft(
  input: CreateKpiDraftInput
): Promise<AtomicCommandOutcome<CreateKpiDraftResult>> {
  const {
    organizationId,
    kpiCode,
    name,
    description = null,
    unit = null,
    targetGeometry,
    targetValue = null,
    targetMin = null,
    targetMax = null,
    warningLow = null,
    warningHigh = null,
    criticalLow = null,
    criticalHigh = null,
    binarySuccessValue = null,
    formulaText = null,
    primaryProcessId = null,
    responsePolicyId = null,
    ownerUserId = null,
    scopeId = null,
    sensitivity = null,
    createdBy,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
  } = input;

  // Captured inside applyMutation, read by buildEvent — see file header.
  let visibilityPolicyVersion: string | undefined;

  return executeAtomicCreate<CreateKpiDraftResult>({
    organizationId,
    applyMutation: async (client) => {
      // Decyzja #11: fail closed if no active visibility policy exists for
      // this org/domain — never fabricate a default.
      const policy = await getActiveVisibilityPolicy(client, {
        organizationId,
        domain: KPI_VISIBILITY_DOMAIN,
      });
      if (!policy) {
        throw new KpiNoActiveVisibilityPolicyError(organizationId, KPI_VISIBILITY_DOMAIN);
      }
      visibilityPolicyVersion = policy.policyVersion;

      const policyDetailsResult = await client.query<{
        visibility_mode: string;
        default_scope_type: string | null;
      }>(
        `SELECT visibility_mode, default_scope_type
           FROM rvn_platform_visibility_policies
          WHERE policy_id = $1`,
        [policy.policyId]
      );
      const policyDetails = policyDetailsResult.rows[0];
      if (!policyDetails) {
        // getActiveVisibilityPolicy just resolved this policy_id from the
        // same table inside the same transaction's read-consistent
        // snapshot — this branch means something deleted it concurrently
        // under repeatable-read semantics gone wrong. Fail loudly rather
        // than insert a resource_visibility row with fabricated defaults.
        throw new Error(
          `[createKpiDraft] active policy ${policy.policyId} could not be re-read mid-transaction`
        );
      }

      const kpiInsert = await client.query<KpiDefinitionRow>(
        `INSERT INTO rvn_kpi_definitions
           (organization_id, kpi_code, status, primary_process_id, response_policy_id, owner_user_id, created_by)
         VALUES ($1, $2, 'draft', $3, $4, $5, $6)
         RETURNING *`,
        [organizationId, kpiCode, primaryProcessId, responsePolicyId, ownerUserId ?? createdBy, createdBy]
      );
      const kpiRow = kpiInsert.rows[0];
      if (!kpiRow) {
        throw new Error('[createKpiDraft] insert into rvn_kpi_definitions returned no row');
      }

      const versionInsert = await client.query<KpiDefinitionVersionRow>(
        `INSERT INTO rvn_kpi_definition_versions
           (kpi_id, organization_id, version_number, name, description, unit, target_geometry,
            target_value, target_min, target_max, warning_low, warning_high, critical_low, critical_high,
            binary_success_value, formula_text, approval_status, created_by)
         VALUES ($1, $2, 1, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'draft', $16)
         RETURNING *`,
        [
          kpiRow.kpi_id,
          organizationId,
          name,
          description,
          unit,
          targetGeometry,
          targetValue,
          targetMin,
          targetMax,
          warningLow,
          warningHigh,
          criticalLow,
          criticalHigh,
          binarySuccessValue,
          formulaText,
          createdBy,
        ]
      );
      const versionRow = versionInsert.rows[0];
      if (!versionRow) {
        throw new Error('[createKpiDraft] insert into rvn_kpi_definition_versions returned no row');
      }

      await client.query(
        `UPDATE rvn_kpi_definitions
            SET current_definition_version_id = $1, updated_at = now()
          WHERE kpi_id = $2`,
        [versionRow.definition_version_id, kpiRow.kpi_id]
      );

      await client.query(
        `INSERT INTO rvn_platform_resource_visibility
           (resource_type, resource_id, organization_id, visibility_mode, policy_id, scope_type, scope_id, owner_user_id, sensitivity)
         VALUES ('kpi', $1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          kpiRow.kpi_id,
          organizationId,
          policyDetails.visibility_mode,
          policy.policyId,
          policyDetails.default_scope_type,
          scopeId,
          ownerUserId ?? createdBy,
          sensitivity,
        ]
      );

      return {
        kpi: toKpiDefinition({ ...kpiRow, current_definition_version_id: versionRow.definition_version_id }),
        definitionVersion: toKpiDefinitionVersion(versionRow),
      };
    },
    buildEvent: ({ result }) => {
      const afterState: Record<string, unknown> = { kpi: result.kpi, definitionVersion: result.definitionVersion };
      return {
        schemaVersion: 1,
        eventType: 'kpi.definition_created',
        aggregateType: 'kpi',
        aggregateId: result.kpi.kpiId,
        organizationId,
        actorUserId: createdBy,
        actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        causationId,
        occurredAt: new Date().toISOString(),
        policyVersion: visibilityPolicyVersion ?? '',
        beforeState: null,
        afterState,
        stateHash: computeStateHash(afterState),
        reason,
        evidenceRefs: [],
        source: KPI_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion: null,
        resultingVersion: 1,
        payload: { definitionVersionId: result.definitionVersion.definitionVersionId, versionNumber: 1 },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// editDraft
// ==========================================

export interface EditDraftInput {
  definitionVersionId: string;
  organizationId: string;
  expectedVersion: number;
  name?: string;
  description?: string | null;
  unit?: string | null;
  targetGeometry?: KpiTargetGeometry;
  targetValue?: number | null;
  targetMin?: number | null;
  targetMax?: number | null;
  warningLow?: number | null;
  warningHigh?: number | null;
  criticalLow?: number | null;
  criticalHigh?: number | null;
  binarySuccessValue?: number | null;
  formulaText?: string | null;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

export async function editDraft(
  input: EditDraftInput
): Promise<AtomicCommandOutcome<KpiDefinitionVersion>> {
  const {
    definitionVersionId,
    organizationId,
    expectedVersion,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
    ...edits
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<KpiDefinitionVersionRow, KpiDefinitionVersion>({
    organizationId,
    aggregateId: definitionVersionId,
    expectedVersion,
    loadForUpdate: loadDefinitionVersionForUpdate,
    getCurrentVersion: versionRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (currentRow.approval_status !== 'draft') {
        throw new KpiDefinitionValidationError(
          `Definition version ${definitionVersionId} is "${currentRow.approval_status}" — only a draft may be edited`,
          'NOT_A_DRAFT',
          { definitionVersionId, approvalStatus: currentRow.approval_status }
        );
      }

      beforeState = { definitionVersion: toKpiDefinitionVersion(currentRow) };

      const merged = {
        name: edits.name ?? currentRow.name,
        description: edits.description !== undefined ? edits.description : currentRow.description,
        unit: edits.unit !== undefined ? edits.unit : currentRow.unit,
        target_geometry: edits.targetGeometry ?? currentRow.target_geometry,
        target_value: edits.targetValue !== undefined ? edits.targetValue : currentRow.target_value,
        target_min: edits.targetMin !== undefined ? edits.targetMin : currentRow.target_min,
        target_max: edits.targetMax !== undefined ? edits.targetMax : currentRow.target_max,
        warning_low: edits.warningLow !== undefined ? edits.warningLow : currentRow.warning_low,
        warning_high: edits.warningHigh !== undefined ? edits.warningHigh : currentRow.warning_high,
        critical_low: edits.criticalLow !== undefined ? edits.criticalLow : currentRow.critical_low,
        critical_high: edits.criticalHigh !== undefined ? edits.criticalHigh : currentRow.critical_high,
        binary_success_value:
          edits.binarySuccessValue !== undefined
            ? edits.binarySuccessValue
            : currentRow.binary_success_value,
        formula_text: edits.formulaText !== undefined ? edits.formulaText : currentRow.formula_text,
      };

      const updateResult = await client.query<KpiDefinitionVersionRow>(
        `UPDATE rvn_kpi_definition_versions
            SET name = $1, description = $2, unit = $3, target_geometry = $4,
                target_value = $5, target_min = $6, target_max = $7,
                warning_low = $8, warning_high = $9, critical_low = $10, critical_high = $11,
                binary_success_value = $12, formula_text = $13, row_version = $14, updated_at = now()
          WHERE definition_version_id = $15
          RETURNING *`,
        [
          merged.name,
          merged.description,
          merged.unit,
          merged.target_geometry,
          merged.target_value,
          merged.target_min,
          merged.target_max,
          merged.warning_low,
          merged.warning_high,
          merged.critical_low,
          merged.critical_high,
          merged.binary_success_value,
          merged.formula_text,
          nextVersion,
          definitionVersionId,
        ]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) {
        throw new Error(`[editDraft] update returned no row for ${definitionVersionId}`);
      }
      return toKpiDefinitionVersion(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { definitionVersion: result };
      return {
        schemaVersion: 1,
        eventType: 'kpi.definition_edited',
        aggregateType: 'kpi',
        aggregateId: result.kpiId,
        organizationId,
        actorUserId,
        actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        causationId,
        occurredAt: new Date().toISOString(),
        policyVersion: POLICY_VERSION_NOT_TRACKED,
        beforeState,
        afterState,
        stateHash: computeStateHash(afterState),
        reason,
        evidenceRefs: [],
        source: KPI_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { definitionVersionId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// submitDefinition
// ==========================================

export interface SubmitDefinitionInput {
  definitionVersionId: string;
  organizationId: string;
  expectedVersion: number;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

export async function submitDefinition(
  input: SubmitDefinitionInput
): Promise<AtomicCommandOutcome<KpiDefinitionVersion>> {
  const {
    definitionVersionId,
    organizationId,
    expectedVersion,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<KpiDefinitionVersionRow, KpiDefinitionVersion>({
    organizationId,
    aggregateId: definitionVersionId,
    expectedVersion,
    loadForUpdate: loadDefinitionVersionForUpdate,
    getCurrentVersion: versionRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (currentRow.approval_status !== 'draft') {
        throw new KpiDefinitionValidationError(
          `Definition version ${definitionVersionId} is "${currentRow.approval_status}" — only a draft may be submitted`,
          'NOT_A_DRAFT',
          { definitionVersionId, approvalStatus: currentRow.approval_status }
        );
      }
      beforeState = { definitionVersion: toKpiDefinitionVersion(currentRow) };

      const updateResult = await client.query<KpiDefinitionVersionRow>(
        `UPDATE rvn_kpi_definition_versions
            SET approval_status = 'submitted', submitted_by = $1, submitted_at = now(),
                row_version = $2, updated_at = now()
          WHERE definition_version_id = $3
          RETURNING *`,
        [actorUserId, nextVersion, definitionVersionId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) {
        throw new Error(`[submitDefinition] update returned no row for ${definitionVersionId}`);
      }

      // Root aggregate lifecycle side-effect (EXECUTION_LEDGER.md §16 fix):
      // submitting a definition version for review is exactly what "freezes
      // the contract for reviewer decision" (plan §4.1) means for the KPI
      // itself — the two status dimensions are independent columns, but
      // this transition is not. Only fires from 'draft' (a later
      // amendment's draft version being submitted while the KPI is already
      // 'active'/'suspended' does NOT pull the root status back to
      // 'pending_approval' — that would freeze governed measurements
      // against an in-flight amendment, which is out of scope for this
      // fix). Same "derived write, no CAS of its own" pattern
      // approveDefinitionVersion already uses below for
      // current_definition_version_id.
      await client.query(
        `UPDATE rvn_kpi_definitions
            SET status = 'pending_approval', updated_at = now()
          WHERE kpi_id = $1 AND status = 'draft'`,
        [updatedRow.kpi_id]
      );

      return toKpiDefinitionVersion(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { definitionVersion: result };
      return {
        schemaVersion: 1,
        eventType: 'kpi.definition_submitted',
        aggregateType: 'kpi',
        aggregateId: result.kpiId,
        organizationId,
        actorUserId,
        actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        causationId,
        occurredAt: new Date().toISOString(),
        policyVersion: POLICY_VERSION_NOT_TRACKED,
        beforeState,
        afterState,
        stateHash: computeStateHash(afterState),
        reason,
        evidenceRefs: [],
        source: KPI_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { definitionVersionId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// approveDefinitionVersion
// ==========================================

export interface ApproveDefinitionVersionInput {
  definitionVersionId: string;
  organizationId: string;
  expectedVersion: number;
  approverId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

/**
 * Design doc §B example: self-approval denial is checked FIRST, inside
 * `applyMutation`, BEFORE any write — `loadForUpdate`'s `SELECT ... FOR
 * UPDATE` has already run by the time `applyMutation` is called (it is
 * `executeAtomicCommand` step 2, before the CAS check in step 3 and the
 * mutation in step 4), so the row is locked but nothing has been written
 * when this check runs.
 */
export async function approveDefinitionVersion(
  input: ApproveDefinitionVersionInput
): Promise<AtomicCommandOutcome<KpiDefinitionVersion>> {
  const {
    definitionVersionId,
    organizationId,
    expectedVersion,
    approverId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<KpiDefinitionVersionRow, KpiDefinitionVersion>({
    organizationId,
    aggregateId: definitionVersionId,
    expectedVersion,
    loadForUpdate: loadDefinitionVersionForUpdate,
    getCurrentVersion: versionRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      // Self-approval denial — FIRST, before any write, per design doc §B.
      if (currentRow.submitted_by === approverId) {
        throw new SelfApprovalDeniedError(definitionVersionId, approverId, 'submitted_by');
      }
      if (currentRow.created_by === approverId) {
        throw new SelfApprovalDeniedError(definitionVersionId, approverId, 'created_by');
      }

      if (currentRow.approval_status !== 'submitted') {
        throw new KpiDefinitionValidationError(
          `Definition version ${definitionVersionId} is "${currentRow.approval_status}" — only a submitted version may be approved`,
          'NOT_SUBMITTED',
          { definitionVersionId, approvalStatus: currentRow.approval_status }
        );
      }

      beforeState = { definitionVersion: toKpiDefinitionVersion(currentRow) };

      const updateResult = await client.query<KpiDefinitionVersionRow>(
        `UPDATE rvn_kpi_definition_versions
            SET approval_status = 'approved', approved_by = $1, approved_at = now(),
                effective_from = COALESCE(effective_from, now()),
                row_version = $2, updated_at = now()
          WHERE definition_version_id = $3
          RETURNING *`,
        [approverId, nextVersion, definitionVersionId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) {
        throw new Error(`[approveDefinitionVersion] update returned no row for ${definitionVersionId}`);
      }

      // The root aggregate's "current" pointer follows the latest APPROVED
      // version. This is a derived pointer maintained here, not a
      // separately CAS'd write — it does not bump rvn_kpi_definitions.row_version,
      // matching the same "closure/derived-state maintained inline" shape
      // managementChainMaintenance.ts uses for the closure table alongside
      // the manager_id write it isn't itself CAS'ing.
      await client.query(
        `UPDATE rvn_kpi_definitions
            SET current_definition_version_id = $1, updated_at = now()
          WHERE kpi_id = $2`,
        [updatedRow.definition_version_id, updatedRow.kpi_id]
      );

      return toKpiDefinitionVersion(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { definitionVersion: result };
      return {
        schemaVersion: 1,
        eventType: 'kpi.definition_approved',
        aggregateType: 'kpi',
        aggregateId: result.kpiId,
        organizationId,
        actorUserId: approverId,
        actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        causationId,
        occurredAt: new Date().toISOString(),
        policyVersion: POLICY_VERSION_NOT_TRACKED,
        beforeState,
        afterState,
        stateHash: computeStateHash(afterState),
        reason,
        evidenceRefs: [],
        source: KPI_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { definitionVersionId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// rejectDefinitionVersion
// ==========================================

export interface RejectDefinitionVersionInput {
  definitionVersionId: string;
  organizationId: string;
  expectedVersion: number;
  rejectedBy: string;
  rejectionReason: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
}

export async function rejectDefinitionVersion(
  input: RejectDefinitionVersionInput
): Promise<AtomicCommandOutcome<KpiDefinitionVersion>> {
  const {
    definitionVersionId,
    organizationId,
    expectedVersion,
    rejectedBy,
    rejectionReason,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<KpiDefinitionVersionRow, KpiDefinitionVersion>({
    organizationId,
    aggregateId: definitionVersionId,
    expectedVersion,
    loadForUpdate: loadDefinitionVersionForUpdate,
    getCurrentVersion: versionRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (currentRow.approval_status !== 'submitted') {
        throw new KpiDefinitionValidationError(
          `Definition version ${definitionVersionId} is "${currentRow.approval_status}" — only a submitted version may be rejected`,
          'NOT_SUBMITTED',
          { definitionVersionId, approvalStatus: currentRow.approval_status }
        );
      }
      beforeState = { definitionVersion: toKpiDefinitionVersion(currentRow) };

      const updateResult = await client.query<KpiDefinitionVersionRow>(
        `UPDATE rvn_kpi_definition_versions
            SET approval_status = 'rejected', rejected_by = $1, rejected_at = now(),
                rejection_reason = $2, row_version = $3, updated_at = now()
          WHERE definition_version_id = $4
          RETURNING *`,
        [rejectedBy, rejectionReason, nextVersion, definitionVersionId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) {
        throw new Error(`[rejectDefinitionVersion] update returned no row for ${definitionVersionId}`);
      }

      // Mirror of submitDefinition's forward transition: a rejection lifts
      // the "frozen for reviewer decision" state (plan §4.1) this KPI
      // entered when the now-rejected version was submitted, so the KPI
      // can be edited and resubmitted. Only fires from 'pending_approval' —
      // an amendment draft being rejected while the KPI is already
      // 'active'/'suspended' on a DIFFERENT, already-approved version must
      // not touch that root status.
      await client.query(
        `UPDATE rvn_kpi_definitions
            SET status = 'draft', updated_at = now()
          WHERE kpi_id = $1 AND status = 'pending_approval'`,
        [updatedRow.kpi_id]
      );

      return toKpiDefinitionVersion(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { definitionVersion: result };
      return {
        schemaVersion: 1,
        eventType: 'kpi.definition_rejected',
        aggregateType: 'kpi',
        aggregateId: result.kpiId,
        organizationId,
        actorUserId: rejectedBy,
        actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        causationId,
        occurredAt: new Date().toISOString(),
        policyVersion: POLICY_VERSION_NOT_TRACKED,
        beforeState,
        afterState,
        stateHash: computeStateHash(afterState),
        reason: rejectionReason,
        evidenceRefs: [],
        source: KPI_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { definitionVersionId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// KPI lifecycle: activateKpi / suspendKpi / archiveKpi
// (all mutate rvn_kpi_definitions.status, root aggregate CAS on its own row_version)
// ==========================================

interface KpiLifecycleTransitionSpec {
  eventType: string;
  fromStatuses: readonly KpiStatus[];
  toStatus: KpiStatus;
  /** Whether an approved current_definition_version_id is required to enter
   * this status. Only `activateKpi` requires one — a KPI cannot go live
   * measuring against nothing approved yet. */
  requiresApprovedVersion: boolean;
}

async function runKpiLifecycleTransition(
  spec: KpiLifecycleTransitionSpec,
  input: {
    kpiId: string;
    organizationId: string;
    expectedVersion: number;
    actorUserId: string;
    actorEffectiveRole: string;
    idempotencyKey: string;
    correlationId?: string;
    causationId?: string | null;
    reason?: string | null;
  }
): Promise<AtomicCommandOutcome<KpiDefinition>> {
  const {
    kpiId,
    organizationId,
    expectedVersion,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<KpiDefinitionRow, KpiDefinition>({
    organizationId,
    aggregateId: kpiId,
    expectedVersion,
    loadForUpdate: loadKpiDefinitionForUpdate,
    getCurrentVersion: definitionRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (!spec.fromStatuses.includes(currentRow.status)) {
        throw new KpiDefinitionValidationError(
          `KPI ${kpiId} is "${currentRow.status}" — cannot transition to "${spec.toStatus}" from there`,
          'INVALID_KPI_STATUS_TRANSITION',
          { kpiId, currentStatus: currentRow.status, toStatus: spec.toStatus }
        );
      }

      if (spec.requiresApprovedVersion) {
        if (!currentRow.current_definition_version_id) {
          throw new KpiDefinitionValidationError(
            `KPI ${kpiId} has no current definition version — cannot activate`,
            'NO_APPROVED_VERSION',
            { kpiId }
          );
        }
        const versionCheck = await client.query<{ approval_status: string }>(
          `SELECT approval_status FROM rvn_kpi_definition_versions WHERE definition_version_id = $1`,
          [currentRow.current_definition_version_id]
        );
        if (versionCheck.rows[0]?.approval_status !== 'approved') {
          throw new KpiDefinitionValidationError(
            `KPI ${kpiId}'s current definition version is not approved — cannot activate`,
            'NO_APPROVED_VERSION',
            { kpiId, definitionVersionId: currentRow.current_definition_version_id }
          );
        }
      }

      beforeState = { kpi: toKpiDefinition(currentRow) };

      const updateResult = await client.query<KpiDefinitionRow>(
        `UPDATE rvn_kpi_definitions
            SET status = $1, row_version = $2, updated_at = now()
          WHERE kpi_id = $3
          RETURNING *`,
        [spec.toStatus, nextVersion, kpiId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) {
        throw new Error(`[${spec.eventType}] update returned no row for ${kpiId}`);
      }
      return toKpiDefinition(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { kpi: result };
      return {
        schemaVersion: 1,
        eventType: spec.eventType,
        aggregateType: 'kpi',
        aggregateId: kpiId,
        organizationId,
        actorUserId,
        actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        causationId,
        occurredAt: new Date().toISOString(),
        policyVersion: POLICY_VERSION_NOT_TRACKED,
        beforeState,
        afterState,
        stateHash: computeStateHash(afterState),
        reason,
        evidenceRefs: [],
        source: KPI_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { kpiId },
      } satisfies AtomicEventInput;
    },
  });
}

export interface KpiLifecycleInput {
  kpiId: string;
  organizationId: string;
  expectedVersion: number;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

export function activateKpi(input: KpiLifecycleInput): Promise<AtomicCommandOutcome<KpiDefinition>> {
  return runKpiLifecycleTransition(
    {
      eventType: 'kpi.activated',
      // 'pending_approval' added (EXECUTION_LEDGER.md §16 fix): the normal
      // path into 'active' now runs draft -> (submitDefinition) ->
      // pending_approval -> (approveDefinitionVersion, root status left
      // untouched) -> pending_approval -> (activateKpi) -> active. 'draft'
      // is kept too — a KPI whose current version was approved without
      // ever moving the root status (e.g. data predating this fix, or a
      // future direct-approve path) must still be activatable; the
      // `requiresApprovedVersion` check below is what actually gates this,
      // not the fromStatuses list.
      fromStatuses: ['draft', 'pending_approval', 'suspended'],
      toStatus: 'active',
      requiresApprovedVersion: true,
    },
    input
  );
}

export function suspendKpi(input: KpiLifecycleInput): Promise<AtomicCommandOutcome<KpiDefinition>> {
  return runKpiLifecycleTransition(
    {
      eventType: 'kpi.suspended',
      fromStatuses: ['active'],
      toStatus: 'suspended',
      requiresApprovedVersion: false,
    },
    input
  );
}

export function archiveKpi(input: KpiLifecycleInput): Promise<AtomicCommandOutcome<KpiDefinition>> {
  return runKpiLifecycleTransition(
    {
      eventType: 'kpi.archived',
      fromStatuses: ['draft', 'active', 'suspended'],
      toStatus: 'archived',
      requiresApprovedVersion: false,
    },
    input
  );
}
