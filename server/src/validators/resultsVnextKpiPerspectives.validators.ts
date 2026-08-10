/**
 * KPI-E005 Perspectives & Links API layer — Zod request-shape validators.
 *
 * Design: docs/product/results-vnext/KPI_E005_DESIGN.md §A (My KPIs), §B
 * (Organization/manager view), §C.3 (InitiativeKPIImpact commands).
 *
 * Style precedent: `resultsVnextKpiScorecard.validators.ts` /
 * `resultsVnextKpiDeviation.validators.ts` — same field helpers
 * (`idempotencyKeyField`/`nullableReasonField`/`nullableShortStringField`/
 * `nullableNumberField`/`expectedVersionField`/`isoDateTimeString`),
 * re-declared locally rather than imported since neither sibling file
 * exports them.
 *
 * `KpiIdParamsSchema` is intentionally NOT re-imported from
 * `resultsVnextKpi.validators.ts` — same convention every sibling validator
 * file in this directory already follows (re-declare, don't cross-import).
 */
import { z } from 'zod';

import {
  INITIATIVE_KPI_IMPACT_DIRECTIONS,
  INITIATIVE_KPI_IMPACT_STATUSES,
} from '../services/resultsVnext/kpi/kpiInitiativeImpactTypes.js';

export const InitiativeKpiImpactDirectionEnum = z.enum(INITIATIVE_KPI_IMPACT_DIRECTIONS);
export const InitiativeKpiImpactStatusEnum = z.enum(INITIATIVE_KPI_IMPACT_STATUSES);

const MAX_IDEMPOTENCY_KEY_CHARS = 200;
const MAX_REASON_CHARS = 2000;
const MAX_SHORT_ID_CHARS = 200;

/** Same rationale/shape as `resultsVnextKpi.validators.ts`'s own
 * `isoDateTimeString` — a cheap pre-check so a malformed date/timestamp 400s
 * here instead of surfacing as a raw Postgres error deeper in the stack.
 * Used for `targetCompletionDate` (a `DATE` column — any string
 * `Date.parse` accepts is fine at this layer). */
const isoDateTimeString = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: 'must be a valid ISO 8601 date/time string',
});

const idempotencyKeyField = z.string().min(1).max(MAX_IDEMPOTENCY_KEY_CHARS).optional();
const nullableReasonField = z.string().max(MAX_REASON_CHARS).nullable().optional();
const nullableNumberField = z.number().finite().nullable().optional();

const expectedVersionField = z.number().int().nonnegative();

// ==========================================
// PATH PARAMS
// ==========================================

export const KpiIdParamsSchema = z.object({
  kpiId: z.string().uuid(),
});

export const ImpactIdParamsSchema = z.object({
  impactId: z.string().uuid(),
});

/** `initiatives.id` (legacy module) is `TEXT`, not a UUID — see design §C
 * ("only initiatives.id ... is a valid FK target", `migrations-v2/
 * 001_baseline_20260413.sql:15856`, TEXT). Do not tighten this to
 * `.uuid()`. */
export const InitiativeIdParamsSchema = z.object({
  initiativeId: z.string().min(1).max(MAX_SHORT_ID_CHARS),
});

// ==========================================
// GET /api/vnext/results/kpi/my — listMyKpis
// ==========================================

export const ListMyKpisQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(500).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

// ==========================================
// GET /api/vnext/results/kpi/attention — listOrganizationKpiAttention
// ==========================================

export const ListOrganizationKpiAttentionQuerySchema = z.object({
  includeSelf: z.coerce.boolean().optional(),
  recurrenceWindowDays: z.coerce.number().int().positive().max(3650).optional(),
});

// ==========================================
// POST /api/vnext/results/kpi/initiative-impacts — proposeInitiativeKpiImpact
// ==========================================

export const ProposeInitiativeKpiImpactSchema = z.object({
  kpiId: z.string().uuid(),
  initiativeId: z.string().min(1).max(MAX_SHORT_ID_CHARS),
  expectedContributionValue: nullableNumberField,
  expectedContributionDirection: InitiativeKpiImpactDirectionEnum.nullable().optional(),
  targetCompletionDate: isoDateTimeString.nullable().optional(),
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST .../initiative-impacts/:impactId/commit — commitInitiativeKpiImpact
// ==========================================

export const CommitInitiativeKpiImpactSchema = z.object({
  expectedVersion: expectedVersionField,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST .../initiative-impacts/:impactId/review — recordReviewedAttribution
// ==========================================

export const RecordReviewedAttributionSchema = z.object({
  expectedVersion: expectedVersionField,
  reviewedAttributionValue: z.number().finite(),
  reviewedAttributionMeasurementId: z.string().uuid().nullable().optional(),
  reviewRationale: z.string().min(1).max(MAX_REASON_CHARS),
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// POST .../initiative-impacts/:impactId/supersede — supersedeInitiativeKpiImpact
// ==========================================

/** The "content" fields of the replacement proposal — `organizationId`/
 * `kpiId`/`initiativeId`/`proposedBy`/`actorEffectiveRole`/`idempotencyKey`/
 * `correlationId`/`causationId` are all derived server-side from the
 * superseded row + the authenticated actor, same division of "client
 * supplies content, server supplies identity/provenance" as every other
 * write endpoint in this file. */
export const SupersedeInitiativeKpiImpactReplacementSchema = z.object({
  expectedContributionValue: nullableNumberField,
  expectedContributionDirection: InitiativeKpiImpactDirectionEnum.nullable().optional(),
  targetCompletionDate: isoDateTimeString.nullable().optional(),
});

export const SupersedeInitiativeKpiImpactSchema = z.object({
  expectedVersion: expectedVersionField,
  replacement: SupersedeInitiativeKpiImpactReplacementSchema,
  reason: nullableReasonField,
  idempotencyKey: idempotencyKeyField,
});

// ==========================================
// GET .../kpi/:kpiId/initiative-impacts — listInitiativeImpactsForKpi
// GET .../initiatives/:initiativeId/kpi-impacts — listKpiImpactsForInitiative
// ==========================================

export const ListImpactsQuerySchema = z.object({
  status: InitiativeKpiImpactStatusEnum.optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});
