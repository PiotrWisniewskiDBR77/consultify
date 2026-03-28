/**
 * V8 Version/Replay/Audit Spine Service
 *
 * Manages version snapshots, restore operations, and audit trail
 * for the V8 multiplayer runtime. Builds on CollaborationRoom (WP-W1-MP-01).
 * All queries enforce organization-level isolation.
 */

import { v4 as uuidv4 } from 'uuid';

import type {
  ActorAttribution,
  AuditEntry,
  CaptureSnapshotParams,
  GetAuditTrailOptions,
  GetVersionHistoryOptions,
  RecordAuditEntryParams,
  RequestRestoreParams,
  RestoreRequest,
  VersionCompareChange,
  VersionCompareResult,
  VersionSnapshot,
} from '../../types/versionReplay.js';
import type { AuditAction, RestoreStatus, SnapshotTrigger } from '../../types/versionReplay.js';

export interface AIStalenessResult {
  isStale: boolean;
  lastAISnapshotAt: string | null;
  ageMs: number | null;
}

export interface ResourceTimelineEntry {
  type: 'snapshot' | 'audit' | 'restore';
  timestamp: string;
  data: unknown;
}
import {
  CaptureSnapshotParamsSchema,
  RecordAuditEntryParamsSchema,
  RequestRestoreParamsSchema,
} from '../../types/versionReplay.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

// ==========================================
// HELPERS
// ==========================================

const LOG_PREFIX = '[V8:VersionReplay]';

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

interface SnapshotRow {
  snapshot_id: string;
  room_id: string | null;
  resource_type: string;
  resource_id: string;
  organization_id: string;
  state_version: number;
  state_data: string;
  trigger_type: string;
  captured_by_actor_id: string;
  captured_by_actor_type: string;
  captured_by_display_name: string;
  captured_at: string;
  metadata: string;
}

interface RestoreRow {
  restore_id: string;
  room_id: string | null;
  resource_type: string;
  resource_id: string;
  organization_id: string;
  target_version_snapshot_id: string;
  requested_by_actor_id: string;
  requested_by_actor_type: string;
  requested_by_display_name: string;
  status: string;
  safety_snapshot_id: string | null;
  requested_at: string;
  resolved_at: string | null;
}

interface AuditRow {
  entry_id: string;
  room_id: string | null;
  resource_type: string;
  resource_id: string;
  organization_id: string;
  actor_id: string;
  actor_type: string;
  actor_display_name: string;
  action: string;
  state_version_before: number | null;
  state_version_after: number | null;
  metadata: string;
  timestamp: string;
}

interface MaxVersionRow {
  max_version: number | null;
}

// ==========================================
// ROW MAPPERS
// ==========================================

function rowToSnapshot(row: SnapshotRow): VersionSnapshot {
  return {
    snapshotId: row.snapshot_id,
    roomId: row.room_id || null,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    organizationId: row.organization_id,
    stateVersion: row.state_version,
    stateData: safeJsonParse(row.state_data, {}),
    triggerType: row.trigger_type as SnapshotTrigger,
    capturedBy: {
      actorId: row.captured_by_actor_id,
      actorType: row.captured_by_actor_type as ActorAttribution['actorType'],
      actorDisplayName: row.captured_by_display_name,
    },
    capturedAt: row.captured_at,
    metadata: safeJsonParse(row.metadata, {}),
  };
}

function rowToRestore(row: RestoreRow): RestoreRequest {
  return {
    restoreId: row.restore_id,
    roomId: row.room_id || null,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    organizationId: row.organization_id,
    targetVersionSnapshotId: row.target_version_snapshot_id,
    requestedBy: {
      actorId: row.requested_by_actor_id,
      actorType: row.requested_by_actor_type as ActorAttribution['actorType'],
      actorDisplayName: row.requested_by_display_name,
    },
    status: row.status as RestoreStatus,
    safetySnapshotId: row.safety_snapshot_id || null,
    requestedAt: row.requested_at,
    resolvedAt: row.resolved_at || null,
  };
}

function rowToAuditEntry(row: AuditRow): AuditEntry {
  return {
    entryId: row.entry_id,
    roomId: row.room_id || null,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    organizationId: row.organization_id,
    actorAttribution: {
      actorId: row.actor_id,
      actorType: row.actor_type as ActorAttribution['actorType'],
      actorDisplayName: row.actor_display_name,
    },
    action: row.action as AuditAction,
    stateVersionBefore: row.state_version_before ?? null,
    stateVersionAfter: row.state_version_after ?? null,
    metadata: safeJsonParse(row.metadata, {}),
    timestamp: row.timestamp,
  };
}

// ==========================================
// INTERNAL — next state version
// ==========================================

async function getNextStateVersion(
  organizationId: string,
  resourceType: string,
  resourceId: string
): Promise<number> {
  const row = await dbGet<MaxVersionRow>(
    `SELECT MAX(state_version) as max_version
     FROM v8_version_snapshots
     WHERE organization_id = ? AND resource_type = ? AND resource_id = ?`,
    [organizationId, resourceType, resourceId],
    { fallback: true }
  );

  return (row?.max_version ?? -1) + 1;
}

// ==========================================
// PUBLIC API — VERSION SNAPSHOTS
// ==========================================

/**
 * Capture a point-in-time version snapshot of a resource's state.
 * Automatically assigns the next monotonic stateVersion.
 */
export async function captureVersionSnapshot(
  params: CaptureSnapshotParams
): Promise<VersionSnapshot> {
  const validated = CaptureSnapshotParamsSchema.parse(params);

  const snapshotId = uuidv4();
  const now = new Date().toISOString();
  const stateVersion = await getNextStateVersion(
    validated.organizationId,
    validated.resourceType,
    validated.resourceId
  );

  const snapshot: VersionSnapshot = {
    snapshotId,
    roomId: validated.roomId ?? null,
    resourceType: validated.resourceType,
    resourceId: validated.resourceId,
    organizationId: validated.organizationId,
    stateVersion,
    stateData: validated.stateData,
    triggerType: validated.triggerType,
    capturedBy: validated.capturedBy,
    capturedAt: now,
    metadata: validated.metadata,
  };

  await dbRun(
    `INSERT INTO v8_version_snapshots (
      snapshot_id, room_id, resource_type, resource_id, organization_id,
      state_version, state_data, trigger_type,
      captured_by_actor_id, captured_by_actor_type, captured_by_display_name,
      captured_at, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      snapshot.snapshotId,
      snapshot.roomId,
      snapshot.resourceType,
      snapshot.resourceId,
      snapshot.organizationId,
      snapshot.stateVersion,
      JSON.stringify(snapshot.stateData),
      snapshot.triggerType,
      snapshot.capturedBy.actorId,
      snapshot.capturedBy.actorType,
      snapshot.capturedBy.actorDisplayName,
      snapshot.capturedAt,
      JSON.stringify(snapshot.metadata),
    ]
  );

  logger.info(
    `${LOG_PREFIX} Captured snapshot ${snapshotId} v${stateVersion} ` +
      `for ${snapshot.resourceType}:${snapshot.resourceId} (trigger: ${snapshot.triggerType})`
  );
  return snapshot;
}

/**
 * Retrieve paginated version history for a resource within an organization.
 */
export async function getVersionHistory(
  roomId: string,
  organizationId: string,
  options?: GetVersionHistoryOptions
): Promise<VersionSnapshot[]> {
  const { limit = 50, offset = 0, triggerType } = options ?? {};

  let query: string;
  let queryParams: unknown[];

  if (triggerType) {
    query = `SELECT * FROM v8_version_snapshots
             WHERE room_id = ? AND organization_id = ? AND trigger_type = ?
             ORDER BY state_version DESC
             LIMIT ? OFFSET ?`;
    queryParams = [roomId, organizationId, triggerType, limit, offset];
  } else {
    query = `SELECT * FROM v8_version_snapshots
             WHERE room_id = ? AND organization_id = ?
             ORDER BY state_version DESC
             LIMIT ? OFFSET ?`;
    queryParams = [roomId, organizationId, limit, offset];
  }

  const rows = await dbAll<SnapshotRow>(query, queryParams, { fallback: true });
  return (rows || []).map(rowToSnapshot);
}

/**
 * Retrieve a single version snapshot by ID with org isolation.
 */
export async function getVersionSnapshot(
  snapshotId: string,
  organizationId: string
): Promise<VersionSnapshot | null> {
  const row = await dbGet<SnapshotRow>(
    `SELECT * FROM v8_version_snapshots
     WHERE snapshot_id = ? AND organization_id = ?`,
    [snapshotId, organizationId],
    { fallback: true }
  );

  if (!row) return null;
  return rowToSnapshot(row);
}

// ==========================================
// PUBLIC API — VERSION COMPARE
// ==========================================

/**
 * Produce a structural diff between two version snapshots.
 * Both snapshots must belong to the same organization.
 */
export async function compareVersions(
  fromSnapshotId: string,
  toSnapshotId: string,
  organizationId: string
): Promise<VersionCompareResult> {
  const fromSnapshot = await getVersionSnapshot(fromSnapshotId, organizationId);
  if (!fromSnapshot) {
    throw new Error(
      `Source snapshot ${fromSnapshotId} not found in organization ${organizationId}`
    );
  }

  const toSnapshot = await getVersionSnapshot(toSnapshotId, organizationId);
  if (!toSnapshot) {
    throw new Error(`Target snapshot ${toSnapshotId} not found in organization ${organizationId}`);
  }

  if (
    fromSnapshot.resourceType !== toSnapshot.resourceType ||
    fromSnapshot.resourceId !== toSnapshot.resourceId
  ) {
    throw new Error(
      'Cannot compare snapshots from different resources: ' +
        `${fromSnapshot.resourceType}:${fromSnapshot.resourceId} vs ` +
        `${toSnapshot.resourceType}:${toSnapshot.resourceId}`
    );
  }

  const changes = computeStructuralDiff(fromSnapshot.stateData, toSnapshot.stateData);

  logger.info(
    `${LOG_PREFIX} Compared v${fromSnapshot.stateVersion} → v${toSnapshot.stateVersion}: ` +
      `${changes.length} change(s)`
  );

  return {
    fromVersion: fromSnapshot.stateVersion,
    toVersion: toSnapshot.stateVersion,
    fromSnapshotId,
    toSnapshotId,
    changes,
  };
}

/**
 * Shallow structural diff between two state objects.
 * Compares top-level keys for added/removed/modified.
 * Artifact-family adapters may replace this with deeper diffing.
 */
function computeStructuralDiff(
  fromData: Record<string, unknown>,
  toData: Record<string, unknown>
): VersionCompareChange[] {
  const changes: VersionCompareChange[] = [];
  const allKeys = new Set([...Object.keys(fromData), ...Object.keys(toData)]);

  for (const key of allKeys) {
    const inFrom = key in fromData;
    const inTo = key in toData;

    if (inFrom && !inTo) {
      changes.push({ path: key, changeType: 'removed', before: fromData[key], after: undefined });
    } else if (!inFrom && inTo) {
      changes.push({ path: key, changeType: 'added', before: undefined, after: toData[key] });
    } else if (JSON.stringify(fromData[key]) !== JSON.stringify(toData[key])) {
      changes.push({
        path: key,
        changeType: 'modified',
        before: fromData[key],
        after: toData[key],
      });
    }
  }

  return changes;
}

// ==========================================
// PUBLIC API — RESTORE
// ==========================================

/**
 * Create a restore request. Automatically captures a pre-restore safety snapshot
 * of the current state before the restore can be applied.
 */
export async function requestRestore(params: RequestRestoreParams): Promise<RestoreRequest> {
  const validated = RequestRestoreParamsSchema.parse(params);

  const targetSnapshot = await getVersionSnapshot(
    validated.targetVersionSnapshotId,
    validated.organizationId
  );
  if (!targetSnapshot) {
    throw new Error(
      `Target snapshot ${validated.targetVersionSnapshotId} not found ` +
        `in organization ${validated.organizationId}`
    );
  }

  const safetySnapshot = await captureVersionSnapshot({
    roomId: validated.roomId,
    resourceType: validated.resourceType,
    resourceId: validated.resourceId,
    organizationId: validated.organizationId,
    stateData: validated.currentStateData,
    triggerType: 'pre_restore_safety',
    capturedBy: { actorId: 'system', actorType: 'system', actorDisplayName: 'System' },
    metadata: { reason: 'pre_restore_safety', targetSnapshotId: validated.targetVersionSnapshotId },
  });

  const restoreId = uuidv4();
  const now = new Date().toISOString();

  const request: RestoreRequest = {
    restoreId,
    roomId: validated.roomId ?? null,
    resourceType: validated.resourceType,
    resourceId: validated.resourceId,
    organizationId: validated.organizationId,
    targetVersionSnapshotId: validated.targetVersionSnapshotId,
    requestedBy: validated.requestedBy,
    status: 'pending',
    safetySnapshotId: safetySnapshot.snapshotId,
    requestedAt: now,
    resolvedAt: null,
  };

  await dbRun(
    `INSERT INTO v8_restore_requests (
      restore_id, room_id, resource_type, resource_id, organization_id,
      target_version_snapshot_id,
      requested_by_actor_id, requested_by_actor_type, requested_by_display_name,
      status, safety_snapshot_id, requested_at, resolved_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      request.restoreId,
      request.roomId,
      request.resourceType,
      request.resourceId,
      request.organizationId,
      request.targetVersionSnapshotId,
      request.requestedBy.actorId,
      request.requestedBy.actorType,
      request.requestedBy.actorDisplayName,
      request.status,
      request.safetySnapshotId,
      request.requestedAt,
      request.resolvedAt,
    ]
  );

  await recordAuditEntry({
    roomId: validated.roomId,
    resourceType: validated.resourceType,
    resourceId: validated.resourceId,
    organizationId: validated.organizationId,
    actorAttribution: validated.requestedBy,
    action: 'restore.requested',
    stateVersionBefore: safetySnapshot.stateVersion,
    stateVersionAfter: null,
    metadata: {
      targetSnapshotId: validated.targetVersionSnapshotId,
      safetySnapshotId: safetySnapshot.snapshotId,
    },
  });

  logger.info(
    `${LOG_PREFIX} Restore requested: ${restoreId} targeting snapshot ` +
      `${validated.targetVersionSnapshotId} (safety: ${safetySnapshot.snapshotId})`
  );
  return request;
}

/**
 * Apply a pending restore request. Creates a new snapshot with the restored state
 * (forward operation — stateVersion increments, never rewinds).
 */
export async function applyRestore(
  restoreId: string,
  organizationId: string
): Promise<RestoreRequest> {
  const row = await dbGet<RestoreRow>(
    `SELECT * FROM v8_restore_requests
     WHERE restore_id = ? AND organization_id = ?`,
    [restoreId, organizationId],
    { fallback: true }
  );

  if (!row) {
    throw new Error(`Restore request ${restoreId} not found in organization ${organizationId}`);
  }

  const request = rowToRestore(row);

  if (request.status !== 'pending') {
    throw new Error(`Restore request ${restoreId} is already ${request.status}, cannot apply`);
  }

  const targetSnapshot = await getVersionSnapshot(request.targetVersionSnapshotId, organizationId);
  if (!targetSnapshot) {
    throw new Error(`Target snapshot ${request.targetVersionSnapshotId} no longer exists`);
  }

  const restoredSnapshot = await captureVersionSnapshot({
    roomId: request.roomId,
    resourceType: request.resourceType,
    resourceId: request.resourceId,
    organizationId,
    stateData: targetSnapshot.stateData,
    triggerType: 'manual_save',
    capturedBy: request.requestedBy,
    metadata: {
      restoredFromSnapshotId: request.targetVersionSnapshotId,
      restoreId,
    },
  });

  const now = new Date().toISOString();

  await dbRun(
    `UPDATE v8_restore_requests
     SET status = 'applied', resolved_at = ?
     WHERE restore_id = ? AND organization_id = ?`,
    [now, restoreId, organizationId]
  );

  await recordAuditEntry({
    roomId: request.roomId,
    resourceType: request.resourceType,
    resourceId: request.resourceId,
    organizationId,
    actorAttribution: request.requestedBy,
    action: 'restore.applied',
    stateVersionBefore: request.safetySnapshotId
      ? ((await getVersionSnapshot(request.safetySnapshotId, organizationId))?.stateVersion ?? null)
      : null,
    stateVersionAfter: restoredSnapshot.stateVersion,
    metadata: {
      restoreId,
      restoredFromSnapshotId: request.targetVersionSnapshotId,
      newSnapshotId: restoredSnapshot.snapshotId,
    },
  });

  logger.info(
    `${LOG_PREFIX} Restore applied: ${restoreId} → new v${restoredSnapshot.stateVersion}`
  );

  return {
    ...request,
    status: 'applied',
    resolvedAt: now,
  };
}

// ==========================================
// PUBLIC API — AUDIT TRAIL
// ==========================================

/**
 * Record an actor-attributed audit entry.
 */
export async function recordAuditEntry(params: RecordAuditEntryParams): Promise<AuditEntry> {
  const validated = RecordAuditEntryParamsSchema.parse(params);

  const entryId = uuidv4();
  const now = new Date().toISOString();

  const entry: AuditEntry = {
    entryId,
    roomId: validated.roomId ?? null,
    resourceType: validated.resourceType,
    resourceId: validated.resourceId,
    organizationId: validated.organizationId,
    actorAttribution: validated.actorAttribution,
    action: validated.action,
    stateVersionBefore: validated.stateVersionBefore ?? null,
    stateVersionAfter: validated.stateVersionAfter ?? null,
    metadata: validated.metadata,
    timestamp: now,
  };

  await dbRun(
    `INSERT INTO v8_audit_entries (
      entry_id, room_id, resource_type, resource_id, organization_id,
      actor_id, actor_type, actor_display_name,
      action, state_version_before, state_version_after,
      metadata, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.entryId,
      entry.roomId,
      entry.resourceType,
      entry.resourceId,
      entry.organizationId,
      entry.actorAttribution.actorId,
      entry.actorAttribution.actorType,
      entry.actorAttribution.actorDisplayName,
      entry.action,
      entry.stateVersionBefore,
      entry.stateVersionAfter,
      JSON.stringify(entry.metadata),
      entry.timestamp,
    ]
  );

  logger.info(
    `${LOG_PREFIX} Audit: ${entry.action} by ${entry.actorAttribution.actorId} ` +
      `on ${entry.resourceType}:${entry.resourceId}`
  );
  return entry;
}

/**
 * Retrieve paginated audit trail for a room within an organization.
 */
export async function getAuditTrail(
  roomId: string,
  organizationId: string,
  options?: GetAuditTrailOptions
): Promise<AuditEntry[]> {
  const { limit = 50, offset = 0, action, actorId } = options ?? {};

  const conditions: string[] = ['room_id = ?', 'organization_id = ?'];
  const queryParams: unknown[] = [roomId, organizationId];

  if (action) {
    conditions.push('action = ?');
    queryParams.push(action);
  }
  if (actorId) {
    conditions.push('actor_id = ?');
    queryParams.push(actorId);
  }

  queryParams.push(limit, offset);

  const query = `SELECT * FROM v8_audit_entries
                 WHERE ${conditions.join(' AND ')}
                 ORDER BY timestamp DESC
                 LIMIT ? OFFSET ?`;

  const rows = await dbAll<AuditRow>(query, queryParams, { fallback: true });
  return (rows || []).map(rowToAuditEntry);
}

// ==========================================
// PUBLIC API — RUNTIME EXTENSIONS (Wave 8)
// ==========================================

/**
 * Get all snapshots for a resource ordered by version desc.
 */
export async function getSnapshotsByResource(
  resourceId: string,
  organizationId: string,
  limit: number = 50
): Promise<VersionSnapshot[]> {
  const rows = await dbAll<SnapshotRow>(
    `SELECT * FROM v8_version_snapshots
     WHERE resource_id = ? AND organization_id = ?
     ORDER BY state_version DESC
     LIMIT ?`,
    [resourceId, organizationId, limit],
    { fallback: true }
  );

  return (rows || []).map(rowToSnapshot);
}

/**
 * Get the most recent snapshot for a resource.
 */
export async function getLatestSnapshot(
  resourceId: string,
  organizationId: string
): Promise<VersionSnapshot | null> {
  const row = await dbGet<SnapshotRow>(
    `SELECT * FROM v8_version_snapshots
     WHERE resource_id = ? AND organization_id = ?
     ORDER BY state_version DESC
     LIMIT 1`,
    [resourceId, organizationId],
    { fallback: true }
  );

  if (!row) return null;
  return rowToSnapshot(row);
}

/**
 * Full rollback flow: create a restore request, auto-approve it, record audit.
 */
export async function rollbackToSnapshot(
  snapshotId: string,
  organizationId: string,
  requestedBy: ActorAttribution
): Promise<RestoreRequest> {
  const targetSnapshot = await getVersionSnapshot(snapshotId, organizationId);
  if (!targetSnapshot) {
    throw new Error(`Snapshot ${snapshotId} not found in organization ${organizationId}`);
  }

  const latestSnapshot = await getLatestSnapshot(targetSnapshot.resourceId, organizationId);
  const currentStateData = latestSnapshot?.stateData ?? {};

  const restoreReq = await requestRestore({
    roomId: targetSnapshot.roomId,
    resourceType: targetSnapshot.resourceType,
    resourceId: targetSnapshot.resourceId,
    organizationId,
    targetVersionSnapshotId: snapshotId,
    requestedBy,
    currentStateData,
  });

  const applied = await applyRestore(restoreReq.restoreId, organizationId);

  await recordAuditEntry({
    roomId: targetSnapshot.roomId,
    resourceType: targetSnapshot.resourceType,
    resourceId: targetSnapshot.resourceId,
    organizationId,
    actorAttribution: requestedBy,
    action: 'snapshot.restored',
    stateVersionBefore: latestSnapshot?.stateVersion ?? null,
    stateVersionAfter: targetSnapshot.stateVersion,
    metadata: { snapshotId, restoreId: applied.restoreId },
  });

  logger.info(
    `${LOG_PREFIX} Rollback to snapshot ${snapshotId} completed (restore: ${applied.restoreId})`
  );

  return applied;
}

const DEFAULT_AI_STALENESS_MS = 60 * 60 * 1000; // 1 hour

/**
 * Check if the latest AI-related snapshot is older than threshold.
 */
export async function detectAIStaleness(
  resourceId: string,
  organizationId: string,
  maxAgeMs: number = DEFAULT_AI_STALENESS_MS
): Promise<AIStalenessResult> {
  const row = await dbGet<SnapshotRow>(
    `SELECT * FROM v8_version_snapshots
     WHERE resource_id = ? AND organization_id = ? AND trigger_type = 'ai_proposal_accepted'
     ORDER BY captured_at DESC
     LIMIT 1`,
    [resourceId, organizationId],
    { fallback: true }
  );

  if (!row) {
    return { isStale: false, lastAISnapshotAt: null, ageMs: null };
  }

  const capturedAt = new Date(row.captured_at).getTime();
  const ageMs = Date.now() - capturedAt;

  return {
    isStale: ageMs > maxAgeMs,
    lastAISnapshotAt: row.captured_at,
    ageMs,
  };
}

/**
 * Aggregate audit entries by action type in a date range.
 */
export async function getAuditSummary(
  resourceId: string,
  organizationId: string,
  fromDate: string,
  toDate: string
): Promise<Map<AuditAction, number>> {
  const rows = await dbAll<{ action: string; count: number }>(
    `SELECT action, COUNT(*) as count FROM v8_audit_entries
     WHERE resource_id = ? AND organization_id = ?
       AND timestamp >= ? AND timestamp <= ?
     GROUP BY action`,
    [resourceId, organizationId, fromDate, toDate],
    { fallback: true }
  );

  const summary = new Map<AuditAction, number>();
  for (const row of rows || []) {
    summary.set(row.action as AuditAction, row.count);
  }
  return summary;
}

/**
 * Get all restore requests with status 'pending' for an org.
 */
export async function getPendingRestores(organizationId: string): Promise<RestoreRequest[]> {
  const rows = await dbAll<RestoreRow>(
    `SELECT * FROM v8_restore_requests
     WHERE organization_id = ? AND status = 'pending'
     ORDER BY requested_at DESC`,
    [organizationId],
    { fallback: true }
  );

  return (rows || []).map(rowToRestore);
}

/**
 * Reject a pending restore request, record audit entry.
 */
export async function rejectRestore(
  restoreId: string,
  organizationId: string,
  rejectedBy: ActorAttribution,
  reason: string
): Promise<RestoreRequest> {
  const row = await dbGet<RestoreRow>(
    `SELECT * FROM v8_restore_requests
     WHERE restore_id = ? AND organization_id = ?`,
    [restoreId, organizationId],
    { fallback: true }
  );

  if (!row) {
    throw new Error(`Restore request ${restoreId} not found in organization ${organizationId}`);
  }

  const request = rowToRestore(row);

  if (request.status !== 'pending') {
    throw new Error(`Restore request ${restoreId} is already ${request.status}, cannot reject`);
  }

  const now = new Date().toISOString();

  await dbRun(
    `UPDATE v8_restore_requests
     SET status = 'rejected', resolved_at = ?
     WHERE restore_id = ? AND organization_id = ?`,
    [now, restoreId, organizationId]
  );

  await recordAuditEntry({
    roomId: request.roomId,
    resourceType: request.resourceType,
    resourceId: request.resourceId,
    organizationId,
    actorAttribution: rejectedBy,
    action: 'restore.rejected',
    metadata: { restoreId, reason },
  });

  logger.info(`${LOG_PREFIX} Restore rejected: ${restoreId} by ${rejectedBy.actorId} — ${reason}`);

  return {
    ...request,
    status: 'rejected',
    resolvedAt: now,
  };
}

/**
 * Get combined timeline: snapshots + audit entries + restore requests, sorted by timestamp desc.
 */
export async function getResourceHistory(
  resourceId: string,
  organizationId: string
): Promise<ResourceTimelineEntry[]> {
  const [snapshots, audits, restores] = await Promise.all([
    dbAll<SnapshotRow>(
      `SELECT * FROM v8_version_snapshots
       WHERE resource_id = ? AND organization_id = ?`,
      [resourceId, organizationId],
      { fallback: true }
    ),
    dbAll<AuditRow>(
      `SELECT * FROM v8_audit_entries
       WHERE resource_id = ? AND organization_id = ?`,
      [resourceId, organizationId],
      { fallback: true }
    ),
    dbAll<RestoreRow>(
      `SELECT * FROM v8_restore_requests
       WHERE resource_id = ? AND organization_id = ?`,
      [resourceId, organizationId],
      { fallback: true }
    ),
  ]);

  const timeline: ResourceTimelineEntry[] = [];

  for (const row of snapshots || []) {
    timeline.push({
      type: 'snapshot',
      timestamp: row.captured_at,
      data: rowToSnapshot(row),
    });
  }

  for (const row of audits || []) {
    timeline.push({
      type: 'audit',
      timestamp: row.timestamp,
      data: rowToAuditEntry(row),
    });
  }

  for (const row of restores || []) {
    timeline.push({
      type: 'restore',
      timestamp: row.requested_at,
      data: rowToRestore(row),
    });
  }

  timeline.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return timeline;
}
