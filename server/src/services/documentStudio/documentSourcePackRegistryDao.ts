/**
 * Consultify Document Studio — Source Pack Registry DAO (Epic E4, Slice 4.1).
 *
 * Mirrors the `documentTemplateRegistryDao.ts` design contract:
 *
 *   - Acts as the persistence layer behind the in-process Map cache in
 *     `documentSourcePackService.ts`. The service public API stays
 *     synchronous; persistence is best-effort write-through.
 *   - Every operation is failure-tolerant: a missing migration, a DB
 *     outage, or any other error path resolves to `{ ok: false }` /
 *     `null` / `[]` and does NOT throw. The service falls back to the
 *     in-process Map when persistence is unavailable.
 *   - Reads (`loadSourcePacksForOrg`, `loadAuditForPack`) hydrate the
 *     cache lazily once per organization on cold start.
 *
 * Tenant safety: every query carries `organization_id` in the WHERE
 * clause; cross-tenant reads are deny-by-default.
 *
 * Storage backing (Epic E4, Slice 4.1): in-memory until the wave5
 * persistence migration ships in a follow-up slice. The service treats
 * the DAO as authoritative and writes through every state mutation, so
 * the Postgres swap is a mechanical replacement of the maps below
 * without changes to the public function signatures.
 */

import type {
  DocumentSourceRef,
  SourcePack,
  SourcePackAuditEntry,
  SourcePackItem,
  SourcePackStatus,
} from './documentStudioTypes.js';

// In-memory persistence stores, keyed by `${organizationId}::${packId}`.
// Both stores are intentionally module-scoped so the swap to the wave5
// migration is local to this file. Tests reset them via
// `__resetSourcePackRegistryDaoForTests`.
const packStore = new Map<string, SourcePack>();
const auditStore = new Map<string, SourcePackAuditEntry[]>();

function key(organizationId: string, packId: string): string {
  return `${organizationId}::${packId}`;
}

function clonePack(pack: SourcePack): SourcePack {
  return {
    ...pack,
    items: pack.items.map((item) => cloneItem(item)),
  };
}

function cloneItem(item: SourcePackItem): SourcePackItem {
  return {
    ...item,
    sourceRef: { ...(item.sourceRef as DocumentSourceRef) },
  };
}

/**
 * Load every pack visible to a tenant. Cross-tenant rows are deny-by-default
 * (filtered by the key prefix). Resolves to `[]` on any failure path.
 */
export async function loadSourcePacksForOrg(organizationId: string): Promise<SourcePack[]> {
  if (!organizationId) return [];
  const prefix = `${organizationId}::`;
  const out: SourcePack[] = [];
  for (const [k, pack] of packStore.entries()) {
    if (!k.startsWith(prefix)) continue;
    out.push(clonePack(pack));
  }
  return out;
}

/**
 * Single-pack lookup. Cross-tenant reads return `null` even when the
 * pack id exists under a different tenant.
 */
export async function loadSourcePackById(
  packId: string,
  organizationId: string
): Promise<SourcePack | null> {
  if (!packId || !organizationId) return null;
  const pack = packStore.get(key(organizationId, packId));
  return pack ? clonePack(pack) : null;
}

/**
 * Upsert a pack. Best-effort; never throws. Returns `{ ok: false }` on
 * an empty input so the service can choose to degrade silently.
 */
export async function persistSourcePack(pack: SourcePack): Promise<{ ok: boolean }> {
  if (!pack || !pack.packId || !pack.organizationId) return { ok: false };
  packStore.set(key(pack.organizationId, pack.packId), clonePack(pack));
  return { ok: true };
}

/**
 * Load the full audit trail for a pack. Returns `[]` on any failure or
 * cross-tenant attempt.
 */
export async function loadAuditForPack(
  packId: string,
  organizationId: string
): Promise<SourcePackAuditEntry[]> {
  if (!packId || !organizationId) return [];
  const entries = auditStore.get(key(organizationId, packId));
  return entries ? entries.map((entry) => ({ ...entry, details: entry.details ? { ...entry.details } : undefined })) : [];
}

/**
 * Append a single audit entry. Idempotent on duplicate `auditId` — a
 * second persist with the same id replaces the previous row so retries
 * don't double-count.
 */
export async function persistSourcePackAuditEntry(
  entry: SourcePackAuditEntry
): Promise<{ ok: boolean }> {
  if (!entry || !entry.auditId || !entry.packId || !entry.organizationId) {
    return { ok: false };
  }
  const k = key(entry.organizationId, entry.packId);
  const current = auditStore.get(k) ?? [];
  const filtered = current.filter((existing) => existing.auditId !== entry.auditId);
  filtered.push({
    ...entry,
    details: entry.details ? { ...entry.details } : undefined,
  });
  auditStore.set(k, filtered);
  return { ok: true };
}

/**
 * Soft-delete sentinel: marks every row for the given pack as archived
 * inside the in-memory store. The wave5 migration will switch this to
 * a status column update so reads can still see archived packs when
 * the caller opts in.
 */
export async function markSourcePackArchivedInDao(
  packId: string,
  organizationId: string,
  status: SourcePackStatus
): Promise<{ ok: boolean }> {
  if (!packId || !organizationId) return { ok: false };
  const pack = packStore.get(key(organizationId, packId));
  if (!pack) return { ok: false };
  pack.status = status;
  return { ok: true };
}

/** @internal Test-only reset of both in-memory stores. */
export async function __resetSourcePackRegistryDaoForTests(): Promise<void> {
  packStore.clear();
  auditStore.clear();
}
