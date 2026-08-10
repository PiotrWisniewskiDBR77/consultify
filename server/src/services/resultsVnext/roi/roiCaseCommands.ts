/**
 * ROI-E001 — Case command layer.
 *
 * Design: docs/product/results-vnext/ROI_E001_DESIGN.md §4.1-§4.3.
 * Schema: server/migrations/20260815_rvn_roi_core.sql.
 *
 * `createRoiCase` mirrors `kpiDefinitionCommands.createKpiDraft` structurally
 * (fail-closed on no active `domain='roi'` visibility policy, `executeAtomicCreate`)
 * but ALSO implements AC-02's duplicate-prevention via the SAVEPOINT pattern
 * `kpiDeviationCommands.openOrEscalateDeviationCase` established (design §4.1
 * — "Build this in from the start; do not rediscover it"): a cheap pre-check
 * SELECT for the non-racing case, and for the racing case a SAVEPOINT around
 * the candidate INSERT so a caught Postgres 23505 (unique violation on
 * `ux_rvn_roi_cases_one_active_per_initiative`) can `ROLLBACK TO SAVEPOINT`
 * (clearing the aborted-transaction state) before the retry SELECT — a naive
 * catch-then-retry-SELECT without the SAVEPOINT fails with Postgres 25P02
 * (transaction aborted, commands ignored until end of transaction block).
 *
 * `updateRoiCaseDetails`/`archiveRoiCase`/`startModeling`/`markReadyForReview`
 * all mutate an EXISTING `rvn_roi_cases` row and go through
 * `executeAtomicCommand` with that row's own `row_version` as the
 * optimistic-concurrency CAS — identical convention to
 * `kpiDefinitionCommands.ts`.
 */
import { randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

import { computeStateHash, KPI_EVENT_SOURCE } from '../kpi/kpiDefinitionCommands.js';
import {
  executeAtomicCommand,
  executeAtomicCreate,
  type AtomicCommandOutcome,
  type AtomicEventInput,
} from '../platform/atomicWrite.js';
import { createObligation } from '../platform/obligations.js';
import { getActiveVisibilityPolicy } from '../platform/visibilityResolver.js';

import { isRoiCaseReadyForReviewEligibleWithEconomicModel } from './roiEconomicModelReadiness.js';
import {
  toRoiCalculationPolicy,
  type RoiCalculationPolicy,
  type RoiCalculationPolicyRow,
} from './roiEconomicModelTypes.js';
import {
  toRoiBaseline,
  toRoiCase,
  type RoiBaseline,
  type RoiBaselineRow,
  type RoiCase,
  type RoiCaseGranularity,
  type RoiCaseRow,
  type RoiCaseStatus,
} from './roiTypes.js';

// ==========================================
// SHARED CONSTANTS
// ==========================================

/** `domain` value used for the `getActiveVisibilityPolicy` lookup and for
 * `rvn_platform_resource_visibility.resource_type` (`RVN_RESOURCE_TYPES`
 * already carries `'roi_case'`, design doc §5). */
export const ROI_VISIBILITY_DOMAIN = 'roi';
export const ROI_RESOURCE_TYPE = 'roi_case';

export const ROI_EVENT_SOURCE = 'resultsVnext.roi';

/** Obligation type created alongside every new Case (design §4.1 point 2). */
export const START_ROI_STUDY_OBLIGATION_TYPE = 'start_roi_study';

/** Same simplification `kpiDefinitionCommands.ts`'s `POLICY_VERSION_NOT_TRACKED`
 * documents: only `createRoiCase`'s write is itself gated by a visibility-
 * policy lookup; every other command here mutates an already-visible
 * resource and does not re-resolve the active policy purely to fill this
 * audit field. */
const POLICY_VERSION_NOT_TRACKED = '';

// ==========================================
// ERRORS
// ==========================================

/** Fail-closed error for `createRoiCase` when no active `domain='roi'`
 * visibility policy exists for the organization — never fabricate a
 * default (design §5, mirrors `KpiNoActiveVisibilityPolicyError`). */
export class RoiCaseNoActiveVisibilityPolicyError extends Error {
  code = 'NO_ACTIVE_VISIBILITY_POLICY';
  details: Record<string, unknown>;
  constructor(organizationId: string, domain: string) {
    super(
      `No active visibility policy for organization ${organizationId}, domain "${domain}" — cannot create a ROI case without one`
    );
    this.name = 'RoiCaseNoActiveVisibilityPolicyError';
    this.details = { organizationId, domain };
  }
}

/** Generic invalid-state-transition / bad-input guard, mirrors
 * `KpiDefinitionValidationError`'s role in the KPI domain. */
export class RoiCaseValidationError extends Error {
  code: string;
  details?: Record<string, unknown>;
  constructor(message: string, code = 'INVALID_TRANSITION', details?: Record<string, unknown>) {
    super(message);
    this.name = 'RoiCaseValidationError';
    this.code = code;
    this.details = details;
  }
}

/** Thrown by `markReadyForReview`'s guard failure (design §4.3) — carries
 * the `reason` string `isRoiCaseReadyForReviewEligible` returns. Mapped to
 * 409 at the HTTP layer, same character as every other typed lifecycle-guard
 * error in the KPI domain (`SelfApprovalDeniedError`,
 * `DeviationSelfApprovalDeniedError`), never a bare 400/500. */
export class RoiCaseNotReadyForReviewError extends Error {
  code = 'NOT_READY_FOR_REVIEW';
  details: Record<string, unknown>;
  constructor(caseId: string, reason: string) {
    super(`ROI case ${caseId} is not ready for review: ${reason}`);
    this.name = 'RoiCaseNotReadyForReviewError';
    this.details = { caseId, reason };
  }
}

// ==========================================
// SHARED ROW LOADER
// ==========================================

async function loadRoiCaseForUpdate(
  client: PoolClient,
  caseId: string,
  organizationId: string
): Promise<RoiCaseRow | undefined> {
  const result = await client.query<RoiCaseRow>(
    `SELECT * FROM rvn_roi_cases WHERE case_id = $1 AND organization_id = $2 FOR UPDATE`,
    [caseId, organizationId]
  );
  return result.rows[0];
}

function caseRowVersion(row: RoiCaseRow): number {
  return row.row_version;
}

// ==========================================
// createRoiCase
// ==========================================

export interface CreateRoiCaseInput {
  organizationId: string;
  initiativeId: string;
  title: string;
  ownerUserId: string;
  currency: string;
  granularity?: RoiCaseGranularity;
  analysisStart?: string | null;
  analysisEnd?: string | null;
  createdBy: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

export interface CreateRoiCaseResult {
  case: RoiCase;
  baseline: RoiBaseline;
  /** ROI-E002 §4.1: the calculation-policy shell, always inserted alongside
   * the baseline shell in the same transaction (Decision D5) — a 1:1 row
   * that always exists so the command layer never branches on "does this
   * row exist yet." */
  calculationPolicy: RoiCalculationPolicy;
  /** false when a pre-existing active Case for this Initiative was found
   * and returned instead of creating a new one — AC-02's idempotent-
   * duplicate behavior, distinct from the idempotencyKey retry mechanism
   * `executeAtomicCreate` already provides. */
  created: boolean;
}

async function loadCaseWithBaseline(
  client: PoolClient,
  caseId: string,
  organizationId: string
): Promise<CreateRoiCaseResult> {
  const caseResult = await client.query<RoiCaseRow>(
    `SELECT * FROM rvn_roi_cases WHERE case_id = $1 AND organization_id = $2`,
    [caseId, organizationId]
  );
  const caseRow = caseResult.rows[0];
  if (!caseRow) {
    throw new Error(`[createRoiCase] winning case ${caseId} could not be re-read after SAVEPOINT rollback`);
  }
  const baselineResult = await client.query<RoiBaselineRow>(
    `SELECT * FROM rvn_roi_baselines WHERE case_id = $1 AND organization_id = $2`,
    [caseId, organizationId]
  );
  const baselineRow = baselineResult.rows[0];
  if (!baselineRow) {
    throw new Error(`[createRoiCase] winning case ${caseId} has no baseline shell row`);
  }
  const policyResult = await client.query<RoiCalculationPolicyRow>(
    `SELECT * FROM rvn_roi_calculation_policy WHERE case_id = $1 AND organization_id = $2`,
    [caseId, organizationId]
  );
  const policyRow = policyResult.rows[0];
  if (!policyRow) {
    throw new Error(`[createRoiCase] winning case ${caseId} has no calculation-policy shell row`);
  }
  return {
    case: toRoiCase(caseRow),
    baseline: toRoiBaseline(baselineRow),
    calculationPolicy: toRoiCalculationPolicy(policyRow),
    created: false,
  };
}

/**
 * Design §4.1: fail-closed on no active `domain='roi'` visibility policy,
 * one INSERT into `rvn_roi_cases`, one INSERT into `rvn_roi_baselines`
 * (empty shell), one `rvn_platform_resource_visibility` row, plus ACL grants
 * (Decision D3) and a `start_roi_study` obligation — all inside the same
 * `applyMutation` transaction.
 *
 * AC-02 concurrency: a plain pre-check SELECT first (cheap, non-racing
 * path), then a SAVEPOINT-wrapped candidate INSERT for the racing case —
 * copied verbatim in shape from `kpiDeviationCommands.openOrEscalateDeviationCase`
 * (design §4.1, EXECUTION_LEDGER §20).
 *
 * IMPLEMENTATION NOTE (event-log consequence of the design's own chosen
 * structure): the design doc pins `createRoiCase` to `executeAtomicCreate`
 * end-to-end (§4.1's own section title/signature), which unconditionally
 * builds+inserts one `rvn_platform_events` row from whatever `applyMutation`
 * returns — including the "found an existing active case" branches (the
 * cheap pre-check SELECT and the SAVEPOINT-losing race). A caller that hits
 * either branch therefore still gets its own `roi.case_created` event row
 * (distinct `idempotency_key`, `payload.created: false`) referencing the
 * SAME `aggregate_id` as the original winning create — this is a duplicate
 * "creation" entry in the append-only event log, not a duplicate DATABASE
 * ROW (no second `rvn_roi_cases`/`rvn_roi_baselines` row is ever inserted;
 * `ux_rvn_roi_cases_one_active_per_initiative` guarantees that). Left as-is
 * rather than restructured around `executeAtomicCreate` (which the design
 * doc does not offer as an option here) — `resultingVersion` below always
 * reflects the CASE's actual current `row_version` (not a hardcoded `1`) so
 * at least that field stays honest for the found-existing branches.
 */
export async function createRoiCase(
  input: CreateRoiCaseInput
): Promise<AtomicCommandOutcome<CreateRoiCaseResult>> {
  const {
    organizationId,
    initiativeId,
    title,
    ownerUserId,
    currency,
    granularity = 'monthly',
    analysisStart = null,
    analysisEnd = null,
    createdBy,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
  } = input;

  // Captured inside applyMutation, read by buildEvent — same closure
  // convention as kpiDefinitionCommands.ts's file header explains.
  let visibilityPolicyVersion: string | undefined;

  return executeAtomicCreate<CreateRoiCaseResult>({
    organizationId,
    applyMutation: async (client) => {
      // Fail closed if no active visibility policy exists for this
      // org/domain — never fabricate a default (design §5).
      const policy = await getActiveVisibilityPolicy(client, {
        organizationId,
        domain: ROI_VISIBILITY_DOMAIN,
      });
      if (!policy) {
        throw new RoiCaseNoActiveVisibilityPolicyError(organizationId, ROI_VISIBILITY_DOMAIN);
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
        throw new Error(
          `[createRoiCase] active policy ${policy.policyId} could not be re-read mid-transaction`
        );
      }

      // AC-02 cheap pre-check (non-racing path): a plain SELECT before ever
      // attempting the INSERT.
      const existingResult = await client.query<{ case_id: string }>(
        `SELECT case_id FROM rvn_roi_cases
          WHERE organization_id = $1 AND initiative_id = $2 AND status NOT IN ('cancelled','closed')`,
        [organizationId, initiativeId]
      );
      const existing = existingResult.rows[0];
      if (existing) {
        return loadCaseWithBaseline(client, existing.case_id, organizationId);
      }

      // -- Racing case: SAVEPOINT around the candidate INSERT so a caught
      // 23505 (unique violation on ux_rvn_roi_cases_one_active_per_initiative)
      // can ROLLBACK TO SAVEPOINT before the retry SELECT. Without the
      // SAVEPOINT, Postgres aborts the WHOLE transaction on the unique
      // violation and the retry SELECT itself fails with 25P02 (transaction
      // aborted) — see kpiDeviationCommands.openOrEscalateDeviationCase's own
      // "-- DEVIATION FROM DESIGN" comment for the empirically-verified
      // rationale this package copies verbatim (design §4.1).
      await client.query('SAVEPOINT roi_case_create');
      let caseRow: RoiCaseRow;
      try {
        const caseInsert = await client.query<RoiCaseRow>(
          `INSERT INTO rvn_roi_cases
             (organization_id, initiative_id, title, owner_user_id, currency, granularity,
              analysis_start, analysis_end, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *`,
          [organizationId, initiativeId, title, ownerUserId, currency, granularity, analysisStart, analysisEnd, createdBy]
        );
        const inserted = caseInsert.rows[0];
        if (!inserted) {
          throw new Error('[createRoiCase] insert into rvn_roi_cases returned no row');
        }
        caseRow = inserted;
        await client.query('RELEASE SAVEPOINT roi_case_create');
      } catch (err: unknown) {
        if ((err as { code?: string }).code === '23505') {
          await client.query('ROLLBACK TO SAVEPOINT roi_case_create');
          const retryResult = await client.query<{ case_id: string }>(
            `SELECT case_id FROM rvn_roi_cases
              WHERE organization_id = $1 AND initiative_id = $2 AND status NOT IN ('cancelled','closed')`,
            [organizationId, initiativeId]
          );
          const winner = retryResult.rows[0];
          if (!winner) {
            throw new Error(
              `[createRoiCase] 23505 on ux_rvn_roi_cases_one_active_per_initiative but no winning row found for initiative ${initiativeId}`
            );
          }
          return loadCaseWithBaseline(client, winner.case_id, organizationId);
        }
        throw err;
      }

      const baselineInsert = await client.query<RoiBaselineRow>(
        `INSERT INTO rvn_roi_baselines (case_id, organization_id, created_by)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [caseRow.case_id, organizationId, createdBy]
      );
      const baselineRow = baselineInsert.rows[0];
      if (!baselineRow) {
        throw new Error('[createRoiCase] insert into rvn_roi_baselines returned no row');
      }

      // ROI-E002 §4.1, Decision D5: calculation-policy shell, same
      // transaction, immediately after the baseline shell. rounding_policy
      // takes its DDL default ('half_up_2dp') — no value passed here.
      const calculationPolicyInsert = await client.query<RoiCalculationPolicyRow>(
        `INSERT INTO rvn_roi_calculation_policy (case_id, organization_id, created_by)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [caseRow.case_id, organizationId, createdBy]
      );
      const calculationPolicyRow = calculationPolicyInsert.rows[0];
      if (!calculationPolicyRow) {
        throw new Error('[createRoiCase] insert into rvn_roi_calculation_policy returned no row');
      }

      await client.query(
        `INSERT INTO rvn_platform_resource_visibility
           (resource_type, resource_id, organization_id, visibility_mode, policy_id, scope_type, scope_id, owner_user_id, sensitivity)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          ROI_RESOURCE_TYPE,
          caseRow.case_id,
          organizationId,
          policyDetails.visibility_mode,
          policy.policyId,
          policyDetails.default_scope_type,
          null,
          ownerUserId,
          null,
        ]
      );

      // Decision D3: creator gets a 'contribute' ACL row; if ownerUserId
      // differs from createdBy, ownerUserId gets a second one. No automatic
      // grant to anyone else.
      //
      // -- DEVIATION FROM AN EARLIER DRAFT OF THIS FILE (real Postgres bug,
      // caught by roiVisibilityJoin.realdb.test.ts): `rvn_platform_resource_acl`
      // (server/migrations/20260809_rvn_platform_visibility_core.sql) has NO
      // `organization_id` column — its PRIMARY KEY is
      // `(resource_type, resource_id, grantee_type, grantee_id)`. An earlier
      // version of this INSERT included `organization_id` (matching every
      // OTHER table in this file, which all carry one) and failed with
      // Postgres 42703 "column organization_id does not exist" the instant a
      // real Postgres ran it — this file's design doc §4.1 snippet already
      // omits it (`resource_type/resource_id/grantee_type/grantee_id/
      // access_level/granted_by` only); the fix here is to match both the
      // design doc's literal column list AND the real table, not to ALTER
      // the platform table to add a column no other caller needs.
      await client.query(
        `INSERT INTO rvn_platform_resource_acl
           (resource_type, resource_id, grantee_type, grantee_id, access_level, granted_by)
         VALUES ($1, $2, 'user', $3, 'contribute', $3)`,
        [ROI_RESOURCE_TYPE, caseRow.case_id, createdBy]
      );
      if (ownerUserId !== createdBy) {
        await client.query(
          `INSERT INTO rvn_platform_resource_acl
             (resource_type, resource_id, grantee_type, grantee_id, access_level, granted_by)
           VALUES ($1, $2, 'user', $3, 'contribute', $4)`,
          [ROI_RESOURCE_TYPE, caseRow.case_id, ownerUserId, createdBy]
        );
      }

      // Design §4.1 point 2: start_roi_study obligation, same transaction.
      await createObligation(client, {
        organizationId,
        assigneeUserId: ownerUserId,
        referenceType: ROI_RESOURCE_TYPE,
        referenceId: caseRow.case_id,
        aggregateVersionAtCreation: 1,
        obligationType: START_ROI_STUDY_OBLIGATION_TYPE,
        deduplicationKey: `${organizationId}:roi_case:${caseRow.case_id}:${START_ROI_STUDY_OBLIGATION_TYPE}`,
      });

      return {
        case: toRoiCase(caseRow),
        baseline: toRoiBaseline(baselineRow),
        calculationPolicy: toRoiCalculationPolicy(calculationPolicyRow),
        created: true,
      };
    },
    buildEvent: ({ result }) => {
      // ROI-E002 §4.1: afterState gains a `calculationPolicy` key.
      const afterState: Record<string, unknown> = {
        case: result.case,
        baseline: result.baseline,
        calculationPolicy: result.calculationPolicy,
      };
      return {
        schemaVersion: 1,
        eventType: 'roi.case_created',
        aggregateType: 'roi_case',
        aggregateId: result.case.caseId,
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
        source: ROI_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion: null,
        resultingVersion: result.case.rowVersion,
        payload: { caseId: result.case.caseId, baselineId: result.baseline.baselineId, created: result.created },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// updateRoiCaseDetails
// ==========================================

// ROI-E002 §4: exported so roiAssumptionCommands.ts/roiCostLineCommands.ts/
// roiBenefitLineCommands.ts/roiBenefitEvidenceLinkCommands.ts/
// roiScenarioCommands.ts can guard on the same "case is pre-approval,
// author-editable only" set rather than re-declaring it.
export const NON_EDITABLE_STATUSES: readonly RoiCaseStatus[] = [
  // ROI-E003 Decision D3: a case is locked the instant it is submitted for
  // approval — 'ready_for_review' itself stays OUT of this list (AC-01's
  // whole point is that reaching ready_for_review does NOT itself freeze
  // editability; only submitting does).
  'submitted_for_approval',
  'approved',
  'rejected',
  'tracking',
  'benefits_realization',
  'post_investment_review_due',
  'post_investment_review',
  'closed',
  'cancelled',
];

// ROI-E004 §4 (design doc), Decision D3: forecast/actual/variance writes
// require the case to be in one of these statuses specifically — not merely
// 'approved' (the frozen-but-not-yet-tracking state). Additive export, same
// placement pattern as NON_EDITABLE_STATUSES above.
export const ROI_TRACKING_ACTIVE_STATUSES: readonly RoiCaseStatus[] = [
  'tracking',
  'benefits_realization',
  'post_investment_review_due',
  'post_investment_review',
];

export interface UpdateRoiCaseDetailsInput {
  caseId: string;
  organizationId: string;
  expectedVersion: number;
  title?: string;
  ownerUserId?: string;
  currency?: string;
  granularity?: RoiCaseGranularity;
  analysisStart?: string | null;
  analysisEnd?: string | null;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

/**
 * Design §4.2: row_version-CAS update of title/ownerUserId/currency/
 * granularity/analysisStart/analysisEnd. Guard: these fields are
 * pre-approval, author-editable only — blocked once the case has reached
 * any post-approval-adjacent status.
 */
export async function updateRoiCaseDetails(
  input: UpdateRoiCaseDetailsInput
): Promise<AtomicCommandOutcome<RoiCase>> {
  const {
    caseId,
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

  return executeAtomicCommand<RoiCaseRow, RoiCase>({
    organizationId,
    aggregateId: caseId,
    expectedVersion,
    loadForUpdate: loadRoiCaseForUpdate,
    getCurrentVersion: caseRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (NON_EDITABLE_STATUSES.includes(currentRow.status)) {
        throw new RoiCaseValidationError(
          `ROI case ${caseId} is "${currentRow.status}" — details may not be edited from this status`,
          'NOT_EDITABLE',
          { caseId, status: currentRow.status }
        );
      }

      beforeState = { case: toRoiCase(currentRow) };

      const merged = {
        title: edits.title ?? currentRow.title,
        owner_user_id: edits.ownerUserId ?? currentRow.owner_user_id,
        currency: edits.currency ?? currentRow.currency,
        granularity: edits.granularity ?? currentRow.granularity,
        analysis_start: edits.analysisStart !== undefined ? edits.analysisStart : currentRow.analysis_start,
        analysis_end: edits.analysisEnd !== undefined ? edits.analysisEnd : currentRow.analysis_end,
      };

      const updateResult = await client.query<RoiCaseRow>(
        `UPDATE rvn_roi_cases
            SET title = $1, owner_user_id = $2, currency = $3, granularity = $4,
                analysis_start = $5, analysis_end = $6,
                row_version = $7, updated_by = $8, updated_at = now()
          WHERE case_id = $9
          RETURNING *`,
        [
          merged.title,
          merged.owner_user_id,
          merged.currency,
          merged.granularity,
          merged.analysis_start,
          merged.analysis_end,
          nextVersion,
          actorUserId,
          caseId,
        ]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) {
        throw new Error(`[updateRoiCaseDetails] update returned no row for ${caseId}`);
      }
      return toRoiCase(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { case: result };
      return {
        schemaVersion: 1,
        eventType: 'roi.case_details_updated',
        aggregateType: 'roi_case',
        aggregateId: result.caseId,
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
        source: ROI_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { caseId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// archiveRoiCase
// ==========================================

export interface ArchiveRoiCaseInput {
  caseId: string;
  organizationId: string;
  expectedVersion: number;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

/**
 * Design §4.2, Decision D4: row_version-CAS setting `archived_at`/
 * `archived_by`. Does NOT touch `status` — archiving is registry
 * housekeeping, orthogonal to lifecycle. No status restriction — a case in
 * ANY status may be archived. Idempotent: calling it again on an
 * already-archived case is a no-op success, not an error.
 */
export async function archiveRoiCase(
  input: ArchiveRoiCaseInput
): Promise<AtomicCommandOutcome<RoiCase>> {
  const {
    caseId,
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

  return executeAtomicCommand<RoiCaseRow, RoiCase>({
    organizationId,
    aggregateId: caseId,
    expectedVersion,
    loadForUpdate: loadRoiCaseForUpdate,
    getCurrentVersion: caseRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      beforeState = { case: toRoiCase(currentRow) };

      if (currentRow.archived_at !== null) {
        // Idempotent no-op — bump row_version anyway so the CAS/event
        // machinery stays consistent (the caller supplied expectedVersion
        // for the CURRENT row, which this branch still honors).
        const noopResult = await client.query<RoiCaseRow>(
          `UPDATE rvn_roi_cases
              SET row_version = $1, updated_by = $2, updated_at = now()
            WHERE case_id = $3
            RETURNING *`,
          [nextVersion, actorUserId, caseId]
        );
        const noopRow = noopResult.rows[0];
        if (!noopRow) {
          throw new Error(`[archiveRoiCase] no-op update returned no row for ${caseId}`);
        }
        return toRoiCase(noopRow);
      }

      const updateResult = await client.query<RoiCaseRow>(
        `UPDATE rvn_roi_cases
            SET archived_at = now(), archived_by = $1, row_version = $2, updated_by = $1, updated_at = now()
          WHERE case_id = $3
          RETURNING *`,
        [actorUserId, nextVersion, caseId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) {
        throw new Error(`[archiveRoiCase] update returned no row for ${caseId}`);
      }
      return toRoiCase(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { case: result };
      return {
        schemaVersion: 1,
        eventType: 'roi.case_archived',
        aggregateType: 'roi_case',
        aggregateId: result.caseId,
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
        source: ROI_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { caseId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// isRoiCaseReadyForReviewEligible (Decision D2)
// ==========================================

export interface RoiCaseReadyForReviewCheck {
  eligible: boolean;
  reason?: string;
}

/**
 * E001's own check: baseline has at minimum a measured value and a
 * reference period. Exported so ROI-E002 can import and EXTEND this
 * (add its own compute-freshness/required-sections check on top), e.g.:
 *   isRoiCaseReadyForReviewEligible(c, b) && hasSuccessfulFreshCalculationRun(c)
 * — do not replace this function's body when E002 lands; wrap it (design §4.3
 * / Decision D2).
 */
export function isRoiCaseReadyForReviewEligible(
  caseRow: RoiCaseRow,
  baselineRow: RoiBaselineRow
): RoiCaseReadyForReviewCheck {
  if (baselineRow.current_measured_value === null) {
    return { eligible: false, reason: 'baseline_measured_value_missing' };
  }
  if (baselineRow.baseline_period_start === null && baselineRow.baseline_period_end === null) {
    return { eligible: false, reason: 'baseline_period_missing' };
  }
  return { eligible: true };
}

// ==========================================
// startModeling / markReadyForReview — generic guarded transition
// ==========================================

interface RoiCaseLifecycleTransitionSpec {
  eventType: string;
  fromStatuses: readonly RoiCaseStatus[];
  toStatus: RoiCaseStatus;
  /** Optional guard evaluated against the pinned transactional client plus
   * the locked case row AND its baseline row (fetched inside the same
   * transaction) — design §4.3's `markReadyForReview` guard shape. ROI-E002
   * §5 widens this from a synchronous `(caseRow, baselineRow) => check` to
   * an async `(client, caseRow, baselineRow) => Promise<check>` so
   * `isRoiCaseReadyForReviewEligibleWithEconomicModel` (roiEconomicModelReadiness.ts)
   * can run its own `SELECT` against `rvn_roi_calculation_runs` on the SAME
   * client/transaction, rather than being restricted to pure in-memory
   * row checks. Throws `RoiCaseNotReadyForReviewError` on failure. */
  guard?: (client: PoolClient, caseRow: RoiCaseRow, baselineRow: RoiBaselineRow) => Promise<RoiCaseReadyForReviewCheck>;
}

export interface RunRoiCaseLifecycleTransitionInput {
  caseId: string;
  organizationId: string;
  expectedVersion: number;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

/** Same `runKpiLifecycleTransition`-shaped helper as the KPI domain,
 * renamed per design §4.3. Not exported directly — `startModeling`/
 * `markReadyForReview` below are the public surface. */
async function runRoiCaseLifecycleTransition(
  spec: RoiCaseLifecycleTransitionSpec,
  input: RunRoiCaseLifecycleTransitionInput
): Promise<AtomicCommandOutcome<RoiCase>> {
  const {
    caseId,
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

  return executeAtomicCommand<RoiCaseRow, RoiCase>({
    organizationId,
    aggregateId: caseId,
    expectedVersion,
    loadForUpdate: loadRoiCaseForUpdate,
    getCurrentVersion: caseRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (!spec.fromStatuses.includes(currentRow.status)) {
        throw new RoiCaseValidationError(
          `ROI case ${caseId} is "${currentRow.status}" — cannot transition to "${spec.toStatus}" from there`,
          'INVALID_ROI_CASE_STATUS_TRANSITION',
          { caseId, currentStatus: currentRow.status, toStatus: spec.toStatus }
        );
      }

      if (spec.guard) {
        const baselineResult = await client.query<RoiBaselineRow>(
          `SELECT * FROM rvn_roi_baselines WHERE case_id = $1 AND organization_id = $2`,
          [caseId, organizationId]
        );
        const baselineRow = baselineResult.rows[0];
        if (!baselineRow) {
          throw new Error(`[${spec.eventType}] no baseline row found for case ${caseId}`);
        }
        const check = await spec.guard(client, currentRow, baselineRow);
        if (!check.eligible) {
          throw new RoiCaseNotReadyForReviewError(caseId, check.reason ?? 'unspecified');
        }
      }

      beforeState = { case: toRoiCase(currentRow) };

      const updateResult = await client.query<RoiCaseRow>(
        `UPDATE rvn_roi_cases
            SET status = $1, row_version = $2, updated_by = $3, updated_at = now()
          WHERE case_id = $4
          RETURNING *`,
        [spec.toStatus, nextVersion, actorUserId, caseId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) {
        throw new Error(`[${spec.eventType}] update returned no row for ${caseId}`);
      }
      return toRoiCase(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { case: result };
      return {
        schemaVersion: 1,
        eventType: spec.eventType,
        aggregateType: 'roi_case',
        aggregateId: caseId,
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
        source: ROI_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { caseId },
      } satisfies AtomicEventInput;
    },
  });
}

export function startModeling(
  input: RunRoiCaseLifecycleTransitionInput
): Promise<AtomicCommandOutcome<RoiCase>> {
  return runRoiCaseLifecycleTransition(
    {
      eventType: 'roi.case_modeling_started',
      fromStatuses: ['draft'],
      toStatus: 'modeling',
    },
    input
  );
}

export function markReadyForReview(
  input: RunRoiCaseLifecycleTransitionInput
): Promise<AtomicCommandOutcome<RoiCase>> {
  return runRoiCaseLifecycleTransition(
    {
      eventType: 'roi.case_ready_for_review',
      fromStatuses: ['modeling'],
      toStatus: 'ready_for_review',
      // ROI-E002 §5: wraps E001's own isRoiCaseReadyForReviewEligible with
      // the economic-model guard (successful+fresh calculation run, no
      // unresolved double-counting) — imported from the new file, not
      // implemented inline, to avoid a circular import (design §5).
      guard: (client, caseRow, baselineRow) =>
        isRoiCaseReadyForReviewEligibleWithEconomicModel(client, caseRow, baselineRow),
    },
    input
  );
}

// ==========================================
// reopenRejectedRoiCase (ROI-E003 §4.7, Decision D8)
// ==========================================

/**
 * `'rejected' -> 'modeling'`. Rejection audit columns (`rejected_by`/
 * `rejected_at`/`rejection_reason`) are left UNTOUCHED — the rejection stays
 * in the case's history, this is a separate, explicitly-auditable revival
 * act (Decision D8), not an undo. No guard — reopening a rejected case for
 * another modeling pass has no readiness precondition of its own.
 */
export function reopenRejectedRoiCase(
  input: RunRoiCaseLifecycleTransitionInput
): Promise<AtomicCommandOutcome<RoiCase>> {
  return runRoiCaseLifecycleTransition(
    { eventType: 'roi.case_reopened_from_rejected', fromStatuses: ['rejected'], toStatus: 'modeling' },
    input
  );
}
