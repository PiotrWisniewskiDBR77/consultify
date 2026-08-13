/**
 * KPI-E003 Deviation Closed Loop API layer — Zod request-shape validators.
 *
 * Design: docs/product/results-vnext/KPI_E003_DESIGN.md §B (state-machine
 * table — one schema per command input), §A (enums, mirrored 1:1 from
 * `kpiDeviationTypes.ts`'s CHECK-constraint arrays via `z.enum(...)`, same
 * convention `resultsVnextKpi.validators.ts` uses for
 * `KpiStatusEnum`/`KpiTargetGeometryEnum`).
 *
 * Style precedent: `server/src/validators/resultsVnextKpi.validators.ts`
 * (this file's sibling for the definition/measurement surface) — same field
 * helpers (`idempotencyKeyField`/`nullableReasonField`/
 * `nullableShortStringField`/`nullableNumberField`/`expectedVersionField`/
 * `isoDateTimeString`), re-declared locally rather than imported since the
 * sibling file does not export them.
 */
import { z } from 'zod';

import {
  CORRECTIVE_ACTION_STATUSES,
  DEVIATION_CASE_STATUSES,
  EFFECTIVENESS_VERIFICATION_STATUSES,
} from '../services/resultsVnext/kpi/kpiDeviationTypes.js';

export const DeviationCaseStatusEnum = z.enum(DEVIATION_CASE_STATUSES);
export const CorrectiveActionStatusEnum = z.enum(CORRECTIVE_ACTION_STATUSES);
export const EffectivenessVerificationStatusEnum = z.enum(EFFECTIVENESS_VERIFICATION_STATUSES);

const MAX_IDEMPOTENCY_KEY_CHARS = 200;
const MAX_REASON_CHARS = 2000;
const MAX_NAME_CHARS = 500;
const MAX_SHORT_ID_CHARS = 200;

/** Same rationale/shape as `resultsVnextKpi.validators.ts`'s own
 * `isoDateTimeString` — a cheap pre-check so a malformed date/timestamp 400s
 * here instead of surfacing as a raw Postgres error deeper in the stack. */
const isoDateTimeString = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: 'must be a valid ISO 8601 date/time string',
});
const nullableIsoDateTimeString = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: 'must be a valid ISO 8601 date/time string',
  })
  .nullable()
  .optional();

const idempotencyKeyField = z.string().min(1).max(MAX_IDEMPOTENCY_KEY_CHARS).optional();
const nullableReasonField = z.string().max(MAX_REASON_CHARS).nullable().optional();
const nullableShortStringField = z.string().max(MAX_SHORT_ID_CHARS).nullable().optional();
const nullableNumberField = z.number().finite().nullable().optional();

const expectedVersionField = z.number().int().nonnegative();

// ==========================================
// PATH PARAMS
// ==========================================

export const CaseIdParamsSchema = z.object({
  caseId: z.string().uuid(),
});

export const CaseActionIdParamsSchema = z.object({
  caseId: z.string().uuid(),
  actionId: z.string().uuid(),
});

// ==========================================
// GET /api/vnext/results/kpi/deviation-cases — listDeviationCases
// ==========================================

export const ListDeviationCasesQuerySchema = z.object({
  kpiId: z.string().uuid().optional(),
  status: DeviationCaseStatusEnum.optional(),
  ownerUserId: z.string().min(1).max(MAX_SHORT_ID_CHARS).optional(),
  escalatedOnly: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

// ==========================================
// Shared "just a CAS + reason" shape — reused for acknowledge / submitPlan /
// approvePlan / close, same convention as resultsVnextKpi.validators.ts's
// `KpiLifecycleActionSchema` being reused across activate/suspend/archive.
// ==========================================

export const DeviationCaseCaseActionSchema = z.object({
  expectedVersion: expectedVersionField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// PUT .../:caseId/root-cause — submitRootCause
// ==========================================

export const SubmitRootCauseSchema = z.object({
  expectedVersion: expectedVersionField,
  rootCauseSummary: nullableReasonField,
  rootCauseCategory: nullableShortStringField,
  recurrenceFlag: z.boolean().optional(),
  expectedRecoveryDate: nullableIsoDateTimeString,
  expectedRecoveryValue: nullableNumberField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST .../:caseId/corrective-actions — addCorrectiveAction
// ==========================================

export const AddCorrectiveActionSchema = z.object({
  title: z.string().min(1).max(MAX_NAME_CHARS),
  description: nullableReasonField,
  ownerUserId: z.string().min(1).max(MAX_SHORT_ID_CHARS),
  dueDate: nullableIsoDateTimeString,
  expectedEffect: nullableReasonField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// PATCH .../:caseId/corrective-actions/:actionId — updateCorrectiveAction
// ==========================================

export const UpdateCorrectiveActionSchema = z.object({
  expectedVersion: expectedVersionField,
  status: CorrectiveActionStatusEnum.optional(),
  title: z.string().min(1).max(MAX_NAME_CHARS).optional(),
  description: nullableReasonField,
  ownerUserId: z.string().min(1).max(MAX_SHORT_ID_CHARS).optional(),
  dueDate: nullableIsoDateTimeString,
  expectedEffect: nullableReasonField,
  actualEffect: nullableReasonField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST .../:caseId/recovery-observation — recordRecoveryObservation
// ==========================================

export const RecordRecoveryObservationSchema = z.object({
  expectedVersion: expectedVersionField,
  recoveryObservationMeasurementId: z.string().uuid(),
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST .../:caseId/effectiveness-verifications — submitEffectivenessVerification
// ==========================================

export const SubmitEffectivenessVerificationSchema = z.object({
  expectedVersion: expectedVersionField,
  verificationWindowStart: isoDateTimeString,
  verificationWindowEnd: isoDateTimeString,
  outcome: EffectivenessVerificationStatusEnum,
  rationale: nullableReasonField,
  measurementIds: z.array(z.string().uuid()).optional(),
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST .../:caseId/escalate | .../:caseId/deescalate — escalation overlay
// ==========================================

export const EscalationOverlaySchema = z.object({
  expectedVersion: expectedVersionField,
  escalatedReason: nullableReasonField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST .../:caseId/reopen — reopenDeviationCase (executeAtomicCreate, no CAS
// — `:caseId` in the URL is the PRIOR (closed) case id, not the new one).
// ==========================================

export const ReopenDeviationCaseSchema = z.object({
  triggerMeasurementId: z.string().uuid().optional(),
  ownerUserId: nullableShortStringField,
  managerUserId: nullableShortStringField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});
