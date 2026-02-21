/**
 * Benchmark Cache Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * In-memory caching for benchmark data to reduce computation
 */

// ==========================================
// TYPES
// ==========================================

interface CachedData<T> {
  data: T;
  timestamp: number;
}

// ==========================================
// CLASS
// ==========================================

class BenchmarkCache {
  private cache: Map<string, CachedData<unknown>>;
  private readonly TTL: number;

  constructor() {
    this.cache = new Map();
    this.TTL = 3600000; // 1 hour
  }

  /**
   * Get cached benchmark data
   * @param industry - Industry identifier
   * @returns Cached data or null
   */
  get<T = unknown>(industry: string): T | null {
    const cached = this.cache.get(industry) as CachedData<T> | undefined;

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
   * @param industry - Industry identifier
   * @param data - Benchmark data
   */
  set<T = unknown>(industry: string, data: T): void {
    this.cache.set(industry, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Clear expired entries
   */
  clearExpired(): number {
    const now = Date.now();
    let cleared = 0;
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.TTL) {
        this.cache.delete(key);
        cleared += 1;
      }
    }
    return cleared;
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }
}

// Singleton instance
export const benchmarkCache = new BenchmarkCache();

// Clear expired entries every 10 minutes
setInterval(() => {
  benchmarkCache.clearExpired();
}, 600000);

export default benchmarkCache;
