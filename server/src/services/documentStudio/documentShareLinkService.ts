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

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import {
  __resetShareLinkRegistryDaoForTests,
  bumpShareLinkConsumeCount,
  countActiveShareLinksForArtifact,
  loadAuditForShareLink,
  loadShareLinkById,
  loadShareLinkByToken,
  loadShareLinkByTokenHash,
  loadShareLinksForOrg,
  markShareLinkStatusInDao,
  persistShareLink,
  persistShareLinkAuditEntry,
  revokeActiveShareLinkInDao,
  rotateActiveShareLinkTokenInDao,
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
const editSessionStore = new Map<
  string,
  {
    shareLinkId: string;
    organizationId: string;
    artifactId: string;
    tokenHash: string;
    fingerprintHash: string;
    expiresAtMs: number;
  }
>();
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
 * Slice E13.hardening — secret used as the HMAC key when hashing
 * share-link tokens for persistence. Read from the environment so
 * production deployments rotate per-tenant; in tests / dev we fall
 * back to a fixed default so the hash is deterministic across
 * process restarts (which makes the in-memory DAO `loadShareLinkByToken`
 * fast path resolve consistently after a hot reload).
 *
 * Production deployments MUST set `SHARE_LINK_TOKEN_SECRET` to a
 * 256-bit random string (e.g. `openssl rand -base64 48`).
 */
const SHARE_LINK_TOKEN_SECRET =
  process.env.SHARE_LINK_TOKEN_SECRET ?? 'consultify-document-studio-share-link-default-dev-secret';

/**
 * Generate a 256-bit URL-safe random token using
 * `crypto.randomBytes(32).toString('base64url')`. Always 43
 * characters long and carries the full 256 bits of entropy from
 * the OS random pool — significantly stronger than the previous
 * `Math.random()`-derived token (which was the substrate used in
 * Slice E13.1 with a wave5 follow-up note).
 */
function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Compute the HMAC-SHA-256 hash of a plaintext token using the
 * per-process `SHARE_LINK_TOKEN_SECRET`. The hash is what we
 * persist + index by; the plaintext token is returned to the
 * caller exactly ONCE (at create / rotate) and lives in the
 * in-memory cache for the lifetime of the process.
 */
function hashToken(token: string): string {
  return createHmac('sha256', SHARE_LINK_TOKEN_SECRET).update(token).digest('hex');
}

/**
 * Constant-time comparison of two hex-encoded HMAC digests.
 * Required to avoid the timing-attack class where an attacker can
 * iteratively guess token bytes by measuring response latency.
 */
function timingSafeHashEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
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

const VALID_ACCESS_SCOPES: ReadonlySet<DocumentShareLinkAccessScope> = new Set([
  'read',
  'comment',
  'download',
  'edit',
]);

export function createShareLink(params: CreateShareLinkParams): DocumentShareLink {
  if (!params.artifactId) throw new Error('artifactId is required');
  if (!params.organizationId) throw new Error('organizationId is required');
  if (!params.userId) throw new Error('userId is required');
  if (!VALID_ACCESS_SCOPES.has(params.accessScope)) {
    throw new Error(`unsupported share-link accessScope: ${params.accessScope}`);
  }
  if (params.expiresAt) {
    const t = Date.parse(params.expiresAt);
    if (!Number.isFinite(t)) throw new Error('expiresAt must be a valid ISO-8601 timestamp');
    if (t <= Date.now()) throw new Error('expiresAt must be in the future');
  }

  const now = nowIso();
  const token = generateToken();
  const link: DocumentShareLink = {
    shareLinkId: makeId('share-link'),
    artifactId: params.artifactId,
    organizationId: params.organizationId,
    token,
    tokenHash: hashToken(token),
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

/**
 * Durable route boundary for link creation. Unlike the legacy synchronous
 * helper, this function does not publish the token in process memory or to
 * the caller until the registry row is confirmed by the database.
 */
export async function createShareLinkDurable(
  params: CreateShareLinkParams
): Promise<DocumentShareLink> {
  if (!params.artifactId) throw new Error('artifactId is required');
  if (!params.organizationId) throw new Error('organizationId is required');
  if (!params.userId) throw new Error('userId is required');
  if (!VALID_ACCESS_SCOPES.has(params.accessScope)) {
    throw new Error(`unsupported share-link accessScope: ${params.accessScope}`);
  }
  if (params.expiresAt) {
    const t = Date.parse(params.expiresAt);
    if (!Number.isFinite(t)) throw new Error('expiresAt must be a valid ISO-8601 timestamp');
    if (t <= Date.now()) throw new Error('expiresAt must be in the future');
  }

  const now = nowIso();
  const token = generateToken();
  const link: DocumentShareLink = {
    shareLinkId: makeId('share-link'),
    artifactId: params.artifactId,
    organizationId: params.organizationId,
    token,
    tokenHash: hashToken(token),
    accessScope: params.accessScope,
    status: 'active',
    expiresAt: params.expiresAt,
    label: params.label?.trim() || undefined,
    createdBy: params.userId,
    createdAt: now,
    consumeCount: 0,
  };
  const persisted = await persistShareLink(link);
  if (!persisted.ok) throw new Error('share_link_persistence_failed');

  const key = linkKey(link.organizationId, link.shareLinkId);
  registryStore.set(key, link);
  tokenIndex.set(link.token, key);
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

/** Security-sensitive durable revoke used by the HTTP route. */
export async function revokeShareLinkDurable(
  params: RevokeShareLinkParams
): Promise<DocumentShareLink> {
  if (!params.shareLinkId) throw new Error('shareLinkId is required');
  if (!params.organizationId) throw new Error('organizationId is required');
  if (!params.userId) throw new Error('userId is required');
  await ensureHydrated(params.organizationId);
  const key = linkKey(params.organizationId, params.shareLinkId);
  const existing = registryStore.get(key);
  if (!existing) throw new Error('share_link_not_found');
  if (existing.status === 'revoked') return { ...existing };

  const now = nowIso();
  const reason = params.reason?.trim() || undefined;
  const next: DocumentShareLink = {
    ...existing,
    status: 'revoked',
    revokedBy: params.userId,
    revokedAt: now,
    revokedReason: reason,
  };
  const persisted = await revokeActiveShareLinkInDao(next);
  if (!persisted.ok) throw new Error('share_link_persistence_failed');
  if (persisted.conflict) {
    const latest = await loadShareLinkById(params.shareLinkId, params.organizationId);
    if (latest?.status === 'revoked') {
      registryStore.set(key, latest);
      return { ...latest };
    }
    throw new Error('share_link_concurrent_change');
  }
  registryStore.set(key, next);
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
// Rotate token (Slice E13.hardening)
// =============================================================================

export interface RotateShareLinkTokenParams {
  shareLinkId: string;
  organizationId: string;
  userId: string;
  reason?: string;
}

/**
 * Mint a fresh token + hash for an existing active share link. Use
 * cases:
 *   - the link was inadvertently leaked outside its intended audience;
 *   - periodic rotation policy (e.g. every 90 days);
 *   - reset after a near-miss security incident.
 *
 * Constraints:
 *   - `shareLinkId` MUST exist within the supplied organization.
 *   - The link MUST currently be `active` (revoked / expired links
 *     cannot be rotated — revoke + re-create instead).
 *   - The previous token is INVALIDATED immediately. Any consumer
 *     holding the old token receives a 404 on the next consume.
 *
 * Audit row: `share_link_token_rotated` with `details.reason`.
 * The new plaintext token is exposed on the return row exactly
 * once; the route MUST surface it inline so the creator can re-
 * distribute. Subsequent reads of the link via `getShareLink` /
 * `listShareLinks` continue to expose the current `token` field
 * because the in-memory MVP DAO carries the plaintext. The wave5
 * migration drops the plaintext column; from there `rotateShareLinkToken`
 * is the only path that exposes plaintext post-creation.
 */
export function rotateShareLinkToken(params: RotateShareLinkTokenParams): DocumentShareLink {
  if (!params.shareLinkId) throw new Error('shareLinkId is required');
  if (!params.organizationId) throw new Error('organizationId is required');
  if (!params.userId) throw new Error('userId is required');

  const key = linkKey(params.organizationId, params.shareLinkId);
  const existing = registryStore.get(key);
  if (!existing) throw new Error('share_link_not_found');
  if (existing.status !== 'active') {
    throw new Error('share_link_not_active');
  }
  // Reject rotation on already-expired links — the consumer would
  // need a fresh expiresAt anyway, which means a new link is the
  // right answer. Surface a structured error so the route can map
  // it to a 409 conflict.
  const runtime = getShareLinkRuntimeStatus(existing);
  if (!runtime.isUsable) {
    throw new Error('share_link_not_active');
  }

  const newToken = generateToken();
  const newTokenHash = hashToken(newToken);
  const next: DocumentShareLink = {
    ...existing,
    token: newToken,
    tokenHash: newTokenHash,
  };
  registryStore.set(key, next);
  // Invalidate the old token in the in-process index immediately;
  // the new token gets indexed in its place.
  if (existing.token) tokenIndex.delete(existing.token);
  tokenIndex.set(newToken, key);
  void persistShareLink(next).catch(() => undefined);

  pushAudit({
    auditId: makeId('share-link-audit'),
    shareLinkId: next.shareLinkId,
    artifactId: next.artifactId,
    organizationId: next.organizationId,
    action: 'share_link_token_rotated',
    actorId: params.userId,
    occurredAt: nowIso(),
    details: {
      reason: params.reason?.trim() || null,
      // We never log the plaintext token. The hash provides forensic
      // continuity (auditors can verify that "this consume row used
      // the token that was rotated at this audit row") without
      // exposing the actual secret.
      newTokenHash: newTokenHash,
    },
  });

  return { ...next };
}

/** Security-sensitive durable token rotation used by the HTTP route. */
export async function rotateShareLinkTokenDurable(
  params: RotateShareLinkTokenParams
): Promise<DocumentShareLink> {
  if (!params.shareLinkId) throw new Error('shareLinkId is required');
  if (!params.organizationId) throw new Error('organizationId is required');
  if (!params.userId) throw new Error('userId is required');
  await ensureHydrated(params.organizationId);
  const key = linkKey(params.organizationId, params.shareLinkId);
  const existing = registryStore.get(key);
  if (!existing) throw new Error('share_link_not_found');
  if (existing.status !== 'active' || !getShareLinkRuntimeStatus(existing).isUsable) {
    throw new Error('share_link_not_active');
  }

  const newToken = generateToken();
  const newTokenHash = hashToken(newToken);
  const next: DocumentShareLink = { ...existing, token: newToken, tokenHash: newTokenHash };
  const persisted = await rotateActiveShareLinkTokenInDao(
    next,
    existing.tokenHash || hashToken(existing.token)
  );
  if (!persisted.ok) throw new Error('share_link_persistence_failed');
  if (persisted.conflict) throw new Error('share_link_concurrent_change');

  registryStore.set(key, next);
  if (existing.token) tokenIndex.delete(existing.token);
  tokenIndex.set(newToken, key);
  pushAudit({
    auditId: makeId('share-link-audit'),
    shareLinkId: next.shareLinkId,
    artifactId: next.artifactId,
    organizationId: next.organizationId,
    action: 'share_link_token_rotated',
    actorId: params.userId,
    occurredAt: nowIso(),
    details: { reason: params.reason?.trim() || null, newTokenHash },
  });
  return { ...next };
}

// =============================================================================
// Token verification (Slice E13.hardening)
// =============================================================================

/**
 * Constant-time check whether `candidateToken` corresponds to the
 * persisted `tokenHash` (or, for legacy rows, the persisted
 * plaintext `token`). Used by the consume path so an attacker
 * cannot bisect tokens via timing analysis.
 *
 * Returns `true` only when:
 *   - the link carries a `tokenHash` AND `hashToken(candidateToken)`
 *     matches it via timing-safe comparison; OR
 *   - the link carries no `tokenHash` (legacy / not-yet-rotated row)
 *     AND `candidateToken === link.token`.
 */
export function verifyShareLinkToken(
  link: Pick<DocumentShareLink, 'token' | 'tokenHash'>,
  candidateToken: string
): boolean {
  if (typeof candidateToken !== 'string' || candidateToken.length === 0) return false;
  if (link.tokenHash) {
    const candidateHash = hashToken(candidateToken);
    return timingSafeHashEqual(candidateHash, link.tokenHash);
  }
  // Legacy / not-yet-rotated rows have no hash; compare plaintext
  // in constant time by lexicographic length-equal byte buffer.
  if (typeof link.token !== 'string' || link.token.length !== candidateToken.length) return false;
  try {
    return timingSafeEqual(Buffer.from(link.token, 'utf8'), Buffer.from(candidateToken, 'utf8'));
  } catch {
    return false;
  }
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
    const persisted =
      (await loadShareLinkByToken(token)) ?? (await loadShareLinkByTokenHash(hashToken(token)));
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

export interface CreateShareLinkEditSessionParams {
  token: string;
  consumerFingerprint: string;
}

export interface CreateShareLinkEditSessionResult {
  shareLinkId: string;
  artifactId: string;
  organizationId: string;
  editSessionToken: string;
  expiresAt: string;
}

const EDIT_SESSION_TTL_MS = 30 * 60 * 1000;

/**
 * F1/F3 — client-reader comment cycle (`ff_client_reader`). An "edit
 * session" is really just the anonymous-actor identity token the
 * public comment-mutation routes require — it is not exclusive to
 * `accessScope === 'edit'`. A `'comment'` scoped link is EXPECTED to
 * let an external reader open threads and add comments (that is the
 * entire point of minting a comment-scope link), it just must never
 * unlock document-content mutation. `'read'` and `'download'` stay
 * view-only and cannot mint a session at all.
 */
const ANONYMOUS_SESSION_SCOPES: ReadonlySet<DocumentShareLinkAccessScope> = new Set([
  'edit',
  'comment',
]);

export async function createShareLinkEditSession(
  params: CreateShareLinkEditSessionParams
): Promise<CreateShareLinkEditSessionResult> {
  const token = params.token?.trim();
  const consumerFingerprint = params.consumerFingerprint?.trim();
  if (!token) throw new Error('token_required');
  if (!consumerFingerprint) throw new Error('consumer_fingerprint_required');

  const resolved = await consumeShareLink({ token, consumerFingerprint });
  if (!resolved) throw new Error('share_link_invalid_or_expired');
  if (!ANONYMOUS_SESSION_SCOPES.has(resolved.accessScope)) {
    throw new Error('share_link_scope_forbidden');
  }

  const editSessionToken = randomBytes(32).toString('base64url');
  const expiresAtMs = Date.now() + EDIT_SESSION_TTL_MS;
  editSessionStore.set(hashToken(editSessionToken), {
    shareLinkId: resolved.shareLinkId,
    organizationId: resolved.organizationId,
    artifactId: resolved.artifactId,
    tokenHash: hashToken(token),
    fingerprintHash: hashToken(consumerFingerprint),
    expiresAtMs,
  });

  return {
    shareLinkId: resolved.shareLinkId,
    artifactId: resolved.artifactId,
    organizationId: resolved.organizationId,
    editSessionToken,
    expiresAt: new Date(expiresAtMs).toISOString(),
  };
}

export interface AuthorizeShareLinkEditSessionParams {
  token: string;
  editSessionToken: string;
  consumerFingerprint: string;
}

export interface AuthorizeShareLinkEditSessionResult {
  shareLinkId: string;
  artifactId: string;
  organizationId: string;
}

export async function authorizeShareLinkEditSession(
  params: AuthorizeShareLinkEditSessionParams
): Promise<AuthorizeShareLinkEditSessionResult> {
  const token = params.token?.trim();
  const editSessionToken = params.editSessionToken?.trim();
  const consumerFingerprint = params.consumerFingerprint?.trim();
  if (!token) throw new Error('token_required');
  if (!editSessionToken) throw new Error('edit_session_token_required');
  if (!consumerFingerprint) throw new Error('consumer_fingerprint_required');

  const sessionKey = hashToken(editSessionToken);
  const session = editSessionStore.get(sessionKey);
  if (!session) throw new Error('share_link_edit_session_invalid');
  if (session.expiresAtMs <= Date.now()) {
    editSessionStore.delete(sessionKey);
    throw new Error('share_link_edit_session_expired');
  }

  if (
    !timingSafeHashEqual(session.tokenHash, hashToken(token)) ||
    !timingSafeHashEqual(session.fingerprintHash, hashToken(consumerFingerprint))
  ) {
    throw new Error('share_link_edit_session_invalid');
  }

  await ensureHydrated(session.organizationId);
  const link = registryStore.get(linkKey(session.organizationId, session.shareLinkId));
  if (!link) throw new Error('share_link_not_found');
  if (!ANONYMOUS_SESSION_SCOPES.has(link.accessScope)) {
    throw new Error('share_link_scope_forbidden');
  }
  const runtime = getShareLinkRuntimeStatus(link);
  if (!runtime.isUsable) throw new Error('share_link_not_active');

  return {
    shareLinkId: link.shareLinkId,
    artifactId: link.artifactId,
    organizationId: link.organizationId,
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
  // Count directly from the in-process Map (the synchronous SSOT). Every
  // createShareLink / revokeShareLink / rotateShareLinkToken mutation writes
  // to registryStore immediately, so the Map is always up-to-date for any
  // links created in this process. We skip ensureHydrated here because the
  // hydration path re-reads from the DAO, which in some environments (mock
  // DB, race conditions) can surface stale state and overwrite mutations that
  // were applied in-process. The DAO-based count is used only as a fallback
  // for a true cold start where the org has never written any links in this
  // process (registryStore is empty for the org).
  const prefix = `${organizationId}::`;
  const now = new Date();
  let inMemoryCount = 0;
  let hasAnyForOrg = false;
  for (const [k, link] of registryStore.entries()) {
    if (!k.startsWith(prefix)) continue;
    hasAnyForOrg = true;
    if (link.artifactId !== artifactId) continue;
    const runtime = getShareLinkRuntimeStatus(link, now);
    if (runtime.effectiveStatus === 'active') inMemoryCount++;
  }
  // If there are in-process entries for this org, the Map is the answer.
  // If the org has no entries in process at all, fall back to the DAO
  // (which may hold cross-process persisted data).
  if (hasAnyForOrg) return inMemoryCount;
  await ensureHydrated(organizationId);
  return countActiveShareLinksForArtifact(artifactId, organizationId, 'active');
}

// =============================================================================
// Test reset
// =============================================================================

/** @internal Test-only reset of all in-process + DAO stores. */
export function __resetShareLinkMemoryForTests(): void {
  registryStore.clear();
  auditStore.clear();
  tokenIndex.clear();
  editSessionStore.clear();
  expiredAuditedLinks.clear();
  hydratedOrgs.clear();
  hydrationInflight.clear();
}

/** @internal Test-only reset of all in-process + DAO stores. */
export async function __resetShareLinkRegistryForTests(): Promise<void> {
  __resetShareLinkMemoryForTests();
  await __resetShareLinkRegistryDaoForTests();
}

// Re-export the DAO bumper so the test harness can call it directly
// when it needs to seed a specific count without going through the
// full consume path. NOT intended for production callers.
export { loadShareLinkByToken, loadShareLinkByTokenHash } from './documentShareLinkRegistryDao.js';
