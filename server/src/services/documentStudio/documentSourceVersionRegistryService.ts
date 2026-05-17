/**
 * Consultify Document Studio — Source Version Registry (Slice E5.6.qa.hard).
 *
 * Tenant-scoped registry of every `sourceVersion` value the system has
 * ever seen for a given `(sourceType, sourceId)` tuple. Closes the
 * §17.3 follow-up gap noted in
 * `CONSULTIFY_DOCUMENT_STUDIO_V1_GAP_VS_TARGET_2026-05-08.md`:
 *
 *   "E5.6.qa.hard — registry-side hard-drift comparator (compare
 *    pinned `sourceVersion` vs latest known version). Needs a
 *    per-source latest-version lookup in `documentSourcePackService`."
 *
 * The registry is **append-only**. Every successful
 * `addSourcePackItem` call (in `documentSourcePackService.ts`) records
 * the item's `sourceRef.sourceVersion` if present, building up a
 * monotonically growing history of versions per `(orgId, type, id)`.
 *
 * The registry **never persists across processes** — it is rebuilt on
 * cold-start by replaying source pack items through the same
 * `recordSeenSourceVersion` calls that fire on ingestion. A future
 * persistence layer can layer on top by hydrating the in-memory map
 * from the source pack DAO; that's deferred until we have an actual
 * cross-process need.
 *
 * Hard-drift comparison contract:
 *
 *   - "latest known version" is the **most recently recorded**
 *     version for the tuple, NOT a semver-sorted maximum. Most source
 *     types in V8 do not use semver (e.g. interview transcript ids
 *     are timestamps, finance-pack revisions are monotonic ints), so
 *     a recency-based latest is more universally meaningful than a
 *     sort-based one.
 *
 *   - When a `DocumentSourceRef` is pinned to a specific
 *     `sourceVersion` and the registry has seen a NEWER version
 *     since, that ref is in HARD drift. The QA pipeline (slice
 *     E5.6.qa.hard wiring in `documentQaService.runSourceDriftQa`)
 *     surfaces that as a `medium`-severity advisory (still
 *     non-blocking until we have approver consent on the gating
 *     contract).
 *
 *   - Refs without a `sourceVersion` are SOFT drift candidates
 *     (slice E5.6.qa) — that path stays unchanged. Hard drift only
 *     fires for explicitly-pinned refs.
 *
 * Tenant isolation: every read / write keys on `organizationId` so
 * one tenant can never observe another tenant's version history.
 *
 * Determinism: the registry's "latest" is the LAST entry recorded
 * for the tuple, so the test harness can drive it deterministically
 * by ordering its `recordSeenSourceVersion` calls.
 */

// `DocumentSourceRef.sourceType` is declared as `string` in
// `documentStudioTypes.ts` (open vocabulary across V8 source kinds),
// so this registry mirrors the loose typing rather than narrowing.
type SourceTypeId = string;

interface SourceVersionRecord {
  /** The version literal as recorded; comparison is string-equality. */
  sourceVersion: string;
  /** ISO timestamp when this version was first observed for the tuple. */
  recordedAt: string;
  /** Optional snapshot id observed on the same ref. */
  sourceSnapshotId?: string;
}

/**
 * Key shape: `${organizationId}::${sourceType}::${sourceId}`.
 * Tenants never collide because `organizationId` leads the key.
 */
function tupleKey(organizationId: string, sourceType: string, sourceId: string): string {
  return `${organizationId}::${sourceType}::${sourceId}`;
}

const registry = new Map<string, SourceVersionRecord[]>();

export interface RecordSeenSourceVersionParams {
  organizationId: string;
  sourceType: SourceTypeId;
  sourceId: string;
  sourceVersion: string;
  sourceSnapshotId?: string;
  /** Override the recorded timestamp (default: now). Test-friendly. */
  recordedAt?: string;
}

/**
 * Append-only record of a `sourceVersion` observation. Idempotent on
 * the trio (orgId, type, id, version) — recording the same version
 * twice does NOT add a duplicate entry but DOES update `recordedAt`
 * to the most recent occurrence so "latest" tracks observation
 * recency rather than first-sighting.
 *
 * Empty / whitespace-only inputs are silently ignored so the caller
 * (typically `addSourcePackItem`) does not need to pre-validate.
 */
export function recordSeenSourceVersion(params: RecordSeenSourceVersionParams): void {
  if (!params.organizationId || params.organizationId.trim().length === 0) return;
  if (!params.sourceId || params.sourceId.trim().length === 0) return;
  if (!params.sourceVersion || params.sourceVersion.trim().length === 0) return;

  const key = tupleKey(params.organizationId, params.sourceType, params.sourceId);
  const existing = registry.get(key) ?? [];
  const recordedAt = params.recordedAt ?? new Date().toISOString();
  const trimmedVersion = params.sourceVersion.trim();
  const trimmedSnapshot = params.sourceSnapshotId?.trim();

  // De-duplicate on (version, snapshot). Re-recording the same tuple
  // refreshes `recordedAt` so duplicate observations don't fan out
  // the array (and don't lose recency information).
  const dupIdx = existing.findIndex(
    (r) =>
      r.sourceVersion === trimmedVersion &&
      (r.sourceSnapshotId ?? undefined) === (trimmedSnapshot || undefined)
  );

  if (dupIdx >= 0) {
    existing[dupIdx] = {
      sourceVersion: trimmedVersion,
      sourceSnapshotId: trimmedSnapshot || undefined,
      recordedAt,
    };
    registry.set(key, existing);
    return;
  }

  existing.push({
    sourceVersion: trimmedVersion,
    sourceSnapshotId: trimmedSnapshot || undefined,
    recordedAt,
  });
  registry.set(key, existing);
}

export interface GetLatestKnownSourceVersionParams {
  organizationId: string;
  sourceType: SourceTypeId;
  sourceId: string;
}

/**
 * Returns the most recently recorded version for the tuple, or
 * `null` if the registry has never seen this `(type, id)` pair under
 * this `organizationId`. Recency = max `recordedAt` across all
 * observations; ties break to insertion order (latest insert wins).
 *
 * Snapshots and versions are recorded together; if multiple snapshot
 * ids exist for the same version, the latest-recorded one is
 * returned alongside.
 */
export function getLatestKnownSourceVersion(
  params: GetLatestKnownSourceVersionParams
): { sourceVersion: string; sourceSnapshotId?: string; recordedAt: string } | null {
  if (!params.organizationId) return null;
  if (!params.sourceId) return null;

  const key = tupleKey(params.organizationId, params.sourceType, params.sourceId);
  const records = registry.get(key);
  if (!records || records.length === 0) return null;

  // Linear scan — registries are bounded by tenant ingestion volume
  // and rarely exceed double-digit entries per tuple in practice.
  // Switching to a sorted structure can wait for hot-path evidence.
  let latest = records[0];
  for (const r of records) {
    if (r.recordedAt > latest.recordedAt) latest = r;
  }
  return {
    sourceVersion: latest.sourceVersion,
    sourceSnapshotId: latest.sourceSnapshotId,
    recordedAt: latest.recordedAt,
  };
}

export interface CompareSourceVersionPinParams {
  organizationId: string;
  sourceType: SourceTypeId;
  sourceId: string;
  pinnedSourceVersion: string;
}

export type SourceVersionPinComparison =
  | { kind: 'no_registry_entry'; latest: null }
  | { kind: 'in_sync'; latest: { sourceVersion: string; recordedAt: string } }
  | { kind: 'hard_drift'; latest: { sourceVersion: string; recordedAt: string } };

/**
 * Compare a pinned `sourceVersion` against the registry's latest
 * known version. Three outcomes:
 *
 *   - `no_registry_entry` — registry has never seen the tuple
 *     (e.g. a ref pinned to a version that was never ingested via
 *     a source pack). Caller should NOT emit hard-drift in this
 *     case; the soft-drift / unpinned layer is the right surface.
 *
 *   - `in_sync` — pinned == latest. No drift.
 *
 *   - `hard_drift` — pinned != latest. The author wrote against a
 *     version older than what the registry has now seen.
 */
export function compareSourceVersionPin(
  params: CompareSourceVersionPinParams
): SourceVersionPinComparison {
  const latest = getLatestKnownSourceVersion(params);
  if (!latest) return { kind: 'no_registry_entry', latest: null };
  const pin = params.pinnedSourceVersion?.trim() ?? '';
  if (pin === latest.sourceVersion) {
    return { kind: 'in_sync', latest };
  }
  return { kind: 'hard_drift', latest };
}

/**
 * Test-only reset. Production code MUST NOT call this; it exists to
 * give the test harness a clean slate between specs without forcing
 * each test to track keys it has touched.
 */
export function __resetSourceVersionRegistryForTests(): void {
  registry.clear();
}
