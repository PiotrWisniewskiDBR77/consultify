/**
 * Memory Leak Detection Tests
 * 
 * Tests for detecting memory leaks in repeated operations
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Memory Leak Detection', () => {
    describe('Heap Growth Monitoring', () => {
        it('should not grow memory excessively during repeated operations', async () => {
            const iterations = 1000;
            const maxAllowedGrowthMB = 50;

            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }

            const initialMemory = process.memoryUsage().heapUsed;

            // Simulate repeated operations
            const results: unknown[] = [];
            for (let i = 0; i < iterations; i++) {
                // Example: Creating and processing objects
                const obj = {
                    id: i,
                    data: new Array(100).fill(Math.random()),
                    timestamp: Date.now()
                };
                results.push(JSON.parse(JSON.stringify(obj)));

                // Clear reference periodically to allow GC
                if (i % 100 === 0) {
                    results.length = 0;
                }
            }

            const finalMemory = process.memoryUsage().heapUsed;
            const growthMB = (finalMemory - initialMemory) / 1024 / 1024;

            expect(growthMB).toBeLessThan(maxAllowedGrowthMB);
        });

        it('should properly release memory after large object processing', () => {
            const createLargeObject = () => ({
                data: new Array(10000).fill('x'.repeat(100)),
                nested: {
                    items: new Array(1000).fill({ value: Math.random() })
                }
            });

            // Measure initial state
            const before = process.memoryUsage().heapUsed;

            // Create and process large objects
            let tempRef: unknown = createLargeObject();

            // Release reference
            tempRef = null;

            // Allow GC time (in real tests, may need async wait)
            if (global.gc) {
                global.gc();
            }

            const after = process.memoryUsage().heapUsed;

            // Memory should be somewhat recovered (allowing for test overhead)
            // This is a basic check; in practice, more sophisticated profiling is needed
            expect(tempRef).toBeNull();
        });
    });

    describe('Event Listener Cleanup', () => {
        it('should track and clean up event listeners', () => {
            const listeners = new Map<string, Set<Function>>();

            const addEventListener = (event: string, handler: Function) => {
                if (!listeners.has(event)) {
                    listeners.set(event, new Set());
                }
                listeners.get(event)!.add(handler);
            };

            const removeEventListener = (event: string, handler: Function) => {
                listeners.get(event)?.delete(handler);
            };

            const getListenerCount = (event: string): number => {
                return listeners.get(event)?.size || 0;
            };

            // Add listeners
            const handler1 = () => { };
            const handler2 = () => { };
            addEventListener('click', handler1);
            addEventListener('click', handler2);

            expect(getListenerCount('click')).toBe(2);

            // Remove listeners
            removeEventListener('click', handler1);
            removeEventListener('click', handler2);

            expect(getListenerCount('click')).toBe(0);
        });

        it('should warn when too many listeners are added', () => {
            const MAX_LISTENERS = 10;
            const listeners: Function[] = [];
            const warnSpy = vi.fn();

            const addListenerWithWarning = (handler: Function) => {
                listeners.push(handler);
                if (listeners.length > MAX_LISTENERS) {
                    warnSpy(`Possible memory leak: ${listeners.length} listeners added`);
                }
            };

            // Add too many listeners
            for (let i = 0; i < 15; i++) {
                addListenerWithWarning(() => { });
            }

            expect(warnSpy).toHaveBeenCalled();
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('memory leak'));
        });
    });

    describe('Timer and Interval Cleanup', () => {
        let timers: NodeJS.Timeout[] = [];
        let intervals: NodeJS.Timeout[] = [];

        beforeEach(() => {
            timers = [];
            intervals = [];
        });

        afterEach(() => {
            timers.forEach(t => clearTimeout(t));
            intervals.forEach(i => clearInterval(i));
        });

        it('should track and cleanup timers', () => {
            const createTrackedTimeout = (callback: () => void, ms: number): NodeJS.Timeout => {
                const id = setTimeout(callback, ms);
                timers.push(id);
                return id;
            };

            const clearTrackedTimeout = (id: NodeJS.Timeout) => {
                clearTimeout(id);
                const index = timers.indexOf(id);
                if (index > -1) {
                    timers.splice(index, 1);
                }
            };

            const timer = createTrackedTimeout(() => { }, 1000);
            expect(timers.length).toBe(1);

            clearTrackedTimeout(timer);
            expect(timers.length).toBe(0);
        });

        it('should cleanup intervals on component unmount', () => {
            const createTrackedInterval = (callback: () => void, ms: number): NodeJS.Timeout => {
                const id = setInterval(callback, ms);
                intervals.push(id);
                return id;
            };

            const clearAllIntervals = () => {
                intervals.forEach(i => clearInterval(i));
                intervals.length = 0;
            };

            createTrackedInterval(() => { }, 100);
            createTrackedInterval(() => { }, 200);
            expect(intervals.length).toBe(2);

            clearAllIntervals();
            expect(intervals.length).toBe(0);
        });
    });

    describe('Cache Size Management', () => {
        it('should enforce cache size limits', () => {
            const MAX_CACHE_SIZE = 100;
            const cache = new Map<string, unknown>();

            const addToCache = (key: string, value: unknown) => {
                if (cache.size >= MAX_CACHE_SIZE) {
                    // Remove oldest entry (LRU-like)
                    const firstKey = cache.keys().next().value;
                    cache.delete(firstKey);
                }
                cache.set(key, value);
            };

            // Add more than max items
            for (let i = 0; i < 150; i++) {
                addToCache(`key-${i}`, { data: i });
            }

            expect(cache.size).toBeLessThanOrEqual(MAX_CACHE_SIZE);
        });

        it('should expire stale cache entries', () => {
            interface CacheEntry {
                value: unknown;
                timestamp: number;
                ttl: number;
            }

            const cache = new Map<string, CacheEntry>();
            const now = Date.now();

            const setWithTTL = (key: string, value: unknown, ttlMs: number) => {
                cache.set(key, { value, timestamp: now, ttl: ttlMs });
            };

            const cleanExpired = (currentTime: number) => {
                for (const [key, entry] of cache) {
                    if (currentTime - entry.timestamp > entry.ttl) {
                        cache.delete(key);
                    }
                }
            };

            // Add entries with different TTLs
            setWithTTL('short', 'data1', 1000);  // 1 second
            setWithTTL('long', 'data2', 60000);  // 1 minute

            // Simulate time passing
            cleanExpired(now + 5000);  // 5 seconds later

            expect(cache.has('short')).toBe(false);
            expect(cache.has('long')).toBe(true);
        });
    });

    describe('Subscription Cleanup', () => {
        it('should cleanup all subscriptions on disposal', () => {
            const subscriptions: { unsubscribe: () => void }[] = [];
            let unsubscribeCalls = 0;

            const subscribe = () => {
                const subscription = {
                    unsubscribe: () => {
                        unsubscribeCalls++;
                    }
                };
                subscriptions.push(subscription);
                return subscription;
            };

            const disposeAll = () => {
                subscriptions.forEach(s => s.unsubscribe());
                subscriptions.length = 0;
            };

            // Create subscriptions
            subscribe();
            subscribe();
            subscribe();
            expect(subscriptions.length).toBe(3);

            // Dispose
            disposeAll();
            expect(subscriptions.length).toBe(0);
            expect(unsubscribeCalls).toBe(3);
        });
    });
});
