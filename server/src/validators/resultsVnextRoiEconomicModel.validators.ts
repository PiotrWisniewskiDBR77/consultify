/**
 * ROI-E002 API layer — Zod request-shape validators.
 *
 * Design: docs/product/results-vnext/ROI_E002_DESIGN.md §7. Redeclares
 * shared field helpers locally rather than importing them from
 * `resultsVnextRoi.validators.ts` — matching that file's own stated
 * convention (ROI-E001 §7 / every `resultsVnextKpi*.validators.ts` file).
 */
import { z } from 'zod';

import {
  ROI_CONFIDENCE_LEVELS,
  ROI_EVIDENCE_LINK_DISPUTE_STATUSES,
  ROI_EVIDENCE_LINK_PURPOSES,
  ROI_RECURRENCE_CADENCES,
  ROI_ROUNDING_POLICIES,
  ROI_SCENARIO_OVERRIDE_TARGET_TYPES,
  ROI_SCENARIO_TYPES,
  ROI_TAX_TREATMENTS,
  ROI_TIMING_TYPES,
} from '../services/resultsVnext/roi/roiEconomicModelTypes.js';

const MAX_IDEMPOTENCY_KEY_CHARS = 200;
const MAX_REASON_CHARS = 2000;
const MAX_LABEL_CHARS = 500;
const MAX_SHORT_ID_CHARS = 200;
const MAX_CURRENCY_CHARS = 12;
const MAX_NOTES_CHARS = 4000;

const isoDateString = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: 'must be a valid ISO 8601 date/time string',
});

const idempotencyKeyField = z.string().min(1).max(MAX_IDEMPOTENCY_KEY_CHARS).optional();
const nullableReasonField = z.string().max(MAX_REASON_CHARS).nullable().optional();
const nullableShortStringField = z.string().max(MAX_SHORT_ID_CHARS).nullable().optional();
const nullableNotesField = z.string().max(MAX_NOTES_CHARS).nullable().optional();
const nullableDateField = isoDateString.nullable().optional();
const nullableNumberField = z.number().finite().nullable().optional();
const expectedVersionField = z.number().int().nonnegative();

const RoiTaxTreatmentEnum = z.enum(ROI_TAX_TREATMENTS);
const RoiRoundingPolicyEnum = z.enum(ROI_ROUNDING_POLICIES);
const RoiConfidenceEnum = z.enum(ROI_CONFIDENCE_LEVELS);
const RoiTimingTypeEnum = z.enum(ROI_TIMING_TYPES);
const RoiRecurrenceCadenceEnum = z.enum(ROI_RECURRENCE_CADENCES);
const RoiEvidenceLinkPurposeEnum = z.enum(ROI_EVIDENCE_LINK_PURPOSES);
const RoiEvidenceLinkDisputeStatusEnum = z.enum(ROI_EVIDENCE_LINK_DISPUTE_STATUSES);
const RoiScenarioTypeEnum = z.enum(ROI_SCENARIO_TYPES);
const RoiScenarioOverrideTargetTypeEnum = z.enum(ROI_SCENARIO_OVERRIDE_TARGET_TYPES);

// ==========================================
// PATH PARAMS
// ==========================================

export const RoiCaseIdParamsSchema = z.object({ caseId: z.string().uuid() });
export const RoiAssumptionParamsSchema = z.object({ caseId: z.string().uuid(), assumptionId: z.string().uuid() });
export const RoiCostLineParamsSchema = z.object({ caseId: z.string().uuid(), costLineId: z.string().uuid() });
export const RoiBenefitLineParamsSchema = z.object({ caseId: z.string().uuid(), benefitLineId: z.string().uuid() });
export const RoiBenefitEvidenceLinkParamsSchema = z.object({
  caseId: z.string().uuid(),
  benefitLineId: z.string().uuid(),
  linkId: z.string().uuid(),
});
export const RoiBenefitEvidenceLinkListParamsSchema = z.object({
  caseId: z.string().uuid(),
  benefitLineId: z.string().uuid(),
});
export const RoiScenarioParamsSchema = z.object({ caseId: z.string().uuid(), scenarioId: z.string().uuid() });
export const RoiScenarioOverrideParamsSchema = z.object({
  caseId: z.string().uuid(),
  scenarioId: z.string().uuid(),
  overrideId: z.string().uuid(),
});
export const RoiCalculationRunParamsSchema = z.object({ caseId: z.string().uuid(), runId: z.string().uuid() });

export const IncludeDeletedQuerySchema = z.object({
  includeDeleted: z.coerce.boolean().optional(),
});

// ==========================================
// PUT .../calculation-policy — captureOrUpdateCalculationPolicy
// ==========================================

export const CaptureOrUpdateCalculationPolicySchema = z.object({
  expectedVersion: expectedVersionField,
  discountRatePct: nullableNumberField,
  taxTreatment: RoiTaxTreatmentEnum.nullable().optional(),
  inflationRatePct: nullableNumberField,
  roundingPolicy: RoiRoundingPolicyEnum.optional(),
  requiredMetrics: z.array(z.string().max(64)).nullable().optional(),
  notes: nullableNotesField,
  confidence: RoiConfidenceEnum.nullable().optional(),
  ownerUserId: nullableShortStringField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST/PATCH .../assumptions[/:assumptionId]
// ==========================================

export const AddAssumptionSchema = z.object({
  category: z.string().min(1).max(MAX_LABEL_CHARS),
  label: z.string().min(1).max(MAX_LABEL_CHARS),
  unit: nullableShortStringField,
  baseValue: nullableNumberField,
  downsideValue: nullableNumberField,
  upsideValue: nullableNumberField,
  confidence: RoiConfidenceEnum.nullable().optional(),
  evidenceRef: nullableShortStringField,
  source: nullableShortStringField,
  ownerUserId: nullableShortStringField,
  sensitivityRank: z.number().int().nullable().optional(),
  notes: nullableNotesField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

export const UpdateAssumptionSchema = AddAssumptionSchema.partial().extend({
  expectedVersion: expectedVersionField,
});

export const RemoveAssumptionSchema = z.object({
  expectedVersion: expectedVersionField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST/PATCH .../cost-lines[/:costLineId]
// ==========================================

export const AddCostLineSchema = z.object({
  category: z.string().min(1).max(MAX_LABEL_CHARS),
  label: z.string().min(1).max(MAX_LABEL_CHARS),
  description: nullableNotesField,
  amount: z.number().finite(),
  currency: z.string().min(1).max(MAX_CURRENCY_CHARS),
  timingType: RoiTimingTypeEnum,
  oneTimePeriodDate: nullableDateField,
  recurrenceStartDate: nullableDateField,
  recurrenceEndDate: nullableDateField,
  recurrenceCadence: RoiRecurrenceCadenceEnum.nullable().optional(),
  confidence: RoiConfidenceEnum.nullable().optional(),
  source: nullableShortStringField,
  ownerUserId: nullableShortStringField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

export const UpdateCostLineSchema = AddCostLineSchema.partial().extend({
  expectedVersion: expectedVersionField,
});

export const RemoveCostLineSchema = z.object({
  expectedVersion: expectedVersionField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST/PATCH .../benefit-lines[/:benefitLineId]
// ==========================================

export const AddBenefitLineSchema = z.object({
  category: z.string().min(1).max(MAX_LABEL_CHARS),
  label: z.string().min(1).max(MAX_LABEL_CHARS),
  description: nullableNotesField,
  isFinancial: z.boolean().optional(),
  amount: nullableNumberField,
  currency: nullableShortStringField,
  timingType: RoiTimingTypeEnum,
  oneTimePeriodDate: nullableDateField,
  recurrenceStartDate: nullableDateField,
  recurrenceEndDate: nullableDateField,
  recurrenceCadence: RoiRecurrenceCadenceEnum.nullable().optional(),
  rampPeriods: z.number().int().positive().nullable().optional(),
  doubleCountingGroup: nullableShortStringField,
  doubleCountingResolutionNote: nullableNotesField,
  confidence: RoiConfidenceEnum.nullable().optional(),
  source: nullableShortStringField,
  ownerUserId: nullableShortStringField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

export const UpdateBenefitLineSchema = AddBenefitLineSchema.partial().extend({
  expectedVersion: expectedVersionField,
});

export const RemoveBenefitLineSchema = z.object({
  expectedVersion: expectedVersionField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST/DELETE .../benefit-lines/:benefitLineId/kpi-evidence-links[/:linkId]
// ==========================================

export const AddBenefitEvidenceLinkSchema = z.object({
  kpiId: z.string().uuid(),
  pinnedKpiDefinitionVersionId: z.string().uuid(),
  expectedUnit: nullableShortStringField,
  purpose: RoiEvidenceLinkPurposeEnum,
  notes: nullableNotesField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

export const RemoveBenefitEvidenceLinkSchema = z.object({
  expectedVersion: expectedVersionField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

export const FlagBenefitEvidenceLinkDisputedSchema = z.object({
  expectedVersion: expectedVersionField,
  disputeStatus: RoiEvidenceLinkDisputeStatusEnum,
  notes: nullableNotesField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

export const ListBenefitEvidenceLinksQuerySchema = z.object({
  hydrateKpiDetails: z.coerce.boolean().optional(),
});

// ==========================================
// POST/PATCH .../scenarios[/:scenarioId]
// ==========================================

export const AddScenarioSchema = z.object({
  scenarioType: RoiScenarioTypeEnum,
  label: z.string().min(1).max(MAX_LABEL_CHARS),
  description: nullableNotesField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

export const UpdateScenarioSchema = z.object({
  expectedVersion: expectedVersionField,
  label: z.string().min(1).max(MAX_LABEL_CHARS).optional(),
  description: nullableNotesField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

export const RemoveScenarioSchema = z.object({
  expectedVersion: expectedVersionField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST .../scenarios/:scenarioId/overrides ; DELETE .../overrides/:overrideId
// ==========================================

export const SetScenarioOverrideSchema = z.object({
  expectedVersion: expectedVersionField,
  targetType: RoiScenarioOverrideTargetTypeEnum,
  targetId: z.string().uuid(),
  overrideValue: nullableNumberField,
  overrideAmount: nullableNumberField,
  note: nullableNotesField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

export const RemoveScenarioOverrideSchema = z.object({
  expectedVersion: expectedVersionField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST .../calculation-runs — createRoiCalculationRun
// ==========================================

export const CreateRoiCalculationRunSchema = z.object({
  scenarioId: z.string().uuid().nullable().optional(),
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

export const ListCalculationRunsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(500).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});
