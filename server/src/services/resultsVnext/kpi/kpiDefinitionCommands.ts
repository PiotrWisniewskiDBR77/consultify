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
 * `reviseDefinition` (RN_G6_P0A) is a THIRD shape: it CASes on an EXISTING
 * row (the rejected definition version, via `executeAtomicCommand`, so a
 * stale read still gets the ordinary typed `STALE_VERSION` conflict) but
 * never UPDATEs that row — it INSERTs a brand-new sibling version instead,
 * with `version_number` computed under a lock on the PARENT
 * `rvn_kpi_definitions` row (not the CAS'd row) so two concurrent revisions
 * of the same rejected version cannot collide on `UNIQUE (kpi_id,
 * version_number)`. See its own doc comment for the full contract
 * (docs/product/results-vnext/RN_G6_P0A_KPI_REVISION_CONTRACT.md).
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
import {
  assertCommandCapability,
  type CommandAccessContext,
} from '../platform/commandCapabilityGuard.js';
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

// ==========================================
// RN-G5 — command capability names (docs/product/results-vnext/RN_G5_AUTHZ_DESIGN.md)
// Same rationale/convention as kpiDeviationCommands.ts's DEVIATION_CAPABILITIES.
// ==========================================
export const KPI_DEFINITION_CAPABILITIES = {
  /** No "record" exists yet at create time — capability-only, no owner/
   * manager override (see commandCapabilityGuard.ts's own doc comment on
   * `responsibleUserIds` being optional). */
  create: 'results.kpi.definition.create',
  editDraft: 'results.kpi.definition.edit_draft',
  /** RN_G6_P0A — gates `reviseDefinition` (create a new draft version from a
   * rejected one). Same responsible-people fallback shape as `editDraft`
   * (owner OR the rejected version's own `created_by`) — see that
   * command's own `assertCommandCapability` call for the precedent. */
  revise: 'results.kpi.definition.revise',
  submit: 'results.kpi.definition.submit',
  approve: 'results.kpi.definition.approve',
  reject: 'results.kpi.definition.reject',
  activate: 'results.kpi.definition.activate',
  suspend: 'results.kpi.definition.suspend',
  archive: 'results.kpi.definition.archive',
} as const;

/**
 * `rvn_kpi_definition_versions` rows (the aggregate `editDraft`/
 * `submitDefinition`/`approveDefinitionVersion`/`rejectDefinitionVersion`
 * CAS against) carry no `owner_user_id` of their own — only the parent
 * `rvn_kpi_definitions` row does (`kpiTypes.ts`'s `KpiDefinitionRow.owner_user_id`).
 * Same shape as `kpiMeasurementCommands.ts`'s `resolveDeviationCaseOwner`,
 * minus that helper's "fall back to the actor" behavior — a guard must see
 * the REAL owner (or `null` if unset), never a value that would make the
 * check trivially pass.
 */
async function loadKpiOwnerUserId(client: PoolClient, kpiId: string): Promise<string | null> {
  const result = await client.query<{ owner_user_id: string | null }>(
    `SELECT owner_user_id FROM rvn_kpi_definitions WHERE kpi_id = $1`,
    [kpiId]
  );
  return result.rows[0]?.owner_user_id ?? null;
}

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
  access: CommandAccessContext;
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
    access,
  } = input;

  // Captured inside applyMutation, read by buildEvent — see file header.
  let visibilityPolicyVersion: string | undefined;

  return executeAtomicCreate<CreateKpiDraftResult>({
    organizationId,
    applyMutation: async (client) => {
      // RN-G5 DECISION (documented, not an oversight): createKpiDraft is
      // deliberately left UNGATED by this pakiet, unlike every other
      // command in this file. Reasons: (1) no record exists yet at create
      // time, so there is no owner/manager fallback — a gate here would be
      // capability-ONLY; (2) `results.kpi.definition.create` is not part of
      // any baseline a regular member holds by default (effectiveAccessService.ts
      // is out of this pakiet's allowlist — cannot add it there), so gating
      // this specific command would deny it to every non-OWNER/ADMIN actor,
      // including Teresa acting for a real user with no elevated
      // organization_members role — verified this breaks a real, currently
      // passing e2e gold flow (tests/resultsVnext/teresa-kpi-e2e-no-silent-approval.test.ts,
      // draft_quality_review create path). Drafting your OWN new KPI is also
      // materially lower-risk than the vulnerability this pakiet targets
      // (approving/verifying/correcting an EXISTING, possibly someone
      // else's, KPI) — a fresh draft is invisible/inert until it passes the
      // separately-guarded submit/approve pipeline below, both of which ARE
      // gated. `access` is still accepted on this input (kept for API
      // consistency with every sibling command and to avoid a breaking
      // signature change if a future pakiet adds the baseline capability),
      // it is simply not asserted here.
      void access;

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
  access: CommandAccessContext;
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
    access,
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
      const ownerUserId = await loadKpiOwnerUserId(client, currentRow.kpi_id);
      assertCommandCapability({
        access,
        actorUserId,
        capability: KPI_DEFINITION_CAPABILITIES.editDraft,
        responsibleUserIds: [ownerUserId, currentRow.created_by],
      });

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
  access: CommandAccessContext;
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
    access,
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<KpiDefinitionVersionRow, KpiDefinitionVersion>({
    organizationId,
    aggregateId: definitionVersionId,
    expectedVersion,
    loadForUpdate: loadDefinitionVersionForUpdate,
    getCurrentVersion: versionRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      const ownerUserId = await loadKpiOwnerUserId(client, currentRow.kpi_id);
      assertCommandCapability({
        access,
        actorUserId,
        capability: KPI_DEFINITION_CAPABILITIES.submit,
        responsibleUserIds: [ownerUserId, currentRow.created_by],
      });

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
  access: CommandAccessContext;
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
    access,
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<KpiDefinitionVersionRow, KpiDefinitionVersion>({
    organizationId,
    aggregateId: definitionVersionId,
    expectedVersion,
    loadForUpdate: loadDefinitionVersionForUpdate,
    getCurrentVersion: versionRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      // RN-G5: coarse authorization FIRST, then maker-checker self-approval
      // SECOND — same ordering/rationale as kpiDeviationCommands.approvePlan.
      const ownerUserId = await loadKpiOwnerUserId(client, currentRow.kpi_id);
      assertCommandCapability({
        access,
        actorUserId: approverId,
        capability: KPI_DEFINITION_CAPABILITIES.approve,
        responsibleUserIds: [ownerUserId],
      });

      // Self-approval denial — SECOND, still before any write, per design doc §B.
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
  access: CommandAccessContext;
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
    access,
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<KpiDefinitionVersionRow, KpiDefinitionVersion>({
    organizationId,
    aggregateId: definitionVersionId,
    expectedVersion,
    loadForUpdate: loadDefinitionVersionForUpdate,
    getCurrentVersion: versionRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      const ownerUserId = await loadKpiOwnerUserId(client, currentRow.kpi_id);
      assertCommandCapability({
        access,
        actorUserId: rejectedBy,
        capability: KPI_DEFINITION_CAPABILITIES.reject,
        responsibleUserIds: [ownerUserId],
      });

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
      // entered when the now-rejected version was submitted. Only fires
      // from 'pending_approval' — an amendment draft being rejected while
      // the KPI is already 'active'/'suspended' on a DIFFERENT,
      // already-approved version must not touch that root status.
      //
      // CORRECTED (RN_G6_P0A, 2026-08-12): this comment used to claim "so
      // the KPI can be edited and resubmitted" — FALSE until this package.
      // The version this UPDATE just set back to 'draft' on the ROOT row is
      // NOT the rejected version itself (that row stays 'rejected' forever,
      // see the trigger/comment on this table — it is never edited or
      // reactivated). Before `reviseDefinition` (below) existed, nothing in
      // this file could ever INSERT the version 2 row that `editDraft`
      // would need to act on — `editDraft` requires `approval_status =
      // 'draft'` ON THE VERSION, and no command produced one after a
      // rejection, so a rejected KPI was permanently stuck. `reviseDefinition`
      // is what actually makes "edited and resubmitted" true: it creates
      // that new draft version (copied from the rejected one) that
      // `editDraft`/`submitDefinition` then act on normally.
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
// reviseDefinition (RN_G6_P0A — P0-A defect fix)
// ==========================================
//
// Docs/product/results-vnext/RN_G6_P0A_KPI_REVISION_CONTRACT.md §3. Before
// this command, a REJECTED definition version was a dead end: `editDraft`
// requires `approval_status = 'draft'` ON THE VERSION, and nothing in this
// file ever produced a new version after a rejection — the KPI was
// permanently blocked (§1 of the contract). No migration was needed: the
// schema already supports multiple versions per `kpi_id`
// (`UNIQUE (kpi_id, version_number)`, `20260810_rvn_kpi_core.sql:110`), the
// approved-only overlap EXCLUDE constraint already ignores draft/submitted/
// rejected rows, and the protect_approved trigger only ever blocks UPDATEs
// on an approved row — none of that stood in the way of a plain INSERT.
//
// Contract §3 "Warunki wstępne" point 2 (checked "each case separately", so
// the 403 wording an owner sees names exactly which prior decision blocks
// them):
//   - the indicated version is 'approved'  -> CANNOT_REVISE_APPROVED
//     (amending an approved definition is a different, out-of-scope flow).
//   - the indicated version is 'draft'     -> CANNOT_REVISE_DRAFT
//     (nothing to revise from — use `editDraft`).
//   - the indicated version is 'submitted' -> CANNOT_REVISE_SUBMITTED
//     (a reviewer decision has not landed yet).
//   - only 'rejected' passes.

/**
 * `reviseDefinition`'s own row loader is `loadDefinitionVersionForUpdate`
 * (shared with `editDraft`/`submitDefinition`/`approveDefinitionVersion`/
 * `rejectDefinitionVersion` above) — it is the REJECTED version that gets
 * `SELECT ... FOR UPDATE`'d and CAS'd (contract §3 point 3: `expectedVersion`
 * compares against the rejected version's OWN `row_version`, and a mismatch
 * is the ordinary `AtomicWriteConflictError`/`STALE_VERSION` every other
 * command in this file already throws — no new conflict type). What is
 * DIFFERENT from every sibling command: `applyMutation` never issues an
 * `UPDATE` against that locked row (contract §3 "Czego komenda NIE robi"
 * point 1 — the rejected row is untouched, forever, byte-for-byte). It
 * INSERTs a new sibling row instead, with `version_number` computed under a
 * SEPARATE lock on the PARENT `rvn_kpi_definitions` row (not the CAS'd
 * version row) — two concurrent `reviseDefinition` calls against the SAME
 * rejected version (or against two DIFFERENT rejected versions of the same
 * KPI) must not both compute the same `MAX(version_number) + 1` and collide
 * on `UNIQUE (kpi_id, version_number)`; only a real row lock inside the same
 * transaction as the INSERT prevents that race (an app-level pre-check
 * would not — a second transaction could read the same MAX before the
 * first's INSERT commits).
 */
export interface ReviseDefinitionInput {
  /** The REJECTED version to revise from — contract §3 point 2. */
  definitionVersionId: string;
  organizationId: string;
  /** CAS against the REJECTED version's own `row_version` — contract §3
   * point 3. */
  expectedVersion: number;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
  access: CommandAccessContext;
}

export async function reviseDefinition(
  input: ReviseDefinitionInput
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
    access,
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<KpiDefinitionVersionRow, KpiDefinitionVersion>({
    organizationId,
    aggregateId: definitionVersionId,
    expectedVersion,
    loadForUpdate: loadDefinitionVersionForUpdate,
    getCurrentVersion: versionRowVersion,
    applyMutation: async (client, currentRow, _nextVersion) => {
      // RN-G5: authorization FIRST, same responsible-people fallback shape
      // as editDraft's own call (owner OR the rejected version's own
      // created_by) — the owner who got the rejection is exactly who should
      // be able to act on it, mirroring editDraft's rationale for the same
      // pair of ids.
      const ownerUserId = await loadKpiOwnerUserId(client, currentRow.kpi_id);
      assertCommandCapability({
        access,
        actorUserId,
        capability: KPI_DEFINITION_CAPABILITIES.revise,
        responsibleUserIds: [ownerUserId, currentRow.created_by],
      });

      // Contract §3 "Warunki wstępne" point 2 — each disallowed status gets
      // its own code/message (never a single generic "wrong status"), so a
      // denied caller (or this command's own tests) can tell an
      // already-approved definition apart from one still awaiting review.
      if (currentRow.approval_status === 'approved') {
        throw new KpiDefinitionValidationError(
          `Definition version ${definitionVersionId} is "approved" — amending an approved definition is a separate flow, out of scope for reviseDefinition`,
          'CANNOT_REVISE_APPROVED',
          { definitionVersionId, approvalStatus: currentRow.approval_status }
        );
      }
      if (currentRow.approval_status === 'draft') {
        throw new KpiDefinitionValidationError(
          `Definition version ${definitionVersionId} is already "draft" — nothing to revise, use editDraft instead`,
          'CANNOT_REVISE_DRAFT',
          { definitionVersionId, approvalStatus: currentRow.approval_status }
        );
      }
      if (currentRow.approval_status === 'submitted') {
        throw new KpiDefinitionValidationError(
          `Definition version ${definitionVersionId} is "submitted" — awaiting a reviewer decision before it can be revised`,
          'CANNOT_REVISE_SUBMITTED',
          { definitionVersionId, approvalStatus: currentRow.approval_status }
        );
      }
      if (currentRow.approval_status !== 'rejected') {
        // Unreachable given the 4-value CHECK constraint (draft/submitted/
        // approved/rejected) — defensive, not a real branch, same
        // "impossible state fails loudly instead of silently falling
        // through" discipline this file already uses elsewhere.
        throw new KpiDefinitionValidationError(
          `Definition version ${definitionVersionId} is "${currentRow.approval_status}" — only a rejected version may be revised`,
          'NOT_REJECTED',
          { definitionVersionId, approvalStatus: currentRow.approval_status }
        );
      }

      beforeState = { definitionVersion: toKpiDefinitionVersion(currentRow) };

      // Lock the PARENT KPI row FOR UPDATE — see this command's own doc
      // comment above for why this (not the already-locked version row) is
      // what actually serializes concurrent revisions and protects
      // `UNIQUE (kpi_id, version_number)`.
      const kpiLock = await client.query<{ kpi_id: string }>(
        `SELECT kpi_id FROM rvn_kpi_definitions WHERE kpi_id = $1 AND organization_id = $2 FOR UPDATE`,
        [currentRow.kpi_id, organizationId]
      );
      if (!kpiLock.rows[0]) {
        // The version row we just loaded references this kpi_id via a NOT
        // NULL FK (20260810_rvn_kpi_core.sql) — this branch means something
        // is structurally broken, not a normal not-found path. Fail loudly
        // rather than silently proceed with an unlocked parent.
        throw new Error(
          `[reviseDefinition] KPI ${currentRow.kpi_id} not found while locking its parent row for version numbering`
        );
      }

      const maxVersionResult = await client.query<{ max_version: number }>(
        `SELECT COALESCE(MAX(version_number), 0)::int AS max_version
           FROM rvn_kpi_definition_versions WHERE kpi_id = $1`,
        [currentRow.kpi_id]
      );
      const newVersionNumber = (maxVersionResult.rows[0]?.max_version ?? 0) + 1;

      // Contract §3 "Skutek" — every substantive field copied verbatim from
      // the rejected version (the reviewer's feedback already lives on that
      // frozen row; the owner gets a filled-in form, not a blank one). Audit
      // fields (submitted/approved/rejected by/at) reset to NULL, `created_by`
      // is THIS actor, `row_version` starts fresh at 1 — this is a brand-new
      // row, not a copy of the rejected row's own optimistic-concurrency
      // counter.
      const insertResult = await client.query<KpiDefinitionVersionRow>(
        `INSERT INTO rvn_kpi_definition_versions
           (kpi_id, organization_id, version_number, name, description, unit, target_geometry,
            target_value, target_min, target_max, warning_low, warning_high, critical_low, critical_high,
            binary_success_value, formula_text, approval_status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'draft', $17)
         RETURNING *`,
        [
          currentRow.kpi_id,
          organizationId,
          newVersionNumber,
          currentRow.name,
          currentRow.description,
          currentRow.unit,
          currentRow.target_geometry,
          currentRow.target_value,
          currentRow.target_min,
          currentRow.target_max,
          currentRow.warning_low,
          currentRow.warning_high,
          currentRow.critical_low,
          currentRow.critical_high,
          currentRow.binary_success_value,
          currentRow.formula_text,
          actorUserId,
        ]
      );
      const newVersionRow = insertResult.rows[0];
      if (!newVersionRow) {
        throw new Error('[reviseDefinition] insert into rvn_kpi_definition_versions returned no row');
      }

      // Root aggregate: `createKpiDraft` sets `current_definition_version_id`
      // to the version it JUST created, at kpiDefinitionCommands.ts:413-418
      // (`UPDATE rvn_kpi_definitions SET current_definition_version_id = $1
      // ... WHERE kpi_id = $2`, immediately after that command's own INSERT
      // into rvn_kpi_definition_versions) — i.e. this column follows the
      // newest version a create/revise-shaped command just produced, not
      // only approved ones (approveDefinitionVersion's later re-pointing,
      // ~line 847 above, is what makes it ALSO track "latest approved" once
      // an approval happens — the two are not in conflict: create/revise set
      // it to the newest version at the moment a new one is born, approve
      // re-points it to whichever version was actually approved, e.g. after
      // this rejected-then-revised cycle producing version 2, approving
      // version 2 exercises that exact same re-pointing code path again).
      // reviseDefinition mirrors createKpiDraft's own write here — same
      // "derived pointer, not a separately CAS'd write" shape
      // approveDefinitionVersion's own comment documents, no bump of
      // rvn_kpi_definitions.row_version.
      await client.query(
        `UPDATE rvn_kpi_definitions
            SET current_definition_version_id = $1, updated_at = now()
          WHERE kpi_id = $2`,
        [newVersionRow.definition_version_id, currentRow.kpi_id]
      );

      return toKpiDefinitionVersion(newVersionRow);
    },
    buildEvent: ({ currentRow, result, nextVersion }) => {
      // `resultingVersion` here follows this file's established idiom for
      // every sibling command (`nextVersion` = the CAS'd row's
      // `row_version` + 1) rather than literally describing a persisted
      // column — see this command's own doc comment: the CAS'd row (the
      // rejected version) is deliberately never UPDATEd, so no row anywhere
      // actually reaches `nextVersion` as its `row_version`. Kept consistent
      // with editDraft/submitDefinition/approveDefinitionVersion/
      // rejectDefinitionVersion above (all of which set this field from the
      // literal `nextVersion` the framework computes) rather than
      // special-cased, so a reader of `rvn_platform_events` sees the same
      // "expected_version -> resulting_version = +1" shape across this
      // whole command family.
      const afterState = { definitionVersion: result, previousDefinitionVersionId: currentRow.definition_version_id };
      return {
        schemaVersion: 1,
        eventType: 'kpi.definition_revised',
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
        payload: {
          definitionVersionId: result.definitionVersionId,
          previousDefinitionVersionId: currentRow.definition_version_id,
          versionNumber: result.versionNumber,
        },
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
  /** RN-G5: capability gating this specific transition. */
  capability: string;
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
    access: CommandAccessContext;
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
    access,
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<KpiDefinitionRow, KpiDefinition>({
    organizationId,
    aggregateId: kpiId,
    expectedVersion,
    loadForUpdate: loadKpiDefinitionForUpdate,
    getCurrentVersion: definitionRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      // RN-G5: KpiDefinitionRow already carries owner_user_id — no extra
      // lookup needed, unlike the version-row commands above.
      assertCommandCapability({
        access,
        actorUserId,
        capability: spec.capability,
        responsibleUserIds: [currentRow.owner_user_id],
      });

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
  access: CommandAccessContext;
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
      capability: KPI_DEFINITION_CAPABILITIES.activate,
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
      capability: KPI_DEFINITION_CAPABILITIES.suspend,
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
      capability: KPI_DEFINITION_CAPABILITIES.archive,
    },
    input
  );
}
