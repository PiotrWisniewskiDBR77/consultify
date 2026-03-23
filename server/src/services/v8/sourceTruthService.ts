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
  RecordMaterializationParams,
  SourceMaterializationRecord,
  SyncedSourceRef,
  PromotionValidation,
  ValidatePromotionParams,
  SyncStatus,
  MaterializationMode,
  EvidenceClass,
  EntrypointClass,
  InitiativeEntrypoint,
} from '../../types/sourceTruthPreservation.js';
import {
  RecordMaterializationParamsSchema,
  AddSyncedSourceRefParamsSchema,
  ValidatePromotionParamsSchema,
  ENTRYPOINT_CLASS_MAP,
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
  params: RecordMaterializationParams,
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
    ],
  );

  logger.info(
    `${LOG_PREFIX} Recorded materialization ${recordId} for initiative ${record.initiativeId} ` +
    `(entrypoint=${record.entrypoint}, class=${record.entrypointClass})`,
  );
  return record;
}

/**
 * Get all source materialization records for an initiative, scoped to org.
 */
export async function getSourcesByInitiative(
  initiativeId: string,
  organizationId: string,
): Promise<SourceMaterializationRecord[]> {
  const rows = await dbAll<MaterializationRow>(
    `SELECT * FROM v8_source_materialization_records
     WHERE initiative_id = ? AND organization_id = ?
     ORDER BY promoted_at ASC`,
    [initiativeId, organizationId],
    { fallback: true },
  );

  return (rows || []).map(rowToMaterializationRecord);
}

/**
 * Get a single materialization record by ID, scoped to org.
 */
export async function getMaterializationRecord(
  recordId: string,
  organizationId: string,
): Promise<SourceMaterializationRecord | null> {
  const row = await dbGet<MaterializationRow>(
    `SELECT * FROM v8_source_materialization_records
     WHERE record_id = ? AND organization_id = ?`,
    [recordId, organizationId],
    { fallback: true },
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
  const evidenceSufficient = validated.evidenceClass === 'strong' || validated.evidenceClass === 'moderate';

  if (!isAllowed) {
    reasons.push('Actor does not have initiative-creation permission');
  }

  if (!evidenceSufficient) {
    reasons.push(`Evidence class '${validated.evidenceClass}' is below threshold (requires strong or moderate)`);
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
  params: AddSyncedSourceRefParams,
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
    ],
  );

  logger.info(
    `${LOG_PREFIX} Added synced source ref ${refId} for initiative ${ref.initiativeId} ` +
    `(system=${ref.externalSystem})`,
  );
  return ref;
}

/**
 * Get all synced source refs for an initiative, scoped to org.
 */
export async function getSyncedSourceRefs(
  initiativeId: string,
  organizationId: string,
): Promise<SyncedSourceRef[]> {
  const rows = await dbAll<SyncedRefRow>(
    `SELECT * FROM v8_synced_source_refs
     WHERE initiative_id = ? AND organization_id = ?
     ORDER BY created_at ASC`,
    [initiativeId, organizationId],
    { fallback: true },
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
  lastSyncedAt?: string | null,
): Promise<SyncedSourceRef | null> {
  const existing = await dbGet<SyncedRefRow>(
    `SELECT * FROM v8_synced_source_refs
     WHERE ref_id = ? AND organization_id = ?`,
    [refId, organizationId],
    { fallback: true },
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
    [syncStatus, syncedAt, refId, organizationId],
  );

  logger.info(`${LOG_PREFIX} Updated sync status for ref ${refId} to ${syncStatus}`);

  return rowToSyncedRef({
    ...existing,
    sync_status: syncStatus,
    last_synced_at: syncedAt,
  });
}
