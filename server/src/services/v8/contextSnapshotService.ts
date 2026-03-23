/**
 * V8 Context Snapshot Service
 *
 * Manages the universal identity spine for the V8 runtime.
 * Captures, retrieves, and audits ContextSnapshots with org-level isolation.
 */

import { v4 as uuidv4 } from 'uuid';

import type {
  CaptureSnapshotParams,
  ContextSnapshot,
  DriftEvent,
} from '../../types/contextSnapshot.js';
import { CaptureSnapshotParamsSchema } from '../../types/contextSnapshot.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

// ==========================================
// HELPERS
// ==========================================

const LOG_PREFIX = '[V8:ContextSnapshot]';

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    logger.warn(`${LOG_PREFIX} Failed to parse JSON, using fallback`);
    return fallback;
  }
}

interface SnapshotRow {
  snapshot_id: string;
  snapshot_version: number;
  captured_at: string;
  workspace_id: string;
  organization_id: string;
  project_id: string | null;
  conversation_id: string | null;
  execution_run_id: string | null;
  artifact_refs: string;
  effective_scope_ref: string;
  resolved_role_ref: string;
  initiator_user_id: string;
  consumer_class: string;
  privacy_mode: number;
  source_context_refs: string;
  drift_events: string;
  created_at: string;
}

function rowToSnapshot(row: SnapshotRow): ContextSnapshot {
  return {
    snapshotId: row.snapshot_id,
    snapshotVersion: row.snapshot_version,
    capturedAt: row.captured_at,
    workspaceId: row.workspace_id,
    organizationId: row.organization_id,
    projectId: row.project_id || null,
    conversationId: row.conversation_id || null,
    executionRunId: row.execution_run_id || null,
    artifactRefs: safeJsonParse(row.artifact_refs, []),
    effectiveScopeRef: row.effective_scope_ref,
    resolvedRoleRef: row.resolved_role_ref,
    initiatorUserId: row.initiator_user_id,
    consumerClass: row.consumer_class as ContextSnapshot['consumerClass'],
    privacyMode: Boolean(row.privacy_mode),
    sourceContextRefs: safeJsonParse(row.source_context_refs, []),
    driftEvents: safeJsonParse(row.drift_events, []),
  };
}

// ==========================================
// PUBLIC API
// ==========================================

/**
 * Capture and persist a new ContextSnapshot.
 * Validates input via Zod before persisting.
 */
export async function captureSnapshot(params: CaptureSnapshotParams): Promise<ContextSnapshot> {
  const validated = CaptureSnapshotParamsSchema.parse(params);

  const snapshotId = uuidv4();
  const capturedAt = new Date().toISOString();

  const snapshot: ContextSnapshot = {
    snapshotId,
    snapshotVersion: 1,
    capturedAt,
    workspaceId: validated.workspaceId,
    organizationId: validated.organizationId,
    projectId: validated.projectId ?? null,
    conversationId: validated.conversationId ?? null,
    executionRunId: validated.executionRunId ?? null,
    artifactRefs: validated.artifactRefs,
    effectiveScopeRef: validated.effectiveScopeRef,
    resolvedRoleRef: validated.resolvedRoleRef,
    initiatorUserId: validated.initiatorUserId,
    consumerClass: validated.consumerClass,
    privacyMode: validated.privacyMode,
    sourceContextRefs: validated.sourceContextRefs,
    driftEvents: [],
  };

  await dbRun(
    `INSERT INTO v8_context_snapshots (
      snapshot_id, snapshot_version, captured_at, workspace_id, organization_id,
      project_id, conversation_id, execution_run_id, artifact_refs,
      effective_scope_ref, resolved_role_ref, initiator_user_id,
      consumer_class, privacy_mode, source_context_refs, drift_events
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      snapshot.snapshotId,
      snapshot.snapshotVersion,
      snapshot.capturedAt,
      snapshot.workspaceId,
      snapshot.organizationId,
      snapshot.projectId,
      snapshot.conversationId,
      snapshot.executionRunId,
      JSON.stringify(snapshot.artifactRefs),
      snapshot.effectiveScopeRef,
      snapshot.resolvedRoleRef,
      snapshot.initiatorUserId,
      snapshot.consumerClass,
      snapshot.privacyMode ? 1 : 0,
      JSON.stringify(snapshot.sourceContextRefs),
      JSON.stringify(snapshot.driftEvents),
    ],
  );

  logger.info(`${LOG_PREFIX} Captured snapshot ${snapshotId} for org ${snapshot.organizationId}`);
  return snapshot;
}

/**
 * Retrieve a snapshot by ID with organization-level isolation.
 */
export async function getSnapshot(
  snapshotId: string,
  organizationId: string,
): Promise<ContextSnapshot | null> {
  const row = await dbGet<SnapshotRow>(
    `SELECT * FROM v8_context_snapshots
     WHERE snapshot_id = ? AND organization_id = ?`,
    [snapshotId, organizationId],
    { fallback: true },
  );

  if (!row) return null;
  return rowToSnapshot(row);
}

/**
 * Retrieve all snapshots for a conversation, scoped to an organization.
 */
export async function getSnapshotsByConversation(
  conversationId: string,
  organizationId: string,
): Promise<ContextSnapshot[]> {
  const rows = await dbAll<SnapshotRow>(
    `SELECT * FROM v8_context_snapshots
     WHERE conversation_id = ? AND organization_id = ?
     ORDER BY captured_at ASC`,
    [conversationId, organizationId],
    { fallback: true },
  );

  return (rows || []).map(rowToSnapshot);
}

/**
 * Retrieve all snapshots for an execution run, scoped to an organization.
 */
export async function getSnapshotsByRun(
  executionRunId: string,
  organizationId: string,
): Promise<ContextSnapshot[]> {
  const rows = await dbAll<SnapshotRow>(
    `SELECT * FROM v8_context_snapshots
     WHERE execution_run_id = ? AND organization_id = ?
     ORDER BY captured_at ASC`,
    [executionRunId, organizationId],
    { fallback: true },
  );

  return (rows || []).map(rowToSnapshot);
}

/**
 * Compare two snapshots and return detected drift events.
 * Does not persist — call recordDriftEvent separately.
 */
export function detectDrift(
  current: ContextSnapshot,
  previous: ContextSnapshot,
): DriftEvent[] {
  const now = new Date().toISOString();
  const drifts: DriftEvent[] = [];

  if (current.projectId !== previous.projectId) {
    drifts.push({
      driftType: 'project_switch',
      detectedAt: now,
      previousValue: previous.projectId ?? '(none)',
      currentValue: current.projectId ?? '(none)',
      resolution: 'revalidated',
    });
  }

  if (current.workspaceId !== previous.workspaceId) {
    drifts.push({
      driftType: 'workspace_switch',
      detectedAt: now,
      previousValue: previous.workspaceId,
      currentValue: current.workspaceId,
      resolution: 'revalidated',
    });
  }

  if (current.resolvedRoleRef !== previous.resolvedRoleRef) {
    drifts.push({
      driftType: 'role_change',
      detectedAt: now,
      previousValue: previous.resolvedRoleRef,
      currentValue: current.resolvedRoleRef,
      resolution: 'revalidated',
    });
  }

  const previousArtifactIds = new Set(previous.artifactRefs.map((a) => a.artifactId));
  const currentArtifactIds = new Set(current.artifactRefs.map((a) => a.artifactId));

  for (const id of previousArtifactIds) {
    if (!currentArtifactIds.has(id)) {
      drifts.push({
        driftType: 'artifact_removed',
        detectedAt: now,
        previousValue: id,
        currentValue: '(removed)',
        resolution: 'revalidated',
      });
    }
  }

  return drifts;
}

/**
 * Append a drift event to an existing snapshot's drift_events array.
 */
export async function recordDriftEvent(
  snapshotId: string,
  driftEvent: DriftEvent,
): Promise<void> {
  const row = await dbGet<{ drift_events: string }>(
    `SELECT drift_events FROM v8_context_snapshots WHERE snapshot_id = ?`,
    [snapshotId],
  );

  if (!row) {
    logger.warn(`${LOG_PREFIX} Cannot record drift — snapshot ${snapshotId} not found`);
    return;
  }

  const existing: DriftEvent[] = safeJsonParse(row.drift_events, []);
  existing.push(driftEvent);

  await dbRun(
    `UPDATE v8_context_snapshots SET drift_events = ? WHERE snapshot_id = ?`,
    [JSON.stringify(existing), snapshotId],
  );

  logger.info(`${LOG_PREFIX} Recorded drift event (${driftEvent.driftType}) on snapshot ${snapshotId}`);
}
