/**
 * Network Utilities Tests
 * Tests for fetch, retry, and request handling
 * 
 * @module tests/network/network-utils.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Fetch wrapper with retry
const createFetchWrapper = (options = {}) => {
    const {
        baseURL = '',
        timeout = 30000,
        retries = 0,
        retryDelay = 1000,
        headers = {},
    } = options;

    const delay = (ms) => new Promise(r => setTimeout(r, ms));

    const request = async (url, config = {}) => {
        const fullURL = url.startsWith('http') ? url : `${baseURL}${url}`;
        const controller = new AbortController();

        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const requestConfig = {
            ...config,
            headers: { ...headers, ...config.headers },
            signal: controller.signal,
        };

        let lastError;
        let attempts = 0;

        while (attempts <= retries) {
            try {
                const response = await fetch(fullURL, requestConfig);
                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const contentType = response.headers.get('content-type');
                if (contentType?.includes('application/json')) {
                    return await response.json();
                }
                return await response.text();
            } catch (error) {
                lastError = error;
                attempts++;

                if (attempts <= retries) {
                    await delay(retryDelay * attempts);
                }
            }
        }

        clearTimeout(timeoutId);
        throw lastError;
    };

    return {
        get: (url, config) => request(url, { ...config, method: 'GET' }),
        post: (url, data, config) => request(url, { ...config, method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json', ...config?.headers } }),
        put: (url, data, config) => request(url, { ...config, method: 'PUT', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json', ...config?.headers } }),
        patch: (url, data, config) => request(url, { ...config, method: 'PATCH', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json', ...config?.headers } }),
        delete: (url, config) => request(url, { ...config, method: 'DELETE' }),
        request,
    };
};

// Request queue
const createRequestQueue = (concurrency = 3) => {
    const queue = [];
    let active = 0;

    const processQueue = async () => {
        while (queue.length > 0 && active < concurrency) {
            const { request, resolve, reject } = queue.shift();
            active++;

            try {
                const result = await request();
                resolve(result);
            } catch (error) {
                reject(error);
            } finally {
                active--;
                processQueue();
            }
        }
    };

    return {
        add: (requestFn) => {
            return new Promise((resolve, reject) => {
                queue.push({ request: requestFn, resolve, reject });
                processQueue();
            });
        },

        getQueueLength: () => queue.length,

        getActiveCount: () => active,

        clear: () => {
            queue.length = 0;
        },
    };
};

// Request interceptors
const createInterceptorManager = () => {
    const requestInterceptors = [];
    const responseInterceptors = [];

    return {
        addRequestInterceptor: (onFulfilled, onRejected) => {
            const id = requestInterceptors.length;
            requestInterceptors.push({ onFulfilled, onRejected });
            return id;
        },

        addResponseInterceptor: (onFulfilled, onRejected) => {
            const id = responseInterceptors.length;
            responseInterceptors.push({ onFulfilled, onRejected });
            return id;
        },

        removeRequestInterceptor: (id) => {
            requestInterceptors[id] = null;
        },

        removeResponseInterceptor: (id) => {
            responseInterceptors[id] = null;
        },

        runRequestInterceptors: async (config) => {
            let result = config;
            for (const interceptor of requestInterceptors) {
                if (interceptor?.onFulfilled) {
                    result = await interceptor.onFulfilled(result);
                }
            }
            return result;
        },

        runResponseInterceptors: async (response) => {
            let result = response;
            for (const interceptor of responseInterceptors) {
                if (interceptor?.onFulfilled) {
                    result = await interceptor.onFulfilled(result);
                }
            }
            return result;
        },

        getRequestInterceptorCount: () => requestInterceptors.filter(Boolean).length,

        getResponseInterceptorCount: () => responseInterceptors.filter(Boolean).length,
    };
};

// Request deduplication
const createRequestDeduplicator = () => {
    const pending = new Map();

    return {
        dedupe: async (key, requestFn) => {
            if (pending.has(key)) {
                return pending.get(key);
            }

            const promise = requestFn().finally(() => {
                pending.delete(key);
            });

            pending.set(key, promise);
            return promise;
        },

        isPending: (key) => pending.has(key),

        getPendingCount: () => pending.size,

        clear: () => {
            pending.clear();
        },
    };
};

// Mock response builder
const createMockResponseBuilder = () => {
    const mocks = new Map();

    return {
        mock: (url, response, options = {}) => {
            mocks.set(url, {
                response,
                status: options.status || 200,
                delay: options.delay || 0,
                headers: options.headers || {},
                once: options.once || false,
            });
        },

        respond: async (url) => {
            const mock = mocks.get(url);
            if (!mock) return null;

            if (mock.delay) {
                await new Promise(r => setTimeout(r, mock.delay));
            }

            if (mock.once) {
                mocks.delete(url);
            }

            return {
                status: mock.status,
                data: mock.response,
                headers: mock.headers,
            };
        },

        hasMock: (url) => mocks.has(url),

        clearMocks: () => {
            mocks.clear();
        },

        getMockCount: () => mocks.size,
    };
};

describe('Fetch Wrapper Tests', () => {
    let fetchWrapper;

    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
        fetchWrapper = createFetchWrapper({ baseURL: 'https://api.example.com' });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('should make GET request', async () => {
        fetch.mockResolvedValue({
            ok: true,
            headers: new Map([['content-type', 'application/json']]),
            json: () => Promise.resolve({ data: 'test' }),
        });

        const result = await fetchWrapper.get('/endpoint');

        expect(fetch).toHaveBeenCalled();
        expect(result).toEqual({ data: 'test' });
    });

    it('should make POST request with data', async () => {
        fetch.mockResolvedValue({
            ok: true,
            headers: new Map([['content-type', 'application/json']]),
            json: () => Promise.resolve({ success: true }),
        });

        await fetchWrapper.post('/endpoint', { foo: 'bar' });

        expect(fetch).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ foo: 'bar' }),
            })
        );
    });
});

describe('Request Queue Tests', () => {
    let queue;

    beforeEach(() => {
        queue = createRequestQueue(2);
    });

    it('should queue requests', async () => {
        const results = [];

        await Promise.all([
            queue.add(() => Promise.resolve(1)).then(r => results.push(r)),
            queue.add(() => Promise.resolve(2)).then(r => results.push(r)),
            queue.add(() => Promise.resolve(3)).then(r => results.push(r)),
        ]);

        expect(results).toContain(1);
        expect(results).toContain(2);
        expect(results).toContain(3);
    });

    it('should limit concurrency', () => {
        queue.add(() => new Promise(r => setTimeout(r, 100)));
        queue.add(() => new Promise(r => setTimeout(r, 100)));
        queue.add(() => new Promise(r => setTimeout(r, 100)));

        expect(queue.getActiveCount()).toBeLessThanOrEqual(2);
    });
});

describe('Interceptor Manager Tests', () => {
    let manager;

    beforeEach(() => {
        manager = createInterceptorManager();
    });

    it('should add request interceptor', () => {
        manager.addRequestInterceptor((config) => config);

        expect(manager.getRequestInterceptorCount()).toBe(1);
    });

    it('should run request interceptors', async () => {
        manager.addRequestInterceptor((config) => ({
            ...config,
            headers: { Authorization: 'Bearer token' },
        }));

        const result = await manager.runRequestInterceptors({ url: '/api' });

        expect(result.headers.Authorization).toBe('Bearer token');
    });

    it('should remove interceptor', () => {
        const id = manager.addRequestInterceptor(() => { });
        manager.removeRequestInterceptor(id);

        expect(manager.getRequestInterceptorCount()).toBe(0);
    });
});

describe('Request Deduplicator Tests', () => {
    let deduplicator;

    beforeEach(() => {
        deduplicator = createRequestDeduplicator();
    });

    it('should deduplicate identical requests', async () => {
        const requestFn = vi.fn().mockResolvedValue('result');

        const [r1, r2] = await Promise.all([
            deduplicator.dedupe('key1', requestFn),
            deduplicator.dedupe('key1', requestFn),
        ]);

        expect(requestFn).toHaveBeenCalledTimes(1);
        expect(r1).toBe(r2);
    });

    it('should track pending requests', () => {
        deduplicator.dedupe('key', () => new Promise(r => setTimeout(r, 100)));

        expect(deduplicator.isPending('key')).toBe(true);
    });
});

describe('Mock Response Builder Tests', () => {
    let mockBuilder;

    beforeEach(() => {
        mockBuilder = createMockResponseBuilder();
    });

    it('should mock response', async () => {
        mockBuilder.mock('/api/users', [{ id: 1 }]);

        const response = await mockBuilder.respond('/api/users');

        expect(response.data).toEqual([{ id: 1 }]);
    });

    it('should support delay', async () => {
        mockBuilder.mock('/api/slow', 'data', { delay: 50 });

        const start = Date.now();
        await mockBuilder.respond('/api/slow');

        expect(Date.now() - start).toBeGreaterThanOrEqual(50);
    });

    it('should remove one-time mocks', async () => {
        mockBuilder.mock('/api/once', 'data', { once: true });

        await mockBuilder.respond('/api/once');

        expect(mockBuilder.hasMock('/api/once')).toBe(false);
    });
});
