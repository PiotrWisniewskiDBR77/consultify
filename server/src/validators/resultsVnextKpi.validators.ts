/**
 * KPI-E001/E002 API layer — Zod request-shape validators.
 *
 * Design: docs/product/results-vnext/02_KPI_IMPLEMENTATION_PLAN.md §7.1/§7.2
 * (route list), server/src/services/resultsVnext/kpi/kpiTypes.ts (enums —
 * `KpiStatusEnum`/`KpiTargetGeometryEnum` below re-export the SAME literal
 * arrays via `z.enum(...)` rather than duplicating the value list, so a
 * future geometry/status addition to kpiTypes.ts does not silently drift out
 * of sync with request validation).
 *
 * Style precedent: server/src/validators/decision.validators.ts (Zod object
 * schemas, one per endpoint body/query/params shape, consumed by
 * `validateBody`/`validateQuery`/`validateParams` — server/src/middleware/
 * validation.middleware.ts).
 *
 * Command-layer optional-field semantics (kpiDefinitionCommands.ts's
 * `editDraft`, in particular) distinguish "field omitted -> don't touch" from
 * "field explicitly null -> clear it". Every nullable field below uses
 * `.nullable().optional()` (not `.optional()` alone) so that tri-state
 * survives `req.body` -> Zod -> command input untouched: omitted stays
 * `undefined`, an explicit JSON `null` stays `null`, and only a real value
 * overwrites.
 */
import { z } from 'zod';

import { KPI_STATUSES, KPI_TARGET_GEOMETRIES } from '../services/resultsVnext/kpi/kpiTypes.js';

export const KpiStatusEnum = z.enum(KPI_STATUSES);
export const KpiTargetGeometryEnum = z.enum(KPI_TARGET_GEOMETRIES);

const MAX_IDEMPOTENCY_KEY_CHARS = 200;
const MAX_REASON_CHARS = 2000;
const MAX_NAME_CHARS = 500;
const MAX_CODE_CHARS = 128;
const MAX_SHORT_ID_CHARS = 200;

/**
 * `rvn_kpi_measurements.period_start`/`period_end` are `TIMESTAMPTZ` (see
 * `server/migrations/20260810_rvn_kpi_core.sql`) — any string `Date.parse`
 * accepts is fine; this is a cheap pre-check so a malformed date 400s here
 * instead of surfacing as a raw Postgres error deeper in the stack.
 */
const isoDateTimeString = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: 'must be a valid ISO 8601 date/time string',
});

const idempotencyKeyField = z.string().min(1).max(MAX_IDEMPOTENCY_KEY_CHARS).optional();
const nullableReasonField = z.string().max(MAX_REASON_CHARS).nullable().optional();
const nullableShortStringField = z.string().max(MAX_SHORT_ID_CHARS).nullable().optional();
const nullableNumberField = z.number().finite().nullable().optional();

const expectedVersionField = z.number().int().nonnegative();

// ==========================================
// PATH PARAMS
// ==========================================

export const KpiIdParamsSchema = z.object({
  kpiId: z.string().uuid(),
});

export const KpiDefinitionVersionParamsSchema = z.object({
  kpiId: z.string().uuid(),
  versionId: z.string().uuid(),
});

export const KpiMeasurementParamsSchema = z.object({
  kpiId: z.string().uuid(),
  measurementId: z.string().uuid(),
});

// ==========================================
// POST /api/vnext/results/kpi — createKpiDraft
// ==========================================

export const CreateKpiDraftSchema = z.object({
  kpiCode: z.string().min(1).max(MAX_CODE_CHARS),
  name: z.string().min(1).max(MAX_NAME_CHARS),
  description: nullableReasonField,
  unit: nullableShortStringField,
  targetGeometry: KpiTargetGeometryEnum,
  targetValue: nullableNumberField,
  targetMin: nullableNumberField,
  targetMax: nullableNumberField,
  warningLow: nullableNumberField,
  warningHigh: nullableNumberField,
  criticalLow: nullableNumberField,
  criticalHigh: nullableNumberField,
  /** Only meaningful when `targetGeometry === 'binary'` — see
   * targetGeometryEvaluator.ts's `evalBinary()`. Not cross-validated against
   * `targetGeometry` here (the command layer/DB CHECK don't enforce that
   * pairing either — see the migration's own column comment). */
  binarySuccessValue: nullableNumberField,
  formulaText: nullableReasonField,
  primaryProcessId: nullableShortStringField,
  responsePolicyId: nullableShortStringField,
  ownerUserId: nullableShortStringField,
  scopeId: nullableShortStringField,
  sensitivity: nullableShortStringField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// GET /api/vnext/results/kpi — listKpis
// ==========================================

export const ListKpisQuerySchema = z.object({
  status: KpiStatusEnum.optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

// ==========================================
// PUT /api/vnext/results/kpi/:kpiId/draft — editDraft
// ==========================================

export const EditKpiDraftSchema = z.object({
  expectedVersion: expectedVersionField,
  name: z.string().min(1).max(MAX_NAME_CHARS).optional(),
  description: nullableReasonField,
  unit: nullableShortStringField,
  targetGeometry: KpiTargetGeometryEnum.optional(),
  targetValue: nullableNumberField,
  targetMin: nullableNumberField,
  targetMax: nullableNumberField,
  warningLow: nullableNumberField,
  warningHigh: nullableNumberField,
  criticalLow: nullableNumberField,
  criticalHigh: nullableNumberField,
  binarySuccessValue: nullableNumberField,
  formulaText: nullableReasonField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST /api/vnext/results/kpi/:kpiId/submit — submitDefinition
// ==========================================

export const SubmitDefinitionSchema = z.object({
  expectedVersion: expectedVersionField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST .../definition-versions/:versionId/approve — approveDefinitionVersion
// ==========================================

export const ApproveDefinitionVersionSchema = z.object({
  expectedVersion: expectedVersionField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST .../definition-versions/:versionId/reject — rejectDefinitionVersion
// ==========================================

export const RejectDefinitionVersionSchema = z.object({
  expectedVersion: expectedVersionField,
  rejectionReason: z.string().min(1).max(MAX_REASON_CHARS),
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST .../activate | .../suspend | .../archive — KpiLifecycleInput
// ==========================================

export const KpiLifecycleActionSchema = z.object({
  expectedVersion: expectedVersionField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST /api/vnext/results/kpi/:kpiId/measurements — recordMeasurement
// ==========================================

export const RecordMeasurementSchema = z.object({
  /** Optional — omit to record against the KPI's current definition
   * version (resolved server-side via `kpiRepository.getKpi`). Provided
   * explicitly to measure against a specific (e.g. still-current-but-about-
   * to-be-amended) version. */
  definitionVersionId: z.string().uuid().optional(),
  periodStart: isoDateTimeString,
  periodEnd: isoDateTimeString,
  actualValue: z.number().finite().nullable(),
  source: z.string().min(1).max(MAX_SHORT_ID_CHARS),
  evidenceRefs: z.array(z.unknown()).optional(),
  notes: nullableReasonField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// GET /api/vnext/results/kpi/:kpiId/measurements — listMeasurements
// ==========================================

export const ListMeasurementsQuerySchema = z.object({
  includeSuperseded: z.coerce.boolean().optional(),
  periodStart: isoDateTimeString.optional(),
  periodEnd: isoDateTimeString.optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

// ==========================================
// POST .../measurements/:measurementId/corrections — correctMeasurement
// ==========================================

export const CorrectMeasurementSchema = z.object({
  actualValue: z.number().finite().nullable(),
  correctionReason: z.string().min(1).max(MAX_REASON_CHARS),
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST .../measurements/:measurementId/verify — verifyMeasurement
// ==========================================

export const VerifyMeasurementSchema = z.object({
  notes: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST .../measurements/:measurementId/dispute — disputeMeasurement
// ==========================================

export const DisputeMeasurementSchema = z.object({
  disputeReason: z.string().min(1).max(MAX_REASON_CHARS),
  idempotencyKey: idempotencyKeyField,
});
