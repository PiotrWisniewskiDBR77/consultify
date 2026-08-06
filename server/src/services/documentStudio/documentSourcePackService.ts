/**
 * Consultify Document Studio — Source Pack Service (Epic E4, Slice 4.1).
 *
 * Source Packs are tenant-scoped, addressable bundles of evidence that
 * feed Mode 1 / Mode 2 / Mode 3 generation. A pack groups the items a
 * connector layer ingests (URL, raw text, file, V8 artifact, integration)
 * and exposes them as `DocumentSourceRef[]` when attached to a document.
 *
 * Design contract (mirrors `documentTemplateService.ts`):
 *
 *   - The in-process `Map<key, SourcePack>` is the synchronous source of
 *     truth. Persistence is a best-effort write-through to the DAO and
 *     lazy hydration on the first read per organization.
 *   - The public surface stays synchronous-friendly: every mutation is a
 *     synchronous function that records audit + writes through to the
 *     DAO via `void persistX().catch(...)` so the caller never has to
 *     await persistence.
 *   - `ensureSourcePackRegistryHydrated(organizationId)` is awaited by the
 *     route layer before list/get/audit reads so a cold-start process
 *     serves the persisted catalogue rather than an empty cache.
 *
 * Tenant boundary: every operation accepts and validates `organizationId`;
 * cross-tenant reads return `null` / `not_found` deny-by-default.
 *
 * Governance: status transitions follow the explicit lifecycle
 *   draft -> ready (when items are sufficient and the consultant signs off)
 *   draft|ready -> archived (irreversible; archived packs cannot be
 *   attached to new documents but stay visible in audit history).
 */

import {
  __resetSourcePackRegistryDaoForTests,
  loadAuditForPack,
  loadSourcePackById,
  loadSourcePacksForOrg,
  markSourcePackArchivedInDao,
  persistSourcePackAuditEntry,
  persistSourcePackWithAudit,
} from './documentSourcePackRegistryDao.js';
import { recordSeenSourceVersion } from './documentSourceVersionRegistryService.js';
import type {
  DocumentSourceRef,
  SourcePack,
  SourcePackAuditEntry,
  SourcePackItem,
  SourcePackItemType,
  SourcePackStatus,
} from './documentStudioTypes.js';

// Synchronous source of truth; key = `${organizationId}::${packId}` so
// tenants never collide on accidental id reuse.
const registryStore = new Map<string, SourcePack>();
const auditStore = new Map<string, SourcePackAuditEntry[]>();

// Sprint-1 (template-style) hydration bookkeeping.
const hydratedOrgs = new Set<string>();
const hydrationInflight = new Map<string, Promise<void>>();

function makeId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${random}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function packKey(organizationId: string, packId: string): string {
  return `${organizationId}::${packId}`;
}

function pushAudit(entry: SourcePackAuditEntry): void {
  const key = packKey(entry.organizationId, entry.packId);
  const current = auditStore.get(key) ?? [];
  current.push(entry);
  auditStore.set(key, current);
  void persistSourcePackAuditEntry(entry).catch(() => undefined);
}

function recordAuditInMemory(entry: SourcePackAuditEntry): void {
  const key = packKey(entry.organizationId, entry.packId);
  const current = auditStore.get(key) ?? [];
  current.push(entry);
  auditStore.set(key, current);
}

/**
 * Commit one lifecycle transition: persist the new pack state and its audit
 * entry atomically FIRST, and only then publish the transition to the
 * in-process cache.
 *
 * The order is deliberate and is the fix for the persistence defect. The
 * previous shape mutated the cache, fired two un-awaited upserts and returned
 * synchronously, so:
 *
 *   - the caller was told the transition succeeded before anything reached
 *     Postgres, and could never learn that it had not — a false success;
 *   - consecutive transitions on the same pack raced, and an earlier upsert
 *     landing late overwrote a later one. A pack promoted to `ready` was read
 *     back from Postgres as `draft`.
 *
 * Persisting before publishing means a failed write leaves the cache holding
 * the last state that IS in the database, rather than a phantom newer one.
 * The lifecycle contract itself is untouched: the same validations, the same
 * transitions, the same idempotence, the same error identifiers.
 */
async function commitTransition(next: SourcePack, audit: SourcePackAuditEntry): Promise<SourcePack> {
  const result = await persistSourcePackWithAudit(next, audit);
  if (!result.ok) {
    throw new Error('source_pack_persist_failed');
  }
  registryStore.set(packKey(next.organizationId, next.packId), next);
  recordAuditInMemory(audit);
  return next;
}

function recomputeContentLength(items: SourcePackItem[]): number {
  return items.reduce((acc, item) => acc + (item.contentLength || 0), 0);
}

function readyToAttach(pack: SourcePack): boolean {
  return pack.status === 'ready';
}

async function ensureHydrated(organizationId: string): Promise<void> {
  if (hydratedOrgs.has(organizationId)) return;
  const inflight = hydrationInflight.get(organizationId);
  if (inflight) return inflight;
  const promise = (async () => {
    try {
      const tenantPacks = await loadSourcePacksForOrg(organizationId);
      for (const pack of tenantPacks) {
        registryStore.set(packKey(pack.organizationId, pack.packId), pack);
        const audit = await loadAuditForPack(pack.packId, pack.organizationId);
        if (audit.length > 0) {
          auditStore.set(packKey(pack.organizationId, pack.packId), audit);
        }
      }
    } catch {
      // Persistence offline → cache stays empty; subsequent writes still
      // attempt write-through and the in-process state remains operational.
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

/**
 * Public hydration trigger used by route handlers before list/get/audit
 * reads so a cold-start process always serves the persisted catalogue.
 * Idempotent per organization; subsequent calls are no-ops.
 */
export async function ensureSourcePackRegistryHydrated(organizationId: string): Promise<void> {
  return ensureHydrated(organizationId);
}

// =============================================================================
// Draft / mutate / lifecycle
// =============================================================================

export interface DraftSourcePackParams {
  organizationId: string;
  userId: string;
  name: string;
  description?: string;
  language: 'pl' | 'en';
  notes?: string;
}

/**
 * Create an empty `draft` pack. Connectors append items via
 * `addSourcePackItem`. The pack is not usable for attach until it is
 * promoted to `ready` via `markSourcePackReady`.
 */
export async function draftSourcePack(params: DraftSourcePackParams): Promise<SourcePack> {
  if (!params.organizationId) throw new Error('organizationId is required');
  if (!params.userId) throw new Error('userId is required');
  if (!params.name || params.name.trim().length === 0) {
    throw new Error('source pack name is required');
  }
  if (params.language !== 'pl' && params.language !== 'en') {
    throw new Error('source pack language must be pl or en');
  }

  const now = nowIso();
  const pack: SourcePack = {
    packId: makeId('source-pack'),
    organizationId: params.organizationId,
    name: params.name.trim(),
    description: params.description?.trim() || undefined,
    language: params.language,
    items: [],
    totalContentLength: 0,
    status: 'draft',
    createdBy: params.userId,
    createdAt: now,
    updatedAt: now,
    notes: params.notes?.trim() || undefined,
  };

  return commitTransition(pack, {
    auditId: makeId('source-pack-audit'),
    packId: pack.packId,
    organizationId: params.organizationId,
    action: 'pack_drafted',
    actorId: params.userId,
    occurredAt: now,
    details: { language: pack.language, name: pack.name },
  });
}

export interface AddSourcePackItemParams {
  organizationId: string;
  userId: string;
  packId: string;
  /**
   * Pre-built item shape. Connectors normalize their native payload into
   * a `SourcePackItem` before calling this; the service is connector-
   * agnostic on purpose. `itemId` is generated here when missing.
   */
  item: Omit<SourcePackItem, 'itemId' | 'ingestedAt' | 'ingestedBy'> & {
    itemId?: string;
    ingestedAt?: string;
    ingestedBy?: string;
  };
}

/**
 * Append an item to a pack. Rejects if the pack is `archived` (immutable)
 * or if the item type is unknown. `ready` packs accept new items —
 * the consultant explicitly opts back into draft semantics by calling
 * this on a ready pack and the status flips back to `draft`.
 */
export async function addSourcePackItem(params: AddSourcePackItemParams): Promise<SourcePack> {
  if (!params.organizationId) throw new Error('organizationId is required');
  if (!params.userId) throw new Error('userId is required');
  const pack = getSourcePack(params.packId, params.organizationId);
  if (!pack) throw new Error('source_pack_not_found');
  if (pack.status === 'archived') throw new Error('source_pack_archived');
  if (!params.item || !params.item.title || params.item.title.trim().length === 0) {
    throw new Error('source pack item title is required');
  }
  const allowed: SourcePackItemType[] = ['url', 'text', 'file', 'integration', 'v8_artifact'];
  if (!allowed.includes(params.item.itemType)) {
    throw new Error(`unsupported source pack item type: ${params.item.itemType}`);
  }
  if (!params.item.sourceRef || !params.item.sourceRef.sourceId) {
    throw new Error('source pack item must declare a sourceRef with sourceId');
  }

  const now = nowIso();
  const newItem: SourcePackItem = {
    itemId: params.item.itemId ?? makeId('source-pack-item'),
    itemType: params.item.itemType,
    title: params.item.title.trim(),
    body: params.item.body,
    bodyTruncated: params.item.bodyTruncated,
    contentLength: params.item.contentLength ?? (params.item.body ? params.item.body.length : 0),
    uri: params.item.uri,
    ingestedAt: params.item.ingestedAt ?? now,
    ingestedBy: params.item.ingestedBy ?? params.userId,
    language: params.item.language,
    notes: params.item.notes,
    sourceRef: { ...(params.item.sourceRef as DocumentSourceRef) },
  };

  const items = [...pack.items, newItem];
  const next: SourcePack = {
    ...pack,
    items,
    totalContentLength: recomputeContentLength(items),
    status: pack.status === 'ready' ? 'draft' : pack.status,
    updatedAt: now,
  };

  const committed = await commitTransition(next, {
    auditId: makeId('source-pack-audit'),
    packId: pack.packId,
    organizationId: params.organizationId,
    action: 'pack_item_added',
    actorId: params.userId,
    occurredAt: now,
    details: {
      itemId: newItem.itemId,
      itemType: newItem.itemType,
      contentLength: newItem.contentLength,
      previousStatus: pack.status,
    },
  });

  // Slice E5.6.qa.hard — when the freshly-ingested item carries a
  // `sourceVersion` on its `sourceRef`, register the observation in
  // the per-tenant version registry. This builds up the per-tuple
  // history that `runSourceDriftQa` consults to flag HARD drift
  // (pinned ≠ latest known). Wrapped defensively because the
  // registry is a best-effort observability layer; a hiccup here
  // must NEVER fail an otherwise-successful ingestion.
  try {
    const ref = newItem.sourceRef;
    if (ref?.sourceVersion && ref.sourceVersion.trim().length > 0) {
      recordSeenSourceVersion({
        organizationId: params.organizationId,
        sourceType: ref.sourceType,
        sourceId: ref.sourceId,
        sourceVersion: ref.sourceVersion,
        sourceSnapshotId: ref.sourceSnapshotId,
        recordedAt: now,
      });
    }
  } catch {
    // ignore — see contract above
  }

  return committed;
}

export interface RemoveSourcePackItemParams {
  organizationId: string;
  userId: string;
  packId: string;
  itemId: string;
}

export async function removeSourcePackItem(
  params: RemoveSourcePackItemParams
): Promise<SourcePack> {
  if (!params.organizationId) throw new Error('organizationId is required');
  if (!params.userId) throw new Error('userId is required');
  const pack = getSourcePack(params.packId, params.organizationId);
  if (!pack) throw new Error('source_pack_not_found');
  if (pack.status === 'archived') throw new Error('source_pack_archived');
  const target = pack.items.find((item) => item.itemId === params.itemId);
  if (!target) throw new Error('source_pack_item_not_found');

  const now = nowIso();
  const items = pack.items.filter((item) => item.itemId !== params.itemId);
  const next: SourcePack = {
    ...pack,
    items,
    totalContentLength: recomputeContentLength(items),
    // Removing an item from a ready pack reverts it to draft so the
    // consultant must explicitly re-confirm the smaller scope.
    status: pack.status === 'ready' ? 'draft' : pack.status,
    updatedAt: now,
  };

  return commitTransition(next, {
    auditId: makeId('source-pack-audit'),
    packId: pack.packId,
    organizationId: params.organizationId,
    action: 'pack_item_removed',
    actorId: params.userId,
    occurredAt: now,
    details: { itemId: target.itemId, itemType: target.itemType },
  });
}

export interface MarkSourcePackReadyParams {
  organizationId: string;
  userId: string;
  packId: string;
  notes?: string;
}

/**
 * Promote a `draft` pack to `ready`. Rejects empty packs and archived
 * packs. Idempotent on already-ready packs (returns the pack unchanged).
 */
export async function markSourcePackReady(
  params: MarkSourcePackReadyParams
): Promise<SourcePack> {
  if (!params.organizationId) throw new Error('organizationId is required');
  if (!params.userId) throw new Error('userId is required');
  const pack = getSourcePack(params.packId, params.organizationId);
  if (!pack) throw new Error('source_pack_not_found');
  if (pack.status === 'archived') throw new Error('source_pack_archived');
  if (pack.status === 'ready') return pack;
  if (pack.items.length === 0) throw new Error('source_pack_empty');

  const now = nowIso();
  const next: SourcePack = {
    ...pack,
    status: 'ready',
    updatedAt: now,
    notes: params.notes?.trim() || pack.notes,
  };

  return commitTransition(next, {
    auditId: makeId('source-pack-audit'),
    packId: pack.packId,
    organizationId: params.organizationId,
    action: 'pack_marked_ready',
    actorId: params.userId,
    occurredAt: now,
    details: { itemCount: pack.items.length, totalContentLength: pack.totalContentLength },
  });
}

export interface ArchiveSourcePackParams {
  organizationId: string;
  userId: string;
  packId: string;
  reason?: string;
}

export async function archiveSourcePack(params: ArchiveSourcePackParams): Promise<SourcePack> {
  if (!params.organizationId) throw new Error('organizationId is required');
  if (!params.userId) throw new Error('userId is required');
  const pack = getSourcePack(params.packId, params.organizationId);
  if (!pack) throw new Error('source_pack_not_found');
  if (pack.status === 'archived') return pack;

  const now = nowIso();
  const next: SourcePack = {
    ...pack,
    status: 'archived',
    archivedBy: params.userId,
    archivedAt: now,
    updatedAt: now,
  };

  await commitTransition(next, {
    auditId: makeId('source-pack-audit'),
    packId: pack.packId,
    organizationId: params.organizationId,
    action: 'pack_archived',
    actorId: params.userId,
    occurredAt: now,
    details: { previousStatus: pack.status, reason: params.reason },
  });

  // Belt-and-braces for the scalar `status` column on rows written before the
  // payload carried the archived status. The authoritative write is the
  // transactional upsert above; this is a no-op on a consistent row.
  void markSourcePackArchivedInDao(pack.packId, params.organizationId, 'archived').catch(
    () => undefined
  );

  return next;
}

// =============================================================================
// Reads
// =============================================================================

export function getSourcePack(packId: string, organizationId: string): SourcePack | null {
  if (!packId || !organizationId) return null;
  return registryStore.get(packKey(organizationId, packId)) ?? null;
}

export interface ListSourcePacksOptions {
  status?: SourcePackStatus;
  language?: 'pl' | 'en';
  /** When true (default false), include archived packs in the result. */
  includeArchived?: boolean;
}

export function listSourcePacks(
  organizationId: string,
  options: ListSourcePacksOptions = {}
): SourcePack[] {
  if (!organizationId) return [];
  const prefix = `${organizationId}::`;
  const out: SourcePack[] = [];
  for (const [key, pack] of registryStore.entries()) {
    if (!key.startsWith(prefix)) continue;
    if (options.status && pack.status !== options.status) continue;
    if (options.language && pack.language !== options.language) continue;
    if (!options.includeArchived && pack.status === 'archived') continue;
    out.push(pack);
  }
  // Newest first for UI ergonomics.
  return out.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
}

export function listSourcePackAuditEntries(
  packId: string,
  organizationId: string
): SourcePackAuditEntry[] {
  if (!packId || !organizationId) return [];
  return [...(auditStore.get(packKey(organizationId, packId)) ?? [])];
}

// =============================================================================
// Attach to document — produces the `DocumentSourceRef[]` the existing
// materializeDocumentArtifact pipeline already accepts. Records an audit
// entry so the document's provenance trail can show "this document was
// generated from pack X with N items".
// =============================================================================

export interface AttachSourcePackToDocumentParams {
  organizationId: string;
  userId: string;
  packId: string;
  artifactId: string;
}

export interface AttachSourcePackToDocumentResult {
  pack: SourcePack;
  sourceRefs: DocumentSourceRef[];
}

/**
 * Project a `ready` pack to the `DocumentSourceRef[]` shape expected by
 * `materializeDocumentArtifact`. Records a `pack_attached_to_document`
 * audit entry on the pack carrying the artifact id so future audits can
 * pivot from a pack to every document grounded in it.
 *
 * Throws when the pack is not yet `ready` so callers cannot accidentally
 * generate against a half-assembled bundle.
 */
export function attachSourcePackToDocument(
  params: AttachSourcePackToDocumentParams
): AttachSourcePackToDocumentResult {
  if (!params.organizationId) throw new Error('organizationId is required');
  if (!params.userId) throw new Error('userId is required');
  if (!params.artifactId) throw new Error('artifactId is required');
  const pack = getSourcePack(params.packId, params.organizationId);
  if (!pack) throw new Error('source_pack_not_found');
  if (!readyToAttach(pack)) throw new Error('source_pack_not_ready');

  const sourceRefs: DocumentSourceRef[] = pack.items.map((item) => ({ ...item.sourceRef }));
  const now = nowIso();

  pushAudit({
    auditId: makeId('source-pack-audit'),
    packId: pack.packId,
    organizationId: params.organizationId,
    action: 'pack_attached_to_document',
    actorId: params.userId,
    occurredAt: now,
    details: {
      artifactId: params.artifactId,
      itemCount: sourceRefs.length,
      totalContentLength: pack.totalContentLength,
    },
  });

  return { pack, sourceRefs };
}

// =============================================================================
// Test-only helpers
// =============================================================================

/** @internal */
export function __resetSourcePackRegistryForTests(): void {
  registryStore.clear();
  auditStore.clear();
  hydratedOrgs.clear();
  hydrationInflight.clear();
}

/** @internal */
export async function __resetSourcePackRegistryAndPersistenceForTests(): Promise<void> {
  __resetSourcePackRegistryForTests();
  await __resetSourcePackRegistryDaoForTests();
}

/** @internal exposes the loadById helper for test scaffolding */
export async function __loadSourcePackByIdForTests(
  packId: string,
  organizationId: string
): Promise<SourcePack | null> {
  return loadSourcePackById(packId, organizationId);
}
