/**
 * V8 MyWork Roof Package — Core Type Family
 *
 * WP-W7-ROOF-01: Cross-surface state propagation, Home block maturity,
 * Inbox materialization, and Calendar hardening phasing.
 *
 * Decision W7-1: One canonical object state across all MyWork surfaces.
 * Decision W7-2: Explicit maturity classification for all 8 Home blocks.
 * Decision W7-3: Event-driven Inbox materialization with latency bands.
 * Decision W7-4: Calendar hardening split into Phase A (internal) / Phase B (external sync).
 */

import { z } from 'zod';

const ContextIdSchema = z.string().min(1);

// ==========================================
// ENUMS / LITERALS
// ==========================================

export const MyWorkSurfaceValues = ['home', 'calendar', 'inbox', 'radar'] as const;
export type MyWorkSurface = (typeof MyWorkSurfaceValues)[number];

export const CanonicalObjectTypeValues = [
  'task',
  'decision',
  'initiative',
  'milestone',
  'approval',
  'ai_proposal',
  'notification',
  'signal',
  // RN-G1 Platform Foundation extension (2026-08-09) — see
  // docs/product/results-vnext/RN_G1_PLATFORM_DESIGN.md §C.1/§C.3 and
  // server/migrations/20260809_rvn_platform_canonical_object_type_extend.sql.
  // Appended, never reordered/removed relative to the values above. This is
  // also the SSOT list RVN_RESOURCE_TYPES in
  // server/src/services/resultsVnext/platform/resourceTypes.ts must stay in
  // sync with (that file re-declares these 4 rather than importing from
  // here, to avoid a runtime dependency from myWorkRoofPackage.ts back into
  // resultsVnext/platform).
  'kpi',
  'roi_case',
  'okr_set',
  'deviation_case',
  // KPI-E004 (docs/product/results-vnext/KPI_E004_DESIGN.md prerequisite) —
  // appended, never reordered/removed relative to the values above. Stays in
  // sync with RVN_RESOURCE_TYPES in
  // server/src/services/resultsVnext/platform/resourceTypes.ts (same
  // duplication rationale as the RN-G1 block above).
  'kpi_scorecard',
] as const;
export type CanonicalObjectType = (typeof CanonicalObjectTypeValues)[number];

export const MaturityLevelValues = [
  'backed_by_real_service',
  'partial_stitched',
  'placeholder_non_canonical',
] as const;
export type MaturityLevel = (typeof MaturityLevelValues)[number];

export const LatencyBandValues = ['near_realtime', 'operational', 'degraded'] as const;
export type LatencyBand = (typeof LatencyBandValues)[number];

export const CalendarPhaseNameValues = ['phase_a_internal', 'phase_b_external_sync'] as const;
export type CalendarPhaseName = (typeof CalendarPhaseNameValues)[number];

export const CalendarPhaseStatusValues = ['active', 'completed', 'blocked'] as const;
export type CalendarPhaseStatus = (typeof CalendarPhaseStatusValues)[number];

export const HomeBlockNameValues = [
  'aiPulseCore',
  'momentum',
  'sparkField',
  'decisionTemperature',
  'industryLens',
  'executionCurrent',
  'teamSignal',
  'commandDock',
] as const;
export type HomeBlockName = (typeof HomeBlockNameValues)[number];

// ==========================================
// LATENCY BAND THRESHOLDS (Decision W7-3)
// ==========================================

export const LATENCY_BAND_THRESHOLDS = {
  near_realtime: 5_000,
  operational: 60_000,
} as const;

export function classifyLatencyBand(latencyMs: number): LatencyBand {
  if (latencyMs <= LATENCY_BAND_THRESHOLDS.near_realtime) return 'near_realtime';
  if (latencyMs <= LATENCY_BAND_THRESHOLDS.operational) return 'operational';
  return 'degraded';
}

// ==========================================
// INTERFACES
// ==========================================

/** Decision W7-1: How a surface renders canonical state. */
export interface SurfaceProjection {
  surface: MyWorkSurface;
  displayState: string;
  isStale: boolean;
  lastRefreshedAt: string;
}

/** Decision W7-1: One canonical object state across all surfaces. */
export interface CanonicalObjectState {
  objectId: string;
  objectType: CanonicalObjectType;
  organizationId: string;
  canonicalState: string;
  lastUpdatedAt: string;
  surfaceProjections: Record<string, SurfaceProjection>;
}

/** Decision W7-2: Block maturity classification. */
export interface HomeBlockMaturity {
  blockId: string;
  blockName: HomeBlockName;
  organizationId: string;
  maturityLevel: MaturityLevel;
  serviceRef: string | null;
  lastAuditedAt: string;
}

/** Decision W7-3: Inbox materialization tracking. */
export interface InboxMaterialization {
  materializationId: string;
  eventSourceRef: string;
  inboxItemId: string;
  userId: string;
  organizationId: string;
  materializedAt: string;
  latencyMs: number;
  latencyBand: LatencyBand;
}

/** Decision W7-4: Calendar hardening phase. */
export interface CalendarPhase {
  phaseId: string;
  phaseName: CalendarPhaseName;
  organizationId: string;
  status: CalendarPhaseStatus;
  blockedBy: string | null;
}

// ==========================================
// ZOD SCHEMAS — DOMAIN OBJECTS
// ==========================================

export const SurfaceProjectionSchema = z.object({
  surface: z.enum(MyWorkSurfaceValues),
  displayState: z.string().min(1),
  isStale: z.boolean(),
  lastRefreshedAt: z.string().min(1),
});

export const CanonicalObjectStateSchema = z.object({
  objectId: z.string().uuid(),
  objectType: z.enum(CanonicalObjectTypeValues),
  organizationId: ContextIdSchema,
  canonicalState: z.string().min(1),
  lastUpdatedAt: z.string().min(1),
  surfaceProjections: z.record(z.string(), SurfaceProjectionSchema),
});

export const HomeBlockMaturitySchema = z.object({
  blockId: z.string().uuid(),
  blockName: z.enum(HomeBlockNameValues),
  organizationId: ContextIdSchema,
  maturityLevel: z.enum(MaturityLevelValues),
  serviceRef: z.string().nullable(),
  lastAuditedAt: z.string().min(1),
});

export const InboxMaterializationSchema = z.object({
  materializationId: z.string().uuid(),
  eventSourceRef: z.string().min(1),
  inboxItemId: z.string().min(1),
  userId: ContextIdSchema,
  organizationId: ContextIdSchema,
  materializedAt: z.string().min(1),
  latencyMs: z.number().nonnegative(),
  latencyBand: z.enum(LatencyBandValues),
});

export const CalendarPhaseSchema = z.object({
  phaseId: z.string().uuid(),
  phaseName: z.enum(CalendarPhaseNameValues),
  organizationId: ContextIdSchema,
  status: z.enum(CalendarPhaseStatusValues),
  blockedBy: z.string().nullable(),
});

// ==========================================
// INPUT TYPES (for service layer)
// ==========================================

export interface SetCanonicalObjectStateParams {
  objectId: string;
  objectType: CanonicalObjectType;
  organizationId: string;
  canonicalState: string;
  surfaceProjections?: Record<string, SurfaceProjection>;
}

export const SetCanonicalObjectStateParamsSchema = z.object({
  objectId: z.string().uuid(),
  objectType: z.enum(CanonicalObjectTypeValues),
  organizationId: ContextIdSchema,
  canonicalState: z.string().min(1),
  surfaceProjections: z.record(z.string(), SurfaceProjectionSchema).optional().default({}),
});

export interface ClassifyHomeBlockParams {
  blockName: HomeBlockName;
  organizationId: string;
  maturityLevel: MaturityLevel;
  serviceRef?: string | null;
}

export const ClassifyHomeBlockParamsSchema = z.object({
  blockName: z.enum(HomeBlockNameValues),
  organizationId: ContextIdSchema,
  maturityLevel: z.enum(MaturityLevelValues),
  serviceRef: z.string().nullable().optional().default(null),
});

export interface RecordInboxMaterializationParams {
  eventSourceRef: string;
  inboxItemId: string;
  userId: string;
  organizationId: string;
  latencyMs: number;
}

export const RecordInboxMaterializationParamsSchema = z.object({
  eventSourceRef: z.string().min(1),
  inboxItemId: z.string().min(1),
  userId: ContextIdSchema,
  organizationId: ContextIdSchema,
  latencyMs: z.number().nonnegative(),
});

export interface SetCalendarPhaseParams {
  phaseName: CalendarPhaseName;
  organizationId: string;
  status: CalendarPhaseStatus;
  blockedBy?: string | null;
}

export const SetCalendarPhaseParamsSchema = z.object({
  phaseName: z.enum(CalendarPhaseNameValues),
  organizationId: ContextIdSchema,
  status: z.enum(CalendarPhaseStatusValues),
  blockedBy: z.string().nullable().optional().default(null),
});

export interface UpdateSurfaceProjectionParams {
  objectId: string;
  organizationId: string;
  surface: MyWorkSurface;
  displayState: string;
  isStale: boolean;
}

export const UpdateSurfaceProjectionParamsSchema = z.object({
  objectId: z.string().uuid(),
  organizationId: ContextIdSchema,
  surface: z.enum(MyWorkSurfaceValues),
  displayState: z.string().min(1),
  isStale: z.boolean(),
});

// ==========================================
// STATS TYPES
// ==========================================

export interface InboxMaterializationStats {
  avgLatencyMs: number;
  latencyBandDistribution: Record<LatencyBand, number>;
}
