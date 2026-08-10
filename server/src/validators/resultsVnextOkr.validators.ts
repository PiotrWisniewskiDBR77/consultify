/**
 * OKR-E001 API layer — Zod request-shape validators.
 *
 * Design: docs/product/results-vnext/OKR_E001_DESIGN.md §8. Style
 * precedent: `resultsVnextRoi.validators.ts` — one object schema per
 * endpoint body/query/params shape, consumed by
 * `validateBody`/`validateQuery`/`validateParams`
 * (`server/src/middleware/validation.middleware.ts`).
 *
 * Redeclares shared field helpers locally (`idempotencyKeyField`/
 * `expectedVersionField`/`isoDateTimeString`) rather than importing them
 * from a sibling domain's validators file — matching every existing
 * `resultsVnext*.validators.ts` file's stated convention.
 */
import { z } from 'zod';

import {
  OKR_CHECKIN_FREQUENCIES,
  OKR_CONFIDENCE_MODELS,
  OKR_CYCLE_MODELS,
  OKR_OBJECTIVE_CONFIDENCE_MODELS,
  OKR_OBJECTIVE_ROLLUP_MODELS,
  OKR_PROGRAM_STATUSES,
  OKR_SCORING_MODELS,
  OKR_VISIBILITY_DEFAULTS,
} from '../services/resultsVnext/okr/okrProgramTypes.js';
import { OKR_CYCLE_STATUSES } from '../services/resultsVnext/okr/okrCycleTypes.js';

export const OkrProgramStatusEnum = z.enum(OKR_PROGRAM_STATUSES);
export const OkrCycleModelEnum = z.enum(OKR_CYCLE_MODELS);
export const OkrCheckinFrequencyEnum = z.enum(OKR_CHECKIN_FREQUENCIES);
export const OkrScoringModelEnum = z.enum(OKR_SCORING_MODELS);
export const OkrObjectiveRollupModelEnum = z.enum(OKR_OBJECTIVE_ROLLUP_MODELS);
export const OkrConfidenceModelEnum = z.enum(OKR_CONFIDENCE_MODELS);
export const OkrObjectiveConfidenceModelEnum = z.enum(OKR_OBJECTIVE_CONFIDENCE_MODELS);
export const OkrVisibilityDefaultEnum = z.enum(OKR_VISIBILITY_DEFAULTS);
export const OkrCycleStatusEnum = z.enum(OKR_CYCLE_STATUSES);

const MAX_IDEMPOTENCY_KEY_CHARS = 200;
const MAX_REASON_CHARS = 2000;
const MAX_NAME_CHARS = 500;

/** `okr_vnext_cycles`' ten TIMESTAMPTZ columns and `start_date`/`end_date`
 * (DATE) — any string `Date.parse` accepts is fine here; a malformed date
 * 400s at this layer instead of surfacing as a raw Postgres error deeper in
 * the stack. Same convention as `resultsVnextRoi.validators.ts`'s
 * `isoDateTimeString`. */
const isoDateTimeString = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: 'must be a valid ISO 8601 date/time string',
});

const idempotencyKeyField = z.string().min(1).max(MAX_IDEMPOTENCY_KEY_CHARS).optional();
const nullableReasonField = z.string().max(MAX_REASON_CHARS).nullable().optional();
const nullableDateField = isoDateTimeString.nullable().optional();

const expectedVersionField = z.number().int().nonnegative();

// ==========================================
// PATH PARAMS
// ==========================================

export const OkrProgramIdParamsSchema = z.object({
  programId: z.string().uuid(),
});

export const OkrCycleIdParamsSchema = z.object({
  cycleId: z.string().uuid(),
});

// ==========================================
// Shared policy-field shape (createProgram + editProgramDraft)
// ==========================================

const okrProgramPolicyFields = {
  cycleModel: OkrCycleModelEnum.optional(),
  annualDirectionEnabled: z.boolean().optional(),
  objectiveMinRecommended: z.number().int().nonnegative().nullable().optional(),
  objectiveMaxRecommended: z.number().int().nonnegative().nullable().optional(),
  krMinRequired: z.number().int().nonnegative().optional(),
  krMaxRecommended: z.number().int().nonnegative().nullable().optional(),
  checkinFrequency: OkrCheckinFrequencyEnum.optional(),
  approvalRequired: z.boolean().optional(),
  scoringModel: OkrScoringModelEnum.optional(),
  objectiveRollupModel: OkrObjectiveRollupModelEnum.optional(),
  confidenceEnabled: z.boolean().optional(),
  confidenceModel: OkrConfidenceModelEnum.optional(),
  objectiveConfidenceModel: OkrObjectiveConfidenceModelEnum.optional(),
  visibilityDefault: OkrVisibilityDefaultEnum.optional(),
  committedVsAspirationalEnabled: z.boolean().optional(),
  managerReviewRequired: z.boolean().optional(),
  selfReviewRequired: z.boolean().optional(),
  reflectionRequiredForClose: z.boolean().optional(),
  recognitionEnabled: z.boolean().optional(),
} as const;

// ==========================================
// POST /api/vnext/results/okr/programs — createProgram
// ==========================================

export const CreateOkrProgramSchema = z.object({
  name: z.string().min(1).max(MAX_NAME_CHARS),
  ...okrProgramPolicyFields,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// GET /api/vnext/results/okr/programs — listPrograms
// ==========================================

export const ListOkrProgramsQuerySchema = z.object({
  status: OkrProgramStatusEnum.optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

// ==========================================
// PATCH /api/vnext/results/okr/programs/:programId/draft — editProgramDraft
// ==========================================

export const EditOkrProgramDraftSchema = z.object({
  expectedVersion: expectedVersionField,
  name: z.string().min(1).max(MAX_NAME_CHARS).optional(),
  ...okrProgramPolicyFields,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST /api/vnext/results/okr/programs/:programId/publish — publishProgram
// ==========================================

export const PublishOkrProgramSchema = z.object({
  expectedVersion: expectedVersionField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST /api/vnext/results/okr/cycles — createCycle
// ==========================================

export const CreateOkrCycleSchema = z.object({
  programId: z.string().uuid(),
  name: z.string().min(1).max(MAX_NAME_CHARS),
  startDate: isoDateTimeString,
  endDate: isoDateTimeString,
  draftOpenAt: isoDateTimeString,
  submissionDueAt: isoDateTimeString,
  approvalDueAt: nullableDateField,
  activeStartAt: isoDateTimeString,
  midcycleReviewAt: nullableDateField,
  finalUpdateDueAt: isoDateTimeString,
  reviewOpenAt: isoDateTimeString,
  reflectionDueAt: isoDateTimeString,
  managerReviewDueAt: nullableDateField,
  closeAt: isoDateTimeString,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// GET /api/vnext/results/okr/cycles — listCycles
// ==========================================

export const ListOkrCyclesQuerySchema = z.object({
  programId: z.string().uuid().optional(),
  status: OkrCycleStatusEnum.optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

// ==========================================
// POST .../cycles/:cycleId/{open-drafting|activate|open-review|close|cancel}
// ==========================================

export const OkrCycleTransitionSchema = z.object({
  expectedVersion: expectedVersionField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});
