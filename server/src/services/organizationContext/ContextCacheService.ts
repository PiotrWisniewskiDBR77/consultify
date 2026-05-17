/**
 * Context Cache Service - tenant-safe caching layer for retrieval results.
 *
 * Source of truth: docs/product/ORGANIZATION_CONTEXT_ENGINE_SOURCE_OF_TRUTH.md §17
 *
 * Invariants:
 * - Cache keys ALWAYS prefix with `tenant:{org_id}:` to prevent cross-tenant leakage.
 * - Default backend is in-process Map with TTL; Redis backend is opt-in via REDIS_URL +
 *   ORG_CONTEXT_CACHE_BACKEND=redis.
 * - Cache invalidation on document upload/delete is the responsibility of the writer
 *   (ContextDocumentService publishes invalidate events).
 */

import logger from '../../utils/Logger.js';

export type CacheBackend = 'memory' | 'redis';

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const memoryStore = new Map<string, CacheEntry>();
let memoryStorePruneTimer: NodeJS.Timeout | null = null;
const DEFAULT_TTL_MS = 5 * 60 * 1000;
const MAX_MEMORY_KEYS = 5000;

function getBackend(): CacheBackend {
  const raw = String(process.env.ORG_CONTEXT_CACHE_BACKEND || 'memory').toLowerCase();
  if (raw === 'redis' && process.env.REDIS_URL) return 'redis';
  return 'memory';
}

function buildKey(organizationId: string, scope: string, key: string): string {
  if (!organizationId) {
    throw new Error('context_cache_organization_id_required');
  }
  return `tenant:${organizationId}:${scope}:${key}`;
}

function pruneMemoryStore(): void {
  const now = Date.now();
  for (const [key, entry] of memoryStore.entries()) {
    if (entry.expiresAt < now) {
      memoryStore.delete(key);
    }
  }
  if (memoryStore.size > MAX_MEMORY_KEYS) {
    const overflow = memoryStore.size - MAX_MEMORY_KEYS;
    let removed = 0;
    for (const key of memoryStore.keys()) {
      memoryStore.delete(key);
      removed += 1;
      if (removed >= overflow) break;
    }
  }
}

function ensurePruner(): void {
  if (memoryStorePruneTimer) return;
  memoryStorePruneTimer = setInterval(pruneMemoryStore, 60_000);
  if (typeof memoryStorePruneTimer.unref === 'function') {
    memoryStorePruneTimer.unref();
  }
}

async function memoryGet(fullKey: string): Promise<unknown | null> {
  const entry = memoryStore.get(fullKey);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    memoryStore.delete(fullKey);
    return null;
  }
  return entry.value;
}

async function memorySet(fullKey: string, value: unknown, ttlMs: number): Promise<void> {
  ensurePruner();
  memoryStore.set(fullKey, { value, expiresAt: Date.now() + ttlMs });
}

async function memoryDelete(prefix: string): Promise<number> {
  let removed = 0;
  for (const key of memoryStore.keys()) {
    if (key.startsWith(prefix)) {
      memoryStore.delete(key);
      removed += 1;
    }
  }
  return removed;
}

let redisClient: any = null;

async function getRedisClient(): Promise<any> {
  if (redisClient) return redisClient;
  if (!process.env.REDIS_URL) return null;
  try {
    const ioredisMod = (await import('ioredis').catch(() => null)) as any;
    if (!ioredisMod) {
      logger.warn(
        '[ContextCacheService] Redis backend requested but ioredis package not installed; falling back to memory.'
      );
      return null;
    }
    const Redis = ioredisMod.default || ioredisMod;
    redisClient = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
    });
    await redisClient.connect().catch(() => null);
    return redisClient;
  } catch {
    return null;
  }
}

async function redisGet(fullKey: string): Promise<unknown | null> {
  const client = await getRedisClient();
  if (!client) return null;
  try {
    const raw = await client.get(fullKey);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function redisSet(fullKey: string, value: unknown, ttlMs: number): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;
  try {
    await client.set(fullKey, JSON.stringify(value), 'PX', ttlMs);
  } catch {
    // best-effort
  }
}

async function redisDelete(prefix: string): Promise<number> {
  const client = await getRedisClient();
  if (!client) return 0;
  try {
    const keys = (await client.keys(`${prefix}*`)) as string[];
    if (keys.length === 0) return 0;
    await client.del(...keys);
    return keys.length;
  } catch {
    return 0;
  }
}

export interface ContextCacheGetInput {
  organizationId: string;
  scope: string;
  key: string;
}

export interface ContextCacheSetInput extends ContextCacheGetInput {
  value: unknown;
  ttlMs?: number;
}

export interface ContextCacheInvalidateInput {
  organizationId: string;
  scope?: string;
}

export async function getCachedContextValue<T = unknown>(
  input: ContextCacheGetInput
): Promise<T | null> {
  const fullKey = buildKey(input.organizationId, input.scope, input.key);
  const value = getBackend() === 'redis' ? await redisGet(fullKey) : await memoryGet(fullKey);
  return (value as T) ?? null;
}

export async function setCachedContextValue(input: ContextCacheSetInput): Promise<void> {
  const fullKey = buildKey(input.organizationId, input.scope, input.key);
  const ttlMs = Math.max(1000, Math.min(input.ttlMs || DEFAULT_TTL_MS, 24 * 60 * 60 * 1000));
  if (getBackend() === 'redis') {
    await redisSet(fullKey, input.value, ttlMs);
  } else {
    await memorySet(fullKey, input.value, ttlMs);
  }
}

export async function invalidateContextCacheForOrganization(
  input: ContextCacheInvalidateInput
): Promise<number> {
  if (!input.organizationId) {
    throw new Error('context_cache_organization_id_required');
  }
  const prefix = `tenant:${input.organizationId}:${input.scope ? `${input.scope}:` : ''}`;
  return getBackend() === 'redis' ? await redisDelete(prefix) : await memoryDelete(prefix);
}

export function getContextCacheBackend(): CacheBackend {
  return getBackend();
}

const contextCacheService = {
  getCachedContextValue,
  setCachedContextValue,
  invalidateContextCacheForOrganization,
  getContextCacheBackend,
};

export default contextCacheService;
