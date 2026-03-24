/**
 * V8 MyWork Roof Package Service
 *
 * WP-W7-ROOF-01: Cross-surface state propagation, Home block maturity
 * classification, Inbox materialization tracking, Calendar hardening phasing.
 *
 * Decision W7-1: One canonical object state across all MyWork surfaces.
 * Decision W7-2: Explicit maturity classification for all 8 Home blocks.
 * Decision W7-3: Event-driven Inbox materialization with latency bands.
 * Decision W7-4: Calendar hardening split into Phase A / Phase B.
 */

import { v4 as uuidv4 } from 'uuid';

import type {
  CanonicalObjectState,
  SurfaceProjection,
  HomeBlockMaturity,
  InboxMaterialization,
  InboxMaterializationStats,
  CalendarPhase,
  MyWorkSurface,
  LatencyBand,
  SetCanonicalObjectStateParams,
  ClassifyHomeBlockParams,
  RecordInboxMaterializationParams,
  SetCalendarPhaseParams,
  UpdateSurfaceProjectionParams,
} from '../../types/myWorkRoofPackage.js';
import {
  SetCanonicalObjectStateParamsSchema,
  ClassifyHomeBlockParamsSchema,
  RecordInboxMaterializationParamsSchema,
  SetCalendarPhaseParamsSchema,
  UpdateSurfaceProjectionParamsSchema,
  classifyLatencyBand,
} from '../../types/myWorkRoofPackage.js';
import { all as dbAll, run as dbRun, get as dbGet } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

// ==========================================
// HELPERS
// ==========================================

const LOG_PREFIX = '[V8:MyWorkRoof]';

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    logger.warn(`${LOG_PREFIX} Failed to parse JSON, using fallback`);
    return fallback;
  }
}

// ==========================================
// ROW TYPES
// ==========================================

interface CanonicalObjectStateRow {
  object_id: string;
  object_type: string;
  organization_id: string;
  canonical_state: string;
  last_updated_at: string;
  surface_projections: string;
}

interface HomeBlockMaturityRow {
  block_id: string;
  block_name: string;
  organization_id: string;
  maturity_level: string;
  service_ref: string | null;
  last_audited_at: string;
}

interface InboxMaterializationRow {
  materialization_id: string;
  event_source_ref: string;
  inbox_item_id: string;
  user_id: string;
  organization_id: string;
  materialized_at: string;
  latency_ms: number;
  latency_band: string;
}

interface CalendarPhaseRow {
  phase_id: string;
  phase_name: string;
  organization_id: string;
  status: string;
  blocked_by: string | null;
}

interface AvgLatencyRow {
  avg_latency: number | string | null;
}

interface BandCountRow {
  latency_band: string;
  cnt: number | string;
}

// ==========================================
// ROW MAPPERS
// ==========================================

function rowToCanonicalObjectState(row: CanonicalObjectStateRow): CanonicalObjectState {
  return {
    objectId: row.object_id,
    objectType: row.object_type as CanonicalObjectState['objectType'],
    organizationId: row.organization_id,
    canonicalState: row.canonical_state,
    lastUpdatedAt: row.last_updated_at,
    surfaceProjections: safeJsonParse<Record<string, SurfaceProjection>>(
      row.surface_projections,
      {},
    ),
  };
}

function rowToHomeBlockMaturity(row: HomeBlockMaturityRow): HomeBlockMaturity {
  return {
    blockId: row.block_id,
    blockName: row.block_name as HomeBlockMaturity['blockName'],
    organizationId: row.organization_id,
    maturityLevel: row.maturity_level as HomeBlockMaturity['maturityLevel'],
    serviceRef: row.service_ref,
    lastAuditedAt: row.last_audited_at,
  };
}

function rowToInboxMaterialization(row: InboxMaterializationRow): InboxMaterialization {
  return {
    materializationId: row.materialization_id,
    eventSourceRef: row.event_source_ref,
    inboxItemId: row.inbox_item_id,
    userId: row.user_id,
    organizationId: row.organization_id,
    materializedAt: row.materialized_at,
    latencyMs: row.latency_ms,
    latencyBand: row.latency_band as InboxMaterialization['latencyBand'],
  };
}

function rowToCalendarPhase(row: CalendarPhaseRow): CalendarPhase {
  return {
    phaseId: row.phase_id,
    phaseName: row.phase_name as CalendarPhase['phaseName'],
    organizationId: row.organization_id,
    status: row.status as CalendarPhase['status'],
    blockedBy: row.blocked_by,
  };
}

// ==========================================
// PUBLIC API — Cross-Surface State (Decision W7-1)
// ==========================================

/**
 * Set or update the canonical object state. Upserts by (objectId, organizationId).
 * Surfaces may show different projections, but never different truths.
 */
export async function setCanonicalObjectState(
  params: SetCanonicalObjectStateParams,
): Promise<CanonicalObjectState> {
  const validated = SetCanonicalObjectStateParamsSchema.parse(params);
  const now = new Date().toISOString();

  const state: CanonicalObjectState = {
    objectId: validated.objectId,
    objectType: validated.objectType,
    organizationId: validated.organizationId,
    canonicalState: validated.canonicalState,
    lastUpdatedAt: now,
    surfaceProjections: validated.surfaceProjections ?? {},
  };

  await dbRun(
    `INSERT INTO v8_canonical_object_states (
      object_id, object_type, organization_id, canonical_state,
      last_updated_at, surface_projections
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (object_id, organization_id) DO UPDATE SET
      object_type = excluded.object_type,
      canonical_state = excluded.canonical_state,
      last_updated_at = excluded.last_updated_at,
      surface_projections = excluded.surface_projections`,
    [
      state.objectId,
      state.objectType,
      state.organizationId,
      state.canonicalState,
      state.lastUpdatedAt,
      JSON.stringify(state.surfaceProjections),
    ],
  );

  logger.info(
    `${LOG_PREFIX} Set canonical state for ${state.objectType}:${state.objectId} → ${state.canonicalState}`,
  );
  return state;
}

/**
 * Get the canonical object state by objectId within an org.
 */
export async function getCanonicalObjectState(
  objectId: string,
  organizationId: string,
): Promise<CanonicalObjectState | null> {
  const row = await dbGet<CanonicalObjectStateRow>(
    `SELECT * FROM v8_canonical_object_states
     WHERE object_id = ? AND organization_id = ?`,
    [objectId, organizationId],
  );

  return row ? rowToCanonicalObjectState(row) : null;
}

/**
 * Get the surface projection for a specific object on a specific surface.
 * Returns null if the object doesn't exist or has no projection for that surface.
 */
export async function getSurfaceProjection(
  objectId: string,
  surface: MyWorkSurface,
  organizationId: string,
): Promise<SurfaceProjection | null> {
  const state = await getCanonicalObjectState(objectId, organizationId);
  if (!state) return null;
  return state.surfaceProjections[surface] ?? null;
}

/**
 * Update a single surface projection on an existing canonical object state.
 * Creates the projection entry within the JSON map; preserves other projections.
 */
export async function updateSurfaceProjection(
  params: UpdateSurfaceProjectionParams,
): Promise<CanonicalObjectState | null> {
  const validated = UpdateSurfaceProjectionParamsSchema.parse(params);
  const now = new Date().toISOString();

  const existing = await getCanonicalObjectState(validated.objectId, validated.organizationId);
  if (!existing) return null;

  const projection: SurfaceProjection = {
    surface: validated.surface,
    displayState: validated.displayState,
    isStale: validated.isStale,
    lastRefreshedAt: now,
  };

  const updatedProjections = {
    ...existing.surfaceProjections,
    [validated.surface]: projection,
  };

  await dbRun(
    `UPDATE v8_canonical_object_states
     SET surface_projections = ?, last_updated_at = ?
     WHERE object_id = ? AND organization_id = ?`,
    [
      JSON.stringify(updatedProjections),
      now,
      validated.objectId,
      validated.organizationId,
    ],
  );

  logger.info(
    `${LOG_PREFIX} Updated projection for ${validated.objectId} on surface ${validated.surface}`,
  );

  return {
    ...existing,
    surfaceProjections: updatedProjections,
    lastUpdatedAt: now,
  };
}

// ==========================================
// PUBLIC API — Home Block Maturity (Decision W7-2)
// ==========================================

/**
 * Classify a Home block's maturity level. Upserts by (blockName, organizationId).
 * Rule: "Home may stay heterogeneous temporarily, but truth labels must be explicit."
 */
export async function classifyHomeBlock(
  params: ClassifyHomeBlockParams,
): Promise<HomeBlockMaturity> {
  const validated = ClassifyHomeBlockParamsSchema.parse(params);
  const blockId = uuidv4();
  const now = new Date().toISOString();

  const maturity: HomeBlockMaturity = {
    blockId,
    blockName: validated.blockName,
    organizationId: validated.organizationId,
    maturityLevel: validated.maturityLevel,
    serviceRef: validated.serviceRef ?? null,
    lastAuditedAt: now,
  };

  await dbRun(
    `INSERT INTO v8_home_block_maturity (
      block_id, block_name, organization_id, maturity_level,
      service_ref, last_audited_at
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (block_name, organization_id) DO UPDATE SET
      maturity_level = excluded.maturity_level,
      service_ref = excluded.service_ref,
      last_audited_at = excluded.last_audited_at`,
    [
      maturity.blockId,
      maturity.blockName,
      maturity.organizationId,
      maturity.maturityLevel,
      maturity.serviceRef,
      maturity.lastAuditedAt,
    ],
  );

  logger.info(
    `${LOG_PREFIX} Classified block ${maturity.blockName} → ${maturity.maturityLevel}`,
  );
  return maturity;
}

/**
 * Get maturity classification for all Home blocks in an org.
 */
export async function getHomeBlockMaturity(
  organizationId: string,
): Promise<HomeBlockMaturity[]> {
  const rows = await dbAll<HomeBlockMaturityRow>(
    `SELECT * FROM v8_home_block_maturity
     WHERE organization_id = ?
     ORDER BY block_name ASC`,
    [organizationId],
    { fallback: true },
  );

  return (rows || []).map(rowToHomeBlockMaturity);
}

// ==========================================
// PUBLIC API — Inbox Materialization (Decision W7-3)
// ==========================================

/**
 * Record an inbox materialization event with auto-classified latency band.
 * Baseline: near-realtime ≤ 5s, operational ≤ 60s, degraded > 60s.
 */
export async function recordInboxMaterialization(
  params: RecordInboxMaterializationParams,
): Promise<InboxMaterialization> {
  const validated = RecordInboxMaterializationParamsSchema.parse(params);
  const materializationId = uuidv4();
  const now = new Date().toISOString();
  const latencyBand = classifyLatencyBand(validated.latencyMs);

  const materialization: InboxMaterialization = {
    materializationId,
    eventSourceRef: validated.eventSourceRef,
    inboxItemId: validated.inboxItemId,
    userId: validated.userId,
    organizationId: validated.organizationId,
    materializedAt: now,
    latencyMs: validated.latencyMs,
    latencyBand,
  };

  await dbRun(
    `INSERT INTO v8_inbox_materializations (
      materialization_id, event_source_ref, inbox_item_id, user_id,
      organization_id, materialized_at, latency_ms, latency_band
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      materialization.materializationId,
      materialization.eventSourceRef,
      materialization.inboxItemId,
      materialization.userId,
      materialization.organizationId,
      materialization.materializedAt,
      materialization.latencyMs,
      materialization.latencyBand,
    ],
  );

  logger.info(
    `${LOG_PREFIX} Recorded inbox materialization ${materializationId} [${latencyBand}] latency=${validated.latencyMs}ms`,
  );
  return materialization;
}

/**
 * Get materialization stats for a user within an org:
 * average latency and latency band distribution.
 */
export async function getInboxMaterializationStats(
  userId: string,
  organizationId: string,
): Promise<InboxMaterializationStats> {
  const avgRow = await dbGet<AvgLatencyRow>(
    `SELECT AVG(latency_ms) as avg_latency
     FROM v8_inbox_materializations
     WHERE user_id = ? AND organization_id = ?`,
    [userId, organizationId],
  );

  const bandRows = await dbAll<BandCountRow>(
    `SELECT latency_band, COUNT(*) as cnt
     FROM v8_inbox_materializations
     WHERE user_id = ? AND organization_id = ?
     GROUP BY latency_band`,
    [userId, organizationId],
    { fallback: true },
  );

  const distribution: Record<LatencyBand, number> = {
    near_realtime: 0,
    operational: 0,
    degraded: 0,
  };

  for (const row of bandRows || []) {
    const band = row.latency_band as LatencyBand;
    if (band in distribution) {
      distribution[band] = Number(row.cnt ?? 0);
    }
  }

  return {
    avgLatencyMs: Number(avgRow?.avg_latency ?? 0),
    latencyBandDistribution: distribution,
  };
}

// ==========================================
// PUBLIC API — Calendar Phasing (Decision W7-4)
// ==========================================

/**
 * Set or update a calendar hardening phase. Upserts by (phaseName, organizationId).
 * Rule: "do not block internal Calendar quality on external sync readiness."
 */
export async function setCalendarPhase(
  params: SetCalendarPhaseParams,
): Promise<CalendarPhase> {
  const validated = SetCalendarPhaseParamsSchema.parse(params);
  const phaseId = uuidv4();

  const phase: CalendarPhase = {
    phaseId,
    phaseName: validated.phaseName,
    organizationId: validated.organizationId,
    status: validated.status,
    blockedBy: validated.blockedBy ?? null,
  };

  await dbRun(
    `INSERT INTO v8_calendar_phases (
      phase_id, phase_name, organization_id, status, blocked_by
    ) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (phase_name, organization_id) DO UPDATE SET
      status = excluded.status,
      blocked_by = excluded.blocked_by`,
    [
      phase.phaseId,
      phase.phaseName,
      phase.organizationId,
      phase.status,
      phase.blockedBy,
    ],
  );

  logger.info(
    `${LOG_PREFIX} Set calendar phase ${phase.phaseName} → ${phase.status}`,
  );
  return phase;
}

/**
 * Get all calendar phases for an org.
 */
export async function getCalendarPhases(
  organizationId: string,
): Promise<CalendarPhase[]> {
  const rows = await dbAll<CalendarPhaseRow>(
    `SELECT * FROM v8_calendar_phases
     WHERE organization_id = ?
     ORDER BY phase_name ASC`,
    [organizationId],
    { fallback: true },
  );

  return (rows || []).map(rowToCalendarPhase);
}
