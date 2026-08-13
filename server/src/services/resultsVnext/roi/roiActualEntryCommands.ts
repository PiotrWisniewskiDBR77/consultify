/**
 * ROI-E004 — Actual entry commands (AC-02: append-only with correction-
 * reference; AC-03: Actual Verifier role/state; AC-06: disputed evidence
 * never overwrites Actual).
 *
 * Design: docs/product/results-vnext/ROI_E004_DESIGN.md §4, Decision D10.
 *
 * Mirrors `kpiMeasurementCommands.ts`'s `recordMeasurement`/
 * `correctMeasurement`/`verifyMeasurement`/`disputeMeasurement` exactly: all
 * four commands go through `executeAtomicCreate` (never CAS — the table's
 * own `REVOKE UPDATE, DELETE` plus the partial unique index on ORIGINAL
 * (non-correction) rows already provide the concurrency guarantee needed,
 * same rationale KPI's decyzja #12 gives), and `correctActualEntry`/
 * `verifyActualEntry`/`disputeActualEntry` are thin wrappers over one shared
 * `insertSupersedingActualEntry` helper — each one INSERTs a NEW row
 * referencing the prior one via `correction_of_actual_entry_id`, never an
 * UPDATE of the original (impossible in intent AND in practice given the
 * REVOKE).
 *
 * ==========================================================================
 * DECISION D10 — the self-verification walk-back (this epic's one genuinely
 * novel piece of business logic beyond mirroring KPI precedent)
 * ==========================================================================
 * `verifyActualEntry` must deny verification when the verifier is the
 * entry's ORIGINAL recorder — and this check must walk BACK through any
 * correction chain to find the original recorder, not just check the
 * immediately-prior row's `recorded_by`. Scenario this must handle: recorder
 * A creates an entry, someone else (B) corrects it, then A attempts to
 * verify B's correction — this must still be denied, because A is still the
 * chain's original recorder. `resolveOriginalActualEntryRecorder` below
 * walks `correction_of_actual_entry_id` back (a recursive CTE, not an
 * application-level loop — the whole chain lives in one table, so one
 * recursive query resolves it in one round trip) to the row where it is
 * `NULL`, and returns THAT row's `recorded_by`.
 *
 * KPI's own `verifyMeasurement` has NO such check (design draft's own
 * recommendation, matching precedent) — D10 is an explicit, deliberate
 * OVERRIDE of that recommendation: AC-03 names an "Actual Verifier ROLE"
 * (language implying separation of duties, unlike KPI's measurement
 * verification which never used "role" language), and ROI's financial
 * stakes are higher than KPI's.
 */
import { randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

import { toNullableNumber } from '../kpi/kpiTypes.js';
import { computeStateHash } from '../kpi/kpiDefinitionCommands.js';
import { executeAtomicCreate, type AtomicCommandOutcome, type AtomicEventInput } from '../platform/atomicWrite.js';
import {
  assertCommandCapability,
  type CommandAccessContext,
} from '../platform/commandCapabilityGuard.js';

import { ROI_EVENT_SOURCE, ROI_TRACKING_ACTIVE_STATUSES } from './roiCaseCommands.js';
import {
  toRoiActualEntry,
  type RoiActualEntry,
  type RoiActualEntryDataQualityStatus,
  type RoiActualEntryRow,
  type RoiActualEntryType,
} from './roiForecastActualTypes.js';
import type { RoiCaseRow } from './roiTypes.js';

// ==========================================
// ERRORS
// ==========================================

export class RoiActualEntryValidationError extends Error {
  code: string;
  details?: Record<string, unknown>;
  constructor(message: string, code = 'INVALID_ACTUAL_ENTRY_REQUEST', details?: Record<string, unknown>) {
    super(message);
    this.name = 'RoiActualEntryValidationError';
    this.code = code;
    this.details = details;
  }
}

/** Mirrors `KpiMeasurementNotFoundError`'s role — a typed, pre-write error
 * for a correct/verify/dispute command referencing an `actual_entry_id` that
 * does not exist (or belongs to a different organization), instead of a raw
 * Postgres FK-violation surfacing to the caller. */
export class RoiActualEntryNotFoundError extends Error {
  code = 'ACTUAL_ENTRY_NOT_FOUND';
  details: Record<string, unknown>;
  constructor(actualEntryId: string, organizationId: string) {
    super(`Actual entry ${actualEntryId} not found in organization ${organizationId}`);
    this.name = 'RoiActualEntryNotFoundError';
    this.details = { actualEntryId, organizationId };
  }
}

/** Decision D10: 403, thrown by `verifyActualEntry` when the verifier is the
 * chain's ORIGINAL recorder — resolved by walking `correction_of_actual_entry_id`
 * back to the root row, not just checking the immediately-prior row. */
export class RoiActualSelfVerificationDeniedError extends Error {
  code = 'SELF_VERIFICATION_DENIED';
  details: Record<string, unknown>;
  constructor(actualEntryId: string, verifierId: string, originalRecorderId: string) {
    super(
      `User ${verifierId} may not verify actual entry ${actualEntryId}: they are the chain's original recorder (${originalRecorderId})`
    );
    this.name = 'RoiActualSelfVerificationDeniedError';
    this.details = { actualEntryId, verifierId, originalRecorderId };
  }
}

// RN-G5 — command capability names (docs/product/results-vnext/RN_G5_AUTHZ_DESIGN.md).
// Scope note: same decision as kpiMeasurementCommands.ts — recordActualEntry
// (new-fact ingestion) is left UNGATED, matching recordMeasurement's
// documented rationale (high-frequency data-entry path, does not let an
// actor touch anyone else's EXISTING work). correct/verify/dispute ARE
// gated — they operate on an EXISTING entry, which is exactly the named
// vulnerability's shape.
export const ROI_ACTUAL_ENTRY_CAPABILITIES = {
  correct: 'results.roi.actual_entry.correct',
  verify: 'results.roi.actual_entry.verify',
  dispute: 'results.roi.actual_entry.dispute',
} as const;

/** RN-G5: the case's owner_user_id, real value only — no fallback to the
 * acting user (same discipline as kpiMeasurementCommands.ts's
 * loadKpiOwnerUserId vs. resolveDeviationCaseOwner distinction). */
async function loadRoiCaseOwnerUserId(
  client: PoolClient,
  caseId: string,
  organizationId: string
): Promise<string | null> {
  const result = await client.query<{ owner_user_id: string | null }>(
    `SELECT owner_user_id FROM rvn_roi_cases WHERE case_id = $1 AND organization_id = $2`,
    [caseId, organizationId]
  );
  return result.rows[0]?.owner_user_id ?? null;
}

// ==========================================
// SHARED CASE-STATUS GUARD
// ==========================================

/** Decision D3: forecast/actual/variance writes require
 * ROI_TRACKING_ACTIVE_STATUSES specifically. Plain SELECT, no lock needed —
 * same convention `recordMeasurement` uses for its own KPI-status read
 * (append-only writes do not need to serialize against the parent). */
async function requireCaseTrackable(client: PoolClient, caseId: string, organizationId: string): Promise<RoiCaseRow> {
  const result = await client.query<RoiCaseRow>(
    `SELECT * FROM rvn_roi_cases WHERE case_id = $1 AND organization_id = $2`,
    [caseId, organizationId]
  );
  const row = result.rows[0];
  if (!row) {
    throw new RoiActualEntryValidationError(`ROI case ${caseId} not found`, 'CASE_NOT_FOUND', { caseId });
  }
  if (!ROI_TRACKING_ACTIVE_STATUSES.includes(row.status)) {
    throw new RoiActualEntryValidationError(
      `ROI case ${caseId} is "${row.status}" — an actual entry may only be recorded while the case is tracking`,
      'CASE_NOT_TRACKABLE',
      { caseId, status: row.status }
    );
  }
  return row;
}

// ==========================================
// recordActualEntry
// ==========================================

export interface RecordActualEntryInput {
  caseId: string;
  organizationId: string;
  entryType: RoiActualEntryType;
  costLineId?: string | null;
  benefitLineId?: string | null;
  periodStart: string;
  periodEnd: string;
  amount?: number | null;
  currency?: string | null;
  source: string;
  evidenceRefs?: unknown[];
  notes?: string | null;
  recordedBy: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

export async function recordActualEntry(input: RecordActualEntryInput): Promise<AtomicCommandOutcome<RoiActualEntry>> {
  const {
    caseId,
    organizationId,
    entryType,
    costLineId = null,
    benefitLineId = null,
    periodStart,
    periodEnd,
    amount = null,
    currency = null,
    source,
    evidenceRefs = [],
    notes = null,
    recordedBy,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
  } = input;

  return executeAtomicCreate<RoiActualEntry>({
    organizationId,
    applyMutation: async (client) => {
      await requireCaseTrackable(client, caseId, organizationId);

      if (entryType === 'cost') {
        if (!costLineId || benefitLineId) {
          throw new RoiActualEntryValidationError(
            `entry_type "cost" requires costLineId and forbids benefitLineId`,
            'INVALID_LINE_REFERENCE',
            { entryType, costLineId, benefitLineId }
          );
        }
        const costLineResult = await client.query<{ cost_line_id: string }>(
          `SELECT cost_line_id FROM rvn_roi_cost_lines WHERE cost_line_id = $1 AND case_id = $2 AND organization_id = $3`,
          [costLineId, caseId, organizationId]
        );
        if (!costLineResult.rows[0]) {
          throw new RoiActualEntryValidationError(
            `Cost line ${costLineId} does not belong to case ${caseId}`,
            'COST_LINE_NOT_FOUND',
            { caseId, costLineId }
          );
        }
      } else if (entryType === 'benefit') {
        if (!benefitLineId || costLineId) {
          throw new RoiActualEntryValidationError(
            `entry_type "benefit" requires benefitLineId and forbids costLineId`,
            'INVALID_LINE_REFERENCE',
            { entryType, costLineId, benefitLineId }
          );
        }
        const benefitLineResult = await client.query<{ benefit_line_id: string }>(
          `SELECT benefit_line_id FROM rvn_roi_benefit_lines WHERE benefit_line_id = $1 AND case_id = $2 AND organization_id = $3`,
          [benefitLineId, caseId, organizationId]
        );
        if (!benefitLineResult.rows[0]) {
          throw new RoiActualEntryValidationError(
            `Benefit line ${benefitLineId} does not belong to case ${caseId}`,
            'BENEFIT_LINE_NOT_FOUND',
            { caseId, benefitLineId }
          );
        }
      } else {
        // 'observation'
        if (costLineId || benefitLineId) {
          throw new RoiActualEntryValidationError(
            `entry_type "observation" forbids both costLineId and benefitLineId`,
            'INVALID_LINE_REFERENCE',
            { entryType, costLineId, benefitLineId }
          );
        }
      }

      if (amount !== null && !currency) {
        throw new RoiActualEntryValidationError(`currency is required when amount is provided`, 'CURRENCY_REQUIRED', {
          amount,
        });
      }

      const insertResult = await client.query<RoiActualEntryRow>(
        `INSERT INTO rvn_roi_actual_entries (
           case_id, organization_id, entry_type, cost_line_id, benefit_line_id,
           period_start, period_end, amount, currency, data_quality_status,
           source, evidence_refs, notes, recorded_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'unverified',$10,$11,$12,$13)
         RETURNING *`,
        [
          caseId,
          organizationId,
          entryType,
          costLineId,
          benefitLineId,
          periodStart,
          periodEnd,
          amount,
          currency,
          source,
          JSON.stringify(evidenceRefs),
          notes,
          recordedBy,
        ]
      );
      const row = insertResult.rows[0];
      if (!row) {
        throw new Error('[recordActualEntry] insert returned no row');
      }
      return toRoiActualEntry(row);
    },
    buildEvent: ({ result }) => {
      const afterState = { actualEntry: result };
      return {
        schemaVersion: 1,
        eventType: 'roi.actual_recorded',
        aggregateType: 'roi_case',
        aggregateId: caseId,
        organizationId,
        actorUserId: recordedBy,
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
        evidenceRefs,
        source: ROI_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion: null,
        resultingVersion: 1,
        payload: { caseId, actualEntryId: result.actualEntryId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// Shared "supersede" INSERT (correct / verify / dispute)
// ==========================================

interface InsertSupersedingActualEntryParams {
  originalActualEntryId: string;
  organizationId: string;
  /** `undefined` = inherit the original row's own value (verify/dispute's
   * case — neither changes the recorded value, AC-06). `correctActualEntry`
   * always overrides both. */
  amountOverride?: number | null;
  currencyOverride?: string | null;
  /** Omit to keep the original row's own `data_quality_status`
   * (`correctActualEntry`'s case — a value correction does not, by itself,
   * change data-quality workflow state, matching KPI's `correctMeasurement`
   * precedent exactly). `verifyActualEntry`/`disputeActualEntry` always pass
   * an explicit target status. */
  dataQualityStatus?: RoiActualEntryDataQualityStatus;
  /** `undefined` = inherit the original row's own `verified_by`/`verified_at`
   * (correct's case, alongside its inherited `dataQualityStatus`).
   * `verifyActualEntry` overrides both to the new verifier/timestamp;
   * `disputeActualEntry` overrides both to `null` — a disputed row is, by
   * definition, not a verified one, even if the entry it disputes had been
   * verified earlier in its chain. */
  verifiedByOverride?: string | null;
  verifiedAtOverride?: string | null;
  correctionReason: string | null;
  recordedBy: string;
  capability: string;
  access: CommandAccessContext;
}

interface SupersedingActualEntryResult {
  original: RoiActualEntry;
  superseding: RoiActualEntry;
}

async function insertSupersedingActualEntry(
  client: PoolClient,
  params: InsertSupersedingActualEntryParams
): Promise<SupersedingActualEntryResult> {
  const {
    originalActualEntryId,
    organizationId,
    amountOverride,
    currencyOverride,
    dataQualityStatus,
    verifiedByOverride,
    verifiedAtOverride,
    correctionReason,
    recordedBy,
    capability,
    access,
  } = params;

  const originalResult = await client.query<RoiActualEntryRow>(
    `SELECT * FROM rvn_roi_actual_entries WHERE actual_entry_id = $1 AND organization_id = $2`,
    [originalActualEntryId, organizationId]
  );
  const originalRow = originalResult.rows[0];
  if (!originalRow) {
    throw new RoiActualEntryNotFoundError(originalActualEntryId, organizationId);
  }

  const caseOwnerUserId = await loadRoiCaseOwnerUserId(client, originalRow.case_id, organizationId);
  assertCommandCapability({
    access,
    actorUserId: recordedBy,
    capability,
    responsibleUserIds: [caseOwnerUserId],
  });

  const amount = amountOverride !== undefined ? amountOverride : toNullableNumber(originalRow.amount);
  const currency = currencyOverride !== undefined ? currencyOverride : originalRow.currency;
  const resolvedDataQualityStatus = dataQualityStatus ?? originalRow.data_quality_status;
  const verifiedBy = verifiedByOverride !== undefined ? verifiedByOverride : originalRow.verified_by;
  const verifiedAt = verifiedAtOverride !== undefined ? verifiedAtOverride : originalRow.verified_at;

  if (amount !== null && !currency) {
    throw new RoiActualEntryValidationError(`currency is required when amount is provided`, 'CURRENCY_REQUIRED', {
      amount,
    });
  }

  const insertResult = await client.query<RoiActualEntryRow>(
    `INSERT INTO rvn_roi_actual_entries (
       case_id, organization_id, entry_type, cost_line_id, benefit_line_id,
       period_start, period_end, amount, currency, data_quality_status,
       correction_of_actual_entry_id, correction_reason, source, evidence_refs, notes,
       recorded_by, verified_by, verified_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     RETURNING *`,
    [
      originalRow.case_id,
      organizationId,
      originalRow.entry_type,
      originalRow.cost_line_id,
      originalRow.benefit_line_id,
      originalRow.period_start,
      originalRow.period_end,
      amount,
      currency,
      resolvedDataQualityStatus,
      originalActualEntryId,
      correctionReason,
      originalRow.source,
      JSON.stringify(originalRow.evidence_refs ?? []),
      originalRow.notes,
      recordedBy,
      verifiedBy,
      verifiedAt,
    ]
  );
  const supersedingRow = insertResult.rows[0];
  if (!supersedingRow) {
    throw new Error('[insertSupersedingActualEntry] insert returned no row');
  }

  return {
    original: toRoiActualEntry(originalRow),
    superseding: toRoiActualEntry(supersedingRow),
  };
}

function buildSupersedingEvent(ctx: {
  eventType: string;
  result: SupersedingActualEntryResult;
  organizationId: string;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason: string | null;
}): AtomicEventInput {
  const {
    eventType,
    result,
    organizationId,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason,
  } = ctx;
  const beforeState = { actualEntry: result.original };
  const afterState = { actualEntry: result.superseding };
  return {
    schemaVersion: 1,
    eventType,
    aggregateType: 'roi_case',
    aggregateId: result.superseding.caseId,
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
    source: ROI_EVENT_SOURCE,
    idempotencyKey,
    expectedVersion: null,
    resultingVersion: 1,
    payload: {
      actualEntryId: result.superseding.actualEntryId,
      correctionOfActualEntryId: result.original.actualEntryId,
    },
  };
}

// ==========================================
// correctActualEntry
// ==========================================

export interface CorrectActualEntryInput {
  actualEntryId: string;
  organizationId: string;
  amount: number | null;
  currency?: string | null;
  correctionReason: string;
  recordedBy: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  access: CommandAccessContext;
}

export async function correctActualEntry(
  input: CorrectActualEntryInput
): Promise<AtomicCommandOutcome<SupersedingActualEntryResult>> {
  const {
    actualEntryId,
    organizationId,
    amount,
    currency,
    correctionReason,
    recordedBy,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    access,
  } = input;

  return executeAtomicCreate<SupersedingActualEntryResult>({
    organizationId,
    applyMutation: (client) =>
      insertSupersedingActualEntry(client, {
        originalActualEntryId: actualEntryId,
        organizationId,
        amountOverride: amount,
        currencyOverride: currency,
        // dataQualityStatus/verifiedBy/verifiedAt omitted on purpose — a
        // correction does not, by itself, change data-quality workflow
        // state (matches KPI's correctMeasurement exactly).
        correctionReason,
        recordedBy,
        capability: ROI_ACTUAL_ENTRY_CAPABILITIES.correct,
        access,
      }),
    buildEvent: ({ result }) =>
      buildSupersedingEvent({
        eventType: 'roi.actual_corrected',
        result,
        organizationId,
        actorUserId: recordedBy,
        actorEffectiveRole,
        idempotencyKey,
        correlationId,
        causationId,
        reason: correctionReason,
      }),
  });
}

// ==========================================
// verifyActualEntry (AC-03, Decision D10)
// ==========================================

/**
 * Walks `correction_of_actual_entry_id` back (recursive CTE, one round
 * trip) from `actualEntryId` to the row where it is `NULL` — the chain's
 * ORIGINAL recorder — and returns that root row's `recorded_by`. Throws
 * `RoiActualEntryNotFoundError` if `actualEntryId` does not exist (mirrors
 * `insertSupersedingActualEntry`'s own not-found handling).
 */
async function resolveOriginalActualEntryRecorder(
  client: PoolClient,
  organizationId: string,
  actualEntryId: string
): Promise<string> {
  const result = await client.query<{ recorded_by: string }>(
    `WITH RECURSIVE chain AS (
       SELECT actual_entry_id, correction_of_actual_entry_id, recorded_by
         FROM rvn_roi_actual_entries
        WHERE actual_entry_id = $1 AND organization_id = $2
       UNION ALL
       SELECT e.actual_entry_id, e.correction_of_actual_entry_id, e.recorded_by
         FROM rvn_roi_actual_entries e
         INNER JOIN chain c ON e.actual_entry_id = c.correction_of_actual_entry_id
        WHERE e.organization_id = $2
     )
     SELECT recorded_by FROM chain WHERE correction_of_actual_entry_id IS NULL LIMIT 1`,
    [actualEntryId, organizationId]
  );
  const row = result.rows[0];
  if (!row) {
    throw new RoiActualEntryNotFoundError(actualEntryId, organizationId);
  }
  return row.recorded_by;
}

export interface VerifyActualEntryInput {
  actualEntryId: string;
  organizationId: string;
  verifierId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  notes?: string | null;
  access: CommandAccessContext;
}

export async function verifyActualEntry(
  input: VerifyActualEntryInput
): Promise<AtomicCommandOutcome<SupersedingActualEntryResult>> {
  const {
    actualEntryId,
    organizationId,
    verifierId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    notes = null,
    access,
  } = input;

  return executeAtomicCreate<SupersedingActualEntryResult>({
    organizationId,
    applyMutation: async (client) => {
      // RN-G5: coarse authorization FIRST — before D10's self-verification
      // walk-back, same "coarse gate before finer business rule" ordering
      // every other guarded command in this program uses.
      const entryCaseResult = await client.query<{ case_id: string }>(
        `SELECT case_id FROM rvn_roi_actual_entries WHERE actual_entry_id = $1 AND organization_id = $2`,
        [actualEntryId, organizationId]
      );
      const entryCaseId = entryCaseResult.rows[0]?.case_id;
      if (!entryCaseId) {
        throw new RoiActualEntryNotFoundError(actualEntryId, organizationId);
      }
      const caseOwnerUserId = await loadRoiCaseOwnerUserId(client, entryCaseId, organizationId);
      assertCommandCapability({
        access,
        actorUserId: verifierId,
        capability: ROI_ACTUAL_ENTRY_CAPABILITIES.verify,
        responsibleUserIds: [caseOwnerUserId],
      });

      // Decision D10, checked SECOND, still before any write — walks the
      // FULL correction chain back to the original recorder, not just the
      // immediately-prior row.
      const originalRecorderId = await resolveOriginalActualEntryRecorder(client, organizationId, actualEntryId);
      if (originalRecorderId === verifierId) {
        throw new RoiActualSelfVerificationDeniedError(actualEntryId, verifierId, originalRecorderId);
      }

      return insertSupersedingActualEntry(client, {
        originalActualEntryId: actualEntryId,
        organizationId,
        dataQualityStatus: 'verified',
        verifiedByOverride: verifierId,
        verifiedAtOverride: new Date().toISOString(),
        correctionReason: notes,
        recordedBy: verifierId,
        capability: ROI_ACTUAL_ENTRY_CAPABILITIES.verify,
        access,
      });
    },
    buildEvent: ({ result }) =>
      buildSupersedingEvent({
        eventType: 'roi.actual_verified',
        result,
        organizationId,
        actorUserId: verifierId,
        actorEffectiveRole,
        idempotencyKey,
        correlationId,
        causationId,
        reason: notes,
      }),
  });
}

// ==========================================
// disputeActualEntry (AC-06)
// ==========================================

export interface DisputeActualEntryInput {
  actualEntryId: string;
  organizationId: string;
  disputedBy: string;
  disputeReason: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  access: CommandAccessContext;
}

/**
 * No self-check (only verification carries the D10 restriction — disputing
 * your own entry is flagging a problem, not attesting it's correct, so no
 * conflict of interest exists there). Value/fields otherwise UNCHANGED from
 * the original (AC-06 — a dispute never silently changes the recorded
 * value; a separate `correctActualEntry` call is needed for that).
 */
export async function disputeActualEntry(
  input: DisputeActualEntryInput
): Promise<AtomicCommandOutcome<SupersedingActualEntryResult>> {
  const {
    actualEntryId,
    organizationId,
    disputedBy,
    disputeReason,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    access,
  } = input;

  return executeAtomicCreate<SupersedingActualEntryResult>({
    organizationId,
    applyMutation: (client) =>
      insertSupersedingActualEntry(client, {
        originalActualEntryId: actualEntryId,
        organizationId,
        // amountOverride/currencyOverride omitted — AC-06: dispute never
        // changes the recorded value.
        dataQualityStatus: 'disputed',
        // A disputed row is, by definition, not verified — reset regardless
        // of what the entry being disputed carried.
        verifiedByOverride: null,
        verifiedAtOverride: null,
        correctionReason: disputeReason,
        recordedBy: disputedBy,
        capability: ROI_ACTUAL_ENTRY_CAPABILITIES.dispute,
        access,
      }),
    buildEvent: ({ result }) =>
      buildSupersedingEvent({
        eventType: 'roi.actual_disputed',
        result,
        organizationId,
        actorUserId: disputedBy,
        actorEffectiveRole,
        idempotencyKey,
        correlationId,
        causationId,
        reason: disputeReason,
      }),
  });
}
