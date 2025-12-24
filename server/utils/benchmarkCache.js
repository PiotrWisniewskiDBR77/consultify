/**
 * Benchmark Cache Service
 * In-memory caching for benchmark data to reduce computation
 */

class BenchmarkCache {
    constructor() {
        this.cache = new Map();
        this.TTL = 3600000; // 1 hour
    }

    /**
     * Get cached benchmark data
     * @param {string} industry - Industry identifier
     * @returns {Object|null} Cached data or null
     */
    get(industry) {
        const cached = this.cache.get(industry);

        if (!cached) return null;

        // Check if expired
        if (Date.now() - cached.timestamp > this.TTL) {
            this.cache.delete(industry);
            return null;
        }

        return cached.data;
    }

    /**
     * Set benchmark data in cache
     * @param {string} industry - Industry identifier
     * @param {Object} data - Benchmark data
     */
    set(industry, data) {
        this.cache.set(industry, {
            data,
            timestamp: Date.now()
        });
    }

    /**
     * Clear entire cache
     */
    clear() {
        this.cache.clear();
    }

    /**
     * Clear expired entries
     */
    clearExpired() {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > this.TTL) {
                this.cache.delete(key);
            }
        }
    }
}

// Singleton instance
const benchmarkCache = new BenchmarkCache();

// Clear expired entries every 10 minutes
setInterval(() => {
    benchmarkCache.clearExpired();
}, 600000);

module.exports = benchmarkCache;
