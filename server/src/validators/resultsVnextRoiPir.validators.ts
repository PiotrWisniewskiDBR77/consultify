/**
 * ROI-E006 API layer — Zod request-shape validators.
 *
 * Design: docs/product/results-vnext/ROI_E006_DESIGN.md §9. Redeclares
 * shared field helpers locally rather than importing them from
 * `resultsVnextRoi.validators.ts`/`resultsVnextRoiForecastActual.validators.ts`
 * — matching those files' own stated convention (dedicated file per epic
 * precedent, ROI-E002 §7).
 */
import { z } from 'zod';

import { ROI_PIR_OUTCOMES, ROI_PIR_TERESA_DRAFT_DISPOSITIONS } from '../services/resultsVnext/roi/roiPirTypes.js';

const MAX_IDEMPOTENCY_KEY_CHARS = 200;
const MAX_REASON_CHARS = 2000;
const MAX_LESSONS_CHARS = 8000;

const isoDateTimeString = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: 'must be a valid ISO 8601 date/time string',
});

const idempotencyKeyField = z.string().min(1).max(MAX_IDEMPOTENCY_KEY_CHARS).optional();
const nullableReasonField = z.string().max(MAX_REASON_CHARS).nullable().optional();
const expectedVersionField = z.number().int().nonnegative();

const RoiPirOutcomeEnum = z.enum(ROI_PIR_OUTCOMES);
const RoiPirTeresaDraftDispositionEnum = z.enum(ROI_PIR_TERESA_DRAFT_DISPOSITIONS);

// ==========================================
// PATH PARAMS
// ==========================================

export const RoiCaseIdParamsSchema = z.object({ caseId: z.string().uuid() });
export const RoiPirParamsSchema = z.object({ caseId: z.string().uuid(), pirId: z.string().uuid() });

// ==========================================
// PUT .../post-investment-review-schedule — scheduleRoiCasePostInvestmentReview
// ==========================================

export const ScheduleRoiCasePostInvestmentReviewSchema = z.object({
  expectedVersion: expectedVersionField,
  nextReviewAt: isoDateTimeString,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST .../transitions/mark-pir-due | .../transitions/start-pir
// ==========================================

export const RoiCaseTransitionSchema = z.object({
  expectedVersion: expectedVersionField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// PATCH .../post-investment-reviews/:pirId — updateRoiPostInvestmentReviewDraft
// ==========================================

export const UpdateRoiPostInvestmentReviewDraftSchema = z.object({
  expectedVersion: expectedVersionField,
  outcome: RoiPirOutcomeEnum.nullable().optional(),
  lessonsLearned: z.string().max(MAX_LESSONS_CHARS).nullable().optional(),
  recommendation: z.string().max(MAX_LESSONS_CHARS).nullable().optional(),
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST .../post-investment-reviews/:pirId/teresa-draft-disposition —
// recordRoiPirTeresaDraftDisposition (AC-06)
// ==========================================

export const RecordRoiPirTeresaDraftDispositionSchema = z.object({
  expectedVersion: expectedVersionField,
  disposition: RoiPirTeresaDraftDispositionEnum,
  finalLessonsText: z.string().max(MAX_LESSONS_CHARS).nullable().optional(),
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST .../transitions/close — closeRoiCase (AC-03)
// ==========================================

export const CloseRoiCaseSchema = z.object({
  expectedVersion: expectedVersionField,
  openVarianceWaiverReason: z.string().max(MAX_REASON_CHARS).nullable().optional(),
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});
