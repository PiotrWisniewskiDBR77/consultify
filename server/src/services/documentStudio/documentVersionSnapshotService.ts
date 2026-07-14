/**
 * Consultify Document Studio — Document Version Snapshot Service
 * (Epic E5, Slice 5.2).
 *
 * Append-only registry of `DocumentVersionSnapshot` rows per artifact.
 * Snapshots freeze the entire `DocumentSchema` at a point in time and
 * are addressable by their `versionId`. They power:
 *
 *   - Rollback (slice 5.3): restore a previous schema as the active one
 *     after recording a `rollback_revert` snapshot of the pre-rollback
 *     state so the operator never loses the state they rolled away from.
 *   - Status-change checkpoints (slice 5.3 / route layer): the route
 *     handler may auto-trigger a snapshot before approving / publishing
 *     so the cleared state is always rollback-reachable.
 *
 * Design contract (mirrors documentLifecycleService.ts):
 *
 *   - Service takes the schema as an explicit parameter — does NOT
 *     reach into wave5 — to keep this module pure / circular-import
 *     free. The studio service is the resolver of "current schema" and
 *     calls into here.
 *   - Per-artifact monotonic versionNumber starts at 1 and increments
 *     atomically inside the synchronous registry mutation.
 *   - Snapshots are deeply cloned on insert AND on read so callers
 *     cannot accidentally mutate the captured schema.
 *   - In-memory write-through DAO mirrors the source-pack pattern; the
 *     wave5 / Postgres swap is mechanical.
 *
 * Tenant safety: every read / list / get accepts and validates
 * `organizationId`. Cross-tenant lookups deny-by-default.
 */

import {
  computeDocumentSchemaDiff,
  summarizeDocumentSchemaDiff,
} from './documentSchemaDiffService.js';
import type {
  DocumentAuditEntry,
  DocumentSchema,
  DocumentStatus,
  DocumentVersionSnapshot,
  DocumentVersionSnapshotOrigin,
} from './documentStudioTypes.js';
import {
  __resetSnapshotRegistryDaoForTests,
  loadSnapshotsForOrg as daoLoadSnapshotsForOrg,
  persistSnapshot as daoPersistSnapshot,
} from './documentVersionSnapshotRegistryDao.js';

// =============================================================================
// In-process registry (live cache) + write-through to Postgres DAO
// =============================================================================

const snapshotStore = new Map<string, DocumentVersionSnapshot[]>();
// versionId → snapshot fast-lookup so getDocumentVersionSnapshot is O(1).
const versionIndex = new Map<string, DocumentVersionSnapshot>();

const hydratedOrgs = new Set<string>();
const hydrationInflight = new Map<string, Promise<void>>();

function key(organizationId: string, artifactId: string): string {
  return `${organizationId}::${artifactId}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${random}`;
}

function deepClone<T>(value: T): T {
  // Schemas are JSON-serializable by contract, so structuredClone is
  // overkill and JSON round-trip is good enough + avoids the runtime
  // dependency. Snapshots never carry functions / dates / RegExp.
  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneSnapshot(snapshot: DocumentVersionSnapshot): DocumentVersionSnapshot {
  return {
    ...snapshot,
    schema: deepClone(snapshot.schema),
  };
}

async function persistSnapshot(snapshot: DocumentVersionSnapshot): Promise<{ ok: boolean }> {
  return daoPersistSnapshot(snapshot);
}

async function loadSnapshotsForOrg(organizationId: string): Promise<DocumentVersionSnapshot[]> {
  return daoLoadSnapshotsForOrg(organizationId);
}

async function ensureHydrated(organizationId: string): Promise<void> {
  if (hydratedOrgs.has(organizationId)) return;
  const inflight = hydrationInflight.get(organizationId);
  if (inflight) return inflight;
  const promise = (async () => {
    try {
      const snapshots = await loadSnapshotsForOrg(organizationId);
      for (const snap of snapshots) {
        const k = key(snap.organizationId, snap.artifactId);
        const list = snapshotStore.get(k) ?? [];
        list.push(snap);
        snapshotStore.set(k, list);
        versionIndex.set(snap.versionId, snap);
      }
      // Resort each artifact's list by versionNumber asc so callers
      // can rely on chronological order.
      for (const list of snapshotStore.values()) {
        list.sort((a, b) => a.versionNumber - b.versionNumber);
      }
    } catch {
      // best-effort hydration
    }
    hydratedOrgs.add(organizationId);
  })();
  hydrationInflight.set(organizationId, promise);
  try {
    await promise;
  } finally {
    hydrationInflight.delete(organizationId);
  }
}

export async function ensureDocumentVersionSnapshotsHydrated(
  organizationId: string
): Promise<void> {
  return ensureHydrated(organizationId);
}

// =============================================================================
// Audit pump — same pattern as the lifecycle service so snapshot
// creation lands in the studio's per-artifact audit timeline.
// =============================================================================

type AuditPump = (entry: DocumentAuditEntry) => void;
let auditPump: AuditPump | null = null;

export function registerDocumentVersionSnapshotAuditPump(pump: AuditPump): void {
  auditPump = pump;
}

function recordAudit(entry: DocumentAuditEntry): void {
  if (!auditPump) return;
  auditPump(entry);
}

// =============================================================================
// Public surface
// =============================================================================

export interface CreateDocumentVersionSnapshotParams {
  organizationId: string;
  artifactId: string;
  userId: string;
  /** Schema to freeze. Caller (studio service) resolves it from wave5. */
  schema: DocumentSchema;
  /** Lifecycle status at the moment of capture. */
  statusAtCapture: DocumentStatus;
  label?: string;
  reason?: string;
  /** Defaults to 'manual'. The studio service supplies 'auto_status_change'
   *  on automatic captures and 'rollback_revert' on the implicit
   *  pre-rollback snapshot. */
  origin?: DocumentVersionSnapshotOrigin;
}

/**
 * Capture the current schema as a versioned snapshot. The new
 * snapshot's `versionNumber` is `lastVersion + 1` for that artifact.
 * Records a `document_version_snapshot_created` audit row.
 */
export function createDocumentVersionSnapshot(
  params: CreateDocumentVersionSnapshotParams
): DocumentVersionSnapshot {
  if (!params.organizationId) throw new Error('organizationId is required');
  if (!params.artifactId) throw new Error('artifactId is required');
  if (!params.userId) throw new Error('userId is required');
  if (!params.schema || typeof params.schema !== 'object') {
    throw new Error('schema is required');
  }

  const k = key(params.organizationId, params.artifactId);
  const existing = snapshotStore.get(k) ?? [];
  const versionNumber =
    existing.length === 0 ? 1 : Math.max(...existing.map((s) => s.versionNumber)) + 1;

  // Slice E16.diff.audit — find the most recent prior snapshot so
  // the audit row can carry a structural-diff summary describing
  // what actually changed between the previous canonical state and
  // the freshly captured one. Best-effort: any computation failure
  // is swallowed so snapshot capture never fails on the diff path.
  const previousSnapshot =
    existing.length === 0
      ? null
      : existing.reduce<DocumentVersionSnapshot | null>(
          (acc, candidate) =>
            !acc || candidate.versionNumber > acc.versionNumber ? candidate : acc,
          null
        );
  let structuralDiffSummary: string | undefined;
  let structuralDiffStats: Record<string, number> | undefined;
  if (previousSnapshot) {
    try {
      const diff = computeDocumentSchemaDiff(previousSnapshot.schema, params.schema);
      structuralDiffSummary = summarizeDocumentSchemaDiff(diff);
      structuralDiffStats = {
        addedSectionCount: diff.stats.addedSectionCount,
        removedSectionCount: diff.stats.removedSectionCount,
        modifiedSectionCount: diff.stats.modifiedSectionCount,
        reorderedSectionCount: diff.stats.reorderedSectionCount,
        unchangedSectionCount: diff.stats.unchangedSectionCount,
        addedBlockCount: diff.stats.addedBlockCount,
        removedBlockCount: diff.stats.removedBlockCount,
        modifiedBlockCount: diff.stats.modifiedBlockCount,
        unchangedBlockCount: diff.stats.unchangedBlockCount,
      };
    } catch {
      // Diff computation MUST NEVER fail snapshot creation. Leave
      // both summary fields undefined so audit consumers can detect
      // the missing-diff condition deterministically.
    }
  }

  const snapshot: DocumentVersionSnapshot = {
    versionId: makeId('document-snapshot'),
    artifactId: params.artifactId,
    organizationId: params.organizationId,
    versionNumber,
    capturedAt: nowIso(),
    capturedBy: params.userId,
    label: params.label?.trim() || undefined,
    reason: params.reason?.trim() || undefined,
    statusAtCapture: params.statusAtCapture,
    schema: deepClone(params.schema),
    origin: params.origin ?? 'manual',
  };

  const next = [...existing, snapshot];
  snapshotStore.set(k, next);
  versionIndex.set(snapshot.versionId, snapshot);
  void persistSnapshot(snapshot).catch(() => undefined);

  recordAudit({
    auditId: makeId('document-audit'),
    artifactId: params.artifactId,
    organizationId: params.organizationId,
    action: 'document_version_snapshot_created',
    actorId: params.userId,
    occurredAt: snapshot.capturedAt,
    details: {
      versionId: snapshot.versionId,
      versionNumber: snapshot.versionNumber,
      origin: snapshot.origin,
      label: snapshot.label,
      reason: snapshot.reason,
      statusAtCapture: snapshot.statusAtCapture,
      // Slice E16.diff.audit — structural-diff summary lines
      // suitable for log-stream rendering and forensic replay. Both
      // fields stay undefined for the very first snapshot of an
      // artifact (no prior state to compare against).
      previousVersionId: previousSnapshot?.versionId,
      previousVersionNumber: previousSnapshot?.versionNumber,
      structuralDiffSummary,
      structuralDiffStats,
    },
  });

  return cloneSnapshot(snapshot);
}

/**
 * Slice E16.diff.audit — return the most recent snapshot for the
 * given artifact (highest `versionNumber`) or `null` when no
 * snapshots exist yet. Mirrors the deep-clone contract of the
 * other readers so callers cannot mutate the registered row.
 *
 * Used by the studio service to wire `DocumentEditorProposal.versionBeforeId`
 * (slice E15.4.edit) at proposal-creation time so the audit trail
 * carries a deterministic pointer to the schema state the proposal
 * was authored against.
 */
export function getMostRecentDocumentVersionSnapshot(
  artifactId: string,
  organizationId: string
): DocumentVersionSnapshot | null {
  if (!artifactId || !organizationId) return null;
  const list = snapshotStore.get(key(organizationId, artifactId)) ?? [];
  if (list.length === 0) return null;
  let best = list[0];
  for (let i = 1; i < list.length; i += 1) {
    if (list[i].versionNumber > best.versionNumber) {
      best = list[i];
    }
  }
  return cloneSnapshot(best);
}

export function listDocumentVersionSnapshots(
  artifactId: string,
  organizationId: string
): DocumentVersionSnapshot[] {
  if (!artifactId || !organizationId) return [];
  const list = snapshotStore.get(key(organizationId, artifactId)) ?? [];
  return list.map((snap) => cloneSnapshot(snap));
}

export function getDocumentVersionSnapshot(
  versionId: string,
  organizationId: string
): DocumentVersionSnapshot | null {
  if (!versionId || !organizationId) return null;
  const snap = versionIndex.get(versionId);
  if (!snap) return null;
  if (snap.organizationId !== organizationId) return null;
  return cloneSnapshot(snap);
}

export function getDocumentVersionSnapshotByNumber(
  artifactId: string,
  organizationId: string,
  versionNumber: number
): DocumentVersionSnapshot | null {
  if (!artifactId || !organizationId) return null;
  const list = snapshotStore.get(key(organizationId, artifactId)) ?? [];
  const match = list.find((s) => s.versionNumber === versionNumber);
  return match ? cloneSnapshot(match) : null;
}

// =============================================================================
// Test-only helpers
// =============================================================================

/** @internal */
export function __resetDocumentVersionSnapshotsForTests(): void {
  snapshotStore.clear();
  versionIndex.clear();
  hydratedOrgs.clear();
  hydrationInflight.clear();
  // Also clear the DAO-level persistence so hydration on the next test
  // does not reload snapshots that belong to a different test case.
  void __resetSnapshotRegistryDaoForTests().catch(() => undefined);
}
