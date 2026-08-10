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
import {
  OKR_OBJECTIVE_AMBITION_TYPES,
  OKR_OBJECTIVE_CONFIDENCE_VALUES,
} from '../services/resultsVnext/okr/okrObjectiveTypes.js';
import {
  OKR_KEY_RESULT_CONFIDENCE_VALUES,
  OKR_KEY_RESULT_DIRECTIONS,
  OKR_KEY_RESULT_MEASUREMENT_TYPES,
  OKR_KEY_RESULT_SOURCE_TYPES,
  OKR_KEY_RESULT_STATUSES,
} from '../services/resultsVnext/okr/okrKeyResultTypes.js';
import {
  OKR_SET_ATTENTION_STATES,
  OKR_SET_SCOPE_TYPES,
  OKR_SET_STATUSES,
  OKR_SET_VERSION_FIELD_NAMES,
} from '../services/resultsVnext/okr/okrSetTypes.js';
import { OKR_CHECKIN_CONFIDENCE_VALUES, OKR_CHECKIN_STATUS_VALUES } from '../services/resultsVnext/okr/okrCheckInTypes.js';
import { OKR_ALIGNMENT_STATUSES } from '../services/resultsVnext/okr/okrAlignmentTypes.js';
import { OKR_REFLECTION_DISPOSITIONS } from '../services/resultsVnext/okr/okrReflectionTypes.js';
import { OKR_REVIEW_COMMENT_LEVELS, OKR_REVIEW_TYPES } from '../services/resultsVnext/okr/okrReviewTypes.js';

export const OkrProgramStatusEnum = z.enum(OKR_PROGRAM_STATUSES);
export const OkrCycleModelEnum = z.enum(OKR_CYCLE_MODELS);
export const OkrCheckinFrequencyEnum = z.enum(OKR_CHECKIN_FREQUENCIES);
export const OkrScoringModelEnum = z.enum(OKR_SCORING_MODELS);
export const OkrObjectiveRollupModelEnum = z.enum(OKR_OBJECTIVE_ROLLUP_MODELS);
export const OkrConfidenceModelEnum = z.enum(OKR_CONFIDENCE_MODELS);
export const OkrObjectiveConfidenceModelEnum = z.enum(OKR_OBJECTIVE_CONFIDENCE_MODELS);
export const OkrVisibilityDefaultEnum = z.enum(OKR_VISIBILITY_DEFAULTS);
export const OkrCycleStatusEnum = z.enum(OKR_CYCLE_STATUSES);
export const OkrSetScopeTypeEnum = z.enum(OKR_SET_SCOPE_TYPES);
export const OkrSetStatusEnum = z.enum(OKR_SET_STATUSES);
export const OkrSetAttentionStateEnum = z.enum(OKR_SET_ATTENTION_STATES);
export const OkrSetVersionFieldNameEnum = z.enum(OKR_SET_VERSION_FIELD_NAMES);
/** Same enum value set as `OkrVisibilityDefaultEnum` above
 * (`rvn_platform_visibility_policies.visibility_mode`) — a per-record
 * `narrowOkrSetVisibility` call targets the identical mode vocabulary the
 * Program's own `visibilityDefault` field uses. Declared as its own const
 * (not a re-export) matching this file's stated convention of not sharing
 * field helpers across concern boundaries within the same file family. */
export const OkrSetVisibilityModeEnum = z.enum(OKR_VISIBILITY_DEFAULTS);

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

// ==========================================
// OKR-E002 — Materialized Set (design §6)
// ==========================================

export const OkrSetIdParamsSchema = z.object({
  setId: z.string().uuid(),
});

const MAX_SCOPE_ID_CHARS = 200;
const MAX_CHANGE_NOTES_CHARS = 2000;

// ==========================================
// POST /api/vnext/results/okr/sets — createOkrSet
// ==========================================

export const CreateOkrSetSchema = z.object({
  programId: z.string().uuid(),
  cycleId: z.string().uuid(),
  scopeType: OkrSetScopeTypeEnum,
  // D4: TEXT, not UUID — for scope_type='company' the caller passes
  // organizationId explicitly (never server-defaulted); for 'business_unit'
  // an opaque caller-supplied identifier (D16); for 'team' a
  // team_members.team_id; for 'individual' a user id.
  scopeId: z.string().min(1).max(MAX_SCOPE_ID_CHARS),
  ownerUserId: z.string().min(1),
  reviewerUserId: z.string().min(1).nullable().optional(),
  title: z.string().min(1).max(MAX_NAME_CHARS),
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// GET /api/vnext/results/okr/sets — listOkrSets
// ==========================================

export const ListOkrSetsQuerySchema = z.object({
  cycleId: z.string().uuid().optional(),
  scopeType: OkrSetScopeTypeEnum.optional(),
  status: OkrSetStatusEnum.optional(),
  attentionState: OkrSetAttentionStateEnum.optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

// ==========================================
// GET /api/vnext/results/okr/company — listOkrSets filtered scope_type='company'
// ==========================================

export const ListOkrCompanySetsQuerySchema = z.object({
  cycleId: z.string().uuid().optional(),
  status: OkrSetStatusEnum.optional(),
  attentionState: OkrSetAttentionStateEnum.optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

// ==========================================
// PATCH /api/vnext/results/okr/sets/:setId/draft — updateOkrSetDraft
// ==========================================

export const UpdateOkrSetDraftSchema = z.object({
  expectedVersion: expectedVersionField,
  title: z.string().min(1).max(MAX_NAME_CHARS).optional(),
  ownerUserId: z.string().min(1).optional(),
  reviewerUserId: z.string().min(1).nullable().optional(),
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// PATCH /api/vnext/results/okr/sets/:setId/visibility — narrowOkrSetVisibility (D19)
// ==========================================

export const NarrowOkrSetVisibilitySchema = z.object({
  expectedVersion: expectedVersionField,
  visibilityMode: OkrSetVisibilityModeEnum,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST .../sets/:setId/{submit|approve|activate|cancel}
// ==========================================

export const OkrSetTransitionSchema = z.object({
  expectedVersion: expectedVersionField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST /api/vnext/results/okr/sets/:setId/request-changes — requestChangesOnOkrSet
// ==========================================

export const RequestChangesOnOkrSetSchema = z.object({
  expectedVersion: expectedVersionField,
  changeRequestNotes: z.string().min(1).max(MAX_CHANGE_NOTES_CHARS),
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST /api/vnext/results/okr/sets/:setId/request-revision — recordOkrSetMaterialChange
// ==========================================

export const RecordOkrSetMaterialChangeSchema = z.object({
  expectedVersion: expectedVersionField,
  fieldName: OkrSetVersionFieldNameEnum,
  afterValue: z.string().min(1).max(MAX_NAME_CHARS),
  reason: z.string().min(1).max(MAX_REASON_CHARS),
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// GET /api/vnext/results/okr/sets/:setId/approval-snapshots/:snapshotId
// ==========================================

export const OkrSetApprovalSnapshotIdParamsSchema = z.object({
  setId: z.string().uuid(),
  snapshotId: z.string().uuid(),
});

// ==========================================
// OKR-E003 — Objective & KeyResult (design §14)
// ==========================================

export const OkrObjectiveAmbitionTypeEnum = z.enum(OKR_OBJECTIVE_AMBITION_TYPES);
export const OkrObjectiveConfidenceEnum = z.enum(OKR_OBJECTIVE_CONFIDENCE_VALUES);
export const OkrKeyResultMeasurementTypeEnum = z.enum(OKR_KEY_RESULT_MEASUREMENT_TYPES);
export const OkrKeyResultDirectionEnum = z.enum(OKR_KEY_RESULT_DIRECTIONS);
export const OkrKeyResultStatusEnum = z.enum(OKR_KEY_RESULT_STATUSES);
export const OkrKeyResultSourceTypeEnum = z.enum(OKR_KEY_RESULT_SOURCE_TYPES);
export const OkrKeyResultConfidenceEnum = z.enum(OKR_KEY_RESULT_CONFIDENCE_VALUES);

const MAX_UNIT_CHARS = 100;
const MAX_CURRENCY_CHARS = 10;
const MAX_SOURCE_REFERENCE_CHARS = 500;

export const OkrObjectiveIdParamsSchema = z.object({
  objectiveId: z.string().uuid(),
});

export const OkrKeyResultIdParamsSchema = z.object({
  keyResultId: z.string().uuid(),
});

// ==========================================
// POST /api/vnext/results/okr/sets/:setId/objectives — createObjective
// ==========================================

export const CreateOkrObjectiveSchema = z.object({
  ownerUserId: z.string().min(1),
  title: z.string().min(1).max(MAX_NAME_CHARS),
  description: z.string().max(MAX_REASON_CHARS).nullable().optional(),
  rationale: z.string().max(MAX_REASON_CHARS).nullable().optional(),
  ambitionType: OkrObjectiveAmbitionTypeEnum.optional(),
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// PATCH /api/vnext/results/okr/objectives/:objectiveId — updateObjective
// ==========================================

export const UpdateOkrObjectiveSchema = z.object({
  expectedVersion: expectedVersionField,
  title: z.string().min(1).max(MAX_NAME_CHARS).optional(),
  description: z.string().max(MAX_REASON_CHARS).nullable().optional(),
  rationale: z.string().max(MAX_REASON_CHARS).nullable().optional(),
  ambitionType: OkrObjectiveAmbitionTypeEnum.optional(),
  ownerUserId: z.string().min(1).optional(),
  // D-E3-10: only accepted when the Cycle's pinned objective_confidence_model
  // is 'owner_selected' — the command layer rejects otherwise.
  confidence: OkrObjectiveConfidenceEnum.nullable().optional(),
  confidenceNumericValue: z.number().nullable().optional(),
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST .../objectives/:objectiveId/cancel — cancelObjective
// (maps the plan's DELETE /objectives/:objectiveId to a guarded status
// transition, per design §6/§10.4's soft-delete precedent)
// ==========================================

export const OkrObjectiveTransitionSchema = z.object({
  expectedVersion: expectedVersionField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST /api/vnext/results/okr/objectives/:objectiveId/key-results — createKeyResult
// ==========================================

export const CreateOkrKeyResultSchema = z
  .object({
    ownerUserId: z.string().min(1),
    title: z.string().min(1).max(MAX_NAME_CHARS),
    description: z.string().max(MAX_REASON_CHARS).nullable().optional(),
    measurementType: OkrKeyResultMeasurementTypeEnum,
    unit: z.string().max(MAX_UNIT_CHARS).nullable().optional(),
    currency: z.string().max(MAX_CURRENCY_CHARS).nullable().optional(),
    baselineValue: z.number().nullable().optional(),
    targetValue: z.number().nullable().optional(),
    startValue: z.number().nullable().optional(),
    currentValue: z.number().nullable().optional(),
    direction: OkrKeyResultDirectionEnum,
    rangeMin: z.number().nullable().optional(),
    rangeMax: z.number().nullable().optional(),
    confidence: OkrKeyResultConfidenceEnum.nullable().optional(),
    confidenceNumericValue: z.number().nullable().optional(),
    sourceType: OkrKeyResultSourceTypeEnum.optional(),
    // D09: opaque string only — never validated as a foreign key to any
    // kpi_*/rvn_kpi_*/initiative_kpis id.
    sourceReference: z.string().max(MAX_SOURCE_REFERENCE_CHARS).nullable().optional(),
    weight: z.number().nullable().optional(),
    reason: nullableReasonField,
    idempotencyKey: idempotencyKeyField,
  })
  .refine((body) => body.measurementType !== 'currency' || !!body.currency, {
    message: 'currency is required when measurementType is "currency"',
    path: ['currency'],
  })
  .refine((body) => body.direction !== 'maintain_range' || (body.rangeMin != null && body.rangeMax != null), {
    message: 'rangeMin and rangeMax are both required when direction is "maintain_range"',
    path: ['rangeMin'],
  });

// ==========================================
// PATCH /api/vnext/results/okr/key-results/:keyResultId — updateKeyResult
// ==========================================

export const UpdateOkrKeyResultSchema = z.object({
  expectedVersion: expectedVersionField,
  title: z.string().min(1).max(MAX_NAME_CHARS).optional(),
  description: z.string().max(MAX_REASON_CHARS).nullable().optional(),
  ownerUserId: z.string().min(1).optional(),
  measurementType: OkrKeyResultMeasurementTypeEnum.optional(),
  unit: z.string().max(MAX_UNIT_CHARS).nullable().optional(),
  currency: z.string().max(MAX_CURRENCY_CHARS).nullable().optional(),
  baselineValue: z.number().nullable().optional(),
  targetValue: z.number().nullable().optional(),
  startValue: z.number().nullable().optional(),
  currentValue: z.number().nullable().optional(),
  direction: OkrKeyResultDirectionEnum.optional(),
  rangeMin: z.number().nullable().optional(),
  rangeMax: z.number().nullable().optional(),
  confidence: OkrKeyResultConfidenceEnum.nullable().optional(),
  confidenceNumericValue: z.number().nullable().optional(),
  // §-IO item 9: owner-declared only. 'cancelled' excluded — that
  // transition is `cancelKeyResult`'s own guarded path, never a plain
  // field edit.
  status: OkrKeyResultStatusEnum.exclude(['cancelled']).optional(),
  sourceType: OkrKeyResultSourceTypeEnum.optional(),
  sourceReference: z.string().max(MAX_SOURCE_REFERENCE_CHARS).nullable().optional(),
  weight: z.number().nullable().optional(),
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST .../key-results/:keyResultId/cancel — cancelKeyResult
// (maps the plan's DELETE /key-results/:keyResultId)
// ==========================================

export const OkrKeyResultTransitionSchema = z.object({
  expectedVersion: expectedVersionField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// OKR-E004 — Check-ins
// ==========================================

export const OkrCheckInStatusEnum = z.enum(OKR_CHECKIN_STATUS_VALUES);
export const OkrCheckInConfidenceEnum = z.enum(OKR_CHECKIN_CONFIDENCE_VALUES);

const MAX_NOTE_CHARS = 4000;
const MAX_BLOCKER_CHARS = 2000;
const MAX_SUPPORT_REQUESTED_CHARS = 2000;
const MAX_CORRECTION_REASON_CHARS = 2000;

export const OkrCheckInIdParamsSchema = z.object({
  keyResultId: z.string().uuid(),
});

export const OkrCheckInIdWithCheckInParamsSchema = z.object({
  keyResultId: z.string().uuid(),
  checkinId: z.string().uuid(),
});

// ==========================================
// GET .../key-results/:keyResultId/check-ins — listCheckIns
// ==========================================

export const ListOkrCheckInsQuerySchema = z.object({
  currentOnly: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
});

// ==========================================
// POST .../key-results/:keyResultId/check-ins — recordCheckIn
// ==========================================

export const RecordOkrCheckInSchema = z
  .object({
    cadenceOccurrenceId: z.string().uuid(),
    newValue: z.number().nullable(),
    ownerDeclaredStatus: OkrCheckInStatusEnum.nullable().optional(),
    confidence: OkrCheckInConfidenceEnum.nullable().optional(),
    confidenceNumericValue: z.number().nullable().optional(),
    note: z.string().min(1).max(MAX_NOTE_CHARS),
    blocker: z.string().max(MAX_BLOCKER_CHARS).nullable().optional(),
    supportRequested: z.string().max(MAX_SUPPORT_REQUESTED_CHARS).nullable().optional(),
    evidenceRefs: z.array(z.unknown()).optional(),
    reason: nullableReasonField,
    idempotencyKey: idempotencyKeyField,
  })
  .refine((body) => body.confidence !== 'numeric' || body.confidenceNumericValue != null, {
    message: 'confidenceNumericValue is required when confidence is "numeric"',
    path: ['confidenceNumericValue'],
  });

// ==========================================
// POST .../key-results/:keyResultId/check-ins/:checkinId/correct — correctCheckIn
// ==========================================

export const CorrectOkrCheckInSchema = z
  .object({
    newValue: z.number().nullable().optional(),
    ownerDeclaredStatus: OkrCheckInStatusEnum.nullable().optional(),
    confidence: OkrCheckInConfidenceEnum.nullable().optional(),
    confidenceNumericValue: z.number().nullable().optional(),
    correctionReason: z.string().min(1).max(MAX_CORRECTION_REASON_CHARS),
    idempotencyKey: idempotencyKeyField,
  })
  .refine((body) => body.confidence !== 'numeric' || body.confidenceNumericValue != null, {
    message: 'confidenceNumericValue is required when confidence is "numeric"',
    path: ['confidenceNumericValue'],
  });

// ==========================================
// OKR-E005 — Alignment (design §A/§H)
// ==========================================

export const OkrAlignmentStatusEnum = z.enum(OKR_ALIGNMENT_STATUSES);

const MAX_RATIONALE_CHARS = 2000;
const MAX_RESPONSE_REASON_CHARS = 2000;

export const OkrAlignmentIdParamsSchema = z.object({
  alignmentId: z.string().uuid(),
});

// ==========================================
// POST /api/vnext/results/okr/objectives/:objectiveId/alignments — proposeAlignment
// ==========================================

export const ProposeOkrAlignmentSchema = z.object({
  targetObjectiveId: z.string().uuid(),
  rationale: z.string().max(MAX_RATIONALE_CHARS).nullable().optional(),
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST .../alignments/:alignmentId/accept — acceptAlignment
// ==========================================

export const AcceptOkrAlignmentSchema = z.object({
  expectedVersion: expectedVersionField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST .../alignments/:alignmentId/reject — rejectAlignment
// ==========================================

export const RejectOkrAlignmentSchema = z.object({
  expectedVersion: expectedVersionField,
  responseReason: z.string().max(MAX_RESPONSE_REASON_CHARS).nullable().optional(),
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// DELETE /api/vnext/results/okr/alignments/:alignmentId — removeAlignment
// (mapped to POST .../alignments/:alignmentId/remove, same DELETE-as-guarded
// -POST convention this router already uses for cancelObjective/
// cancelKeyResult)
// ==========================================

export const RemoveOkrAlignmentSchema = z.object({
  expectedVersion: expectedVersionField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// GET /api/vnext/results/okr/objectives/:objectiveId/alignments — listAlignmentsForObjective
// ==========================================

export const ListOkrAlignmentsForObjectiveQuerySchema = z.object({
  direction: z.enum(['outgoing', 'incoming']),
  status: OkrAlignmentStatusEnum.optional(),
});

// ==========================================
// GET /api/vnext/results/okr/objectives/:objectiveId/alignment-tree — getAlignmentTreeUnderObjective
// ==========================================

export const GetOkrAlignmentTreeQuerySchema = z.object({
  maxDepth: z.coerce.number().int().positive().max(50).optional(),
});

// ==========================================
// OKR-E007 — Review & Learning (design §-see OKR_E007_DESIGN.md §6)
// ==========================================

export const OkrReflectionDispositionEnum = z.enum(OKR_REFLECTION_DISPOSITIONS);
export const OkrReviewTypeEnum = z.enum(OKR_REVIEW_TYPES);
export const OkrReviewCommentLevelEnum = z.enum(OKR_REVIEW_COMMENT_LEVELS);

const MAX_REFLECTION_TEXT_CHARS = 4000;
const MAX_REVIEW_COMMENT_CHARS = 2000;

// ==========================================
// POST /api/vnext/results/okr/sets/:setId/open-review — openOkrSetReview
// POST /api/vnext/results/okr/sets/:setId/final-score — finalScoreOkrSet
// POST /api/vnext/results/okr/sets/:setId/close — closeOkrSet
// (all three: expectedVersion CAS on the Set's own row_version — same
// shape as OkrSetTransitionSchema, redeclared per this file's own stated
// convention of not sharing schema objects across unrelated endpoints even
// when structurally identical)
// ==========================================

export const OkrSetReviewLifecycleTransitionSchema = z.object({
  expectedVersion: expectedVersionField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST /api/vnext/results/okr/objectives/:objectiveId/reflection — recordObjectiveReflection
// ==========================================

export const RecordOkrObjectiveReflectionSchema = z.object({
  setId: z.string().uuid(),
  // 0 = create path (no reflection row exists yet for this Objective);
  // >=1 = CAS an existing row's own row_version. See
  // okrReflectionCommands.ts file header.
  expectedVersion: z.number().int().nonnegative(),
  whatWorked: z.string().max(MAX_REFLECTION_TEXT_CHARS).nullable().optional(),
  whatDidNotWork: z.string().max(MAX_REFLECTION_TEXT_CHARS).nullable().optional(),
  why: z.string().max(MAX_REFLECTION_TEXT_CHARS).nullable().optional(),
  learning: z.string().max(MAX_REFLECTION_TEXT_CHARS).nullable().optional(),
  nextCycleChange: z.string().max(MAX_REFLECTION_TEXT_CHARS).nullable().optional(),
  disposition: OkrReflectionDispositionEnum.nullable().optional(),
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST .../sets/:setId/reviews/self/submit — submitOkrSetSelfReview
// POST .../sets/:setId/reviews/manager/submit — submitOkrSetForManagerReview
// (both: 0 = create path, >=1 = CAS an existing row)
// ==========================================

export const SubmitOkrSetReviewSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST .../sets/:setId/reviews/manager/approve — approveOkrSetManagerReview
// ==========================================

export const ApproveOkrSetManagerReviewSchema = z.object({
  expectedVersion: expectedVersionField,
  outcome: z.string().max(MAX_NAME_CHARS).nullable().optional(),
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST .../sets/:setId/reviews/manager/request-changes — requestChangesOnOkrSetManagerReview
// ==========================================

export const RequestChangesOnOkrSetManagerReviewSchema = z.object({
  expectedVersion: expectedVersionField,
  changeRequestNotes: z.string().max(MAX_REASON_CHARS).nullable().optional(),
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST .../sets/:setId/reviews/:reviewType/comments — recordOkrSetReviewComment
// ==========================================

export const OkrReviewTypeParamsSchema = z.object({
  setId: z.string().uuid(),
  reviewType: OkrReviewTypeEnum,
});

export const RecordOkrSetReviewCommentSchema = z.object({
  expectedVersion: expectedVersionField,
  level: OkrReviewCommentLevelEnum,
  targetId: z.string().min(1).max(MAX_NAME_CHARS),
  text: z.string().min(1).max(MAX_REVIEW_COMMENT_CHARS),
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST /api/vnext/results/okr/sets/:setId/carry-forward — carryForwardOkrSet
// ==========================================

export const CarryForwardOkrSetSchema = z.object({
  targetCycleId: z.string().uuid(),
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// GET /api/vnext/results/okr/sets/:setId/history — getOkrSetHistory
// ==========================================

export const GetOkrSetHistoryQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});
