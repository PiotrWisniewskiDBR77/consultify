/**
 * OKR-E001 — Program command layer.
 *
 * Design: docs/product/results-vnext/OKR_E001_DESIGN.md §6.1-§6.3.
 * Schema: server/migrations/20260822_rvn_okr_program_cycle.sql.
 *
 * `createProgram` mirrors `createRoiCase`'s `executeAtomicCreate` shape but
 * has NO fail-closed visibility-policy lookup — Program is not an ABAC
 * resource (Decision P2). Plain INSERT, `status='draft'`, no policy-version
 * row yet (that only happens on the first `publishProgram` call).
 *
 * `publishProgram` is the core of OKR-F-001-AC-01: it snapshots every
 * policy field into an append-only `okr_vnext_program_policy_versions` row,
 * pins `active_policy_version_id` to it, and — Decision P5 — is also the
 * FIRST product-facing writer of `rvn_platform_visibility_policies`, via
 * the new `publishVisibilityPolicy` platform primitive, on the SAME pinned
 * client/transaction (design §5's "same shape as `openOrEscalateDeviationCase`
 * being called from inside `recordMeasurement`").
 */
import { randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

import { computeStateHash } from '../kpi/kpiDefinitionCommands.js';
import {
  executeAtomicCommand,
  executeAtomicCreate,
  type AtomicCommandOutcome,
  type AtomicEventInput,
} from '../platform/atomicWrite.js';
import { publishVisibilityPolicy } from '../platform/visibilityResolver.js';

import {
  buildProgramPolicySnapshot,
  toOkrProgram,
  toOkrProgramPolicyVersion,
  type OkrCheckinFrequency,
  type OkrConfidenceModel,
  type OkrCycleModel,
  type OkrObjectiveConfidenceModel,
  type OkrObjectiveRollupModel,
  type OkrProgram,
  type OkrProgramPolicyVersion,
  type OkrProgramPolicyVersionRow,
  type OkrProgramRow,
  type OkrScoringModel,
  type OkrVisibilityDefault,
} from './okrProgramTypes.js';

// ==========================================
// SHARED CONSTANTS
// ==========================================

/** `domain` value used for `publishVisibilityPolicy`'s
 * `(organizationId, domain)` key and for `rvn_platform_events.aggregate_type`
 * lookups elsewhere (design §5/§7 — RVN_RESOURCE_TYPES carries
 * `'okr_program'`/`'okr_cycle'`, not `'okr'`; `'okr'` is only ever the
 * visibility-policy DOMAIN string, a separate namespace). */
export const OKR_VISIBILITY_DOMAIN = 'okr';
export const OKR_PROGRAM_RESOURCE_TYPE = 'okr_program';

export const OKR_EVENT_SOURCE = 'resultsVnext.okr';

// ==========================================
// ERRORS
// ==========================================

/** Generic invalid-state-transition / bad-input guard, mirrors
 * `RoiCaseValidationError`'s role in the ROI domain. */
export class OkrProgramValidationError extends Error {
  code: string;
  details?: Record<string, unknown>;
  constructor(message: string, code = 'INVALID_TRANSITION', details?: Record<string, unknown>) {
    super(message);
    this.name = 'OkrProgramValidationError';
    this.code = code;
    this.details = details;
  }
}

// ==========================================
// SHARED ROW LOADER
// ==========================================

async function loadOkrProgramForUpdate(
  client: PoolClient,
  programId: string,
  organizationId: string
): Promise<OkrProgramRow | undefined> {
  const result = await client.query<OkrProgramRow>(
    `SELECT * FROM okr_vnext_programs WHERE program_id = $1 AND organization_id = $2 FOR UPDATE`,
    [programId, organizationId]
  );
  return result.rows[0];
}

function programRowVersion(row: OkrProgramRow): number {
  return row.row_version;
}

// ==========================================
// SHARED EDITABLE-FIELD SHAPE (createProgram + editProgramDraft)
// ==========================================

interface OkrProgramPolicyFieldsInput {
  cycleModel?: OkrCycleModel;
  annualDirectionEnabled?: boolean;
  objectiveMinRecommended?: number | null;
  objectiveMaxRecommended?: number | null;
  krMinRequired?: number;
  krMaxRecommended?: number | null;
  checkinFrequency?: OkrCheckinFrequency;
  approvalRequired?: boolean;
  scoringModel?: OkrScoringModel;
  objectiveRollupModel?: OkrObjectiveRollupModel;
  confidenceEnabled?: boolean;
  confidenceModel?: OkrConfidenceModel;
  objectiveConfidenceModel?: OkrObjectiveConfidenceModel;
  visibilityDefault?: OkrVisibilityDefault;
  committedVsAspirationalEnabled?: boolean;
  managerReviewRequired?: boolean;
  selfReviewRequired?: boolean;
  reflectionRequiredForClose?: boolean;
  recognitionEnabled?: boolean;
}

// DDL defaults, restated here so createProgram's INSERT is fully explicit
// (never relies on a caller omitting a column to reach a DB default — same
// discipline every other resultsVnext create command in this repo follows).
const PROGRAM_POLICY_DEFAULTS: Required<OkrProgramPolicyFieldsInput> = {
  cycleModel: 'quarterly',
  annualDirectionEnabled: false,
  objectiveMinRecommended: null,
  objectiveMaxRecommended: null,
  krMinRequired: 2,
  krMaxRecommended: null,
  checkinFrequency: 'biweekly',
  approvalRequired: true,
  scoringModel: 'zero_to_one',
  objectiveRollupModel: 'none',
  confidenceEnabled: true,
  confidenceModel: 'high_medium_low',
  objectiveConfidenceModel: 'lowest_kr',
  visibilityDefault: 'OPEN_ORG',
  committedVsAspirationalEnabled: true,
  managerReviewRequired: true,
  selfReviewRequired: false,
  reflectionRequiredForClose: false,
  recognitionEnabled: true,
};

// ==========================================
// createProgram
// ==========================================

export interface CreateOkrProgramInput extends OkrProgramPolicyFieldsInput {
  organizationId: string;
  name: string;
  createdBy: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

/**
 * Design §6.1: plain INSERT (`status='draft'`, no policy-version row yet).
 * No fail-closed visibility-policy lookup (Program is not an ABAC resource,
 * Decision P2).
 */
export async function createProgram(
  input: CreateOkrProgramInput
): Promise<AtomicCommandOutcome<OkrProgram>> {
  const {
    organizationId,
    name,
    createdBy,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
    ...policyOverrides
  } = input;

  const fields = { ...PROGRAM_POLICY_DEFAULTS, ...policyOverrides };

  return executeAtomicCreate<OkrProgram>({
    organizationId,
    applyMutation: async (client) => {
      const insertResult = await client.query<OkrProgramRow>(
        `INSERT INTO okr_vnext_programs
           (organization_id, name, status, cycle_model, annual_direction_enabled,
            objective_min_recommended, objective_max_recommended, kr_min_required,
            kr_max_recommended, checkin_frequency, approval_required, scoring_model,
            objective_rollup_model, confidence_enabled, confidence_model,
            objective_confidence_model, visibility_default,
            committed_vs_aspirational_enabled, manager_review_required,
            self_review_required, reflection_required_for_close, recognition_enabled,
            created_by)
         VALUES ($1, $2, 'draft', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
                 $17, $18, $19, $20, $21, $22)
         RETURNING *`,
        [
          organizationId,
          name,
          fields.cycleModel,
          fields.annualDirectionEnabled,
          fields.objectiveMinRecommended,
          fields.objectiveMaxRecommended,
          fields.krMinRequired,
          fields.krMaxRecommended,
          fields.checkinFrequency,
          fields.approvalRequired,
          fields.scoringModel,
          fields.objectiveRollupModel,
          fields.confidenceEnabled,
          fields.confidenceModel,
          fields.objectiveConfidenceModel,
          fields.visibilityDefault,
          fields.committedVsAspirationalEnabled,
          fields.managerReviewRequired,
          fields.selfReviewRequired,
          fields.reflectionRequiredForClose,
          fields.recognitionEnabled,
          createdBy,
        ]
      );
      const row = insertResult.rows[0];
      if (!row) {
        throw new Error('[createProgram] insert into okr_vnext_programs returned no row');
      }
      return toOkrProgram(row);
    },
    buildEvent: ({ result }) => {
      const afterState: Record<string, unknown> = { program: result };
      return {
        schemaVersion: 1,
        eventType: 'okr_program.created',
        aggregateType: 'okr_program',
        aggregateId: result.programId,
        organizationId,
        actorUserId: createdBy,
        actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        causationId,
        occurredAt: new Date().toISOString(),
        policyVersion: '',
        beforeState: null,
        afterState,
        stateHash: computeStateHash(afterState),
        reason,
        evidenceRefs: [],
        source: OKR_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion: null,
        resultingVersion: result.rowVersion,
        payload: { programId: result.programId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// editProgramDraft
// ==========================================

/** Design §6.2: editing allowed pre-first-publish (`draft`) AND as ongoing
 * tuning while `active` (staged fields take effect only for future Cycles
 * once `publishProgram` snapshots them). Rejected for `suspended`/
 * `retired`. */
const PROGRAM_EDITABLE_STATUSES: readonly OkrProgramRow['status'][] = ['draft', 'active'];

export interface EditOkrProgramDraftInput extends OkrProgramPolicyFieldsInput {
  programId: string;
  organizationId: string;
  expectedVersion: number;
  name?: string;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

export async function editProgramDraft(
  input: EditOkrProgramDraftInput
): Promise<AtomicCommandOutcome<OkrProgram>> {
  const {
    programId,
    organizationId,
    expectedVersion,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
    name,
    ...policyOverrides
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<OkrProgramRow, OkrProgram>({
    organizationId,
    aggregateId: programId,
    expectedVersion,
    loadForUpdate: loadOkrProgramForUpdate,
    getCurrentVersion: programRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (!PROGRAM_EDITABLE_STATUSES.includes(currentRow.status)) {
        throw new OkrProgramValidationError(
          `OKR Program ${programId} is "${currentRow.status}" — draft fields may not be edited from this status`,
          'NOT_EDITABLE',
          { programId, status: currentRow.status }
        );
      }

      beforeState = { program: toOkrProgram(currentRow) };

      const merged = {
        name: name ?? currentRow.name,
        cycleModel: policyOverrides.cycleModel ?? currentRow.cycle_model,
        annualDirectionEnabled: policyOverrides.annualDirectionEnabled ?? currentRow.annual_direction_enabled,
        objectiveMinRecommended:
          policyOverrides.objectiveMinRecommended !== undefined
            ? policyOverrides.objectiveMinRecommended
            : currentRow.objective_min_recommended,
        objectiveMaxRecommended:
          policyOverrides.objectiveMaxRecommended !== undefined
            ? policyOverrides.objectiveMaxRecommended
            : currentRow.objective_max_recommended,
        krMinRequired: policyOverrides.krMinRequired ?? currentRow.kr_min_required,
        krMaxRecommended:
          policyOverrides.krMaxRecommended !== undefined
            ? policyOverrides.krMaxRecommended
            : currentRow.kr_max_recommended,
        checkinFrequency: policyOverrides.checkinFrequency ?? currentRow.checkin_frequency,
        approvalRequired: policyOverrides.approvalRequired ?? currentRow.approval_required,
        scoringModel: policyOverrides.scoringModel ?? currentRow.scoring_model,
        objectiveRollupModel: policyOverrides.objectiveRollupModel ?? currentRow.objective_rollup_model,
        confidenceEnabled: policyOverrides.confidenceEnabled ?? currentRow.confidence_enabled,
        confidenceModel: policyOverrides.confidenceModel ?? currentRow.confidence_model,
        objectiveConfidenceModel:
          policyOverrides.objectiveConfidenceModel ?? currentRow.objective_confidence_model,
        visibilityDefault: policyOverrides.visibilityDefault ?? currentRow.visibility_default,
        committedVsAspirationalEnabled:
          policyOverrides.committedVsAspirationalEnabled ?? currentRow.committed_vs_aspirational_enabled,
        managerReviewRequired: policyOverrides.managerReviewRequired ?? currentRow.manager_review_required,
        selfReviewRequired: policyOverrides.selfReviewRequired ?? currentRow.self_review_required,
        reflectionRequiredForClose:
          policyOverrides.reflectionRequiredForClose ?? currentRow.reflection_required_for_close,
        recognitionEnabled: policyOverrides.recognitionEnabled ?? currentRow.recognition_enabled,
      };

      const updateResult = await client.query<OkrProgramRow>(
        `UPDATE okr_vnext_programs
            SET name = $1, cycle_model = $2, annual_direction_enabled = $3,
                objective_min_recommended = $4, objective_max_recommended = $5,
                kr_min_required = $6, kr_max_recommended = $7, checkin_frequency = $8,
                approval_required = $9, scoring_model = $10, objective_rollup_model = $11,
                confidence_enabled = $12, confidence_model = $13,
                objective_confidence_model = $14, visibility_default = $15,
                committed_vs_aspirational_enabled = $16, manager_review_required = $17,
                self_review_required = $18, reflection_required_for_close = $19,
                recognition_enabled = $20,
                row_version = $21, updated_by = $22, updated_at = now()
          WHERE program_id = $23
          RETURNING *`,
        [
          merged.name,
          merged.cycleModel,
          merged.annualDirectionEnabled,
          merged.objectiveMinRecommended,
          merged.objectiveMaxRecommended,
          merged.krMinRequired,
          merged.krMaxRecommended,
          merged.checkinFrequency,
          merged.approvalRequired,
          merged.scoringModel,
          merged.objectiveRollupModel,
          merged.confidenceEnabled,
          merged.confidenceModel,
          merged.objectiveConfidenceModel,
          merged.visibilityDefault,
          merged.committedVsAspirationalEnabled,
          merged.managerReviewRequired,
          merged.selfReviewRequired,
          merged.reflectionRequiredForClose,
          merged.recognitionEnabled,
          nextVersion,
          actorUserId,
          programId,
        ]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) {
        throw new Error(`[editProgramDraft] update returned no row for ${programId}`);
      }
      return toOkrProgram(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { program: result };
      return {
        schemaVersion: 1,
        eventType: 'okr_program.draft_edited',
        aggregateType: 'okr_program',
        aggregateId: result.programId,
        organizationId,
        actorUserId,
        actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        causationId,
        occurredAt: new Date().toISOString(),
        policyVersion: '',
        beforeState,
        afterState,
        stateHash: computeStateHash(afterState),
        reason,
        evidenceRefs: [],
        source: OKR_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { programId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// publishProgram
// ==========================================

export interface PublishOkrProgramInput {
  programId: string;
  organizationId: string;
  expectedVersion: number;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

export interface PublishOkrProgramResult {
  program: OkrProgram;
  policyVersion: OkrProgramPolicyVersion;
}

/**
 * Design §6.3, core of OKR-F-001-AC-01. Inside `applyMutation`, same pinned
 * client:
 *   1. `nextVersionNumber = COALESCE(MAX(version_number),0)+1` for this
 *      program_id.
 *   2. INSERT the full current field snapshot into
 *      `okr_vnext_program_policy_versions`.
 *   3. UPDATE `okr_vnext_programs.active_policy_version_id`; if
 *      `status='draft'`, transition to `active`; if already `active`,
 *      unchanged.
 *   4. `publishVisibilityPolicy(client, {organizationId, domain:'okr',
 *      mode: program.visibility_default, publishedBy: actorId})`.
 *
 * No self-approval denial (Decision P6) — any authorized admin may publish
 * their own draft.
 */
export async function publishProgram(
  input: PublishOkrProgramInput
): Promise<AtomicCommandOutcome<PublishOkrProgramResult>> {
  const {
    programId,
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

  return executeAtomicCommand<OkrProgramRow, PublishOkrProgramResult>({
    organizationId,
    aggregateId: programId,
    expectedVersion,
    loadForUpdate: loadOkrProgramForUpdate,
    getCurrentVersion: programRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      beforeState = { program: toOkrProgram(currentRow) };

      // Step 1: next policy version_number for this program.
      const nextPolicyVersionResult = await client.query<{ next: number }>(
        `SELECT COALESCE(MAX(version_number), 0) + 1 AS next
           FROM okr_vnext_program_policy_versions
          WHERE program_id = $1`,
        [programId]
      );
      const nextVersionNumber = nextPolicyVersionResult.rows[0].next;

      // Step 2: append-only snapshot insert.
      const snapshot = buildProgramPolicySnapshot(currentRow);
      const policyVersionInsert = await client.query<OkrProgramPolicyVersionRow>(
        `INSERT INTO okr_vnext_program_policy_versions
           (program_id, organization_id, version_number, snapshot, published_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [programId, organizationId, nextVersionNumber, JSON.stringify(snapshot), actorUserId]
      );
      const policyVersionRow = policyVersionInsert.rows[0];
      if (!policyVersionRow) {
        throw new Error('[publishProgram] insert into okr_vnext_program_policy_versions returned no row');
      }

      // Step 3: pin active_policy_version_id; draft -> active, active stays active.
      const nextStatus = currentRow.status === 'draft' ? 'active' : currentRow.status;
      const programUpdateResult = await client.query<OkrProgramRow>(
        `UPDATE okr_vnext_programs
            SET active_policy_version_id = $1, status = $2,
                row_version = $3, updated_by = $4, updated_at = now()
          WHERE program_id = $5
          RETURNING *`,
        [policyVersionRow.policy_version_id, nextStatus, nextVersion, actorUserId, programId]
      );
      const programRow = programUpdateResult.rows[0];
      if (!programRow) {
        throw new Error(`[publishProgram] update returned no row for ${programId}`);
      }

      // Step 4: author the platform's visibility-policy row for domain='okr'
      // — first product-facing writer of rvn_platform_visibility_policies
      // (Decision P5).
      await publishVisibilityPolicy(client, {
        organizationId,
        domain: OKR_VISIBILITY_DOMAIN,
        mode: programRow.visibility_default,
        publishedBy: actorUserId,
      });

      return {
        program: toOkrProgram(programRow),
        policyVersion: toOkrProgramPolicyVersion(policyVersionRow),
      };
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { program: result.program, policyVersion: result.policyVersion };
      return {
        schemaVersion: 1,
        eventType: 'okr_program.published',
        aggregateType: 'okr_program',
        aggregateId: result.program.programId,
        organizationId,
        actorUserId,
        actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        causationId,
        occurredAt: new Date().toISOString(),
        policyVersion: String(result.policyVersion.versionNumber),
        beforeState,
        afterState,
        stateHash: computeStateHash(afterState),
        reason,
        evidenceRefs: [],
        source: OKR_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { programId, policyVersionId: result.policyVersion.policyVersionId },
      } satisfies AtomicEventInput;
    },
  });
}
