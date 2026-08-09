/**
 * KPI-E001/E002 — measurement-side commands.
 *
 * Design: docs/product/results-vnext/KPI_E001_E002_DESIGN.md decyzja #12.
 * Schema: server/migrations/20260810_rvn_kpi_core.sql
 * (`rvn_kpi_measurements` — append-only, REVOKE UPDATE/DELETE).
 *
 * All FOUR commands here (`recordMeasurement`/`correctMeasurement`/
 * `verifyMeasurement`/`disputeMeasurement`) go through `executeAtomicCreate`
 * — decyzja #12, quoted in full: "Standalone — use `executeAtomicCreate`,
 * NOT `executeAtomicCommand` with parent CAS. The
 * `ux_rvn_kpi_measurements_period` unique index ... already provides the
 * concurrency guarantee needed ... Routing every measurement write through
 * the parent's `row_version` CAS would serialize all measurement writes for
 * a KPI — unnecessary contention for what may be a high-frequency write
 * path (imports, connectors)." This is why NONE of these four commands
 * takes an `expectedVersion`/CAS parameter the way `kpiDefinitionCommands.ts`
 * does — each one is a plain INSERT of a new, immutable row.
 *
 * `correctMeasurement`/`verifyMeasurement`/`disputeMeasurement` are all
 * "insert a new row referencing the prior one" (`correction_of_measurement_id`),
 * NEVER an UPDATE of the original — the table's own `REVOKE UPDATE, DELETE`
 * makes an UPDATE-based implementation impossible even for the owner
 * connection in intent, and impossible for any non-owner role in practice.
 * `data_quality_status` is what verify/dispute actually change (append-only,
 * see file header of the migration); `correctMeasurement` is for
 * `actual_value` corrections. The three "supersede" commands are
 * consequently structurally similar (same shape, different fixed
 * `data_quality_status` target and required fields) — implemented as thin
 * wrappers over one shared `insertSupersedingMeasurement` helper below to
 * avoid restating the same INSERT four times.
 */
import { randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

import {
  executeAtomicCreate,
  type AtomicCommandOutcome,
  type AtomicEventInput,
} from '../platform/atomicWrite.js';

import { computeStateHash, KPI_EVENT_SOURCE } from './kpiDefinitionCommands.js';
import { toKpiMeasurement, type KpiMeasurement, type KpiMeasurementRow } from './kpiTypes.js';

// ==========================================
// ERRORS
// ==========================================

/** Thrown when a correct/verify/dispute command references a
 * `measurement_id` that does not exist (or belongs to a different
 * organization) — the FK on `correction_of_measurement_id` would catch this
 * at INSERT time regardless, but this gives a typed, pre-write error
 * instead of a raw Postgres FK-violation surfacing to the caller. */
export class KpiMeasurementNotFoundError extends Error {
  code = 'MEASUREMENT_NOT_FOUND';
  details: Record<string, unknown>;
  constructor(measurementId: string, organizationId: string) {
    super(`Measurement ${measurementId} not found in organization ${organizationId}`);
    this.name = 'KpiMeasurementNotFoundError';
    this.details = { measurementId, organizationId };
  }
}

// ==========================================
// recordMeasurement
// ==========================================

export interface RecordMeasurementInput {
  kpiId: string;
  definitionVersionId: string;
  organizationId: string;
  periodStart: string;
  periodEnd: string;
  actualValue: number | null;
  /** `evaluatePerformanceStatus()` output (targetGeometryEvaluator.ts) —
   * this command does not evaluate it itself (it has no target-geometry
   * bounds in scope; the caller already has the definition version loaded
   * to pick `definitionVersionId` and can evaluate before calling). */
  performanceStatus: KpiMeasurementRow['performance_status'];
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

export async function recordMeasurement(
  input: RecordMeasurementInput
): Promise<AtomicCommandOutcome<KpiMeasurement>> {
  const {
    kpiId,
    definitionVersionId,
    organizationId,
    periodStart,
    periodEnd,
    actualValue,
    performanceStatus,
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

  return executeAtomicCreate<KpiMeasurement>({
    organizationId,
    applyMutation: async (client) => {
      const insertResult = await client.query<KpiMeasurementRow>(
        `INSERT INTO rvn_kpi_measurements
           (kpi_id, definition_version_id, organization_id, period_start, period_end,
            actual_value, performance_status, data_quality_status, source, evidence_refs, notes, recorded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'unverified', $8, $9, $10, $11)
         RETURNING *`,
        [
          kpiId,
          definitionVersionId,
          organizationId,
          periodStart,
          periodEnd,
          actualValue,
          performanceStatus,
          source,
          JSON.stringify(evidenceRefs),
          notes,
          recordedBy,
        ]
      );
      const row = insertResult.rows[0];
      if (!row) {
        throw new Error('[recordMeasurement] insert returned no row');
      }
      return toKpiMeasurement(row);
    },
    buildEvent: ({ result }) => {
      const afterState = { measurement: result };
      return {
        schemaVersion: 1,
        eventType: 'kpi.measurement_recorded',
        aggregateType: 'kpi',
        aggregateId: kpiId,
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
        source: KPI_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion: null,
        resultingVersion: 1,
        payload: { measurementId: result.measurementId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// Shared "supersede" INSERT (correct / verify / dispute)
// ==========================================

interface InsertSupersedingMeasurementParams {
  originalMeasurementId: string;
  organizationId: string;
  /** `actual_value`/`performance_status` default to the original row's own
   * values (verify/dispute do not change the measured fact, only its data
   * quality) — `correctMeasurement` overrides both. */
  actualValueOverride?: number | null;
  performanceStatusOverride?: KpiMeasurementRow['performance_status'];
  /** Omit to keep the original row's `data_quality_status` unchanged
   * (`correctMeasurement`'s case — a value correction does not, by itself,
   * change data-quality workflow state). `verifyMeasurement`/
   * `disputeMeasurement` always pass an explicit target status. */
  dataQualityStatus?: KpiMeasurementRow['data_quality_status'];
  correctionReason: string | null;
  recordedBy: string;
}

interface SupersedingMeasurementResult {
  original: KpiMeasurement;
  superseding: KpiMeasurement;
}

async function insertSupersedingMeasurement(
  client: PoolClient,
  params: InsertSupersedingMeasurementParams
): Promise<SupersedingMeasurementResult> {
  const {
    originalMeasurementId,
    organizationId,
    actualValueOverride,
    performanceStatusOverride,
    dataQualityStatus,
    correctionReason,
    recordedBy,
  } = params;

  const originalResult = await client.query<KpiMeasurementRow>(
    `SELECT * FROM rvn_kpi_measurements WHERE measurement_id = $1 AND organization_id = $2`,
    [originalMeasurementId, organizationId]
  );
  const originalRow = originalResult.rows[0];
  if (!originalRow) {
    throw new KpiMeasurementNotFoundError(originalMeasurementId, organizationId);
  }

  const actualValue =
    actualValueOverride !== undefined ? actualValueOverride : originalRow.actual_value;
  const performanceStatus = performanceStatusOverride ?? originalRow.performance_status;
  const resolvedDataQualityStatus = dataQualityStatus ?? originalRow.data_quality_status;

  const insertResult = await client.query<KpiMeasurementRow>(
    `INSERT INTO rvn_kpi_measurements
       (kpi_id, definition_version_id, organization_id, period_start, period_end,
        actual_value, performance_status, data_quality_status,
        correction_of_measurement_id, correction_reason, source, evidence_refs, notes, recorded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING *`,
    [
      originalRow.kpi_id,
      originalRow.definition_version_id,
      organizationId,
      originalRow.period_start,
      originalRow.period_end,
      actualValue,
      performanceStatus,
      resolvedDataQualityStatus,
      originalMeasurementId,
      correctionReason,
      originalRow.source,
      JSON.stringify(originalRow.evidence_refs ?? []),
      originalRow.notes,
      recordedBy,
    ]
  );
  const supersedingRow = insertResult.rows[0];
  if (!supersedingRow) {
    throw new Error('[insertSupersedingMeasurement] insert returned no row');
  }

  return {
    original: toKpiMeasurement(originalRow),
    superseding: toKpiMeasurement(supersedingRow),
  };
}

function buildSupersedingEvent(ctx: {
  eventType: string;
  result: SupersedingMeasurementResult;
  organizationId: string;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason: string | null;
  evidenceRefs: unknown[];
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
    evidenceRefs,
  } = ctx;
  const beforeState = { measurement: result.original };
  const afterState = { measurement: result.superseding };
  return {
    schemaVersion: 1,
    eventType,
    aggregateType: 'kpi',
    aggregateId: result.superseding.kpiId,
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
    evidenceRefs,
    source: KPI_EVENT_SOURCE,
    idempotencyKey,
    expectedVersion: null,
    resultingVersion: 1,
    payload: {
      measurementId: result.superseding.measurementId,
      correctionOfMeasurementId: result.original.measurementId,
    },
  };
}

// ==========================================
// correctMeasurement
// ==========================================

export interface CorrectMeasurementInput {
  measurementId: string;
  organizationId: string;
  actualValue: number | null;
  performanceStatus: KpiMeasurementRow['performance_status'];
  correctionReason: string;
  recordedBy: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
}

export async function correctMeasurement(
  input: CorrectMeasurementInput
): Promise<AtomicCommandOutcome<SupersedingMeasurementResult>> {
  const {
    measurementId,
    organizationId,
    actualValue,
    performanceStatus,
    correctionReason,
    recordedBy,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
  } = input;

  return executeAtomicCreate<SupersedingMeasurementResult>({
    organizationId,
    applyMutation: (client) =>
      insertSupersedingMeasurement(client, {
        originalMeasurementId: measurementId,
        organizationId,
        actualValueOverride: actualValue,
        performanceStatusOverride: performanceStatus,
        // dataQualityStatus omitted on purpose — a correction does not, by
        // itself, change data-quality workflow state (correcting a
        // 'verified' measurement's value does not silently re-verify or
        // un-verify it; that is a separate, explicit verify/dispute call).
        // insertSupersedingMeasurement defaults it to the original row's
        // own data_quality_status when omitted.
        correctionReason,
        recordedBy,
      }),
    buildEvent: ({ result }) =>
      buildSupersedingEvent({
        eventType: 'kpi.measurement_corrected',
        result,
        organizationId,
        actorUserId: recordedBy,
        actorEffectiveRole,
        idempotencyKey,
        correlationId,
        causationId,
        reason: correctionReason,
        evidenceRefs: [],
      }),
  });
}

// ==========================================
// verifyMeasurement
// ==========================================

export interface VerifyMeasurementInput {
  measurementId: string;
  organizationId: string;
  verifiedBy: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  notes?: string | null;
}

export async function verifyMeasurement(
  input: VerifyMeasurementInput
): Promise<AtomicCommandOutcome<SupersedingMeasurementResult>> {
  const {
    measurementId,
    organizationId,
    verifiedBy,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    notes = null,
  } = input;

  return executeAtomicCreate<SupersedingMeasurementResult>({
    organizationId,
    applyMutation: (client) =>
      insertSupersedingMeasurement(client, {
        originalMeasurementId: measurementId,
        organizationId,
        dataQualityStatus: 'verified',
        correctionReason: notes,
        recordedBy: verifiedBy,
      }),
    buildEvent: ({ result }) =>
      buildSupersedingEvent({
        eventType: 'kpi.measurement_verified',
        result,
        organizationId,
        actorUserId: verifiedBy,
        actorEffectiveRole,
        idempotencyKey,
        correlationId,
        causationId,
        reason: notes,
        evidenceRefs: [],
      }),
  });
}

// ==========================================
// disputeMeasurement
// ==========================================

export interface DisputeMeasurementInput {
  measurementId: string;
  organizationId: string;
  disputedBy: string;
  disputeReason: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
}

export async function disputeMeasurement(
  input: DisputeMeasurementInput
): Promise<AtomicCommandOutcome<SupersedingMeasurementResult>> {
  const {
    measurementId,
    organizationId,
    disputedBy,
    disputeReason,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
  } = input;

  return executeAtomicCreate<SupersedingMeasurementResult>({
    organizationId,
    applyMutation: (client) =>
      insertSupersedingMeasurement(client, {
        originalMeasurementId: measurementId,
        organizationId,
        dataQualityStatus: 'disputed',
        correctionReason: disputeReason,
        recordedBy: disputedBy,
      }),
    buildEvent: ({ result }) =>
      buildSupersedingEvent({
        eventType: 'kpi.measurement_disputed',
        result,
        organizationId,
        actorUserId: disputedBy,
        actorEffectiveRole,
        idempotencyKey,
        correlationId,
        causationId,
        reason: disputeReason,
        evidenceRefs: [],
      }),
  });
}
