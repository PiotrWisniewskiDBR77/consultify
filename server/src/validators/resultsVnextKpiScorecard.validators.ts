/**
 * KPI-E004 Scorecards API layer — Zod request-shape validators.
 *
 * Design: docs/product/results-vnext/KPI_E004_DESIGN.md §A (enums, mirrored
 * 1:1 from `kpiScorecardTypes.ts`'s CHECK-constraint arrays via
 * `z.enum(...)`) / §B/§C (command inputs — one schema per endpoint body/
 * query/params shape).
 *
 * Style precedent: `server/src/validators/resultsVnextKpiDeviation.validators.ts`
 * (this file's sibling for the KPI-E003 surface) — same field helpers
 * (`idempotencyKeyField`/`nullableReasonField`/`nullableShortStringField`/
 * `expectedVersionField`/`isoDateTimeString`), re-declared locally rather
 * than imported since the sibling file does not export them either.
 */
import { z } from 'zod';

import {
  KPI_SCORECARD_ITEM_ROLES,
  KPI_SCORECARD_LIFECYCLE_STATUSES,
  KPI_SCORECARD_REVIEW_FREQUENCIES,
  KPI_SCORECARD_SCOPE_TYPES,
  KPI_SCORECARD_SNAPSHOT_STATUSES,
} from '../services/resultsVnext/kpi/kpiScorecardTypes.js';

export const KpiScorecardScopeTypeEnum = z.enum(KPI_SCORECARD_SCOPE_TYPES);
export const KpiScorecardReviewFrequencyEnum = z.enum(KPI_SCORECARD_REVIEW_FREQUENCIES);
export const KpiScorecardLifecycleStatusEnum = z.enum(KPI_SCORECARD_LIFECYCLE_STATUSES);
export const KpiScorecardItemRoleEnum = z.enum(KPI_SCORECARD_ITEM_ROLES);
export const KpiScorecardSnapshotStatusEnum = z.enum(KPI_SCORECARD_SNAPSHOT_STATUSES);

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

const idempotencyKeyField = z.string().min(1).max(MAX_IDEMPOTENCY_KEY_CHARS).optional();
const nullableReasonField = z.string().max(MAX_REASON_CHARS).nullable().optional();
const nullableShortStringField = z.string().max(MAX_SHORT_ID_CHARS).nullable().optional();

const expectedVersionField = z.number().int().nonnegative();

// ==========================================
// PATH PARAMS
// ==========================================

export const ScorecardIdParamsSchema = z.object({
  scorecardId: z.string().uuid(),
});

export const ScorecardItemIdParamsSchema = z.object({
  scorecardId: z.string().uuid(),
  itemId: z.string().uuid(),
});

export const ScorecardSnapshotIdParamsSchema = z.object({
  scorecardId: z.string().uuid(),
  snapshotId: z.string().uuid(),
});

// ==========================================
// POST /api/vnext/results/kpi/scorecards — createScorecard
// ==========================================

export const CreateScorecardSchema = z.object({
  name: z.string().min(1).max(MAX_NAME_CHARS),
  description: nullableReasonField,
  scopeType: KpiScorecardScopeTypeEnum,
  scopeId: nullableShortStringField,
  ownerUserId: nullableShortStringField,
  reviewFrequency: KpiScorecardReviewFrequencyEnum,
  /** Only meaningful when the active `'kpi'`-domain visibility policy's
   * `default_scope_type` needs a concrete target — same minimal surface
   * `createScorecard`'s own `sensitivity` param documents (mirrors
   * `CreateKpiDraftSchema`'s `sensitivity`). */
  sensitivity: nullableShortStringField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// GET /api/vnext/results/kpi/scorecards — listScorecards
// ==========================================

export const ListScorecardsQuerySchema = z.object({
  lifecycleStatus: KpiScorecardLifecycleStatusEnum.optional(),
  ownerUserId: z.string().min(1).max(MAX_SHORT_ID_CHARS).optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

// ==========================================
// POST /api/vnext/results/kpi/scorecards/:scorecardId/items — addScorecardItem
// ==========================================

export const AddScorecardItemSchema = z.object({
  expectedVersion: expectedVersionField,
  kpiId: z.string().uuid(),
  role: KpiScorecardItemRoleEnum.optional(),
  sortOrder: z.number().int().optional(),
  displayConfig: z.record(z.string(), z.unknown()).nullable().optional(),
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// DELETE .../items/:itemId — removeScorecardItem
// ==========================================

export const RemoveScorecardItemSchema = z.object({
  expectedVersion: expectedVersionField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// PATCH .../items/reorder — reorderScorecardItems (decision #4: item `role`
// change folded in here — no separate endpoint)
// ==========================================

export const ReorderScorecardItemSpecSchema = z.object({
  itemId: z.string().uuid(),
  sortOrder: z.number().int(),
  role: KpiScorecardItemRoleEnum.optional(),
});

export const ReorderScorecardItemsSchema = z.object({
  expectedVersion: expectedVersionField,
  items: z.array(ReorderScorecardItemSpecSchema).min(1),
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// GET .../status — getScorecardStatusDistribution
// ==========================================

export const ScorecardStatusQuerySchema = z.object({
  asOf: isoDateTimeString.optional(),
});

// ==========================================
// POST .../activate | .../suspend | .../archive — shared "CAS + reason"
// shape, same convention as resultsVnextKpi.validators.ts's
// `KpiLifecycleActionSchema` being reused across activate/suspend/archive.
// ==========================================

export const ScorecardLifecycleActionSchema = z.object({
  expectedVersion: expectedVersionField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST .../review-snapshots — createReviewSnapshot (executeAtomicCreate, no
// expectedVersion — a new draft row, not a CAS'd mutation of an existing one)
// ==========================================

export const CreateReviewSnapshotSchema = z.object({
  reviewPeriodStart: isoDateTimeString,
  reviewPeriodEnd: isoDateTimeString,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// GET .../review-snapshots — listReviewSnapshots
// ==========================================

export const ListReviewSnapshotsQuerySchema = z.object({
  status: KpiScorecardSnapshotStatusEnum.optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

// ==========================================
// POST .../review-snapshots/:snapshotId/publish — publishReviewSnapshot
// ==========================================

export const PublishReviewSnapshotSchema = z.object({
  expectedVersion: expectedVersionField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});
