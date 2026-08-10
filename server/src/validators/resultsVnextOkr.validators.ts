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
  OKR_SET_ATTENTION_STATES,
  OKR_SET_SCOPE_TYPES,
  OKR_SET_STATUSES,
  OKR_SET_VERSION_FIELD_NAMES,
} from '../services/resultsVnext/okr/okrSetTypes.js';

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
