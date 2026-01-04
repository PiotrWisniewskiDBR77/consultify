/**
 * Redis Store Utility
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Base class for Redis-backed stores with fallback to in-memory
 * Used by rate limiters and other middleware that need shared state
 */

import type { RedisClientType } from 'redis';

import { getRedisClient, isRedisConnected } from '../services/ai/redisClient.js';

// ==========================================
// TYPES
// ==========================================

interface InMemoryStore {
    [key: string]: {
        value: unknown;
        expiresAt?: number;
    };
}

// ==========================================
// REDIS STORE BASE CLASS
// ==========================================

/**
 * Base Redis store with fallback to in-memory
 * Provides common operations: get, set, increment, expire, delete
 */
export class RedisStore {
    protected prefix: string;
    protected inMemoryStore: InMemoryStore = {};
    protected cleanupInterval: NodeJS.Timeout | null = null;

    constructor(prefix: string) {
        this.prefix = prefix;
        // Start cleanup interval for in-memory store (every 5 minutes)
        this.startCleanupInterval();
    }

    /**
     * Get value from Redis or in-memory fallback
     */
    async get(key: string): Promise<string | null> {
        const fullKey = this.prefix + key;

        try {
            const client = getRedisClient();
            if (isRedisConnected() && client) {
                const value = await client.get(fullKey);
                return value;
            }
        } catch (error: unknown) {
            console.warn(`[RedisStore] Redis get error for key ${fullKey}:`, error);
        }

        // Fallback to in-memory
        const memEntry = this.inMemoryStore[fullKey];
        if (memEntry) {
            if (memEntry.expiresAt && memEntry.expiresAt < Date.now()) {
                delete this.inMemoryStore[fullKey];
                return null;
            }
            return String(memEntry.value);
        }

        return null;
    }

    /**
     * Set value in Redis or in-memory fallback
     */
    async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
        const fullKey = this.prefix + key;

        try {
            const client = getRedisClient();
            if (isRedisConnected() && client) {
                if (ttlSeconds) {
                    await client.setEx(fullKey, ttlSeconds, value);
                } else {
                    await client.set(fullKey, value);
                }
                return;
            }
        } catch (error: unknown) {
            console.warn(`[RedisStore] Redis set error for key ${fullKey}:`, error);
        }

        // Fallback to in-memory
        this.inMemoryStore[fullKey] = {
            value,
            expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
        };
    }

    /**
     * Increment value in Redis or in-memory fallback
     */
    async increment(key: string, ttlSeconds?: number): Promise<number> {
        const fullKey = this.prefix + key;

        try {
            const client = getRedisClient();
            if (isRedisConnected() && client) {
                const result = await client.incr(fullKey);
                if (ttlSeconds && result === 1) {
                    // Set TTL on first increment
                    await client.expire(fullKey, ttlSeconds);
                }
                return result;
            }
        } catch (error: unknown) {
            console.warn(`[RedisStore] Redis increment error for key ${fullKey}:`, error);
        }

        // Fallback to in-memory
        const memEntry = this.inMemoryStore[fullKey];
        if (memEntry && memEntry.expiresAt && memEntry.expiresAt < Date.now()) {
            delete this.inMemoryStore[fullKey];
        }

        const currentValue = memEntry ? Number(memEntry.value) || 0 : 0;
        const newValue = currentValue + 1;

        this.inMemoryStore[fullKey] = {
            value: newValue,
            expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
        };

        return newValue;
    }

    /**
     * Decrement value in Redis or in-memory fallback
     */
    async decrement(key: string): Promise<number> {
        const fullKey = this.prefix + key;

        try {
            const client = getRedisClient();
            if (isRedisConnected() && client) {
                return await client.decr(fullKey);
            }
        } catch (error: unknown) {
            console.warn(`[RedisStore] Redis decrement error for key ${fullKey}:`, error);
        }

        // Fallback to in-memory
        const memEntry = this.inMemoryStore[fullKey];
        if (!memEntry) {
            return 0;
        }

        if (memEntry.expiresAt && memEntry.expiresAt < Date.now()) {
            delete this.inMemoryStore[fullKey];
            return 0;
        }

        const currentValue = Number(memEntry.value) || 0;
        const newValue = Math.max(0, currentValue - 1);

        if (newValue === 0) {
            delete this.inMemoryStore[fullKey];
        } else {
            this.inMemoryStore[fullKey] = {
                value: newValue,
                expiresAt: memEntry.expiresAt,
            };
        }

        return newValue;
    }

    /**
     * Set expiration for a key
     */
    async expire(key: string, ttlSeconds: number): Promise<boolean> {
        const fullKey = this.prefix + key;

        try {
            const client = getRedisClient();
            if (isRedisConnected() && client) {
                const result = await client.expire(fullKey, ttlSeconds);
                return result === 1;
            }
        } catch (error: unknown) {
            console.warn(`[RedisStore] Redis expire error for key ${fullKey}:`, error);
        }

        // Fallback to in-memory
        const memEntry = this.inMemoryStore[fullKey];
        if (memEntry) {
            memEntry.expiresAt = Date.now() + ttlSeconds * 1000;
            return true;
        }

        return false;
    }

    /**
     * Delete a key
     */
    async delete(key: string): Promise<boolean> {
        const fullKey = this.prefix + key;

        try {
            const client = getRedisClient();
            if (isRedisConnected() && client) {
                const result = await client.del(fullKey);
                return result > 0;
            }
        } catch (error: unknown) {
            console.warn(`[RedisStore] Redis delete error for key ${fullKey}:`, error);
        }

        // Fallback to in-memory
        const existed = fullKey in this.inMemoryStore;
        delete this.inMemoryStore[fullKey];
        return existed;
    }

    /**
     * Check if Redis is available
     */
    isRedisAvailable(): boolean {
        return isRedisConnected();
    }

    /**
     * Get all keys matching a pattern (Redis only, not available in fallback)
     */
    async keys(pattern: string): Promise<string[]> {
        const fullPattern = this.prefix + pattern;

        try {
            const client = getRedisClient();
            if (isRedisConnected() && client) {
                const keys = await client.keys(fullPattern);
                // Remove prefix from keys
                return keys.map((key) => key.replace(this.prefix, ''));
            }
        } catch (error: unknown) {
            console.warn(`[RedisStore] Redis keys error for pattern ${fullPattern}:`, error);
        }

        // Fallback: return in-memory keys matching pattern
        const regex = new RegExp('^' + fullPattern.replace(/\*/g, '.*') + '$');
        return Object.keys(this.inMemoryStore)
            .filter((key) => regex.test(key))
            .map((key) => key.replace(this.prefix, ''));
    }

    /**
     * Clear all keys (use with caution!)
     */
    async clear(): Promise<void> {
        try {
            const client = getRedisClient();
            if (isRedisConnected() && client) {
                const keys = await client.keys(this.prefix + '*');
                if (keys.length > 0) {
                    await client.del(keys);
                }
            }
        } catch (error: unknown) {
            console.warn(`[RedisStore] Redis clear error:`, error);
        }

        // Clear in-memory store
        Object.keys(this.inMemoryStore).forEach((key) => {
            if (key.startsWith(this.prefix)) {
                delete this.inMemoryStore[key];
            }
        });
    }

    /**
     * Start cleanup interval for in-memory store
     */
    private startCleanupInterval(): void {
        if (this.cleanupInterval) {
            return;
        }

        this.cleanupInterval = setInterval(() => {
            const now = Date.now();
            Object.keys(this.inMemoryStore).forEach((key) => {
                const entry = this.inMemoryStore[key];
                if (entry.expiresAt && entry.expiresAt < now) {
                    delete this.inMemoryStore[key];
                }
            });
        }, 5 * 60 * 1000); // Every 5 minutes
    }

    /**
     * Stop cleanup interval
     */
    stopCleanupInterval(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
}

export default RedisStore;

