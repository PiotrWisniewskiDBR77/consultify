/**
 * Lazy Loading Pattern Tests
 * Tests for deferred loading and code splitting patterns
 * 
 * @module tests/performance/lazy-loading.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Lazy loader
const createLazyLoader = () => {
    const cache = new Map();
    const pending = new Map();

    return {
        load: async (key, loader) => {
            if (cache.has(key)) {
                return cache.get(key);
            }

            if (pending.has(key)) {
                return pending.get(key);
            }

            const promise = loader().then(result => {
                cache.set(key, result);
                pending.delete(key);
                return result;
            }).catch(err => {
                pending.delete(key);
                throw err;
            });

            pending.set(key, promise);
            return promise;
        },

        preload: (key, loader) => {
            if (!cache.has(key) && !pending.has(key)) {
                this.load(key, loader);
            }
        },

        isLoaded: (key) => cache.has(key),

        isPending: (key) => pending.has(key),

        invalidate: (key) => {
            cache.delete(key);
        },

        clear: () => {
            cache.clear();
        },
    };
};

// Intersection observer-based lazy loader
const createIntersectionLoader = () => {
    const callbacks = new Map();
    let observer = null;

    return {
        init: (options = {}) => {
            const { rootMargin = '50px', threshold = 0.1 } = options;

            observer = {
                observe: vi.fn((element) => {
                    // Simulate intersection
                    setTimeout(() => {
                        const callback = callbacks.get(element);
                        callback?.();
                    }, 10);
                }),
                unobserve: vi.fn(),
                disconnect: vi.fn(),
            };
        },

        observe: (element, callback) => {
            callbacks.set(element, callback);
            observer?.observe(element);
        },

        unobserve: (element) => {
            callbacks.delete(element);
            observer?.unobserve(element);
        },

        disconnect: () => {
            callbacks.clear();
            observer?.disconnect();
        },

        getObservedCount: () => callbacks.size,
    };
};

// Module registry for dynamic imports
const createModuleRegistry = () => {
    const modules = new Map();
    const loaded = new Map();

    return {
        register: (name, loader) => {
            modules.set(name, loader);
        },

        import: async (name) => {
            if (loaded.has(name)) {
                return loaded.get(name);
            }

            const loader = modules.get(name);
            if (!loader) {
                throw new Error(`Module not registered: ${name}`);
            }

            const module = await loader();
            loaded.set(name, module);
            return module;
        },

        isLoaded: (name) => loaded.has(name),

        preloadAll: async () => {
            const promises = [];
            for (const name of modules.keys()) {
                if (!loaded.has(name)) {
                    promises.push(this.import(name));
                }
            }
            await Promise.all(promises);
        },

        getLoadedModules: () => [...loaded.keys()],
    };
};

// Resource loader with priority
const createPriorityLoader = () => {
    const queue = [];
    let isProcessing = false;
    let concurrency = 2;
    let active = 0;

    const processQueue = async () => {
        if (isProcessing || queue.length === 0 || active >= concurrency) return;
        isProcessing = true;

        while (queue.length > 0 && active < concurrency) {
            const { loader, resolve, reject } = queue.shift();
            active++;

            loader()
                .then(resolve)
                .catch(reject)
                .finally(() => {
                    active--;
                    processQueue();
                });
        }

        isProcessing = false;
    };

    return {
        load: (loader, priority = 0) => {
            return new Promise((resolve, reject) => {
                const item = { loader, resolve, reject, priority };

                // Insert by priority (higher = more urgent)
                let inserted = false;
                for (let i = 0; i < queue.length; i++) {
                    if (queue[i].priority < priority) {
                        queue.splice(i, 0, item);
                        inserted = true;
                        break;
                    }
                }
                if (!inserted) queue.push(item);

                processQueue();
            });
        },

        setConcurrency: (n) => {
            concurrency = n;
        },

        getQueueLength: () => queue.length,

        getActiveCount: () => active,
    };
};

// Chunked data loader
const createChunkedLoader = (chunkSize = 10) => {
    return {
        loadAll: async (items, processor) => {
            const results = [];

            for (let i = 0; i < items.length; i += chunkSize) {
                const chunk = items.slice(i, i + chunkSize);
                const chunkResults = await Promise.all(chunk.map(processor));
                results.push(...chunkResults);
            }

            return results;
        },

        loadWithProgress: async (items, processor, onProgress) => {
            const results = [];
            let processed = 0;

            for (let i = 0; i < items.length; i += chunkSize) {
                const chunk = items.slice(i, i + chunkSize);
                const chunkResults = await Promise.all(chunk.map(processor));
                results.push(...chunkResults);

                processed += chunk.length;
                onProgress?.({
                    processed,
                    total: items.length,
                    percent: (processed / items.length) * 100,
                });
            }

            return results;
        },
    };
};

describe('Lazy Loader Tests', () => {
    let loader;

    beforeEach(() => {
        loader = createLazyLoader();
    });

    it('should load and cache', async () => {
        const factory = vi.fn(() => Promise.resolve({ data: 'test' }));

        const result1 = await loader.load('key', factory);
        const result2 = await loader.load('key', factory);

        expect(result1).toEqual({ data: 'test' });
        expect(result1).toBe(result2);
        expect(factory).toHaveBeenCalledTimes(1);
    });

    it('should deduplicate concurrent loads', async () => {
        let resolveLoad;
        const factory = vi.fn(() => new Promise(r => { resolveLoad = r; }));

        const p1 = loader.load('key', factory);
        const p2 = loader.load('key', factory);

        expect(loader.isPending('key')).toBe(true);

        resolveLoad('value');
        await Promise.all([p1, p2]);

        expect(factory).toHaveBeenCalledTimes(1);
    });

    it('should invalidate', async () => {
        await loader.load('key', () => Promise.resolve('v1'));
        loader.invalidate('key');

        const result = await loader.load('key', () => Promise.resolve('v2'));

        expect(result).toBe('v2');
    });
});

describe('Module Registry Tests', () => {
    let registry;

    beforeEach(() => {
        registry = createModuleRegistry();
    });

    it('should register and import', async () => {
        registry.register('utils', () => Promise.resolve({ sum: (a, b) => a + b }));

        const mod = await registry.import('utils');

        expect(mod.sum(1, 2)).toBe(3);
    });

    it('should cache imports', async () => {
        const loader = vi.fn(() => Promise.resolve({}));
        registry.register('mod', loader);

        await registry.import('mod');
        await registry.import('mod');

        expect(loader).toHaveBeenCalledTimes(1);
    });

    it('should preload all', async () => {
        registry.register('a', () => Promise.resolve('a'));
        registry.register('b', () => Promise.resolve('b'));

        await registry.preloadAll();

        expect(registry.isLoaded('a')).toBe(true);
        expect(registry.isLoaded('b')).toBe(true);
    });
});

describe('Priority Loader Tests', () => {
    let loader;

    beforeEach(() => {
        loader = createPriorityLoader();
        loader.setConcurrency(1);
    });

    it('should process by priority', async () => {
        const order = [];

        const p1 = loader.load(() => Promise.resolve().then(() => order.push('low')), 1);
        const p2 = loader.load(() => Promise.resolve().then(() => order.push('high')), 10);

        await Promise.all([p1, p2]);

        expect(order[0]).toBe('high');
    });
});

describe('Chunked Loader Tests', () => {
    let loader;

    beforeEach(() => {
        loader = createChunkedLoader(3);
    });

    it('should load in chunks', async () => {
        const items = [1, 2, 3, 4, 5];
        const results = await loader.loadAll(items, async (x) => x * 2);

        expect(results).toEqual([2, 4, 6, 8, 10]);
    });

    it('should report progress', async () => {
        const items = [1, 2, 3, 4, 5, 6];
        const progress = [];

        await loader.loadWithProgress(
            items,
            async (x) => x,
            (p) => progress.push(p.percent)
        );

        expect(progress).toContain(50);
        expect(progress).toContain(100);
    });
});
