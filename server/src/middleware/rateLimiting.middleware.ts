/**
 * Rate Limiting Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Production-grade rate limiting with in-memory sliding window.
 * Enforces real limits per endpoint category.
 */

import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import logger from '../utils/Logger.js';
import { incrementRateLimitHits } from './metrics.middleware.js';

// ---------------------------------------------------------------------------
// In-Memory Sliding Window Store
// ---------------------------------------------------------------------------
interface Entry {
  count: number;
  resetAt: number;
}
const store = new Map<string, Entry>();
const MAX_RATE_LIMIT_IP_KEY_LEN = 256;
const MAX_RATE_LIMIT_JWT_DECODE_LEN = 16384;
const MAX_RATE_LIMIT_STORE_KEYS = 50_000;
const STORE_CAP_PRUNE_TARGET = 45_000;
const MAX_RATE_LIMIT_WINDOW_MS = 7 * 24 * 60 * 60_000;
const MAX_RATE_LIMIT_MAX = 1_000_000;
const STORE_CLEANUP_INTERVAL_KEY = '__consultifyRateLimitStoreCleanup__';
type RateLimitGlobal = typeof globalThis & {
  [STORE_CLEANUP_INTERVAL_KEY]?: ReturnType<typeof setInterval>;
};
const globalRateLimit = globalThis as RateLimitGlobal;
if (globalRateLimit[STORE_CLEANUP_INTERVAL_KEY]) {
  clearInterval(globalRateLimit[STORE_CLEANUP_INTERVAL_KEY]);
}
const storeCleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [k, v] of store) {
    if (now >= v.resetAt) store.delete(k);
  }
}, 60_000);
globalRateLimit[STORE_CLEANUP_INTERVAL_KEY] = storeCleanupInterval;
storeCleanupInterval.unref?.();

function safeInvokeNext(next: NextFunction): void {
  if (typeof next !== 'function') return;
  try {
    next();
  } catch {
    // Rate limiter must never crash due to downstream handler failures.
  }
}

function capKeySegment(value: string): string {
  if (value.length <= MAX_RATE_LIMIT_IP_KEY_LEN) return value;
  return value.slice(0, MAX_RATE_LIMIT_IP_KEY_LEN);
}

function normalizeIpKeyMaterial(value: string): string {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return '';
  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(normalized)) {
    return normalized.replace(/:\d+$/, '');
  }
  if (normalized.startsWith('[')) {
    const bracketCloseIndex = normalized.indexOf(']');
    if (bracketCloseIndex > 1) {
      return normalized.slice(1, bracketCloseIndex);
    }
  }
  return normalized;
}

function increment(key: string, windowMs: number): { count: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || now >= entry.resetAt) {
    const e = { count: 1, resetAt: now + windowMs };
    store.set(key, e);
    enforceStoreCap(now);
    return e;
  }
  entry.count++;
  return { count: entry.count, resetAt: entry.resetAt };
}

function clampOverLimitCount(key: string, max: number): void {
  const entry = store.get(key);
  if (!entry) return;
  const clamped = Math.max(1, max + 1);
  if (entry.count > clamped) {
    entry.count = clamped;
  }
}

function enforceStoreCap(now: number): void {
  if (store.size <= MAX_RATE_LIMIT_STORE_KEYS) return;
  for (const [k, v] of store) {
    if (now >= v.resetAt) store.delete(k);
  }
  if (store.size <= MAX_RATE_LIMIT_STORE_KEYS) return;
  let keysToDelete = store.size - STORE_CAP_PRUNE_TARGET;
  if (keysToDelete <= 0) return;
  const candidates: Array<{ key: string; resetAt: number }> = [];
  for (const [key, entry] of store) {
    if (keysToDelete <= 0) break;
    if (candidates.length < keysToDelete) {
      candidates.push({ key, resetAt: entry.resetAt });
      continue;
    }
    let maxIndex = 0;
    for (let i = 1; i < candidates.length; i += 1) {
      if (candidates[i].resetAt > candidates[maxIndex].resetAt) {
        maxIndex = i;
      }
    }
    if (entry.resetAt < candidates[maxIndex].resetAt) {
      candidates[maxIndex] = { key, resetAt: entry.resetAt };
    }
  }
  for (const candidate of candidates) {
    if (store.size <= STORE_CAP_PRUNE_TARGET) break;
    if (store.delete(candidate.key)) {
      keysToDelete -= 1;
    }
  }
}

function resolveLimiterParams(windowMs: number, max: number): { windowMs: number; max: number } {
  const resolvedWindowMsRaw =
    typeof windowMs === 'number' && Number.isFinite(windowMs) && windowMs > 0
      ? Math.floor(windowMs)
      : 15 * 60_000;
  const resolvedMaxRaw =
    typeof max === 'number' && Number.isFinite(max) && max > 0 ? Math.floor(max) : 1;
  const resolvedWindowMs = Math.min(resolvedWindowMsRaw, MAX_RATE_LIMIT_WINDOW_MS);
  const resolvedMax = Math.min(resolvedMaxRaw, MAX_RATE_LIMIT_MAX);
  return { windowMs: resolvedWindowMs, max: resolvedMax };
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function safeRead<T>(reader: () => T, fallback: T): T {
  try {
    return reader();
  } catch {
    return fallback;
  }
}

function safeSetHeader(res: Response, headerName: string, value: string | number): void {
  try {
    res.setHeader(headerName, value);
  } catch {
    // Best effort only; limiter still functions without headers.
  }
}
function toSafeNonNegativeIntCount(value: unknown, fallback = 0): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.floor(numeric));
}
function toSafeNonNegativeIntSeconds(value: unknown, fallback = 0): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.ceil(numeric));
}

function extractToken(req: Request): string | null {
  const authHeader = safeRead(() => req.headers['authorization'], undefined as unknown);
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const bearerToken = normalizeOptionalString(authHeader.slice(7));
    if (bearerToken) return bearerToken;
  }
  if (typeof authHeader === 'string') {
    const normalizedAuthHeader = normalizeOptionalString(authHeader);
    if (normalizedAuthHeader) return normalizedAuthHeader;
  }
  if (Array.isArray(authHeader)) {
    for (const authHeaderValue of authHeader) {
      if (typeof authHeaderValue !== 'string') continue;
      if (authHeaderValue.startsWith('Bearer ')) {
        const bearerToken = normalizeOptionalString(authHeaderValue.slice(7));
        if (bearerToken) return bearerToken;
      }
      const normalizedAuthHeader = normalizeOptionalString(authHeaderValue);
      if (normalizedAuthHeader) return normalizedAuthHeader;
    }
  }

  const cookieToken =
    safeRead(() => (req as any).cookies?.access_token, undefined as unknown) ||
    safeRead(() => (req as any).cookies?.token, undefined as unknown);
  if (typeof cookieToken === 'string') {
    const normalizedCookieToken = normalizeOptionalString(cookieToken);
    if (normalizedCookieToken) return normalizedCookieToken;
  }

  return null;
}

function tryExtractUserIdFromToken(req: Request): string | null {
  const token = extractToken(req);
  if (!token) return null;
  if (token.length > MAX_RATE_LIMIT_JWT_DECODE_LEN) return null;

  try {
    const decoded = jwt.decode(token) as { id?: string; userId?: string; sub?: string } | null;
    const candidate =
      normalizeOptionalString(safeRead(() => decoded?.id, undefined as unknown)) ||
      normalizeOptionalString(safeRead(() => decoded?.userId, undefined as unknown)) ||
      normalizeOptionalString(safeRead(() => decoded?.sub, undefined as unknown));
    return candidate;
  } catch {
    return null;
  }
}

/**
 * Network-only identity, ignoring any credential the caller presents.
 *
 * `extractKey` prefers a user id read out of the token with `jwt.decode` — an
 * UNVERIFIED read. On an authenticated endpoint that is harmless: a forged id only
 * buys you a bucket of your own. On an UNAUTHENTICATED provisioning endpoint it is
 * a bypass — attach any junk bearer, rotate the `id` claim, and every request
 * lands in a fresh bucket. `register-demo` has no legitimate authenticated caller,
 * so its quota must never be influenced by a token.
 */
export function networkOnlyRateLimitKey(req: Request): string {
  const ipFromReqRaw = normalizeOptionalString(safeRead(() => req.ip, undefined as unknown));
  const ipFromReq = ipFromReqRaw ? capKeySegment(normalizeIpKeyMaterial(ipFromReqRaw)) : null;
  const ipFromSocketRaw = normalizeOptionalString(
    safeRead(() => req.socket?.remoteAddress, undefined as unknown)
  );
  const ipFromSocket = ipFromSocketRaw
    ? capKeySegment(normalizeIpKeyMaterial(ipFromSocketRaw))
    : null;
  const forwardedHeader = safeRead(() => req.headers['x-forwarded-for'], undefined as unknown);
  const trustProxy = Boolean(
    safeRead(
      () =>
        (req as Request & { app?: { get?: (name: string) => unknown } }).app?.get?.('trust proxy'),
      false
    )
  );
  const ipFromForwarded = (() => {
    if (!trustProxy) return null;
    if (typeof forwardedHeader === 'string') {
      const candidate = normalizeOptionalString(forwardedHeader.split(',')[0]);
      return candidate ? capKeySegment(normalizeIpKeyMaterial(candidate)) : null;
    }
    if (Array.isArray(forwardedHeader)) {
      for (const forwardedEntry of forwardedHeader) {
        if (typeof forwardedEntry !== 'string') continue;
        const candidate = normalizeOptionalString(forwardedEntry.split(',')[0]);
        if (candidate) return capKeySegment(normalizeIpKeyMaterial(candidate));
      }
    }
    return null;
  })();
  return `ip:${capKeySegment(ipFromReq || ipFromForwarded || ipFromSocket || 'unknown')}`;
}

function extractKey(req: Request): string {
  const uid =
    normalizeOptionalString(safeRead(() => (req as any)._rateLimitUserId, undefined as unknown)) ||
    normalizeOptionalString(safeRead(() => (req as any).userId, undefined as unknown)) ||
    normalizeOptionalString(safeRead(() => (req as any).user?.id, undefined as unknown));
  if (uid) return `u:${capKeySegment(uid)}`;
  const tokenUid = tryExtractUserIdFromToken(req);
  if (tokenUid) return `u:${capKeySegment(tokenUid)}`;
  const ipFromReqRaw = normalizeOptionalString(safeRead(() => req.ip, undefined as unknown));
  const ipFromReq = ipFromReqRaw ? capKeySegment(normalizeIpKeyMaterial(ipFromReqRaw)) : null;
  const ipFromSocketRaw = normalizeOptionalString(
    safeRead(() => req.socket?.remoteAddress, undefined as unknown)
  );
  const ipFromSocket = ipFromSocketRaw
    ? capKeySegment(normalizeIpKeyMaterial(ipFromSocketRaw))
    : null;
  const forwardedHeader = safeRead(() => req.headers['x-forwarded-for'], undefined as unknown);
  const trustProxy = Boolean(
    safeRead(
      () =>
        (req as Request & { app?: { get?: (name: string) => unknown } }).app?.get?.('trust proxy'),
      false
    )
  );
  const ipFromForwarded = (() => {
    if (!trustProxy) return null;
    if (typeof forwardedHeader === 'string') {
      const candidate = normalizeOptionalString(forwardedHeader.split(',')[0]);
      return candidate ? capKeySegment(normalizeIpKeyMaterial(candidate)) : null;
    }
    if (Array.isArray(forwardedHeader)) {
      for (const forwardedEntry of forwardedHeader) {
        if (typeof forwardedEntry !== 'string') continue;
        const candidate = normalizeOptionalString(forwardedEntry.split(',')[0]);
        if (candidate) return capKeySegment(normalizeIpKeyMaterial(candidate));
      }
    }
    return null;
  })();
  const ip = capKeySegment(ipFromReq || ipFromForwarded || ipFromSocket || 'unknown');
  return `ip:${ip}`;
}

// ---------------------------------------------------------------------------
// Rejection telemetry (OPS-DEMO-002)
// ---------------------------------------------------------------------------
/**
 * Counts refusals per limiter so an operator can tell a demo-signup flood apart
 * from ordinary auth throttling. Two surfaces, deliberately:
 *
 * 1. the SHARED facility — `incrementRateLimitHits()` from metrics.middleware,
 *    already surfaced by `GET /api/health/aggregated`
 *    (`components.metrics.details.rateLimitHits`). That counter existed but had
 *    zero callers, so the aggregate was permanently 0 until now;
 * 2. this module's per-limiter breakdown, which the shared bucket cannot express
 *    (it is a single unlabelled number).
 *
 * PRIVACY: the store key holds an IP or an opaque identity hash. Neither is ever
 * logged or exposed. Keys are only ever counted, and the distinct-source tally
 * hashes the key again before it touches a set, so nothing reversible is held.
 */
const REJECTION_LOG_INTERVAL_MS = 60_000;
const MAX_TRACKED_LIMITER_PREFIXES = 64;
const MAX_TRACKED_REJECTION_SOURCES = 1_000;
const MAX_TELEMETRY_COUNTER = Number.MAX_SAFE_INTEGER;

/** `rejected` = refused over quota. `store-unavailable` = the shared store could not answer. */
export type RateLimitTelemetryReason = 'rejected' | 'store-unavailable';

export interface RateLimitTelemetryEntry {
  rejected: number;
  storeUnavailable: number;
}

export type RateLimitTelemetrySnapshot = Record<string, RateLimitTelemetryEntry>;

interface RejectionLogWindow {
  lastLoggedAt: number;
  pending: number;
  sources: Set<string>;
  sourcesTruncated: boolean;
}

const telemetryCounters = new Map<string, RateLimitTelemetryEntry>();
const rejectionLogWindows = new Map<string, RejectionLogWindow>();

function addBoundedTelemetryCounter(current: unknown, delta: number): number {
  const currentValue =
    typeof current === 'number' && Number.isFinite(current) && current >= 0 ? current : 0;
  return Math.min(MAX_TELEMETRY_COUNTER, currentValue + delta);
}

function telemetryBucketFor(prefix: string): RateLimitTelemetryEntry | null {
  const existing = telemetryCounters.get(prefix);
  if (existing) return existing;
  // Prefixes are compile-time constants, so this cap should never bind; it only
  // stops a future caller from turning the counter map into an unbounded label space.
  if (telemetryCounters.size >= MAX_TRACKED_LIMITER_PREFIXES) return null;
  const created: RateLimitTelemetryEntry = { rejected: 0, storeUnavailable: 0 };
  telemetryCounters.set(prefix, created);
  return created;
}

/**
 * Count-and-summarise rather than one line per refused request: under a real
 * flood the per-request line IS the denial of service against the log pipeline.
 * The first refusal of a quiet period logs immediately (so the signal is not
 * delayed), then at most one summary per limiter per minute.
 *
 * `hashRateLimitIdentity` is declared further down; function declarations hoist.
 */
function summariseRateLimitEvent(
  prefix: string,
  key: string,
  reason: RateLimitTelemetryReason
): void {
  const windowKey = `${prefix}|${reason}`;
  let window = rejectionLogWindows.get(windowKey);
  if (!window) {
    if (rejectionLogWindows.size >= MAX_TRACKED_LIMITER_PREFIXES * 2) return;
    window = { lastLoggedAt: 0, pending: 0, sources: new Set<string>(), sourcesTruncated: false };
    rejectionLogWindows.set(windowKey, window);
  }
  window.pending = addBoundedTelemetryCounter(window.pending, 1);
  if (window.sources.size < MAX_TRACKED_REJECTION_SOURCES) {
    window.sources.add(hashRateLimitIdentity('rate-limit-source', key));
  } else {
    window.sourcesTruncated = true;
  }

  const now = Date.now();
  if (window.lastLoggedAt > 0 && now - window.lastLoggedAt < REJECTION_LOG_INTERVAL_MS) return;

  const bucket = telemetryCounters.get(prefix);
  const payload = {
    limiter: prefix,
    reason,
    events: window.pending,
    distinctSources: window.sources.size,
    distinctSourcesTruncated: window.sourcesTruncated,
    totalSinceReset:
      (reason === 'store-unavailable' ? bucket?.storeUnavailable : bucket?.rejected) ?? 0,
    summaryWindowMs: REJECTION_LOG_INTERVAL_MS,
  };
  window.lastLoggedAt = now;
  window.pending = 0;
  window.sources.clear();
  window.sourcesTruncated = false;

  logger.warn(
    reason === 'store-unavailable'
      ? '[RateLimit] shared store unavailable'
      : '[RateLimit] requests refused over quota',
    payload
  );
}

function recordRateLimitEvent(
  prefix: string,
  key: string,
  reason: RateLimitTelemetryReason
): void {
  try {
    const bucket = telemetryBucketFor(prefix);
    if (bucket) {
      if (reason === 'store-unavailable') {
        bucket.storeUnavailable = addBoundedTelemetryCounter(bucket.storeUnavailable, 1);
      } else {
        bucket.rejected = addBoundedTelemetryCounter(bucket.rejected, 1);
      }
    }
    if (reason === 'rejected') {
      try {
        incrementRateLimitHits();
      } catch {
        // The shared metrics bucket is best effort; never let it break the limiter.
      }
    }
    summariseRateLimitEvent(prefix, key, reason);
  } catch {
    // Telemetry must never change whether a request is allowed.
  }
}

/** Per-limiter refusal counts, keyed by limiter prefix (`auth`, `demo-signup-ip`, ...). */
export function getRateLimitTelemetry(): RateLimitTelemetrySnapshot {
  const snapshot: RateLimitTelemetrySnapshot = Object.create(null) as RateLimitTelemetrySnapshot;
  for (const [prefix, bucket] of telemetryCounters) {
    snapshot[prefix] = { rejected: bucket.rejected, storeUnavailable: bucket.storeUnavailable };
  }
  return snapshot;
}

/** Clears counters and the log-throttle windows, so tests are deterministic. */
export function resetRateLimitTelemetry(): void {
  telemetryCounters.clear();
  rejectionLogWindows.clear();
}

// ---------------------------------------------------------------------------
// Shared (cross-replica) store seam — PREPARED, OFF BY DEFAULT
// ---------------------------------------------------------------------------
/**
 * The in-memory bucket above is per-process: on a horizontally scaled deployment
 * the effective quota is multiplied by the replica count. Single-replica staging
 * is fine; a public production deployment is not.
 *
 * This seam lets a limiter delegate counting to a store shared by all replicas.
 * It is OPT-IN and defaults OFF, so nothing changes without an explicit decision:
 *
 *   RATE_LIMIT_SHARED_STORE=redis            enables it (any other value = in-memory)
 *   RATE_LIMIT_SHARED_STORE_FAIL_MODE=...    closed (default) | local | open
 *
 * Only limiters created with `sharedStore: true` consult the flag at all, so
 * turning it on cannot silently change the auth/api limiters.
 */
export interface SharedRateLimitStore {
  increment(key: string, windowMs: number): Promise<{ count: number; resetAt: number }>;
}

export type SharedRateLimitStoreFactory = (
  windowMs: number
) => SharedRateLimitStore | Promise<SharedRateLimitStore>;

type SharedStoreFailMode = 'closed' | 'local' | 'open';

const SHARED_STORE_ENV = 'RATE_LIMIT_SHARED_STORE';
const SHARED_STORE_FAIL_MODE_ENV = 'RATE_LIMIT_SHARED_STORE_FAIL_MODE';
const SHARED_STORE_UNAVAILABLE_RETRY_AFTER_SECONDS = 30;

let sharedStoreFactoryOverride: SharedRateLimitStoreFactory | null = null;
let sharedStoreGeneration = 0;

/**
 * `redis` selects the cross-replica store. `local` is now a FIRST-CLASS value
 * meaning "in-process counters, deliberately" — it resolves to exactly the same
 * behaviour as leaving the variable unset, but it lets an operator DECLARE the
 * single-replica posture instead of having it inferred from an absent variable.
 * `server/src/config/rateLimitPosture.ts` refuses startup on any other value, so
 * a typo can no longer mean "local" by accident.
 */
function isSharedStoreEnabled(): boolean {
  const configured = normalizeOptionalString(process.env[SHARED_STORE_ENV]);
  return configured?.toLowerCase() === 'redis';
}

/**
 * The exact predicate the limiter middleware uses to wave a request through
 * without counting it. Extracted so the readiness probe below reports on the
 * REAL path rather than on a config value that merely looks right.
 */
function isRateLimitBypassed(): boolean {
  if (process.env.NODE_ENV === 'test') return true;
  const disableRateLimitRequested = process.env.DISABLE_RATE_LIMIT === 'true';
  if (!disableRateLimitRequested) return false;
  const allowProdDisable = process.env.RATE_LIMIT_ALLOW_PROD_DISABLE === 'true';
  return process.env.NODE_ENV !== 'production' || allowProdDisable;
}

/**
 * Fail direction when the shared store cannot answer.
 *
 * DEFAULT: `closed`. These limiters guard an unauthenticated endpoint that
 * provisions a seeded tenant per success. A store outage during a flood is
 * exactly when an unbounded quota is most expensive, and the blast radius of
 * failing closed is a temporarily unavailable signup form — a funnel outage,
 * not a data or security incident. Note this is the OPPOSITE of the
 * `express-rate-limit` layer in index.ts, which fails open because it fronts
 * authenticated product traffic where closing would take the whole app down.
 *
 * `local` degrades to the per-replica in-memory bucket (bounded, but N x quota).
 * `open` lets every request through; that is an explicitly accepted risk.
 */
function resolveSharedStoreFailMode(): SharedStoreFailMode {
  const configured = normalizeOptionalString(process.env[SHARED_STORE_FAIL_MODE_ENV])?.toLowerCase();
  if (configured === 'open' || configured === 'local') return configured;
  return 'closed';
}

/**
 * Thin adapter over the existing `RedisRateLimitStore`. An adapter is required
 * rather than using that class directly, for three reasons:
 *
 * 1. shape — it returns `{ totalHits, resetTime: Date }` (the express-rate-limit
 *    contract); this limiter counts in `{ count, resetAt }` epoch milliseconds;
 * 2. window — its window is constructor-bound, not per-call, so each limiter
 *    needs its own instance;
 * 3. failure semantics — by DEFAULT its `increment` swallows every Redis error
 *    and returns `totalHits: 1`, i.e. it fails open INDISTINGUISHABLY: during an
 *    outage each request looks like the first hit of a fresh window and the quota
 *    silently becomes infinite. That default is retained for the
 *    express-rate-limit gateway limiters in index.ts, which want fail-open.
 *
 * This adapter therefore constructs the store with `throwOnError: true`, so a
 * rejected INCR, a rejected TTL read, a rejected EXPIRE or a non-numeric reply
 * ALL propagate here and let the fail-mode policy above make a deliberate
 * choice. The pre-call connectivity check below is kept as a cheap short circuit,
 * but it is no longer load-bearing: it only catches "not connected", which is one
 * failure out of many.
 *
 * The in-process MOCK client (`MOCK_REDIS=true`, or no `REDIS_URL`) is refused
 * twice over — here, and inside the store, which requires a real `ttl` command.
 * Its `incr` returns a constant 1, which would look like a working shared store
 * while enforcing nothing at all.
 */
async function createRedisSharedRateLimitStore(windowMs: number): Promise<SharedRateLimitStore> {
  const [storeModule, clientModule] = await Promise.all([
    import('../utils/RedisRateLimitStore.js'),
    import('../utils/RedisClient.js'),
  ]);
  const RedisStore = storeModule.RedisRateLimitStore ?? storeModule.default;
  const redisClient = clientModule.default as unknown as {
    isOpen?: boolean;
    incr?: unknown;
    ttl?: unknown;
  };
  const store = new RedisStore({ windowMs, throwOnError: true });

  return {
    async increment(key: string): Promise<{ count: number; resetAt: number }> {
      if (!redisClient || redisClient.isOpen !== true) {
        throw new Error('shared rate limit store is not connected');
      }
      if (typeof redisClient.incr !== 'function' || typeof redisClient.ttl !== 'function') {
        throw new Error('shared rate limit store is backed by the in-process mock client');
      }
      const result = await store.increment(key);
      const count = toSafeNonNegativeIntCount(result?.totalHits, 0);
      if (count < 1) throw new Error('shared rate limit store returned an unusable hit count');
      const resetTime = result?.resetTime;
      const resetAtRaw = resetTime instanceof Date ? resetTime.getTime() : Number.NaN;
      const resetAt =
        Number.isFinite(resetAtRaw) && resetAtRaw > 0 ? resetAtRaw : Date.now() + windowMs;
      return { count, resetAt };
    },
  };
}

function resolveSharedStoreFactory(): SharedRateLimitStoreFactory {
  return sharedStoreFactoryOverride ?? createRedisSharedRateLimitStore;
}

/** Test seam: inject a fake store factory. `null` restores the Redis-backed one. */
function setSharedRateLimitStoreFactory(factory: SharedRateLimitStoreFactory | null): void {
  sharedStoreFactoryOverride = factory;
  sharedStoreGeneration += 1;
}

// ---------------------------------------------------------------------------
// Runtime state + readiness probe (OPS-DEMO-002)
// ---------------------------------------------------------------------------

export interface RateLimitRuntimeState {
  /** The store the demo-signup limiters will actually count in. */
  store: 'local' | 'redis';
  failMode: SharedStoreFailMode;
  /** `true` when every limiter is currently waving requests through. */
  bypassed: boolean;
}

export function getRateLimitRuntimeState(): RateLimitRuntimeState {
  return {
    store: isSharedStoreEnabled() ? 'redis' : 'local',
    failMode: resolveSharedStoreFailMode(),
    bypassed: isRateLimitBypassed(),
  };
}

export interface RateLimiterProbeResult extends RateLimitRuntimeState {
  /** The limiter is present AND demonstrably counting. */
  ok: boolean;
  /** Short, non-sensitive reason. Never contains a key, address or IP. */
  detail: string;
  durationMs: number;
}

const PROBE_WINDOW_MS = 10_000;
const PROBE_TIMEOUT_MS = 1_500;

/**
 * Cheap liveness probe of the LIMITER PATH, not of a config value.
 *
 * "Is `RATE_LIMIT_SHARED_STORE=redis` set?" proves nothing: the previous round
 * found that a missing `REDIS_URL` yields a mock client whose `incr()` returns a
 * constant 1, so a limiter can be fully configured and still count nothing. The
 * probe therefore does the one thing a broken store cannot fake — it increments
 * the SAME throwaway key TWICE and requires the count to strictly increase.
 *
 * Cost: two INCRs (plus a TTL) against one random key with a 10-second window,
 * which then expires on its own. The local variant additionally deletes the key.
 * Nothing about a real caller is touched, and the probe key is random so it can
 * never collide with production traffic.
 */
export async function probeRateLimiterHealth(): Promise<RateLimiterProbeResult> {
  const startedAt = Date.now();
  const state = getRateLimitRuntimeState();
  const finish = (ok: boolean, detail: string): RateLimiterProbeResult => ({
    ...state,
    ok,
    detail,
    durationMs: Math.max(0, Date.now() - startedAt),
  });

  if (state.bypassed) {
    return finish(false, 'rate limiting is disabled for this process');
  }

  const probeKey = `rl:__probe__:${crypto.randomBytes(12).toString('hex')}`;

  try {
    if (state.store === 'redis') {
      const run = (async () => {
        const sharedStore = await resolveSharedStoreFactory()(PROBE_WINDOW_MS);
        if (!sharedStore || typeof sharedStore.increment !== 'function') {
          throw new Error('shared store factory returned no usable store');
        }
        const first = await sharedStore.increment(probeKey, PROBE_WINDOW_MS);
        const second = await sharedStore.increment(probeKey, PROBE_WINDOW_MS);
        return { first, second };
      })();
      const timeout = new Promise<never>((_, reject) => {
        const timer = setTimeout(
          () => reject(new Error('shared store did not answer in time')),
          PROBE_TIMEOUT_MS
        );
        timer.unref?.();
      });
      const { first, second } = await Promise.race([run, timeout]);
      const firstCount = toSafeNonNegativeIntCount(first?.count, 0);
      const secondCount = toSafeNonNegativeIntCount(second?.count, 0);
      if (firstCount < 1 || secondCount <= firstCount) {
        // A store that answers but does not advance is the mock-client failure:
        // it looks healthy and enforces nothing.
        return finish(false, 'shared store did not advance its counter');
      }
      return finish(true, 'shared store counted two probe hits');
    }

    // Read the count out IMMEDIATELY: on a fresh key `increment` returns the very
    // object it stored, so holding the result and reading `.count` after the
    // second call would observe the mutated value and always look identical.
    const firstCount = increment(probeKey, PROBE_WINDOW_MS).count;
    const secondCount = increment(probeKey, PROBE_WINDOW_MS).count;
    store.delete(probeKey);
    if (firstCount !== 1 || secondCount !== 2) {
      return finish(false, 'in-process store did not advance its counter');
    }
    return finish(true, 'in-process store counted two probe hits');
  } catch {
    store.delete(probeKey);
    return finish(false, 'store probe failed');
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
function createLimiter(opts: {
  windowMs: number;
  max: number;
  prefix: string;
  message?: string;
  /**
   * Opts this limiter into the shared-store seam above. Even then the store is
   * only used when `RATE_LIMIT_SHARED_STORE=redis`; otherwise the limiter runs
   * the unchanged, fully synchronous in-memory path.
   */
  sharedStore?: boolean;
  /**
   * Overrides the default identity (user id, else IP). Must return an ALREADY
   * OPAQUE value — the returned string lands in the store key verbatim, so a raw
   * email address here would put registered addresses in the key space. Return
   * an empty string to fall back to the default identity, which is what an
   * anonymous request with no usable identifier should do.
   */
  keyResolver?: (req: Request) => string;
}) {
  const {
    prefix,
    message = 'Too many requests, please try again later.',
    keyResolver,
    sharedStore = false,
  } = opts;
  const { windowMs, max } = resolveLimiterParams(opts.windowMs, opts.max);

  let cachedSharedStore: { generation: number; promise: Promise<SharedRateLimitStore> } | null =
    null;

  const loadSharedStore = (): Promise<SharedRateLimitStore> => {
    if (cachedSharedStore && cachedSharedStore.generation === sharedStoreGeneration) {
      return cachedSharedStore.promise;
    }
    const generation = sharedStoreGeneration;
    const promise = Promise.resolve()
      .then(() => resolveSharedStoreFactory()(windowMs))
      .then((store) => {
        if (!store || typeof store.increment !== 'function') {
          throw new Error('shared rate limit store factory returned no usable store');
        }
        return store;
      });
    // A construction failure must not be cached forever, or one bad boot would
    // pin the limiter to its fail mode for the process lifetime.
    promise.catch(() => {
      if (cachedSharedStore && cachedSharedStore.promise === promise) cachedSharedStore = null;
    });
    cachedSharedStore = { generation, promise };
    return promise;
  };

  const sendOverQuota = (res: Response, next: NextFunction, resetAt: number): void => {
    const retryAfter = Math.max(1, toSafeNonNegativeIntSeconds((resetAt - Date.now()) / 1000, 0));
    safeSetHeader(res, 'Retry-After', String(retryAfter));
    if (safeRead(() => res.headersSent, false)) {
      safeInvokeNext(next);
      return;
    }
    try {
      res.status(429).json({
        error: message,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter,
      });
    } catch {
      if (!safeRead(() => res.headersSent, false)) {
        safeRead(() => {
          const statusResult = res.status(429) as Response | { end?: () => void };
          if (statusResult && typeof statusResult.end === 'function') {
            statusResult.end();
            return;
          }
          if (typeof (res as Response & { end?: () => void }).end === 'function') {
            (res as Response & { end?: () => void }).end?.();
          }
        }, undefined as void);
      }
    }
  };

  const applyDecision = (
    res: Response,
    next: NextFunction,
    key: string,
    count: number,
    resetAt: number,
    localBucket: boolean
  ): void => {
    const remaining = toSafeNonNegativeIntCount(max - count, 0);
    const resetSeconds = toSafeNonNegativeIntSeconds(resetAt / 1000, 0);

    safeSetHeader(res, 'X-RateLimit-Limit', max);
    safeSetHeader(res, 'X-RateLimit-Remaining', remaining);
    safeSetHeader(res, 'X-RateLimit-Reset', resetSeconds);

    if (count > max) {
      if (localBucket) clampOverLimitCount(key, max);
      recordRateLimitEvent(prefix, key, 'rejected');
      sendOverQuota(res, next, resetAt);
      return;
    }
    safeInvokeNext(next);
  };

  const handleSharedStoreFailure = (key: string, res: Response, next: NextFunction): void => {
    recordRateLimitEvent(prefix, key, 'store-unavailable');
    const failMode = resolveSharedStoreFailMode();
    if (failMode === 'open') {
      safeInvokeNext(next);
      return;
    }
    if (failMode === 'local') {
      try {
        const local = increment(key, windowMs);
        applyDecision(res, next, key, local.count, local.resetAt, true);
      } catch {
        safeInvokeNext(next);
      }
      return;
    }
    // 'closed': refuse rather than serve an unbounded quota on a public,
    // unauthenticated provisioning endpoint.
    if (safeRead(() => res.headersSent, false)) {
      safeInvokeNext(next);
      return;
    }
    safeSetHeader(res, 'Retry-After', String(SHARED_STORE_UNAVAILABLE_RETRY_AFTER_SECONDS));
    try {
      res.status(503).json({
        error: 'Service temporarily unavailable. Please try again shortly.',
        code: 'RATE_LIMIT_STORE_UNAVAILABLE',
        retryAfter: SHARED_STORE_UNAVAILABLE_RETRY_AFTER_SECONDS,
      });
    } catch {
      if (!safeRead(() => res.headersSent, false)) {
        safeRead(() => {
          const statusResult = res.status(503) as Response | { end?: () => void };
          if (statusResult && typeof statusResult.end === 'function') statusResult.end();
        }, undefined as void);
      }
    }
  };

  const runSharedPath = async (key: string, res: Response, next: NextFunction): Promise<void> => {
    let decision: { count: number; resetAt: number };
    try {
      const store = await loadSharedStore();
      const result = await store.increment(key, windowMs);
      const count = toSafeNonNegativeIntCount(result?.count, 0);
      const resetAt = Number(result?.resetAt);
      if (count < 1 || !Number.isFinite(resetAt)) {
        throw new Error('shared rate limit store returned an unusable result');
      }
      decision = { count, resetAt };
    } catch {
      handleSharedStoreFailure(key, res, next);
      return;
    }
    // Kept out of the try above so a response-writing failure is not misread as
    // a store outage and answered twice.
    try {
      applyDecision(res, next, key, decision.count, decision.resetAt, false);
    } catch {
      safeInvokeNext(next);
    }
  };

  return (req: Request, res: Response, next: NextFunction): void => {
    // Same predicate the readiness probe reports on — see isRateLimitBypassed.
    if (isRateLimitBypassed()) {
      safeInvokeNext(next);
      return;
    }
    const method = normalizeOptionalString(safeRead(() => req.method, undefined as unknown));
    if (method?.toUpperCase() === 'OPTIONS') {
      safeInvokeNext(next);
      return;
    }
    try {
      const resolved = keyResolver
        ? normalizeOptionalString(safeRead(() => keyResolver(req), undefined as unknown))
        : undefined;
      const key = `rl:${prefix}:${resolved ? capKeySegment(resolved) : extractKey(req)}`;

      // Opt-in only. With the flag unset (the default, including staging) this
      // branch is never taken and the limiter stays fully synchronous.
      if (sharedStore && isSharedStoreEnabled()) {
        void runSharedPath(key, res, next);
        return;
      }

      const { count, resetAt } = increment(key, windowMs);
      applyDecision(res, next, key, count, resetAt, true);
    } catch {
      // Limiter is defense-in-depth; unexpected internal failures should not block requests.
      if (safeRead(() => res.headersSent, false)) {
        safeInvokeNext(next);
        return;
      }
      safeInvokeNext(next);
    }
  };
}

// ---------------------------------------------------------------------------
// Pre-configured limiters
// ---------------------------------------------------------------------------
const isProd = process.env.NODE_ENV === 'production';

/** Auth (login/register only): 15 req / 15 min - brute force protection */
export const authRateLimiter = createLimiter({
  windowMs: 15 * 60_000,
  max: isProd ? 15 : 5000,
  prefix: 'auth',
  message: 'Too many authentication attempts.',
});

/**
 * API routes (initiatives, tasks, tools, etc.).
 * Keys by userId when authenticated (see extractKey -> `u:<uid>`), else IP.
 *
 * FIX-1 (429 self-storm): the previous 1000/2000-per-15min bucket was too low
 * for a single real SPA session. One My Work / Ideas screen load legitimately
 * fans out across dozens of authenticated GETs (hub loaders, session-context,
 * inbox, notebooks, tasks, polling) and was tripping its OWN per-user limit ->
 * 429 death-spiral that made most screens "Failed to load". Because this bucket
 * is per-authenticated-user, a high ceiling here does NOT weaken cross-user
 * abuse protection — it only stops the app from rate-limiting itself. Kept
 * generous-but-finite in prod so a single compromised session still can't run
 * unbounded; non-prod is very high to make StrictMode double-fire + dev polling
 * a non-issue.
 */
export const apiAuthRateLimiter = createLimiter({
  windowMs: 15 * 60_000,
  max: isProd ? 12_000 : 60_000,
  prefix: 'api-auth',
  message: 'Too many requests, please try again later.',
});

// ---------------------------------------------------------------------------
// Public demo signup (OPS-DEMO-002)
// ---------------------------------------------------------------------------

/**
 * Opaque identity for the per-address demo signup quota.
 *
 * The address is hashed with a domain-separated prefix and truncated, so the
 * rate-limit key space never contains a registered address. Callers must pass
 * the SAME normalized form the account lookup uses (lowercased, trimmed),
 * otherwise `Foo@x.test` and `foo@x.test` would get separate quotas.
 */
export function hashRateLimitIdentity(namespace: string, value: string): string {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  return crypto
    .createHash('sha256')
    .update(`rate-limit-identity-v1:${namespace}:${normalized}`)
    .digest('hex')
    .slice(0, 32);
}

function demoSignupIdentityKey(req: Request): string {
  const email = normalizeOptionalString(
    safeRead(() => (req.body as { email?: unknown } | undefined)?.email, undefined as unknown)
  );
  if (!email) {
    // No address to key on: fall back to the NETWORK identity, never to the
    // default resolver, whose token-derived key an anonymous caller can choose.
    return networkOnlyRateLimitKey(req);
  }
  const hashed = hashRateLimitIdentity('demo-signup', email.trim().toLowerCase());
  return hashed ? `id:${hashed}` : networkOnlyRateLimitKey(req);
}

/**
 * Public demo signup, per source IP. This is the endpoint's only network-level
 * brake: it provisions a seeded tenant per success, so an unthrottled caller can
 * fill the demo database and enumerate addresses at will.
 */
export const demoSignupIpRateLimiter = createLimiter({
  windowMs: 60 * 60_000,
  max: isProd ? 5 : 500,
  prefix: 'demo-signup-ip',
  message: 'Too many demo requests from this network. Please try again later.',
  sharedStore: true,
  // Network identity only — see `networkOnlyRateLimitKey`. Without this the bucket
  // is chosen by an unverified `id` claim and the quota is trivially bypassed.
  keyResolver: networkOnlyRateLimitKey,
});

/**
 * Public demo signup, per address (hashed). Distinct from the IP bucket so that
 * hammering one address from many networks is still bounded — that is the shape
 * an enumeration or provisioning-abuse attempt takes behind a proxy pool.
 * Falls back to the IP identity when the body carries no address.
 */
export const demoSignupIdentityRateLimiter = createLimiter({
  windowMs: 60 * 60_000,
  max: isProd ? 3 : 500,
  prefix: 'demo-signup-id',
  message: 'Too many demo requests for this address. Please try again later.',
  keyResolver: demoSignupIdentityKey,
  sharedStore: true,
});

/** Public invitation token endpoints: stricter anti-enumeration limits */
export const invitePublicRateLimiter = createLimiter({
  windowMs: 15 * 60_000,
  max: isProd ? 15 : 300,
  prefix: 'invite-public',
  message: 'Too many invitation attempts. Please try again later.',
});

/**
 * Public interview respondent writes (Package A, cross-flow runtime build).
 *
 * Deliberately NOT `invitePublicRateLimiter`. That one is tuned for
 * anti-enumeration on a one-shot invite lookup (15 requests / 15 min in prod);
 * an interview respondent legitimately writes once per question and may answer
 * twenty questions in a sitting, so reusing it would throttle the happy path
 * into failure and look like a product defect.
 *
 * Keyed by a hash of the invite token rather than by IP: several respondents
 * behind one corporate NAT must not consume each other's budget, and a single
 * leaked token must not get a fresh budget by rotating source addresses. The
 * token never lands in the key space in clear — `hashRateLimitIdentity` is the
 * same opacity contract `demoSignupIdentityRateLimiter` uses.
 */
export const interviewPublicAnswerRateLimiter = createLimiter({
  windowMs: 15 * 60_000,
  max: isProd ? 120 : 1000,
  prefix: 'interview-public-answer',
  message: 'Too many answer submissions for this invitation. Please try again shortly.',
  keyResolver: (req: Request) =>
    hashRateLimitIdentity('interview-public-answer', String(req.params?.token || '')),
  sharedStore: true,
});

/** Default API: 300 req / 15 min (prod) */
export const defaultRateLimiter = createLimiter({
  windowMs: 15 * 60_000,
  max: isProd ? 300 : 1000,
  prefix: 'api',
});

/** AI Chat stream: 30 req / min (prod) */
export const aiRateLimiter = createLimiter({
  windowMs: 60_000,
  max: isProd ? 30 : 200,
  prefix: 'ai',
  message: 'AI request rate limit exceeded.',
});

/** AI Memory: 20 req / min (prod) */
export const aiMemoryRateLimiter = createLimiter({
  windowMs: 60_000,
  max: isProd ? 20 : 200,
  prefix: 'ai-mem',
});

/** AI Actions: 50 req / min (prod) */
export const aiActionsRateLimiter = createLimiter({
  windowMs: 60_000,
  max: isProd ? 50 : 200,
  prefix: 'ai-act',
});

/** Conversations: 100 req / min (prod) */
export const conversationsRateLimiter = createLimiter({
  windowMs: 60_000,
  max: isProd ? 100 : 500,
  prefix: 'conv',
});

/**
 * Feedback submission: 10 req / min (prod).
 *
 * Keys by userId when authenticated, else IP. Scoped narrowly because each
 * POST /api/feedback payload can hold up to ~1.2 MB of diagnostics (screenshot
 * + breadcrumbs + console + network buffers). Without a dedicated limiter one
 * bored user could easily fill the feedback_items table and the
 * FEEDBACK_ARTIFACTS_DIR volume in minutes.
 */
export const feedbackRateLimiter = createLimiter({
  windowMs: 60_000,
  max: isProd ? 10 : 100,
  prefix: 'feedback',
  message: 'Feedback submission rate limit exceeded. Please try again in a moment.',
});

export const __private__ = {
  resolveLimiterParams,
  toSafeNonNegativeIntCount,
  toSafeNonNegativeIntSeconds,
  MAX_RATE_LIMIT_WINDOW_MS,
  MAX_RATE_LIMIT_MAX,
  getStoreSize: (): number => store.size,
  // Telemetry (OPS-DEMO-002)
  getRateLimitTelemetry,
  resetRateLimitTelemetry,
  REJECTION_LOG_INTERVAL_MS,
  // Shared-store seam (OPS-DEMO-002) — prepared, opt-in, default off
  isSharedStoreEnabled,
  isRateLimitBypassed,
  resolveSharedStoreFailMode,
  setSharedRateLimitStoreFactory,
  createRedisSharedRateLimitStore,
  getRateLimitRuntimeState,
  probeRateLimiterHealth,
  SHARED_STORE_ENV,
  SHARED_STORE_FAIL_MODE_ENV,
  PROBE_WINDOW_MS,
};

export default defaultRateLimiter;
