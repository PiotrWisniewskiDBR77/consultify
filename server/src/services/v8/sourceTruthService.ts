/**
 * V8 Source Truth Preservation Service — WP-W3-LIFECYCLE-01
 *
 * Records how upstream artifacts (Ideas, Interviews, Assessments, Chat, Manual)
 * become initiatives while preserving origin, evidence, and context traceability.
 *
 * Decisions applied:
 *   W3-1 — invisible materialization by default, explicit when truth risk increases
 *   W3-2 — dual-gate promotion: permission AND evidence class
 *   W3-3 — synced_source_refs at initiative governance level
 */

import { v4 as uuidv4 } from 'uuid';

import type {
  AddSyncedSourceRefParams,
  EntrypointClass,
  EvidenceClass,
  InitiativeEntrypoint,
  MaterializationMode,
  PromotionValidation,
  RecordMaterializationParams,
  SourceMaterializationRecord,
  SyncedSourceRef,
  SyncStatus,
  ValidatePromotionParams,
} from '../../types/sourceTruthPreservation.js';
import {
  AddSyncedSourceRefParamsSchema,
  ENTRYPOINT_CLASS_MAP,
  InitiativeEntrypointValues,
  RecordMaterializationParamsSchema,
  ValidatePromotionParamsSchema,
} from '../../types/sourceTruthPreservation.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

// ==========================================
// HELPERS
// ==========================================

const LOG_PREFIX = '[V8:SourceTruth]';

interface MaterializationRow {
  record_id: string;
  initiative_id: string;
  organization_id: string;
  entrypoint: string;
  entrypoint_class: string;
  source_artifact_id: string;
  source_artifact_type: string;
  context_snapshot_id: string | null;
  materialization_mode: string;
  evidence_class: string;
  promoted_by: string;
  promoted_at: string;
  created_at: string;
}

interface SyncedRefRow {
  ref_id: string;
  initiative_id: string;
  organization_id: string;
  external_source_id: string;
  external_system: string;
  sync_status: string;
  last_synced_at: string | null;
  created_at: string;
}

function rowToMaterializationRecord(row: MaterializationRow): SourceMaterializationRecord {
  return {
    recordId: row.record_id,
    initiativeId: row.initiative_id,
    organizationId: row.organization_id,
    entrypoint: row.entrypoint as InitiativeEntrypoint,
    entrypointClass: row.entrypoint_class as EntrypointClass,
    sourceArtifactId: row.source_artifact_id,
    sourceArtifactType: row.source_artifact_type,
    contextSnapshotId: row.context_snapshot_id || null,
    materializationMode: row.materialization_mode as MaterializationMode,
    evidenceClass: row.evidence_class as EvidenceClass,
    promotedBy: row.promoted_by,
    promotedAt: row.promoted_at,
    createdAt: row.created_at,
  };
}

function rowToSyncedRef(row: SyncedRefRow): SyncedSourceRef {
  return {
    refId: row.ref_id,
    initiativeId: row.initiative_id,
    organizationId: row.organization_id,
    externalSourceId: row.external_source_id,
    externalSystem: row.external_system,
    syncStatus: row.sync_status as SyncStatus,
    lastSyncedAt: row.last_synced_at || null,
    createdAt: row.created_at,
  };
}

// ==========================================
// PUBLIC API
// ==========================================

/**
 * Record how a source artifact became an initiative.
 *
 * Decision W3-1: materialization is invisible by default.
 * The entrypoint class is derived automatically from the entrypoint.
 */
export async function recordSourceMaterialization(
  params: RecordMaterializationParams
): Promise<SourceMaterializationRecord> {
  const validated = RecordMaterializationParamsSchema.parse(params);

  const recordId = uuidv4();
  const promotedAt = new Date().toISOString();
  const entrypointClass = ENTRYPOINT_CLASS_MAP[validated.entrypoint];

  const record: SourceMaterializationRecord = {
    recordId,
    initiativeId: validated.initiativeId,
    organizationId: validated.organizationId,
    entrypoint: validated.entrypoint,
    entrypointClass,
    sourceArtifactId: validated.sourceArtifactId,
    sourceArtifactType: validated.sourceArtifactType,
    contextSnapshotId: validated.contextSnapshotId ?? null,
    materializationMode: validated.materializationMode,
    evidenceClass: validated.evidenceClass,
    promotedBy: validated.promotedBy,
    promotedAt,
    createdAt: promotedAt,
  };

  await dbRun(
    `INSERT INTO v8_source_materialization_records (
      record_id, initiative_id, organization_id, entrypoint, entrypoint_class,
      source_artifact_id, source_artifact_type, context_snapshot_id,
      materialization_mode, evidence_class, promoted_by, promoted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.recordId,
      record.initiativeId,
      record.organizationId,
      record.entrypoint,
      record.entrypointClass,
      record.sourceArtifactId,
      record.sourceArtifactType,
      record.contextSnapshotId,
      record.materializationMode,
      record.evidenceClass,
      record.promotedBy,
      record.promotedAt,
    ]
  );

  logger.info(
    `${LOG_PREFIX} Recorded materialization ${recordId} for initiative ${record.initiativeId} ` +
      `(entrypoint=${record.entrypoint}, class=${record.entrypointClass})`
  );
  return record;
}

/**
 * Get all source materialization records for an initiative, scoped to org.
 */
export async function getSourcesByInitiative(
  initiativeId: string,
  organizationId: string
): Promise<SourceMaterializationRecord[]> {
  const rows = await dbAll<MaterializationRow>(
    `SELECT * FROM v8_source_materialization_records
     WHERE initiative_id = ? AND organization_id = ?
     ORDER BY promoted_at ASC`,
    [initiativeId, organizationId],
    { fallback: true }
  );

  return (rows || []).map(rowToMaterializationRecord);
}

/**
 * Get a single materialization record by ID, scoped to org.
 */
export async function getMaterializationRecord(
  recordId: string,
  organizationId: string
): Promise<SourceMaterializationRecord | null> {
  const row = await dbGet<MaterializationRow>(
    `SELECT * FROM v8_source_materialization_records
     WHERE record_id = ? AND organization_id = ?`,
    [recordId, organizationId],
    { fallback: true }
  );

  if (!row) return null;
  return rowToMaterializationRecord(row);
}

/**
 * Validate whether a promotion is allowed.
 *
 * Decision W3-2: dual-gate — both permission AND evidence class must pass.
 * - Permission alone is not enough; evidence alone is not enough.
 * - Review required when finding is weak, contradictory (mixed), or high-impact.
 */
export function validatePromotion(params: ValidatePromotionParams): PromotionValidation {
  const validated = ValidatePromotionParamsSchema.parse(params);

  const reasons: string[] = [];
  const isAllowed = validated.hasPermission;
  const evidenceSufficient =
    validated.evidenceClass === 'strong' || validated.evidenceClass === 'moderate';

  if (!isAllowed) {
    reasons.push('Actor does not have initiative-creation permission');
  }

  if (!evidenceSufficient) {
    reasons.push(
      `Evidence class '${validated.evidenceClass}' is below threshold (requires strong or moderate)`
    );
  }

  const requiresReview =
    validated.evidenceClass === 'weak' ||
    validated.evidenceClass === 'mixed' ||
    validated.isHighImpact === true;

  if (validated.evidenceClass === 'weak') {
    reasons.push('Weak evidence requires review before promotion');
  }
  if (validated.evidenceClass === 'mixed') {
    reasons.push('Mixed/contradictory evidence requires review before promotion');
  }
  if (validated.isHighImpact) {
    reasons.push('High-impact promotion requires review');
  }

  return {
    isAllowed,
    evidenceSufficient,
    requiresReview,
    reasons,
  };
}

/**
 * Add a synced external source reference to an initiative.
 *
 * Decision W3-3: synced_source_refs live at initiative governance level,
 * not only at Idea workspace level.
 */
export async function addSyncedSourceRef(
  params: AddSyncedSourceRefParams
): Promise<SyncedSourceRef> {
  const validated = AddSyncedSourceRefParamsSchema.parse(params);

  const refId = uuidv4();
  const createdAt = new Date().toISOString();

  const ref: SyncedSourceRef = {
    refId,
    initiativeId: validated.initiativeId,
    organizationId: validated.organizationId,
    externalSourceId: validated.externalSourceId,
    externalSystem: validated.externalSystem,
    syncStatus: validated.syncStatus,
    lastSyncedAt: validated.lastSyncedAt ?? null,
    createdAt,
  };

  await dbRun(
    `INSERT INTO v8_synced_source_refs (
      ref_id, initiative_id, organization_id, external_source_id,
      external_system, sync_status, last_synced_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      ref.refId,
      ref.initiativeId,
      ref.organizationId,
      ref.externalSourceId,
      ref.externalSystem,
      ref.syncStatus,
      ref.lastSyncedAt,
    ]
  );

  logger.info(
    `${LOG_PREFIX} Added synced source ref ${refId} for initiative ${ref.initiativeId} ` +
      `(system=${ref.externalSystem})`
  );
  return ref;
}

/**
 * Get all synced source refs for an initiative, scoped to org.
 */
export async function getSyncedSourceRefs(
  initiativeId: string,
  organizationId: string
): Promise<SyncedSourceRef[]> {
  const rows = await dbAll<SyncedRefRow>(
    `SELECT * FROM v8_synced_source_refs
     WHERE initiative_id = ? AND organization_id = ?
     ORDER BY created_at ASC`,
    [initiativeId, organizationId],
    { fallback: true }
  );

  return (rows || []).map(rowToSyncedRef);
}

/**
 * Update the sync status of a synced source ref.
 */
export async function updateSyncStatus(
  refId: string,
  organizationId: string,
  syncStatus: SyncStatus,
  lastSyncedAt?: string | null
): Promise<SyncedSourceRef | null> {
  const existing = await dbGet<SyncedRefRow>(
    `SELECT * FROM v8_synced_source_refs
     WHERE ref_id = ? AND organization_id = ?`,
    [refId, organizationId],
    { fallback: true }
  );

  if (!existing) {
    logger.warn(`${LOG_PREFIX} Cannot update sync status — ref ${refId} not found`);
    return null;
  }

  const syncedAt = lastSyncedAt !== undefined ? lastSyncedAt : existing.last_synced_at;

  await dbRun(
    `UPDATE v8_synced_source_refs
     SET sync_status = ?, last_synced_at = ?
     WHERE ref_id = ? AND organization_id = ?`,
    [syncStatus, syncedAt, refId, organizationId]
  );

  logger.info(`${LOG_PREFIX} Updated sync status for ref ${refId} to ${syncStatus}`);

  return rowToSyncedRef({
    ...existing,
    sync_status: syncStatus,
    last_synced_at: syncedAt,
  });
}

// ==========================================
// TRANSFORMATION LIFECYCLE (entrypoints → materializations)
// ==========================================

const DEFAULT_ENTRYPOINT_LIST_LIMIT = 500;
const MAX_ENTRYPOINT_LIST_LIMIT = 5000;

export interface InitiativeEntrypointRecord {
  entrypointId: string;
  organizationId: string;
  sourceType: InitiativeEntrypoint;
  sourceId: string;
  createdAt: string;
  lastValidatedAt: string | null;
}

export interface InitiativeLifecycleMaterialization {
  materializationId: string;
  entrypointId: string;
  initiativeId: string;
  organizationId: string;
  createdAt: string;
}

export interface SourceTruthChainLink {
  source: { id: string; type: InitiativeEntrypoint };
  entrypoint: InitiativeEntrypointRecord;
  materialization: InitiativeLifecycleMaterialization;
}

export interface MaterializationChainValidationResult {
  valid: boolean;
  chain: SourceTruthChainLink[];
  gaps: string[];
}

export interface TransformationPipelineSummary {
  totalEntrypoints: number;
  materializedCount: number;
  orphanedCount: number;
  bySourceType: Record<InitiativeEntrypoint, number>;
}

export interface RefreshSyncedSourcesResult {
  checked: number;
  markedStale: string[];
}

interface InitiativeEntrypointRow {
  entrypoint_id: string;
  organization_id: string;
  source_type: string;
  source_id: string;
  created_at: string;
  last_validated_at: string | null;
}

interface ChainJoinRow {
  materialization_id: string;
  entrypoint_id: string;
  initiative_id: string;
  organization_id: string;
  mat_created_at: string;
  ep_entrypoint_id: string | null;
  ep_organization_id: string | null;
  source_type: string | null;
  source_id: string | null;
  ep_created_at: string | null;
  ep_last_validated_at: string | null;
}

function rowToInitiativeEntrypoint(row: InitiativeEntrypointRow): InitiativeEntrypointRecord {
  return {
    entrypointId: row.entrypoint_id,
    organizationId: row.organization_id,
    sourceType: row.source_type as InitiativeEntrypoint,
    sourceId: row.source_id,
    createdAt: row.created_at,
    lastValidatedAt: row.last_validated_at ?? null,
  };
}

function emptyBySourceType(): Record<InitiativeEntrypoint, number> {
  return InitiativeEntrypointValues.reduce(
    (acc, ep) => {
      acc[ep] = 0;
      return acc;
    },
    {} as Record<InitiativeEntrypoint, number>
  );
}

/**
 * List initiative entrypoints for an organization, optionally filtered by source type (initiative entrypoint).
 */
export async function getEntrypointsByOrg(
  organizationId: string,
  sourceType?: InitiativeEntrypoint,
  limit?: number
): Promise<InitiativeEntrypointRecord[]> {
  const rawLimit = limit ?? DEFAULT_ENTRYPOINT_LIST_LIMIT;
  const safeLimit = Math.min(Math.max(rawLimit, 1), MAX_ENTRYPOINT_LIST_LIMIT);

  if (sourceType !== undefined && !InitiativeEntrypointValues.includes(sourceType)) {
    throw new Error(`Invalid sourceType: ${sourceType}`);
  }

  const rows = sourceType
    ? await dbAll<InitiativeEntrypointRow>(
        `SELECT * FROM v8_initiative_entrypoints
         WHERE organization_id = ? AND source_type = ?
         ORDER BY created_at DESC
         LIMIT ?`,
        [organizationId, sourceType, safeLimit],
        { fallback: true }
      )
    : await dbAll<InitiativeEntrypointRow>(
        `SELECT * FROM v8_initiative_entrypoints
         WHERE organization_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
        [organizationId, safeLimit],
        { fallback: true }
      );

  return (rows || []).map(rowToInitiativeEntrypoint);
}

/**
 * All entrypoints originating from a given upstream source artifact (idea id, interview id, etc.).
 */
export async function getEntrypointsBySource(
  sourceId: string,
  organizationId: string
): Promise<InitiativeEntrypointRecord[]> {
  const rows = await dbAll<InitiativeEntrypointRow>(
    `SELECT * FROM v8_initiative_entrypoints
     WHERE source_id = ? AND organization_id = ?
     ORDER BY created_at ASC`,
    [sourceId, organizationId],
    { fallback: true }
  );

  return (rows || []).map(rowToInitiativeEntrypoint);
}

/**
 * Verify lifecycle linkage: upstream source → entrypoint → initiative materialization row, plus matching
 * v8_source_materialization_records row for the same initiative (canonical promotion record).
 */
export async function validateMaterializationChain(
  initiativeId: string,
  organizationId: string
): Promise<MaterializationChainValidationResult> {
  const gaps: string[] = [];
  const chain: SourceTruthChainLink[] = [];

  const joinRows = await dbAll<ChainJoinRow>(
    `SELECT
       m.materialization_id,
       m.entrypoint_id,
       m.initiative_id,
       m.organization_id,
       m.created_at AS mat_created_at,
       e.entrypoint_id AS ep_entrypoint_id,
       e.organization_id AS ep_organization_id,
       e.source_type,
       e.source_id,
       e.created_at AS ep_created_at,
       e.last_validated_at AS ep_last_validated_at
     FROM v8_initiative_materializations m
     LEFT JOIN v8_initiative_entrypoints e
       ON e.entrypoint_id = m.entrypoint_id AND e.organization_id = m.organization_id
     WHERE m.initiative_id = ? AND m.organization_id = ?`,
    [initiativeId, organizationId],
    { fallback: true }
  );

  const rows = joinRows || [];

  if (rows.length === 0) {
    gaps.push('No lifecycle materializations recorded for this initiative');
    return { valid: false, chain, gaps };
  }

  const smrs = await dbAll<MaterializationRow>(
    `SELECT * FROM v8_source_materialization_records
     WHERE initiative_id = ? AND organization_id = ?`,
    [initiativeId, organizationId],
    { fallback: true }
  );
  const promotionRecords = smrs || [];

  for (const row of rows) {
    if (!row.ep_entrypoint_id || !row.source_id || !row.source_type) {
      gaps.push(`Materialization ${row.materialization_id} has no matching entrypoint`);
      continue;
    }

    const smr = promotionRecords.find(
      (r) => r.source_artifact_id === row.source_id && r.entrypoint === row.source_type
    );

    if (!smr) {
      gaps.push(
        `No v8_source_materialization_records row for source ${row.source_id} (entrypoint=${row.source_type})`
      );
      continue;
    }

    const entrypointRow: InitiativeEntrypointRow = {
      entrypoint_id: row.ep_entrypoint_id,
      organization_id: row.ep_organization_id!,
      source_type: row.source_type,
      source_id: row.source_id,
      created_at: row.ep_created_at!,
      last_validated_at: row.ep_last_validated_at,
    };

    chain.push({
      source: { id: row.source_id, type: row.source_type as InitiativeEntrypoint },
      entrypoint: rowToInitiativeEntrypoint(entrypointRow),
      materialization: {
        materializationId: row.materialization_id,
        entrypointId: row.entrypoint_id,
        initiativeId: row.initiative_id,
        organizationId: row.organization_id,
        createdAt: row.mat_created_at,
      },
    });
  }

  const valid = gaps.length === 0;
  return { valid, chain, gaps };
}

/**
 * Entrypoints that have not yet been promoted to an initiative (no v8_initiative_materializations row).
 */
export async function getOrphanedEntrypoints(
  organizationId: string
): Promise<InitiativeEntrypointRecord[]> {
  const rows = await dbAll<InitiativeEntrypointRow>(
    `SELECT e.*
     FROM v8_initiative_entrypoints e
     LEFT JOIN v8_initiative_materializations m ON m.entrypoint_id = e.entrypoint_id
     WHERE e.organization_id = ? AND m.materialization_id IS NULL
     ORDER BY e.created_at ASC`,
    [organizationId],
    { fallback: true }
  );

  return (rows || []).map(rowToInitiativeEntrypoint);
}

/**
 * Re-evaluate synced source refs: missing lineage or entrypoint re-validation after last sync → `stale`.
 */
export async function refreshSyncedSources(
  initiativeId: string,
  organizationId: string
): Promise<RefreshSyncedSourcesResult> {
  const refs = await getSyncedSourceRefs(initiativeId, organizationId);
  const markedStale: string[] = [];

  const smrs = await dbAll<MaterializationRow>(
    `SELECT source_artifact_id, entrypoint FROM v8_source_materialization_records
     WHERE initiative_id = ? AND organization_id = ?`,
    [initiativeId, organizationId],
    { fallback: true }
  );
  const promotions = smrs || [];

  const lifecycleRows = await dbAll<{
    source_id: string;
    source_type: string;
    last_validated_at: string | null;
  }>(
    `SELECT e.source_id, e.source_type, e.last_validated_at
     FROM v8_initiative_materializations m
     INNER JOIN v8_initiative_entrypoints e
       ON e.entrypoint_id = m.entrypoint_id AND e.organization_id = m.organization_id
     WHERE m.initiative_id = ? AND m.organization_id = ?`,
    [initiativeId, organizationId],
    { fallback: true }
  );
  const lifecycle = lifecycleRows || [];

  for (const ref of refs) {
    const hasPromotion = promotions.some((p) => p.source_artifact_id === ref.externalSourceId);
    const lifecycleHit = lifecycle.find((l) => l.source_id === ref.externalSourceId);
    const hasLifecycle = Boolean(lifecycleHit);

    let isStale = !hasPromotion && !hasLifecycle;

    if (!isStale && lifecycleHit?.last_validated_at && ref.lastSyncedAt) {
      if (lifecycleHit.last_validated_at > ref.lastSyncedAt) {
        isStale = true;
      }
    }

    if (isStale) {
      const updated = await updateSyncStatus(ref.refId, organizationId, 'stale');
      if (updated) {
        markedStale.push(ref.refId);
        logger.info(
          `${LOG_PREFIX} refreshSyncedSources marked ref ${ref.refId} stale for initiative ${initiativeId}`
        );
      }
    }
  }

  return { checked: refs.length, markedStale };
}

/**
 * Aggregate counts for the transformation pipeline in one org.
 */
export async function getTransformationPipeline(
  organizationId: string
): Promise<TransformationPipelineSummary> {
  const totalRow = await dbGet<{ c: number }>(
    `SELECT COUNT(*) AS c FROM v8_initiative_entrypoints WHERE organization_id = ?`,
    [organizationId],
    { fallback: true }
  );
  const totalEntrypoints = Number(totalRow?.c ?? 0);

  const matRow = await dbGet<{ c: number }>(
    `SELECT COUNT(DISTINCT e.entrypoint_id) AS c
     FROM v8_initiative_entrypoints e
     INNER JOIN v8_initiative_materializations m ON m.entrypoint_id = e.entrypoint_id
     WHERE e.organization_id = ?`,
    [organizationId],
    { fallback: true }
  );
  const materializedCount = Number(matRow?.c ?? 0);

  const typeRows = await dbAll<{ source_type: string; c: number }>(
    `SELECT source_type, COUNT(*) AS c
     FROM v8_initiative_entrypoints
     WHERE organization_id = ?
     GROUP BY source_type`,
    [organizationId],
    { fallback: true }
  );

  const bySourceType = emptyBySourceType();
  for (const tr of typeRows || []) {
    const st = tr.source_type as InitiativeEntrypoint;
    if (InitiativeEntrypointValues.includes(st)) {
      bySourceType[st] = Number(tr.c);
    }
  }

  return {
    totalEntrypoints,
    materializedCount,
    orphanedCount: Math.max(0, totalEntrypoints - materializedCount),
    bySourceType,
  };
}
