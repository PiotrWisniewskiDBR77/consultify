/**
 * Consultify Document Studio — Share Link Registry DAO (Epic E13).
 *
 * Mirrors the `documentSourcePackRegistryDao.ts` design contract:
 *
 *   - Acts as the persistence layer behind the in-process Map cache in
 *     `documentShareLinkService.ts`. The service public API stays
 *     synchronous; persistence is best-effort write-through.
 *   - Every operation is failure-tolerant: a missing migration, a DB
 *     outage, or any other error path resolves to `{ ok: false }` /
 *     `null` / `[]` and does NOT throw. The service falls back to the
 *     in-process Map when persistence is unavailable.
 *   - Reads (`loadShareLinksForOrg`, `loadShareLinkByToken`,
 *     `loadAuditForShareLink`) hydrate the cache lazily once per
 *     organization on cold start (driven by the service).
 *
 * Tenant safety: every primary-key query carries `organization_id` so
 * cross-tenant reads are deny-by-default. The token-based resolve
 * (`loadShareLinkByToken`) is the one exception — it intentionally
 * does NOT take a tenant id, because the external consumer does not
 * know which tenant owns the link. The token itself is the auth
 * signal; the resolver returns the tenant alongside the row, and the
 * service is responsible for tenant-stamping every downstream
 * mutation it emits.
 *
 * Storage backing (Epic E13, Slice 13.1): in-memory until the wave5
 * persistence migration ships in a follow-up slice. The service
 * treats the DAO as authoritative and writes through every state
 * mutation, so the Postgres swap is a mechanical replacement of the
 * maps below without changes to the public function signatures.
 */

import type {
  DocumentShareLink,
  DocumentShareLinkAuditEntry,
  DocumentShareLinkStatus,
} from './documentStudioTypes.js';

// In-memory persistence stores, keyed by `${organizationId}::${shareLinkId}`.
// `tokenIndex` is the secondary index that enables O(1) token → linkId
// resolution without scanning the primary store. Both stores are
// intentionally module-scoped so the swap to the wave5 migration is
// local to this file. Tests reset them via
// `__resetShareLinkRegistryDaoForTests`.
const linkStore = new Map<string, DocumentShareLink>();
const auditStore = new Map<string, DocumentShareLinkAuditEntry[]>();
/** token → primary key (`${organizationId}::${shareLinkId}`). */
const tokenIndex = new Map<string, string>();

function key(organizationId: string, shareLinkId: string): string {
  return `${organizationId}::${shareLinkId}`;
}

function cloneLink(link: DocumentShareLink): DocumentShareLink {
  return { ...link };
}

function cloneAuditEntry(entry: DocumentShareLinkAuditEntry): DocumentShareLinkAuditEntry {
  return {
    ...entry,
    details: entry.details ? { ...entry.details } : undefined,
  };
}

/**
 * Load every share link visible to a tenant. Cross-tenant rows are
 * deny-by-default (filtered by the key prefix). Resolves to `[]` on
 * any failure path.
 */
export async function loadShareLinksForOrg(organizationId: string): Promise<DocumentShareLink[]> {
  if (!organizationId) return [];
  const prefix = `${organizationId}::`;
  const out: DocumentShareLink[] = [];
  for (const [k, link] of linkStore.entries()) {
    if (!k.startsWith(prefix)) continue;
    out.push(cloneLink(link));
  }
  return out;
}

/**
 * Single-link lookup by primary key. Cross-tenant reads return `null`
 * even when the share-link id exists under a different tenant.
 */
export async function loadShareLinkById(
  shareLinkId: string,
  organizationId: string
): Promise<DocumentShareLink | null> {
  if (!shareLinkId || !organizationId) return null;
  const link = linkStore.get(key(organizationId, shareLinkId));
  return link ? cloneLink(link) : null;
}

/**
 * Token-based resolve. Returns the link AND its owning organization
 * because the consumer does not know the tenant in advance — the
 * service stamps the resulting tuple on every downstream mutation.
 *
 * Returns `null` when the token is empty / unknown / has been
 * unbound (e.g. the link was wiped via test-reset). Cross-tenant
 * leakage is impossible because the index maps token → exactly one
 * primary key.
 */
export async function loadShareLinkByToken(token: string): Promise<DocumentShareLink | null> {
  if (!token || token.trim().length === 0) return null;
  const primaryKey = tokenIndex.get(token);
  if (!primaryKey) return null;
  const link = linkStore.get(primaryKey);
  return link ? cloneLink(link) : null;
}

/**
 * Upsert a share link. Best-effort; never throws. Returns
 * `{ ok: false }` on an empty input so the service can choose to
 * degrade silently. Keeps the token index in sync — re-persisting
 * a row with a different token (rare, but allowed; e.g. a future
 * "rotate token" affordance) updates the index atomically.
 */
export async function persistShareLink(link: DocumentShareLink): Promise<{ ok: boolean }> {
  if (!link || !link.shareLinkId || !link.organizationId || !link.token) {
    return { ok: false };
  }
  const primaryKey = key(link.organizationId, link.shareLinkId);
  // If a previous version of this link had a different token, drop
  // its index entry so a stale token can never resolve.
  const previous = linkStore.get(primaryKey);
  if (previous && previous.token && previous.token !== link.token) {
    tokenIndex.delete(previous.token);
  }
  linkStore.set(primaryKey, cloneLink(link));
  tokenIndex.set(link.token, primaryKey);
  return { ok: true };
}

/**
 * Apply a status update + revocation metadata in a single hop. Used
 * by the service's `revokeShareLink` path so the DAO never sees a
 * half-revoked row. Best-effort; returns `{ ok: false }` when the
 * link does not exist for the tenant.
 */
export async function markShareLinkStatusInDao(
  shareLinkId: string,
  organizationId: string,
  patch: Pick<DocumentShareLink, 'status'> &
    Partial<Pick<DocumentShareLink, 'revokedBy' | 'revokedAt' | 'revokedReason'>>
): Promise<{ ok: boolean }> {
  if (!shareLinkId || !organizationId) return { ok: false };
  const primaryKey = key(organizationId, shareLinkId);
  const link = linkStore.get(primaryKey);
  if (!link) return { ok: false };
  const next: DocumentShareLink = {
    ...link,
    status: patch.status,
    revokedBy: patch.revokedBy ?? link.revokedBy,
    revokedAt: patch.revokedAt ?? link.revokedAt,
    revokedReason: patch.revokedReason ?? link.revokedReason,
  };
  linkStore.set(primaryKey, next);
  return { ok: true };
}

/**
 * Increment the consume counter atomically alongside `lastConsumedAt`.
 * The service uses this on every successful `consumeShareLink` so
 * the right-panel surface can show "Used N times" without scanning
 * the audit log. Best-effort; returns the post-increment count or
 * `null` when the link does not exist.
 */
export async function bumpShareLinkConsumeCount(
  shareLinkId: string,
  organizationId: string,
  consumedAt: string
): Promise<number | null> {
  if (!shareLinkId || !organizationId) return null;
  const primaryKey = key(organizationId, shareLinkId);
  const link = linkStore.get(primaryKey);
  if (!link) return null;
  const next: DocumentShareLink = {
    ...link,
    consumeCount: (link.consumeCount ?? 0) + 1,
    lastConsumedAt: consumedAt,
  };
  linkStore.set(primaryKey, next);
  return next.consumeCount;
}

/**
 * Load the full audit trail for a link. Returns `[]` on any failure
 * or cross-tenant attempt. Sorted by `occurredAt` ascending so the
 * UI can render the timeline without re-sorting.
 */
export async function loadAuditForShareLink(
  shareLinkId: string,
  organizationId: string
): Promise<DocumentShareLinkAuditEntry[]> {
  if (!shareLinkId || !organizationId) return [];
  const entries = auditStore.get(key(organizationId, shareLinkId));
  if (!entries) return [];
  const cloned = entries.map((entry) => cloneAuditEntry(entry));
  cloned.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  return cloned;
}

/**
 * Append a single audit entry. Idempotent on duplicate `auditId` — a
 * second persist with the same id replaces the previous row so
 * retries don't double-count.
 */
export async function persistShareLinkAuditEntry(
  entry: DocumentShareLinkAuditEntry
): Promise<{ ok: boolean }> {
  if (!entry || !entry.auditId || !entry.shareLinkId || !entry.organizationId) {
    return { ok: false };
  }
  const k = key(entry.organizationId, entry.shareLinkId);
  const current = auditStore.get(k) ?? [];
  const filtered = current.filter((existing) => existing.auditId !== entry.auditId);
  filtered.push(cloneAuditEntry(entry));
  auditStore.set(k, filtered);
  return { ok: true };
}

/**
 * Sentinel used by the FE-E2 right-panel UI: returns the count of
 * active links for an artifact without copying the rows. Implemented
 * here (vs in the service) so the in-memory + future-DB
 * implementations stay symmetrical and the route layer can keep its
 * narrow surface.
 */
export async function countActiveShareLinksForArtifact(
  artifactId: string,
  organizationId: string,
  statusToCount: DocumentShareLinkStatus = 'active'
): Promise<number> {
  if (!artifactId || !organizationId) return 0;
  const prefix = `${organizationId}::`;
  let count = 0;
  for (const [k, link] of linkStore.entries()) {
    if (!k.startsWith(prefix)) continue;
    if (link.artifactId !== artifactId) continue;
    if (link.status !== statusToCount) continue;
    count += 1;
  }
  return count;
}

/** @internal Test-only reset of all in-memory stores. */
export async function __resetShareLinkRegistryDaoForTests(): Promise<void> {
  linkStore.clear();
  auditStore.clear();
  tokenIndex.clear();
}
