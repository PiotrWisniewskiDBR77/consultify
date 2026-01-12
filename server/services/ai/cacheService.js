/**
 * Cache Service - Semantic Caching for AI Responses
 * Uses in-memory cache by default, Redis-ready interface
 */

import crypto from 'crypto';

// In-memory cache (can be swapped for Redis)
const memoryCache = new Map();

// Cache configuration
const CACHE_CONFIG = {
    methodology: {
        ttl: 24 * 60 * 60 * 1000, // 24 hours for DRD methodology
        prefix: 'meth:'
    },
    data: {
        ttl: 60 * 60 * 1000, // 1 hour for data queries
        prefix: 'data:'
    },
    general: {
        ttl: 30 * 60 * 1000, // 30 minutes for general
        prefix: 'gen:'
    }
};

// Keywords that indicate methodology queries (higher cache retention)
const METHODOLOGY_KEYWORDS = [
    'drd', 'methodology', 'framework', 'maturity', 'assessment',
    'readiness', 'diagnostic', 'dimension', 'axis', 'level'
];

class CacheService {
    constructor() {
        this.redis = null; // Future: Redis client
        this.enabled = process.env.AI_CACHE_ENABLED !== 'false';
        this.stats = { hits: 0, misses: 0 };
    }

    /**
     * Generate cache key from query and context
     */
    generateKey(query, context = {}) {
        const normalizedQuery = query.toLowerCase().trim().replace(/\s+/g, ' ');
        const contextHash = this.hashObject({
            orgId: context.organizationId,
            projectId: context.projectId,
            capability: context.capability
        });

        const cacheType = this.detectCacheType(normalizedQuery);
        const prefix = CACHE_CONFIG[cacheType].prefix;
        const queryHash = crypto.createHash('sha256').update(normalizedQuery).digest('hex').substring(0, 16);

        return `${prefix}${queryHash}:${contextHash}`;
    }

    /**
     * Detect cache type based on query content
     */
    detectCacheType(query) {
        const lowerQuery = query.toLowerCase();

        if (METHODOLOGY_KEYWORDS.some(kw => lowerQuery.includes(kw))) {
            return 'methodology';
        }

        // Data queries contain specific identifiers
        if (query.includes('project') || query.includes('report') || /\b[a-f0-9-]{36}\b/.test(query)) {
            return 'data';
        }

        return 'general';
    }

    /**
     * Get cached response
     * @returns {object|null} Cached response or null
     */
    async get(query, context = {}) {
        if (!this.enabled) return null;

        const key = this.generateKey(query, context);

        // Try Redis first (if available)
        if (this.redis) {
            try {
                const cached = await this.redis.get(key);
                if (cached) {
                    this.stats.hits++;
                    return JSON.parse(cached);
                }
            } catch (e) {
                console.warn('[CacheService] Redis get error:', e.message);
            }
        }

        // Fall back to memory cache
        const entry = memoryCache.get(key);
        if (entry && Date.now() < entry.expiresAt) {
            this.stats.hits++;
            return entry.value;
        }

        // Clean up expired entry
        if (entry) {
            memoryCache.delete(key);
        }

        this.stats.misses++;
        return null;
    }

    /**
     * Cache a response
     */
    async set(query, context, response) {
        if (!this.enabled) return;

        const key = this.generateKey(query, context);
        const cacheType = this.detectCacheType(query);
        const ttl = CACHE_CONFIG[cacheType].ttl;

        const cacheEntry = {
            value: response,
            createdAt: Date.now(),
            expiresAt: Date.now() + ttl,
            type: cacheType
        };

        // Try Redis first
        if (this.redis) {
            try {
                await this.redis.setex(key, Math.floor(ttl / 1000), JSON.stringify(response));
                return;
            } catch (e) {
                console.warn('[CacheService] Redis set error:', e.message);
            }
        }

        // Fall back to memory cache
        memoryCache.set(key, cacheEntry);

        // Clean up old entries periodically
        if (memoryCache.size > 1000) {
            this.cleanup();
        }
    }

    /**
     * Invalidate cache entries matching a pattern
     */
    async invalidate(pattern) {
        // Memory cache cleanup
        for (const [key] of memoryCache) {
            if (key.includes(pattern)) {
                memoryCache.delete(key);
            }
        }

        // Redis cleanup
        if (this.redis) {
            try {
                const keys = await this.redis.keys(`*${pattern}*`);
                if (keys.length > 0) {
                    await this.redis.del(...keys);
                }
            } catch (e) {
                console.warn('[CacheService] Redis invalidate error:', e.message);
            }
        }
    }

    /**
     * Clean up expired entries
     */
    cleanup() {
        const now = Date.now();
        for (const [key, entry] of memoryCache) {
            if (now > entry.expiresAt) {
                memoryCache.delete(key);
            }
        }
    }

    /**
     * Get cache statistics
     */
    getStats() {
        const total = this.stats.hits + this.stats.misses;
        return {
            hits: this.stats.hits,
            misses: this.stats.misses,
            hitRate: total > 0 ? Math.round((this.stats.hits / total) * 100) : 0,
            memoryCacheSize: memoryCache.size,
            redisConnected: !!this.redis
        };
    }

    /**
     * Connect to Redis using shared client
     * @param {object} redisClient - Redis client from redisClient.js
     */
    connectRedis(redisClient) {
        if (redisClient) {
            this.redis = redisClient;
            console.log('[CacheService] Connected to Redis (shared client)');
        }
    }

    /**
     * Check if Redis is connected
     */
    isRedisConnected() {
        return this.redis !== null;
    }

    hashObject(obj) {
        return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex').substring(0, 8);
    }
}

// Singleton
const cacheService = new CacheService();

export {
CacheService, cacheService, CACHE_CONFIG
};

export default { CacheService, cacheService, CACHE_CONFIG };
