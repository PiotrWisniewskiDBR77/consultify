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

import { createHash } from 'node:crypto';

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
  deleteSnapshot as daoDeleteSnapshot,
  insertCheckpointSnapshotWithCas as daoInsertCheckpointSnapshotWithCas,
  loadLatestSnapshotMeta as daoLoadLatestSnapshotMeta,
  loadSnapshotsForOrg as daoLoadSnapshotsForOrg,
  loadVersionLineage as daoLoadVersionLineage,
  persistSnapshot as daoPersistSnapshot,
  type DocumentVersionLineageEntry,
} from './documentVersionSnapshotRegistryDao.js';

// =============================================================================
// Epic E1 — automatic history (server-side auto-capture on autosave).
//
// The manual autosave path (`PUT /:artifactId/content` →
// `updateDocumentManualContent`) calls `maybeAutoCaptureDocumentVersionSnapshot`
// after every successful save. A snapshot is captured — origin `'autosave'`
// — when EITHER:
//
//   - time threshold: `AUTO_SNAPSHOT_MIN_INTERVAL_MS` has elapsed since the
//     artifact's most recent snapshot (any origin), OR
//   - content threshold: the JSON-serialized `sections` length changed by
//     more than `AUTO_SNAPSHOT_CONTENT_DELTA_RATIO` (15%) relative to the
//     most recent snapshot's content length.
//
// An artifact with no snapshot yet always captures (there is nothing to
// diff against, and "no history" is itself the condition auto-capture
// exists to fix).
//
// Retention: `autosave`-origin snapshots are capped at
// `AUTO_SNAPSHOT_RETENTION_LIMIT` (30) per artifact — the oldest
// autosave snapshots are pruned once the cap is exceeded. `manual`,
// `auto_status_change` and `rollback_revert` snapshots are never touched
// by this cap (checked by origin, not by recency).
// =============================================================================

export const AUTO_SNAPSHOT_MIN_INTERVAL_MS = 10 * 60 * 1000;
export const AUTO_SNAPSHOT_CONTENT_DELTA_RATIO = 0.15;
export const AUTO_SNAPSHOT_RETENTION_LIMIT = 30;

/** JSON-length proxy for "how much content is in here". Deliberately
 *  simple — a byte-length delta is a fine proxy for "meaningful change"
 *  without needing a real text/word diff. */
function sectionsContentLength(schema: DocumentSchema): number {
  try {
    return JSON.stringify(schema?.sections ?? []).length;
  } catch {
    return 0;
  }
}

export interface AutoSnapshotDecision {
  shouldCapture: boolean;
  reason: string;
  /** ms since the previous snapshot, or null when there was none. */
  elapsedMs: number | null;
  /** content-length delta ratio vs the previous snapshot, or null when
   *  there was no previous snapshot to diff against. */
  deltaRatio: number | null;
}

/**
 * Pure decision function (no I/O, no store access) — kept standalone so
 * the threshold rule itself is unit-testable without the full
 * hydration/registry machinery.
 */
export function decideAutoSnapshotCapture(params: {
  previous: DocumentVersionSnapshot | null;
  nextSchema: DocumentSchema;
  now?: number;
}): AutoSnapshotDecision {
  const { previous, nextSchema } = params;
  const now = params.now ?? Date.now();

  if (!previous) {
    return {
      shouldCapture: true,
      reason: 'autosave: first snapshot for this document',
      elapsedMs: null,
      deltaRatio: null,
    };
  }

  const previousCapturedAtMs = new Date(previous.capturedAt).getTime();
  const elapsedMs = Number.isFinite(previousCapturedAtMs) ? now - previousCapturedAtMs : null;

  if (elapsedMs !== null && elapsedMs >= AUTO_SNAPSHOT_MIN_INTERVAL_MS) {
    return {
      shouldCapture: true,
      reason: `autosave: ${Math.round(elapsedMs / 60000)} min since last snapshot`,
      elapsedMs,
      deltaRatio: null,
    };
  }

  const prevLen = sectionsContentLength(previous.schema);
  const nextLen = sectionsContentLength(nextSchema);
  const deltaRatio = prevLen === 0 ? (nextLen > 0 ? 1 : 0) : Math.abs(nextLen - prevLen) / prevLen;

  if (deltaRatio > AUTO_SNAPSHOT_CONTENT_DELTA_RATIO) {
    return {
      shouldCapture: true,
      reason: `autosave: content length changed ${(deltaRatio * 100).toFixed(1)}%`,
      elapsedMs,
      deltaRatio,
    };
  }

  return {
    shouldCapture: false,
    reason: 'autosave: below time and content-delta thresholds',
    elapsedMs,
    deltaRatio,
  };
}

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

// =============================================================================
// MAT-MVP-DOC-001 (Lane C, 2026-09-12) — content hash.
//
// Recursively sorts object keys (arrays keep their order — order IS content
// for `sections`) so two snapshots with textually identical content always
// hash identically regardless of how the object was constructed, and a
// changed byte anywhere in the content changes the hash.
//
// Deliberately hashes only the CONTENT-relevant subset of the schema
// (`title`, `sections`, `sourceRefs`) — not the whole `DocumentSchema`.
// Fields like `updatedAt`/`documentStatus`/`statusChangedAt` are volatile
// metadata that change on saves/rollbacks/status transitions WITHOUT the
// document's actual content changing; including them would make "identical
// content -> identical hash" false for the common case of two checkpoints
// taken back-to-back with no edit in between. This mirrors the existing
// `sectionsContentLength()` proxy above, which already treats `sections` as
// the definitive "how much content is in here" signal.
// =============================================================================

function canonicalizeForHash(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeForHash);
  if (value && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[k] = canonicalizeForHash((value as Record<string, unknown>)[k]);
    }
    return sorted;
  }
  return value;
}

/**
 * sha256 hex digest of the canonicalized content-relevant subset of a
 * `DocumentSchema`. Exported so route/service callers (and tests) can
 * compute the SAME hash independently to assert equality/inequality
 * without depending on internal snapshot-creation plumbing.
 */
export function computeDocumentSchemaContentHash(schema: DocumentSchema): string {
  const contentSubset = {
    title: schema?.title ?? null,
    sections: schema?.sections ?? [],
    sourceRefs: schema?.sourceRefs ?? [],
  };
  const canonical = canonicalizeForHash(contentSubset);
  const json = JSON.stringify(canonical);
  return createHash('sha256').update(json).digest('hex');
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
    // 20260912_claude_c_document_version_lineage (part a) — every snapshot,
    // regardless of call site (manual checkpoint, autosave, rollback-revert,
    // auto-status-change), gets a content hash and an explicit parent
    // pointer now. `previousSnapshot` was already computed above for the
    // structural-diff audit summary; reuse it here instead of resolving it
    // twice.
    contentHash: computeDocumentSchemaContentHash(params.schema),
    parentVersionId: previousSnapshot?.versionId ?? null,
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

/**
 * Prune `autosave`-origin snapshots down to `AUTO_SNAPSHOT_RETENTION_LIMIT`
 * for a single artifact — oldest-first. Snapshots of any other origin
 * (`manual`, `auto_status_change`, `rollback_revert`) are never selected
 * for removal, regardless of age. Best-effort: the DAO delete is
 * fire-and-forget, mirroring `persistSnapshot`'s write-through contract —
 * a failed delete just leaves a stale row in Postgres for the next pass.
 */
function pruneAutoDocumentVersionSnapshots(organizationId: string, artifactId: string): void {
  const k = key(organizationId, artifactId);
  const list = snapshotStore.get(k);
  if (!list || list.length === 0) return;

  const autoSnapshots = list
    .filter((s) => s.origin === 'autosave')
    .sort((a, b) => a.versionNumber - b.versionNumber);

  const excess = autoSnapshots.length - AUTO_SNAPSHOT_RETENTION_LIMIT;
  if (excess <= 0) return;

  const toRemove = autoSnapshots.slice(0, excess);
  const removeIds = new Set(toRemove.map((s) => s.versionId));

  snapshotStore.set(
    k,
    list.filter((s) => !removeIds.has(s.versionId))
  );
  for (const removed of toRemove) {
    versionIndex.delete(removed.versionId);
    void daoDeleteSnapshot(removed.versionId, organizationId).catch(() => undefined);
  }
}

export interface MaybeAutoCaptureDocumentVersionSnapshotParams {
  organizationId: string;
  artifactId: string;
  userId: string;
  /** The freshly-saved schema (post-write). */
  schema: DocumentSchema;
  statusAtCapture: DocumentStatus;
}

/**
 * Epic E1 — server-side auto-capture entry point. Called from the
 * autosave path (`updateDocumentManualContent`) after every successful
 * content save. Evaluates the time/content-delta rule via
 * `decideAutoSnapshotCapture` against the artifact's most recent
 * snapshot (any origin); when the rule fires, records an `'autosave'`
 * snapshot and prunes old auto-snapshots back to the retention cap.
 *
 * Fail-soft by contract: ANY error here is swallowed and resolves to
 * `null`. Auto-capture is a convenience layer over the document's
 * durable save — it must never be able to turn a successful autosave
 * into a failed request.
 */
export function maybeAutoCaptureDocumentVersionSnapshot(
  params: MaybeAutoCaptureDocumentVersionSnapshotParams
): DocumentVersionSnapshot | null {
  try {
    if (!params.organizationId || !params.artifactId || !params.userId || !params.schema) {
      return null;
    }

    const previous = getMostRecentDocumentVersionSnapshot(params.artifactId, params.organizationId);
    const decision = decideAutoSnapshotCapture({ previous, nextSchema: params.schema });
    if (!decision.shouldCapture) return null;

    const snapshot = createDocumentVersionSnapshot({
      organizationId: params.organizationId,
      artifactId: params.artifactId,
      userId: params.userId,
      schema: params.schema,
      statusAtCapture: params.statusAtCapture,
      reason: decision.reason,
      origin: 'autosave',
    });

    pruneAutoDocumentVersionSnapshots(params.organizationId, params.artifactId);

    return snapshot;
  } catch {
    return null;
  }
}

// =============================================================================
// MAT-MVP-DOC-001 (Lane C) part (b) — CAS-guarded checkpoint.
//
// `documentStudioService.createDocumentSnapshot` (the handler behind
// `POST /:artifactId/snapshots`) calls THIS function instead of the sync
// `createDocumentVersionSnapshot` above. Autosave and the rollback-revert
// snapshot keep using the sync path unmodified — see that function's own
// doc comment (and `document-studio.routes.ts`'s "Codex final review,
// Blocker 2" comment) for why its sync, fire-and-forget contract is frozen.
// The checkpoint route is the one place a double-click / blind retry
// without an `Idempotency-Key` could otherwise create two rows, so it is
// the one place that gets a real, Postgres-adjudicated CAS guard.
// =============================================================================

export interface CreateCheckpointSnapshotWithCasParams {
  organizationId: string;
  artifactId: string;
  userId: string;
  schema: DocumentSchema;
  statusAtCapture: DocumentStatus;
  label?: string;
  reason?: string;
  /** Defaults to 'manual' — the checkpoint route never sets this today. */
  origin?: DocumentVersionSnapshotOrigin;
  /**
   * The CAS token: the `versionId` of the snapshot the caller believes is
   * currently latest, `null` to assert "no snapshot exists yet", or
   * `undefined` to INFER it (the service reads the actual current latest
   * via `loadLatestSnapshotMeta` immediately before the atomic insert and
   * uses that as the gate). INFER is what every pre-existing caller gets
   * for free — no request shape change required — while still producing a
   * real, Postgres-adjudicated "exactly one of two concurrent checkpoints
   * wins" outcome, because the atomic insert re-validates whatever value
   * is passed here against Postgres's own state at insert time regardless
   * of how that value was obtained.
   */
  expectedVersion?: string | null;
}

export type CreateCheckpointSnapshotWithCasResult =
  | { outcome: 'created'; snapshot: DocumentVersionSnapshot }
  | {
      outcome: 'conflict';
      /** What the caller asserted (possibly inferred) — for the error envelope's `yourVersion`. */
      yourVersion: string | null;
      /** What Postgres actually holds right now — for the error envelope's `serverVersion`. */
      serverVersion: { versionId: string; versionNumber: number } | null;
    }
  | { outcome: 'error' };

export async function createCheckpointSnapshotWithCas(
  params: CreateCheckpointSnapshotWithCasParams
): Promise<CreateCheckpointSnapshotWithCasResult> {
  if (!params.organizationId || !params.artifactId || !params.userId || !params.schema) {
    return { outcome: 'error' };
  }

  const expectedParentVersionId =
    params.expectedVersion !== undefined
      ? params.expectedVersion
      : (await daoLoadLatestSnapshotMeta(params.artifactId, params.organizationId))?.versionId ?? null;

  const contentHash = computeDocumentSchemaContentHash(params.schema);
  const versionId = makeId('document-snapshot');
  const capturedAt = nowIso();

  const result = await daoInsertCheckpointSnapshotWithCas({
    versionId,
    artifactId: params.artifactId,
    organizationId: params.organizationId,
    capturedAt,
    capturedBy: params.userId,
    label: params.label?.trim() || null,
    reason: params.reason?.trim() || null,
    statusAtCapture: params.statusAtCapture,
    schemaJson: JSON.stringify(params.schema),
    origin: params.origin ?? 'manual',
    contentHash,
    expectedParentVersionId,
  });

  if (result.outcome === 'error') return { outcome: 'error' };
  if (result.outcome === 'conflict') {
    return { outcome: 'conflict', yourVersion: expectedParentVersionId, serverVersion: result.serverLatest };
  }

  const snapshot: DocumentVersionSnapshot = {
    versionId,
    artifactId: params.artifactId,
    organizationId: params.organizationId,
    versionNumber: result.versionNumber,
    capturedAt,
    capturedBy: params.userId,
    label: params.label?.trim() || undefined,
    reason: params.reason?.trim() || undefined,
    statusAtCapture: params.statusAtCapture,
    schema: deepClone(params.schema),
    origin: params.origin ?? 'manual',
    contentHash,
    parentVersionId: result.parentVersionId,
  };

  // Keep the in-process cache consistent with what Postgres now holds so
  // synchronous readers (`listDocumentVersionSnapshots`,
  // `getMostRecentDocumentVersionSnapshot`, etc.) see this checkpoint
  // immediately, exactly as the sync path does.
  const k = key(params.organizationId, params.artifactId);
  const existing = snapshotStore.get(k) ?? [];
  snapshotStore.set(k, [...existing, snapshot]);
  versionIndex.set(snapshot.versionId, snapshot);

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
      previousVersionId: snapshot.parentVersionId,
      contentHash: snapshot.contentHash,
      cas: 'atomic_insert',
    },
  });

  return { outcome: 'created', snapshot: cloneSnapshot(snapshot) };
}

// =============================================================================
// MAT-MVP-DOC-001 (Lane C) part (c) — immutable-lineage readback.
//
// Always a direct, COLD Postgres read (bypasses `snapshotStore` entirely) so
// callers can prove the chain survived a process restart. Tenant-scoped by
// construction (the DAO query always predicates on organization_id).
// =============================================================================

export async function getDocumentVersionLineage(
  artifactId: string,
  organizationId: string
): Promise<DocumentVersionLineageEntry[]> {
  return daoLoadVersionLineage(artifactId, organizationId);
}

export type { DocumentVersionLineageEntry };

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
