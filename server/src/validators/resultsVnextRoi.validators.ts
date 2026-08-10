/**
 * ROI-E001 API layer — Zod request-shape validators.
 *
 * Design: docs/product/results-vnext/ROI_E001_DESIGN.md §7. Style
 * precedent: `resultsVnextKpi.validators.ts` — one object schema per
 * endpoint body/query/params shape, consumed by
 * `validateBody`/`validateQuery`/`validateParams`
 * (`server/src/middleware/validation.middleware.ts`).
 *
 * Redeclares shared field helpers locally (`idempotencyKeyField`/
 * `expectedVersionField`/`isoDateTimeString`) rather than importing them
 * from `resultsVnextKpi.validators.ts` — matching every existing
 * `resultsVnextKpi*.validators.ts` file's stated convention (design §7).
 */
import { z } from 'zod';

import {
  ROI_BASELINE_CONFIDENCE_LEVELS,
  ROI_BASELINE_PROJECTION_METHODS,
  ROI_CASE_GRANULARITIES,
  ROI_CASE_STATUSES,
} from '../services/resultsVnext/roi/roiTypes.js';

export const RoiCaseStatusEnum = z.enum(ROI_CASE_STATUSES);
export const RoiCaseGranularityEnum = z.enum(ROI_CASE_GRANULARITIES);
export const RoiBaselineProjectionMethodEnum = z.enum(ROI_BASELINE_PROJECTION_METHODS);
export const RoiBaselineConfidenceEnum = z.enum(ROI_BASELINE_CONFIDENCE_LEVELS);

const MAX_IDEMPOTENCY_KEY_CHARS = 200;
const MAX_REASON_CHARS = 2000;
const MAX_TITLE_CHARS = 500;
const MAX_SHORT_ID_CHARS = 200;
const MAX_CURRENCY_CHARS = 12;

/** `rvn_roi_cases.analysis_start`/`analysis_end` and
 * `rvn_roi_baselines.baseline_period_start`/`baseline_period_end`/
 * `current_measured_as_of` are all `DATE` — any string `Date.parse` accepts
 * is fine here; a malformed date 400s at this layer instead of surfacing as
 * a raw Postgres error deeper in the stack. Same convention as
 * `resultsVnextKpi.validators.ts`'s `isoDateTimeString`. */
const isoDateTimeString = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: 'must be a valid ISO 8601 date/time string',
});

const idempotencyKeyField = z.string().min(1).max(MAX_IDEMPOTENCY_KEY_CHARS).optional();
const nullableReasonField = z.string().max(MAX_REASON_CHARS).nullable().optional();
const nullableShortStringField = z.string().max(MAX_SHORT_ID_CHARS).nullable().optional();
const nullableDateField = isoDateTimeString.nullable().optional();
const nullableNumberField = z.number().finite().nullable().optional();

const expectedVersionField = z.number().int().nonnegative();

// ==========================================
// PATH PARAMS
// ==========================================

export const RoiCaseIdParamsSchema = z.object({
  caseId: z.string().uuid(),
});

// ROI-E003 §7: GET .../approval-snapshots/:snapshotId.
export const RoiApprovalSnapshotParamsSchema = z.object({
  caseId: z.string().uuid(),
  snapshotId: z.string().uuid(),
});

// ==========================================
// POST /api/vnext/results/roi/cases — createRoiCase
// ==========================================

export const CreateRoiCaseSchema = z.object({
  initiativeId: z.string().min(1).max(MAX_SHORT_ID_CHARS),
  title: z.string().min(1).max(MAX_TITLE_CHARS),
  ownerUserId: z.string().min(1).max(MAX_SHORT_ID_CHARS),
  currency: z.string().min(1).max(MAX_CURRENCY_CHARS),
  granularity: RoiCaseGranularityEnum.optional(),
  analysisStart: nullableDateField,
  analysisEnd: nullableDateField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// GET /api/vnext/results/roi/cases — listRoiCases
// ==========================================

export const ListRoiCasesQuerySchema = z.object({
  status: RoiCaseStatusEnum.optional(),
  includeArchived: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

// ==========================================
// PATCH /api/vnext/results/roi/cases/:caseId — updateRoiCaseDetails
// ==========================================

export const UpdateRoiCaseDetailsSchema = z.object({
  expectedVersion: expectedVersionField,
  title: z.string().min(1).max(MAX_TITLE_CHARS).optional(),
  ownerUserId: z.string().min(1).max(MAX_SHORT_ID_CHARS).optional(),
  currency: z.string().min(1).max(MAX_CURRENCY_CHARS).optional(),
  granularity: RoiCaseGranularityEnum.optional(),
  analysisStart: nullableDateField,
  analysisEnd: nullableDateField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST .../cases/:caseId/archive — archiveRoiCase
// ==========================================

export const ArchiveRoiCaseSchema = z.object({
  expectedVersion: expectedVersionField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST .../transitions/start-modeling | .../ready-for-review
// ==========================================

export const RoiCaseTransitionSchema = z.object({
  expectedVersion: expectedVersionField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// PUT /api/vnext/results/roi/cases/:caseId/baseline — captureOrUpdateBaseline
// ==========================================

export const CaptureOrUpdateBaselineSchema = z.object({
  expectedVersion: expectedVersionField,
  baselinePeriodStart: nullableDateField,
  baselinePeriodEnd: nullableDateField,
  currentMeasuredValue: nullableNumberField,
  currentMeasuredUnit: nullableShortStringField,
  currentMeasuredAsOf: nullableDateField,
  bauProjectionMethod: RoiBaselineProjectionMethodEnum.optional(),
  bauGrowthRatePct: nullableNumberField,
  bauReferenceValue: nullableNumberField,
  interventionComparisonNotes: nullableReasonField,
  source: nullableShortStringField,
  confidence: RoiBaselineConfidenceEnum.nullable().optional(),
  ownerUserId: nullableShortStringField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// ROI-E003 §7 — Decision & Approved
// ==========================================

// POST .../transitions/submit-for-approval | .../transitions/approve |
// .../transitions/reopen-after-rejection — reuse RoiCaseTransitionSchema's
// shape (expectedVersion/optional reason/idempotencyKey); approver identity
// comes from auth.userId, not the body, so `approve` needs no extra field.

// POST .../transitions/reject — expectedVersion + REQUIRED rejectionReason.
export const RejectRoiCaseSchema = z.object({
  expectedVersion: expectedVersionField,
  rejectionReason: z.string().min(1).max(MAX_REASON_CHARS),
  idempotencyKey: idempotencyKeyField,
});

// POST .../transitions/request-changes — expectedVersion + REQUIRED
// changeRequestNotes.
export const RequestChangesOnRoiCaseSchema = z.object({
  expectedVersion: expectedVersionField,
  changeRequestNotes: z.string().min(1).max(MAX_REASON_CHARS),
  idempotencyKey: idempotencyKeyField,
});

// POST .../transitions/reopen-for-revision — expectedVersion + REQUIRED
// reason (unlike every other command's optional reason — design §4.5).
export const ReopenApprovedRoiCaseForRevisionSchema = z.object({
  expectedVersion: expectedVersionField,
  reason: z.string().min(1).max(MAX_REASON_CHARS),
  idempotencyKey: idempotencyKeyField,
});
