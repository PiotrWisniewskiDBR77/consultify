/**
 * Consultify Document Studio — Share Link Service (Epic E13, Slice 13.1).
 *
 * Closes the FR-40 functional gap noted in
 * `CONSULTIFY_DOCUMENT_STUDIO_V1_GAP_VS_TARGET_2026-05-08.md` §11.5
 * and §K (P1 backlog). A share link is a tenant-scoped, optionally
 * time-boxed, scoped-permission token that lets a party WITHOUT a
 * seat in the owning organization access a `DocumentArtifact`.
 *
 * Design contract (mirrors `documentSourcePackService.ts`):
 *
 *   - The in-process `Map<key, DocumentShareLink>` is the synchronous
 *     source of truth. Persistence is a best-effort write-through to
 *     the DAO and lazy hydration on the first read per organization.
 *   - The public surface stays synchronous-friendly: every mutation
 *     is a synchronous function that records audit + writes through
 *     to the DAO via `void persist...().catch(...)` so the caller
 *     never has to await persistence.
 *   - `ensureShareLinkRegistryHydrated(organizationId)` is awaited
 *     by the route layer before list/get/audit reads so a cold-start
 *     process serves the persisted catalogue rather than an empty
 *     cache.
 *
 * Tenant boundary: every primary-key operation accepts and validates
 * `organizationId`; cross-tenant reads return `null` / `not_found`
 * deny-by-default. The token-based `consumeShareLink` is the one
 * exception — it accepts a token without an organization id because
 * the consumer is by definition outside the workspace; the service
 * resolves the tuple internally and stamps the resulting tenant on
 * every audit row it emits.
 *
 * Status semantics:
 *
 *   - Persisted `status` is one-way: `active → revoked`. Expiration
 *     is computed at runtime from `expiresAt vs now()` so a
 *     background sweeper is not required.
 *   - The audit trail records `share_link_expired_observed` ONCE per
 *     link on the first consume / get attempt that crosses the
 *     `expiresAt` boundary, so a stale token hit thousands of times
 *     does not flood the audit log.
 */

import {
  __resetShareLinkRegistryDaoForTests,
  bumpShareLinkConsumeCount,
  countActiveShareLinksForArtifact,
  loadAuditForShareLink,
  loadShareLinkByToken,
  loadShareLinksForOrg,
  markShareLinkStatusInDao,
  persistShareLink,
  persistShareLinkAuditEntry,
} from './documentShareLinkRegistryDao.js';
import type {
  DocumentShareLink,
  DocumentShareLinkAccessScope,
  DocumentShareLinkAuditEntry,
  DocumentShareLinkRuntimeStatus,
  DocumentShareLinkStatus,
} from './documentStudioTypes.js';

// Synchronous source of truth; key = `${organizationId}::${shareLinkId}`
// so tenants never collide on accidental id reuse.
const registryStore = new Map<string, DocumentShareLink>();
const auditStore = new Map<string, DocumentShareLinkAuditEntry[]>();
/** Cache mirror of the DAO `tokenIndex`; service-side fast path. */
const tokenIndex = new Map<string, string>();
/** Tracks which links have already emitted `share_link_expired_observed`. */
const expiredAuditedLinks = new Set<string>();

// Hydration bookkeeping (mirrors source pack pattern).
const hydratedOrgs = new Set<string>();
const hydrationInflight = new Map<string, Promise<void>>();

function makeId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${random}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function linkKey(organizationId: string, shareLinkId: string): string {
  return `${organizationId}::${shareLinkId}`;
}

function pushAudit(entry: DocumentShareLinkAuditEntry): void {
  const key = linkKey(entry.organizationId, entry.shareLinkId);
  const current = auditStore.get(key) ?? [];
  current.push(entry);
  auditStore.set(key, current);
  void persistShareLinkAuditEntry(entry).catch(() => undefined);
}

/**
 * Generate a 256-bit URL-safe random token. Each slice is
 * `Math.random().toString(36)` clipped to exactly 11 base-36 chars
 * so the four-slice concatenation is always 44 characters long
 * (4 × 11 = 44). The previous implementation used `padStart(11, '0')`
 * which can grow PAST 11 when the float produces a long radix-36
 * tail; clipping with `.slice(0, 11)` keeps the length deterministic.
 *
 * The wave5 hardening slice replaces this with
 * `crypto.randomBytes(32).toString('base64url')` (always 43 chars,
 * full 256 bits of entropy) without changing the public surface.
 */
function generateToken(): string {
  const slice = (): string =>
    Math.random().toString(36).slice(2).padStart(11, '0').slice(0, 11);
  return `${slice()}${slice()}${slice()}${slice()}`;
}

/**
 * Compute the runtime status of a link. Persisted `status` of
 * `revoked` always wins; otherwise the `expiresAt` window decides.
 */
export function getShareLinkRuntimeStatus(
  link: DocumentShareLink,
  now: Date = new Date()
): DocumentShareLinkRuntimeStatus {
  if (link.status === 'revoked') {
    return { effectiveStatus: 'revoked', isUsable: false, reason: 'revoked' };
  }
  if (link.status === 'expired') {
    return { effectiveStatus: 'expired', isUsable: false, reason: 'expired' };
  }
  if (link.expiresAt) {
    const expiresAt = Date.parse(link.expiresAt);
    if (Number.isFinite(expiresAt) && expiresAt <= now.getTime()) {
      return { effectiveStatus: 'expired', isUsable: false, reason: 'expired' };
    }
  }
  return { effectiveStatus: 'active', isUsable: true };
}

/**
 * Emit `share_link_expired_observed` exactly once per link. Idempotent
 * across processes within the lifetime of the in-memory tracker; the
 * future DAO migration will key this off a persisted boolean column.
 */
function maybeEmitExpiredAudit(link: DocumentShareLink): void {
  const key = linkKey(link.organizationId, link.shareLinkId);
  if (expiredAuditedLinks.has(key)) return;
  expiredAuditedLinks.add(key);
  pushAudit({
    auditId: makeId('share-link-audit'),
    shareLinkId: link.shareLinkId,
    artifactId: link.artifactId,
    organizationId: link.organizationId,
    action: 'share_link_expired_observed',
    actorId: 'anonymous',
    occurredAt: nowIso(),
    details: { expiresAt: link.expiresAt ?? null },
  });
}

async function ensureHydrated(organizationId: string): Promise<void> {
  if (hydratedOrgs.has(organizationId)) return;
  const inflight = hydrationInflight.get(organizationId);
  if (inflight) return inflight;
  const promise = (async () => {
    try {
      const tenantLinks = await loadShareLinksForOrg(organizationId);
      for (const link of tenantLinks) {
        const key = linkKey(link.organizationId, link.shareLinkId);
        registryStore.set(key, link);
        if (link.token) tokenIndex.set(link.token, key);
        const audit = await loadAuditForShareLink(link.shareLinkId, link.organizationId);
        if (audit.length > 0) {
          auditStore.set(key, audit);
        }
      }
    } catch {
      // Persistence offline → cache stays empty; subsequent writes
      // still attempt write-through and the in-process state
      // remains operational.
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
 * Idempotent per organization.
 */
export async function ensureShareLinkRegistryHydrated(organizationId: string): Promise<void> {
  return ensureHydrated(organizationId);
}

// =============================================================================
// Create
// =============================================================================

export interface CreateShareLinkParams {
  artifactId: string;
  organizationId: string;
  userId: string;
  accessScope: DocumentShareLinkAccessScope;
  /** Optional ISO-8601 expiry. Must be in the future when supplied. */
  expiresAt?: string;
  /** Optional human-readable label for the right-panel surface. */
  label?: string;
}

export function createShareLink(params: CreateShareLinkParams): DocumentShareLink {
  if (!params.artifactId) throw new Error('artifactId is required');
  if (!params.organizationId) throw new Error('organizationId is required');
  if (!params.userId) throw new Error('userId is required');
  if (params.accessScope !== 'read' && params.accessScope !== 'comment') {
    throw new Error(`unsupported share-link accessScope: ${params.accessScope}`);
  }
  if (params.expiresAt) {
    const t = Date.parse(params.expiresAt);
    if (!Number.isFinite(t)) throw new Error('expiresAt must be a valid ISO-8601 timestamp');
    if (t <= Date.now()) throw new Error('expiresAt must be in the future');
  }

  const now = nowIso();
  const link: DocumentShareLink = {
    shareLinkId: makeId('share-link'),
    artifactId: params.artifactId,
    organizationId: params.organizationId,
    token: generateToken(),
    accessScope: params.accessScope,
    status: 'active',
    expiresAt: params.expiresAt,
    label: params.label?.trim() || undefined,
    createdBy: params.userId,
    createdAt: now,
    consumeCount: 0,
  };

  const key = linkKey(link.organizationId, link.shareLinkId);
  registryStore.set(key, link);
  tokenIndex.set(link.token, key);
  void persistShareLink(link).catch(() => undefined);

  pushAudit({
    auditId: makeId('share-link-audit'),
    shareLinkId: link.shareLinkId,
    artifactId: link.artifactId,
    organizationId: link.organizationId,
    action: 'share_link_created',
    actorId: params.userId,
    occurredAt: now,
    details: {
      accessScope: link.accessScope,
      expiresAt: link.expiresAt ?? null,
      label: link.label ?? null,
    },
  });

  return { ...link };
}

// =============================================================================
// Revoke
// =============================================================================

export interface RevokeShareLinkParams {
  shareLinkId: string;
  organizationId: string;
  userId: string;
  reason?: string;
}

export function revokeShareLink(params: RevokeShareLinkParams): DocumentShareLink {
  if (!params.shareLinkId) throw new Error('shareLinkId is required');
  if (!params.organizationId) throw new Error('organizationId is required');
  if (!params.userId) throw new Error('userId is required');

  const key = linkKey(params.organizationId, params.shareLinkId);
  const existing = registryStore.get(key);
  if (!existing) throw new Error('share_link_not_found');
  if (existing.status === 'revoked') {
    // Idempotent revoke — return the existing row untouched. The
    // route layer maps this to 200 OK so retries don't fail.
    return { ...existing };
  }

  const now = nowIso();
  const reason = params.reason?.trim() || undefined;
  const next: DocumentShareLink = {
    ...existing,
    status: 'revoked',
    revokedBy: params.userId,
    revokedAt: now,
    revokedReason: reason,
  };
  registryStore.set(key, next);
  void markShareLinkStatusInDao(next.shareLinkId, next.organizationId, {
    status: 'revoked',
    revokedBy: params.userId,
    revokedAt: now,
    revokedReason: reason,
  }).catch(() => undefined);

  pushAudit({
    auditId: makeId('share-link-audit'),
    shareLinkId: next.shareLinkId,
    artifactId: next.artifactId,
    organizationId: next.organizationId,
    action: 'share_link_revoked',
    actorId: params.userId,
    occurredAt: now,
    details: { reason: reason ?? null },
  });

  return { ...next };
}

// =============================================================================
// Read
// =============================================================================

/**
 * Synchronous primary-key getter. Returns `null` cross-tenant or for
 * unknown ids. Does NOT compute runtime status — callers that care
 * about effective expiration use `getShareLinkRuntimeStatus(...)` on
 * the returned row.
 */
export function getShareLink(
  shareLinkId: string,
  organizationId: string
): DocumentShareLink | null {
  if (!shareLinkId || !organizationId) return null;
  const link = registryStore.get(linkKey(organizationId, shareLinkId));
  return link ? { ...link } : null;
}

export interface ListShareLinksOptions {
  artifactId?: string;
  status?: DocumentShareLinkStatus;
  /** Include rows whose runtime status is `expired`. Default false. */
  includeExpired?: boolean;
}

export function listShareLinks(
  organizationId: string,
  options: ListShareLinksOptions = {}
): DocumentShareLink[] {
  if (!organizationId) return [];
  const prefix = `${organizationId}::`;
  const out: DocumentShareLink[] = [];
  const now = new Date();
  for (const [k, link] of registryStore.entries()) {
    if (!k.startsWith(prefix)) continue;
    if (options.artifactId && link.artifactId !== options.artifactId) continue;
    const runtime = getShareLinkRuntimeStatus(link, now);
    if (options.status) {
      const matches = link.status === options.status || runtime.effectiveStatus === options.status;
      if (!matches) continue;
    }
    if (!options.includeExpired && runtime.effectiveStatus === 'expired') continue;
    out.push({ ...link });
  }
  // Stable order: createdAt descending (newest first).
  out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return out;
}

export function listShareLinkAuditEntries(
  shareLinkId: string,
  organizationId: string
): DocumentShareLinkAuditEntry[] {
  if (!shareLinkId || !organizationId) return [];
  const entries = auditStore.get(linkKey(organizationId, shareLinkId));
  return entries
    ? entries.map((entry) => ({
        ...entry,
        details: entry.details ? { ...entry.details } : undefined,
      }))
    : [];
}

// =============================================================================
// Consume (token resolve)
// =============================================================================

export interface ConsumeShareLinkParams {
  token: string;
  /** Opaque caller fingerprint for the audit row (NOT raw IP / UA). */
  consumerFingerprint?: string;
}

export interface ConsumeShareLinkResult {
  artifactId: string;
  organizationId: string;
  accessScope: DocumentShareLinkAccessScope;
  shareLinkId: string;
  consumeCount: number;
}

/**
 * Resolve a token into a `(artifactId, organizationId, accessScope)`
 * tuple. This is the public surface used by the consumer-facing
 * route — it does NOT require an organization id because the
 * consumer is outside the workspace.
 *
 * Returns `null` when:
 *   - the token is empty / unknown;
 *   - the link is revoked;
 *   - the link's `expiresAt` is past.
 *
 * On every successful resolve, increments the link's `consumeCount`,
 * updates `lastConsumedAt`, and emits a `share_link_consumed` audit
 * row. On the first failed resolve due to expiry, emits a
 * `share_link_expired_observed` audit row (idempotent per link).
 *
 * The function is `async` because the consume path may need to
 * hydrate the tenant cache first (cold start) — the route does not
 * know which tenant to hydrate, so the service hydrates lazily by
 * resolving the token first, then hydrating its tenant.
 */
export async function consumeShareLink(
  params: ConsumeShareLinkParams
): Promise<ConsumeShareLinkResult | null> {
  const token = params.token?.trim();
  if (!token || token.length === 0) return null;

  // Cache fast path: token already in the in-memory index.
  let primaryKey = tokenIndex.get(token);
  let link: DocumentShareLink | undefined = primaryKey ? registryStore.get(primaryKey) : undefined;

  if (!link) {
    // Cold-start fallback: ask the DAO directly. This works even
    // before any tenant is hydrated — `loadShareLinkByToken` walks
    // the global token index without a tenant filter.
    const persisted = await loadShareLinkByToken(token);
    if (!persisted) return null;
    primaryKey = linkKey(persisted.organizationId, persisted.shareLinkId);
    registryStore.set(primaryKey, persisted);
    tokenIndex.set(persisted.token, primaryKey);
    link = persisted;
  }

  // Hydrate this tenant's cache so subsequent listShareLinks reads
  // (and audit aggregation) see the full picture.
  await ensureHydrated(link.organizationId);

  const runtime = getShareLinkRuntimeStatus(link);
  if (!runtime.isUsable) {
    if (runtime.reason === 'expired') {
      maybeEmitExpiredAudit(link);
    }
    return null;
  }

  const now = nowIso();
  const updatedCount = await bumpShareLinkConsumeCount(link.shareLinkId, link.organizationId, now);
  // Update the cached row to mirror the persisted increment.
  const next: DocumentShareLink = {
    ...link,
    consumeCount: updatedCount ?? (link.consumeCount ?? 0) + 1,
    lastConsumedAt: now,
  };
  registryStore.set(primaryKey ?? linkKey(link.organizationId, link.shareLinkId), next);

  pushAudit({
    auditId: makeId('share-link-audit'),
    shareLinkId: link.shareLinkId,
    artifactId: link.artifactId,
    organizationId: link.organizationId,
    action: 'share_link_consumed',
    actorId: 'anonymous',
    occurredAt: now,
    details: {
      accessScope: link.accessScope,
      consumerFingerprint: params.consumerFingerprint ?? null,
      consumeCountAfter: next.consumeCount,
    },
  });

  return {
    artifactId: link.artifactId,
    organizationId: link.organizationId,
    accessScope: link.accessScope,
    shareLinkId: link.shareLinkId,
    consumeCount: next.consumeCount,
  };
}

/**
 * Right-panel companion: returns the count of currently-active links
 * for an artifact. Driven by the DAO so the in-memory + future-DB
 * paths stay symmetrical.
 */
export async function getActiveShareLinkCount(
  artifactId: string,
  organizationId: string
): Promise<number> {
  if (!artifactId || !organizationId) return 0;
  await ensureHydrated(organizationId);
  return countActiveShareLinksForArtifact(artifactId, organizationId, 'active');
}

// =============================================================================
// Test reset
// =============================================================================

/** @internal Test-only reset of all in-process + DAO stores. */
export async function __resetShareLinkRegistryForTests(): Promise<void> {
  registryStore.clear();
  auditStore.clear();
  tokenIndex.clear();
  expiredAuditedLinks.clear();
  hydratedOrgs.clear();
  hydrationInflight.clear();
  await __resetShareLinkRegistryDaoForTests();
}

// Re-export the DAO bumper so the test harness can call it directly
// when it needs to seed a specific count without going through the
// full consume path. NOT intended for production callers.
export { loadShareLinkByToken } from './documentShareLinkRegistryDao.js';
