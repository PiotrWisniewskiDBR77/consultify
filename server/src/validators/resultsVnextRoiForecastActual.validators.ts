/**
 * ROI-E004 API layer — Zod request-shape validators.
 *
 * Design: docs/product/results-vnext/ROI_E004_DESIGN.md §6. Redeclares
 * shared field helpers locally rather than importing them from
 * `resultsVnextRoi.validators.ts`/`resultsVnextRoiEconomicModel.validators.ts`
 * — matching those files' own stated convention (dedicated file per E002/
 * E003/E004 precedent, ROI-E002 §7).
 */
import { z } from 'zod';

import { ROI_COMPARE_METRICS } from '../services/resultsVnext/roi/roiCompareRepository.js';
import {
  ROI_ACTUAL_ENTRY_TYPES,
  ROI_VARIANCE_COMPARISON_TYPES,
  ROI_VARIANCE_STATUSES,
} from '../services/resultsVnext/roi/roiForecastActualTypes.js';

const MAX_IDEMPOTENCY_KEY_CHARS = 200;
const MAX_REASON_CHARS = 2000;
const MAX_SHORT_ID_CHARS = 200;
const MAX_CURRENCY_CHARS = 12;
const MAX_NOTES_CHARS = 4000;
const MAX_LABEL_CHARS = 500;

const isoDateString = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: 'must be a valid ISO 8601 date/time string',
});

const idempotencyKeyField = z.string().min(1).max(MAX_IDEMPOTENCY_KEY_CHARS).optional();
const nullableReasonField = z.string().max(MAX_REASON_CHARS).nullable().optional();
const nullableShortStringField = z.string().max(MAX_SHORT_ID_CHARS).nullable().optional();
const nullableNotesField = z.string().max(MAX_NOTES_CHARS).nullable().optional();
const nullableNumberField = z.number().finite().nullable().optional();
/** Required-but-nullable — `correctActualEntry`'s `amount` must always be
 * present in the body (a correction always states its new value, which MAY
 * be `null`), unlike every other numeric field here which is optional. */
const requiredNullableNumberField = z.number().finite().nullable();
const nullableCurrencyField = z.string().max(MAX_CURRENCY_CHARS).nullable().optional();
const expectedVersionField = z.number().int().nonnegative();

const RoiActualEntryTypeEnum = z.enum(ROI_ACTUAL_ENTRY_TYPES);
const RoiVarianceComparisonTypeEnum = z.enum(ROI_VARIANCE_COMPARISON_TYPES);
const RoiVarianceStatusEnum = z.enum(ROI_VARIANCE_STATUSES);
const RoiCompareMetricEnum = z.enum(ROI_COMPARE_METRICS);

// ==========================================
// PATH PARAMS
// ==========================================

export const RoiCaseIdParamsSchema = z.object({ caseId: z.string().uuid() });
export const RoiForecastVersionParamsSchema = z.object({ caseId: z.string().uuid(), forecastVersionId: z.string().uuid() });
export const RoiActualEntryParamsSchema = z.object({ caseId: z.string().uuid(), entryId: z.string().uuid() });
export const RoiActualSnapshotParamsSchema = z.object({ caseId: z.string().uuid(), actualSnapshotId: z.string().uuid() });
export const RoiVarianceParamsSchema = z.object({ caseId: z.string().uuid(), varianceId: z.string().uuid() });
export const RoiVarianceCauseParamsSchema = z.object({
  caseId: z.string().uuid(),
  varianceId: z.string().uuid(),
  causeId: z.string().uuid(),
});

export const ListActualEntriesQuerySchema = z.object({
  includeSuperseded: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

// ==========================================
// POST .../transitions/start-tracking — startRoiCaseTracking
// ==========================================

export const RoiCaseTransitionSchema = z.object({
  expectedVersion: expectedVersionField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST .../transitions/cancel — cancelRoiCase (ROI-E005 design §4)
// ==========================================

/** `reason` is REQUIRED here (Decision D8) — overrides the base schema's
 * optional/nullable `reason` field with a mandatory non-empty string. */
export const RoiCaseCancellationSchema = RoiCaseTransitionSchema.extend({
  reason: z.string().min(1).max(MAX_REASON_CHARS),
});

// ==========================================
// POST .../forecast-versions — createRoiForecastVersion
// ==========================================

const RoiForecastVersionOverrideSchema = z.object({
  targetType: z.enum(['assumption', 'cost_line', 'benefit_line']),
  targetId: z.string().uuid(),
  overrideValue: nullableNumberField,
  overrideAmount: nullableNumberField,
});

export const CreateRoiForecastVersionSchema = z.object({
  expectedVersion: expectedVersionField,
  reason: z.string().min(1).max(MAX_REASON_CHARS),
  overrides: z.array(RoiForecastVersionOverrideSchema).max(500).optional(),
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST .../actuals — recordActualEntry
// ==========================================

export const RecordActualEntrySchema = z.object({
  entryType: RoiActualEntryTypeEnum,
  costLineId: z.string().uuid().nullable().optional(),
  benefitLineId: z.string().uuid().nullable().optional(),
  periodStart: isoDateString,
  periodEnd: isoDateString,
  amount: nullableNumberField,
  currency: nullableCurrencyField,
  source: z.string().min(1).max(MAX_LABEL_CHARS),
  evidenceRefs: z.array(z.unknown()).optional(),
  notes: nullableNotesField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

export const CorrectActualEntrySchema = z.object({
  amount: requiredNullableNumberField,
  currency: nullableCurrencyField,
  correctionReason: z.string().min(1).max(MAX_REASON_CHARS),
  idempotencyKey: idempotencyKeyField,
});

export const VerifyActualEntrySchema = z.object({
  notes: nullableNotesField,
  idempotencyKey: idempotencyKeyField,
});

export const DisputeActualEntrySchema = z.object({
  disputeReason: z.string().min(1).max(MAX_REASON_CHARS),
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST .../actual-snapshots — publishRoiActualSnapshot
// ==========================================

export const PublishRoiActualSnapshotSchema = z.object({
  expectedVersion: expectedVersionField,
  asOfPeriodEnd: isoDateString,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST .../variances — recordVariance
// ==========================================

export const RecordVarianceSchema = z.object({
  comparisonType: RoiVarianceComparisonTypeEnum,
  metric: RoiCompareMetricEnum,
  referenceApprovalSnapshotId: z.string().uuid().nullable().optional(),
  referenceForecastVersionId: z.string().uuid().nullable().optional(),
  referenceActualSnapshotId: z.string().uuid().nullable().optional(),
  ownerUserId: nullableShortStringField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

export const UpdateVarianceStatusSchema = z.object({
  expectedVersion: expectedVersionField,
  status: RoiVarianceStatusEnum.optional(),
  ownerUserId: nullableShortStringField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

export const AddVarianceCauseSchema = z.object({
  causeCategory: z.string().min(1).max(MAX_LABEL_CHARS),
  contributionPct: nullableNumberField,
  narrative: z.string().min(1).max(MAX_NOTES_CHARS),
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

export const RemoveVarianceCauseSchema = z.object({
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});
